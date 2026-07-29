import { describe, expect, it } from 'vitest';
import { isoDate } from './date.js';
import { ZERO, rupees } from './money.js';
import {
  type Membership,
  type PlanSnapshot,
  checkInVerdict,
  computeExpiry,
  daysRemaining,
  deriveStatus,
  effectiveExpiry,
} from './membership.js';

const ANNUAL: PlanSnapshot = {
  planId: 'p1',
  name: 'Muscle Building · Annual',
  durationUnit: 'YEAR',
  durationCount: 1,
  price: rupees(12000),
  priceBasis: 'INCLUSIVE',
  gstRate: 18,
  branchAccess: 'HOME_ONLY',
};

function membership(over: Partial<Membership> = {}): Membership {
  return {
    id: 'm1',
    memberId: 'mem1',
    branchId: 'vidhyadhar-nagar',
    plan: ANNUAL,
    startsOn: isoDate('2026-01-01'),
    expiresOn: isoDate('2026-12-31'),
    balanceDue: ZERO,
    ...over,
  };
}

describe('computeExpiry', () => {
  it('runs a one-month plan to the day before the same date next month', () => {
    // Bought 15 Jan, valid through 14 Feb.
    expect(computeExpiry(isoDate('2026-01-15'), { durationUnit: 'MONTH', durationCount: 1 })).toBe(
      '2026-02-14',
    );
  });

  it('gives month-end joiners the whole target month', () => {
    // Clamping first and subtracting a day would give 27 Feb and quietly
    // short-change anyone who joined on the 29th, 30th or 31st.
    expect(computeExpiry(isoDate('2026-01-31'), { durationUnit: 'MONTH', durationCount: 1 })).toBe(
      '2026-02-28',
    );
    expect(computeExpiry(isoDate('2024-01-31'), { durationUnit: 'MONTH', durationCount: 1 })).toBe(
      '2024-02-29',
    );
  });

  it('handles quarters, half-years and years', () => {
    const jan1 = isoDate('2026-01-01');
    expect(computeExpiry(jan1, { durationUnit: 'MONTH', durationCount: 3 })).toBe('2026-03-31');
    expect(computeExpiry(jan1, { durationUnit: 'MONTH', durationCount: 6 })).toBe('2026-06-30');
    expect(computeExpiry(jan1, { durationUnit: 'YEAR', durationCount: 1 })).toBe('2026-12-31');
  });

  it('makes a one-day pass valid on the day it is bought', () => {
    expect(computeExpiry(isoDate('2026-07-29'), { durationUnit: 'DAY', durationCount: 1 })).toBe(
      '2026-07-29',
    );
    expect(computeExpiry(isoDate('2026-07-29'), { durationUnit: 'DAY', durationCount: 30 })).toBe(
      '2026-08-27',
    );
  });

  it('rejects nonsense durations', () => {
    expect(() => computeExpiry(isoDate('2026-01-01'), { durationUnit: 'MONTH', durationCount: 0 })).toThrow();
    expect(() => computeExpiry(isoDate('2026-01-01'), { durationUnit: 'MONTH', durationCount: 1.5 })).toThrow();
  });
});

describe('deriveStatus', () => {
  const m = membership();

  it('is active well before expiry', () => {
    expect(deriveStatus(m, isoDate('2026-06-01'))).toBe('ACTIVE');
  });

  it('turns expiring inside the 7-day window', () => {
    // Expiry is 31 Dec. On 23 Dec there are 8 days left; on 24 Dec, exactly 7.
    expect(deriveStatus(m, isoDate('2026-12-23'))).toBe('ACTIVE');
    expect(deriveStatus(m, isoDate('2026-12-24'))).toBe('EXPIRING');
    expect(deriveStatus(m, isoDate('2026-12-31'))).toBe('EXPIRING');
  });

  it('is still valid on the expiry date itself, and expired the next day', () => {
    expect(deriveStatus(m, isoDate('2026-12-31'))).not.toBe('EXPIRED');
    expect(deriveStatus(m, isoDate('2027-01-01'))).toBe('EXPIRED');
  });

  it('reports a cancellation and a running freeze', () => {
    expect(deriveStatus(membership({ cancelledOn: isoDate('2026-05-01') }), isoDate('2026-06-01'))).toBe('CANCELLED');
    expect(
      deriveStatus(membership({ freezes: [{ from: isoDate('2026-05-01') }] }), isoDate('2026-06-01')),
    ).toBe('FROZEN');
  });
});

