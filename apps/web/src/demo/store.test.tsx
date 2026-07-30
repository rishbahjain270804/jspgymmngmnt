// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { rupees } from '@oan/core';
import { DemoStoreProvider, useDemo } from './store';
import { MEMBERS, TODAY } from './data';

/**
 * The demo has to survive a walkthrough.
 *
 * Before the store existed, every screen kept its own copy of the fixtures:
 * you could collect ₹4,000, walk back to the member, and still see ₹4,000
 * outstanding. These tests pin the behaviour that makes the demo believable —
 * an action changes the world, and the world is the same world everywhere.
 */

let container: HTMLDivElement;
let root: Root;
let api: ReturnType<typeof useDemo>;

function Probe() {
  api = useDemo();
  return null;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  sessionStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <DemoStoreProvider>
        <Probe />
      </DemoStoreProvider>,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const withDues = () => api.members.find((m) => m.membership.balanceDue > 0)!;
/** Someone not already in today's seeded log, or the dedup rule refuses. */
const notYetIn = () => api.members.find((m) => !api.hasCheckedInToday(m.id, m.branchId))!;

describe('check-in', () => {
  it('records a visit that is still there afterwards', () => {
    const m = notYetIn();
    const before = api.checkIns.length;

    act(() => {
      api.recordCheckIn({ member: m, branchId: m.branchId, level: 'GREEN', code: 'ACTIVE' });
    });

    expect(api.checkIns.length).toBe(before + 1);
    expect(api.checkIns[0]!.member.id).toBe(m.id);
    expect(api.checkIns[0]!.date).toBe(TODAY);
    expect(api.hasCheckedInToday(m.id, m.branchId)).toBe(true);
  });

  it('refuses a second scan the same day at the same branch', () => {
    const m = notYetIn();
    act(() => {
      api.recordCheckIn({ member: m, branchId: m.branchId, level: 'GREEN', code: 'ACTIVE' });
    });
    const after = api.checkIns.length;

    act(() => {
      api.recordCheckIn({ member: m, branchId: m.branchId, level: 'GREEN', code: 'ACTIVE' });
    });

    // Same rule as the unique index in 0001_foundation.sql: a double scan at
    // the 6:30 rush must not become double footfall.
    expect(api.checkIns.length).toBe(after);
  });

  it('adds today to the member’s visit history', () => {
    const m = api.members.find((x) => x.visits[0] !== TODAY)!;
    act(() => {
      api.recordCheckIn({ member: m, branchId: m.branchId, level: 'GREEN', code: 'ACTIVE' });
    });
    expect(api.members.find((x) => x.id === m.id)!.visits[0]).toBe(TODAY);
  });
});

describe('collecting a payment', () => {
  it('reduces the outstanding balance — the moment the old demo got wrong', () => {
    const m = withDues();
    const owed = m.membership.balanceDue;

    act(() => {
      api.collect({
        memberId: m.id,
        total: owed,
        received: owed,
        mode: 'UPI',
        planName: m.membership.plan.name,
      });
    });

    expect(api.members.find((x) => x.id === m.id)!.membership.balanceDue).toBe(0);
  });

  it('handles a part payment by leaving the remainder outstanding', () => {
    const m = withDues();
    const owed = m.membership.balanceDue;
    const part = rupees(Math.floor(owed / 200)); // roughly half, in whole rupees

    act(() => {
      api.collect({
        memberId: m.id,
        total: owed,
        received: part,
        mode: 'CASH',
        planName: m.membership.plan.name,
      });
    });

    const after = api.members.find((x) => x.id === m.id)!;
    expect(after.membership.balanceDue).toBe(owed - part);
    expect(after.membership.balanceDue).toBeGreaterThan(0);
  });

  it('adds the invoice to the member’s history', () => {
    const m = api.members[0]!;
    const before = api.invoices.filter((i) => i.memberId === m.id).length;

    act(() => {
      api.collect({
        memberId: m.id,
        total: rupees(12000),
        received: rupees(8000),
        mode: 'CASH',
        planName: 'Annual',
      });
    });

    const mine = api.invoices.filter((i) => i.memberId === m.id);
    expect(mine.length).toBe(before + 1);
    expect(mine[0]!.received).toBe(rupees(8000));
    expect(mine[0]!.balance).toBe(rupees(4000));
    expect(mine[0]!.date).toBe(TODAY);
  });

  it('credits what was taken to paid-to-date', () => {
    const m = api.members[0]!;
    const before = m.paidToDate;
    act(() => {
      api.collect({
        memberId: m.id,
        total: rupees(5000),
        received: rupees(5000),
        mode: 'UPI',
        planName: 'Quarterly',
      });
    });
    expect(api.members.find((x) => x.id === m.id)!.paidToDate).toBe(before + rupees(5000));
  });

  it('restarts the membership from today when the payment is a renewal', () => {
    const expired = api.members.find((m) => m.membership.expiresOn < TODAY)!;

    act(() => {
      api.collect({
        memberId: expired.id,
        total: rupees(12000),
        received: rupees(12000),
        mode: 'UPI',
        planName: 'Annual',
        renewal: { planId: 'pl-annual', durationUnit: 'YEAR', durationCount: 1 },
      });
    });

    const after = api.members.find((m) => m.id === expired.id)!;
    expect(after.membership.startsOn).toBe(TODAY);
    // An expired member who pays is active again, which is the whole point of
    // the red verdict on the counter screen.
    expect(after.membership.expiresOn > TODAY).toBe(true);
  });
});

describe('equipment', () => {
  it('takes a machine out of service and dates it', () => {
    const a = api.assets.find((x) => x.condition === 'WORKING')!;
    act(() => api.reportFault(a.id, 'Belt slipping'));

    const after = api.assets.find((x) => x.id === a.id)!;
    expect(after.condition).toBe('OUT_OF_ORDER');
    expect(after.downSince).toBe(TODAY);
    expect(after.fault).toBe('Belt slipping');
  });
});

describe('reset', () => {
  it('puts the world back for the next person you show it to', () => {
    const m = withDues();
    const owed = m.membership.balanceDue;

    act(() => {
      api.collect({ memberId: m.id, total: owed, received: owed, mode: 'UPI', planName: 'x' });
      api.recordCheckIn({ member: m, branchId: m.branchId, level: 'GREEN', code: 'ACTIVE' });
    });
    expect(api.touched).toBe(true);

    act(() => api.reset());

    expect(api.touched).toBe(false);
    expect(api.members.find((x) => x.id === m.id)!.membership.balanceDue).toBe(owed);
    expect(api.members.length).toBe(MEMBERS.length);
  });
});

describe('persistence', () => {
  it('survives a refresh mid-demo', () => {
    const m = notYetIn();
    act(() => {
      api.recordCheckIn({ member: m, branchId: m.branchId, level: 'GREEN', code: 'ACTIVE' });
    });
    const count = api.checkIns.length;

    // Tear down and mount again, exactly as a browser refresh would.
    act(() => root.unmount());
    root = createRoot(container);
    act(() => {
      root.render(
        <DemoStoreProvider>
          <Probe />
        </DemoStoreProvider>,
      );
    });

    expect(api.checkIns.length).toBe(count);
    expect(api.hasCheckedInToday(m.id, m.branchId)).toBe(true);
  });
});
