import { describe, expect, it } from 'vitest';
import { checkInVerdict, formatINR } from '@oan/core';
import {
  ASSETS,
  MEMBERS,
  PNL_LINES,
  TODAY,
  memberById,
  netProfit,
  pnlTotals,
} from './data';
import { assetStats, dues, memberStats } from './selectors';

/**
 * The demo data has one job: every headline figure on screen must reconcile
 * with the figures in the wireframes, and must keep reconciling as the
 * relative dates roll forward. These assertions are what stop a screen from
 * quietly drifting away from the document it was built from.
 */

describe('member roll-up', () => {
  it('matches the wireframe totals: 1,240 active, 23 expiring, 88 expired', () => {
    const all = memberStats(null);
    expect(all.active).toBe(1240);
    expect(all.expiring).toBe(23);
    expect(all.expired).toBe(88);
  });

  it('splits by branch as the roll-up screen shows', () => {
    const vn = memberStats('br-vn');
    expect([vn.active, vn.expiring, vn.expired]).toEqual([780, 14, 52]);

    const ms = memberStats('br-ms');
    expect([ms.active, ms.expiring, ms.expired]).toEqual([460, 9, 36]);
  });

  it('rolls Level 2 up into Level 1 exactly — no member is counted twice', () => {
    const all = memberStats(null);
    const vn = memberStats('br-vn');
    const ms = memberStats('br-ms');
    expect(vn.active + ms.active).toBe(all.active);
    expect(vn.total + ms.total).toBe(MEMBERS.length);
  });

  it('carries ₹86,400 of outstanding dues across the brand', () => {
    expect(formatINR(dues(null), { paise: false })).toBe('₹86,400');
  });

  it('gives every member a unique id', () => {
    // The generator once counted up through the named members' fixed ids and
    // minted duplicates, which handed one member another's balance.
    const ids = new Set(MEMBERS.map((m) => m.id));
    expect(ids.size).toBe(MEMBERS.length);
  });
});

describe('the members the wireframes name', () => {
  it('gives Rahul Sharma a green welcome — active, 214 days left', () => {
    const m = memberById('mb-1042')!;
    const v = checkInVerdict(m.membership, 'br-vn', TODAY);
    expect(v.level).toBe('GREEN');
    expect(v.headline).toBe('WELCOME BACK');
  });

  it('gives Priya Meena amber — expiring in 4 days, offer a renewal', () => {
    const m = memberById('mb-1103')!;
    const v = checkInVerdict(m.membership, 'br-vn', TODAY);
    expect(v.level).toBe('AMBER');
    expect(v.code).toBe('EXPIRING_SOON');
    expect(v.action).toBe('OFFER_RENEWAL');
    expect(v.allow).toBe(true);
  });

  it('blocks Amit Jain — expired, collect payment', () => {
    const m = memberById('mb-0987')!;
    const v = checkInVerdict(m.membership, 'br-vn', TODAY);
    expect(v.level).toBe('RED');
    expect(v.allow).toBe(false);
    expect(v.action).toBe('COLLECT_PAYMENT');
  });

  it('distinguishes the three ambers, which is the whole point of amber', () => {
    const codes = new Set(
      MEMBERS.map((m) => checkInVerdict(m.membership, 'br-vn', TODAY))
        .filter((v) => v.level === 'AMBER')
        .map((v) => v.code),
    );
    // Expiring, dues pending and wrong-branch must all be reachable in the
    // demo, each with its own reason line and its own next action.
    expect(codes.has('EXPIRING_SOON')).toBe(true);
    expect(codes.has('DUES_PENDING')).toBe(true);
    expect(codes.has('WRONG_BRANCH')).toBe(true);
  });
});

describe('equipment register', () => {
  it('is 146 units: 138 working, 4 needing service, 4 out of order', () => {
    const s = assetStats(null);
    expect(s.total).toBe(146);
    expect(s.working).toBe(138);
    expect(s.needsService).toBe(4);
    expect(s.outOfOrder).toBe(4);
  });

  it('has 11 machines past their service date', () => {
    expect(assetStats(null).serviceDue).toBe(11);
  });

  it('sums its category × branch grid back to the total', () => {
    const perBranch = assetStats('br-vn').total + assetStats('br-ms').total;
    expect(perBranch).toBe(ASSETS.length);
  });
});

describe('profit & loss', () => {
  it('nets ₹1,57,000 at Vidhyadhar Nagar and ₹7,000 at Mansarovar', () => {
    const net = netProfit();
    expect(formatINR(net.vn, { paise: false })).toBe('₹1,57,000');
    expect(formatINR(net.ms, { paise: false })).toBe('₹7,000');
    expect(formatINR(net.total, { paise: false })).toBe('₹1,64,000');
  });

  it('makes the branch comparison say something — Mansarovar keeps almost nothing', () => {
    const income = pnlTotals('income');
    const net = netProfit();
    // Collects a bit over half of V. Nagar's income, keeps ~4% of what it takes.
    expect(net.ms / income.ms).toBeLessThan(0.05);
    expect(net.vn / income.vn).toBeGreaterThan(0.3);
  });

  it('adds up: income minus direct minus indirect equals the net line', () => {
    const income = pnlTotals('income');
    const direct = pnlTotals('direct');
    const indirect = pnlTotals('indirect');
    const net = netProfit();
    expect(income.vn - direct.vn - indirect.vn).toBe(net.vn);
    expect(income.ms - direct.ms - indirect.ms).toBe(net.ms);
  });

  it('posts every P&L line to a real account code', () => {
    for (const line of PNL_LINES) {
      expect(line.accountCode).toMatch(/^\d{4}$/);
    }
  });
});