describe('freezes', () => {
  it('push the expiry out by the days frozen', () => {
    const m = membership({
      freezes: [{ from: isoDate('2026-05-01'), to: isoDate('2026-05-10') }], // 10 days inclusive
    });
    expect(effectiveExpiry(m)).toBe('2027-01-10');
    expect(deriveStatus(m, isoDate('2027-01-05'))).toBe('EXPIRING');
  });

  it('ignores a freeze that has not ended yet', () => {
    const m = membership({ freezes: [{ from: isoDate('2026-05-01') }] });
    expect(effectiveExpiry(m)).toBe('2026-12-31');
  });
});

describe('daysRemaining', () => {
  it('is zero on the last valid day and negative once lapsed', () => {
    const m = membership();
    expect(daysRemaining(m, isoDate('2026-12-31'))).toBe(0);
    expect(daysRemaining(m, isoDate('2027-01-05'))).toBe(-5);
  });
});

describe('checkInVerdict', () => {
  const HOME = 'vidhyadhar-nagar';
  const OTHER = 'branch-2';

  it('is green for an active member at their own branch', () => {
    const v = checkInVerdict(membership(), HOME, isoDate('2026-06-01'));
    expect(v.level).toBe('GREEN');
    expect(v.allow).toBe(true);
  });

  it('is red and blocks an expired member — the leak this whole product exists to stop', () => {
    const v = checkInVerdict(membership(), HOME, isoDate('2027-01-12'));
    expect(v.level).toBe('RED');
    expect(v.code).toBe('EXPIRED');
    expect(v.allow).toBe(false);
    expect(v.action).toBe('COLLECT_PAYMENT');
    // Last valid day was 31 Dec, so on 12 Jan it lapsed 12 days ago.
    expect(v.detail).toContain('12 days ago');
    expect(v.detail).toContain('2026-12-31');
  });

  it('is red with no membership at all', () => {
    expect(checkInVerdict(undefined, HOME).level).toBe('RED');
  });

  describe('the three ambers are distinguishable', () => {
    it('expiring soon, with days left and a renewal prompt', () => {
      const v = checkInVerdict(membership(), HOME, isoDate('2026-12-28'));
      expect(v.code).toBe('EXPIRING_SOON');
      expect(v.allow).toBe(true);
      expect(v.action).toBe('OFFER_RENEWAL');
      expect(v.detail).toContain('3 days left');
    });

    it('dues pending, still allowed in, prompting for payment', () => {
      const v = checkInVerdict(membership({ balanceDue: rupees(2000) }), HOME, isoDate('2026-06-01'));
      expect(v.code).toBe('DUES_PENDING');
      expect(v.allow).toBe(true);
      expect(v.action).toBe('COLLECT_PAYMENT');
    });

    it('wrong branch, blocked pending an override', () => {
      const v = checkInVerdict(membership(), OTHER, isoDate('2026-06-01'));
      expect(v.code).toBe('WRONG_BRANCH');
      expect(v.allow).toBe(false);
      expect(v.action).toBe('OVERRIDE');
    });

    it('all three are amber but never share a code or an action', () => {
      const on = isoDate('2026-12-28');
      const codes = new Set([
        checkInVerdict(membership(), HOME, on).code,
        checkInVerdict(membership({ balanceDue: rupees(2000) }), HOME, on).code,
        checkInVerdict(membership(), OTHER, on).code,
      ]);
      expect(codes.size).toBe(3);
    });
  });

  it('lets an all-branches plan train anywhere', () => {
    const m = membership({ plan: { ...ANNUAL, branchAccess: 'ALL_BRANCHES' } });
    expect(checkInVerdict(m, OTHER, isoDate('2026-06-01')).level).toBe('GREEN');
  });

  it('shows expired rather than wrong-branch when both are true', () => {
    // Red always wins. Staff need the more serious problem, not the first one found.
    const v = checkInVerdict(membership(), OTHER, isoDate('2027-02-01'));
    expect(v.code).toBe('EXPIRED');
  });
});
