import { describe, expect, it } from 'vitest';
import {
  type Actor,
  allowed,
  can,
  discountWithinCap,
  ROLE_PERMISSIONS,
  visibleBranches,
} from './rbac.js';

const HOME = 'vidhyadhar-nagar';
const OTHER = 'branch-2';

const admin: Actor = { userId: 'u-admin', role: 'ADMIN', branchIds: [] };
const manager: Actor = { userId: 'u-mgr', role: 'BRANCH_MANAGER', branchIds: [HOME] };
const frontDesk: Actor = { userId: 'u-fd', role: 'FRONT_DESK', branchIds: [HOME] };
const coach: Actor = {
  userId: 'u-coach',
  role: 'COACH',
  branchIds: [HOME],
  assignedMemberIds: ['mem1', 'mem2'],
};
const member: Actor = { userId: 'u-mem', role: 'MEMBER', branchIds: [HOME], memberId: 'mem1' };

describe('the rows that cost money when they are wrong', () => {
  it('front desk can never see revenue or the P&L', () => {
    expect(allowed(frontDesk, 'report.revenue', { branchId: HOME })).toBe(false);
    expect(allowed(frontDesk, 'report.pnl', { branchId: HOME })).toBe(false);
    expect(allowed(frontDesk, 'ledger.view', { branchId: HOME })).toBe(false);
  });

  it('front desk can never extend an expiry — that is giving away inventory', () => {
    expect(allowed(frontDesk, 'membership.extend_expiry', { branchId: HOME })).toBe(false);
    // But assigning a paid plan is routine work.
    expect(allowed(frontDesk, 'membership.assign', { branchId: HOME })).toBe(true);
  });

  it('front desk can never reverse a payment', () => {
    expect(allowed(frontDesk, 'payment.reverse', { branchId: HOME })).toBe(false);
    expect(allowed(manager, 'payment.reverse', { branchId: HOME })).toBe(false);
    expect(allowed(admin, 'payment.reverse')).toBe(true);
  });

  it('marks reversal as elevated, so it lands in the audit log', () => {
    expect(can(admin, 'payment.reverse').elevated).toBe(true);
    expect(can(admin, 'membership.extend_expiry').elevated).toBe(true);
  });
});

describe('scope, not strength', () => {
  it('gives a manager the same P&L permission as an Admin, narrower', () => {
    expect(can(admin, 'report.pnl').scope).toBe('all');
    expect(can(manager, 'report.pnl', { branchId: HOME }).scope).toBe('branch');
  });

  it('stops a manager reading another branch', () => {
    expect(allowed(manager, 'report.pnl', { branchId: HOME })).toBe(true);
    expect(allowed(manager, 'report.pnl', { branchId: OTHER })).toBe(false);
    expect(allowed(manager, 'member.view', { branchId: OTHER })).toBe(false);
  });

  it('lets an Admin reach every branch', () => {
    expect(allowed(admin, 'member.view', { branchId: OTHER })).toBe(true);
    expect(visibleBranches(admin, 'report.pnl')).toBeNull(); // null means all
    expect(visibleBranches(manager, 'report.pnl')).toEqual([HOME]);
    expect(visibleBranches(frontDesk, 'report.pnl')).toEqual([]);
  });
});

describe('coach', () => {
  it('touches no money at all — the point of the role', () => {
    expect(allowed(coach, 'payment.collect', { branchId: HOME })).toBe(false);
    expect(allowed(coach, 'payment.discount', { branchId: HOME })).toBe(false);
    expect(allowed(coach, 'invoice.view', { branchId: HOME })).toBe(false);
    expect(allowed(coach, 'report.revenue', { branchId: HOME })).toBe(false);
  });

  it('reaches assigned clients and nobody else', () => {
    expect(allowed(coach, 'workout.log_session', { memberId: 'mem1' })).toBe(true);
    expect(allowed(coach, 'workout.log_session', { memberId: 'mem9' })).toBe(false);
    expect(allowed(coach, 'measurement.record', { memberId: 'mem2' })).toBe(true);
  });
});

describe('member', () => {
  it('reaches only their own record', () => {
    expect(allowed(member, 'member.view', { memberId: 'mem1' })).toBe(true);
    expect(allowed(member, 'member.view', { memberId: 'mem2' })).toBe(false);
  });

  it('cannot see anyone else, edit plans, or reach the books', () => {
    expect(allowed(member, 'plan.manage')).toBe(false);
    expect(allowed(member, 'report.pnl')).toBe(false);
    expect(allowed(member, 'staff.manage')).toBe(false);
  });
});

describe('health data', () => {
  it('is withheld from the counter but available to the coach and the member', () => {
    expect(allowed(frontDesk, 'health.view', { branchId: HOME })).toBe(false);
    expect(allowed(coach, 'health.view', { memberId: 'mem1' })).toBe(true);
    expect(allowed(member, 'health.view', { memberId: 'mem1' })).toBe(true);
    expect(allowed(manager, 'health.view', { branchId: HOME })).toBe(true);
  });
});

describe('accountant', () => {
  const accountant: Actor = { userId: 'u-ca', role: 'ACCOUNTANT', branchIds: [] };

  it('reads the books but cannot take money or touch members', () => {
    expect(allowed(accountant, 'report.balance_sheet')).toBe(true);
    expect(allowed(accountant, 'report.gst_export')).toBe(true);
    expect(allowed(accountant, 'payment.collect')).toBe(false);
    expect(allowed(accountant, 'member.edit')).toBe(false);
  });
});

describe('discount caps', () => {
  it('lets front desk discount up to their ceiling, then requires approval', () => {
    expect(discountWithinCap(frontDesk, 5, { branchId: HOME })).toMatchObject({
      ok: true,
      capPercent: 10,
      needsApproval: false,
    });
    expect(discountWithinCap(frontDesk, 25, { branchId: HOME })).toMatchObject({
      ok: false,
      needsApproval: true,
    });
  });

  it('raises the ceiling for a manager and removes it for an Admin', () => {
    expect(discountWithinCap(manager, 20, { branchId: HOME }).ok).toBe(true);
    expect(discountWithinCap(manager, 40, { branchId: HOME }).needsApproval).toBe(true);
    expect(discountWithinCap(admin, 100).ok).toBe(true);
  });

  it('gives a coach no discount authority whatsoever', () => {
    expect(discountWithinCap(coach, 1, { branchId: HOME })).toMatchObject({
      ok: false,
      capPercent: 0,
    });
  });
});

describe('deny by default', () => {
  it('refuses anything not explicitly granted', () => {
    expect(allowed(frontDesk, 'branch.manage')).toBe(false);
    expect(allowed(coach, 'settings.gym')).toBe(false);
    expect(can(frontDesk, 'journal.manual').reason).toContain('no grant');
  });

  it('only ever grants Admin the brand-wide settings', () => {
    const brandWide = ['plan.manage', 'branch.manage', 'settings.gym', 'exercise_food.manage'] as const;
    for (const p of brandWide) {
      for (const role of ['BRANCH_MANAGER', 'FRONT_DESK', 'COACH', 'MEMBER', 'ACCOUNTANT'] as const) {
        expect(ROLE_PERMISSIONS[role][p], `${role} must not have ${p}`).toBeUndefined();
      }
      expect(ROLE_PERMISSIONS.ADMIN[p]).toBeDefined();
    }
  });
});
