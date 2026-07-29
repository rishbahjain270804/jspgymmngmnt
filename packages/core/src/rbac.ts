/**
 * Access control — role × scope.
 *
 * Plain RBAC isn't enough here, because "can view revenue" means something
 * different for an Admin and a branch manager. A branch manager doesn't get a
 * *weaker* permission than an Admin; they get the **same permission at a
 * narrower scope**. That keeps this list short and makes multi-branch fall out
 * of the model instead of being bolted on.
 *
 * In a gym this is a cash-handling control before it is a security control.
 * The rows that cost money when they're wrong: `report.revenue`,
 * `payment.discount`, `membership.extend_expiry`.
 */

export type Role = 'ADMIN' | 'BRANCH_MANAGER' | 'FRONT_DESK' | 'COACH' | 'MEMBER' | 'ACCOUNTANT';

/** How wide a permission reaches. */
export type Scope = 'all' | 'branch' | 'assigned' | 'self';

export type Permission =
  // members
  | 'member.view'
  | 'member.create'
  | 'member.edit'
  | 'member.delete'
  | 'health.view'
  // attendance
  | 'checkin.record'
  | 'checkin.view'
  // plans & memberships
  | 'plan.view'
  | 'plan.manage'
  | 'membership.assign'
  | 'membership.extend_expiry'
  | 'membership.freeze'
  // money
  | 'payment.collect'
  | 'payment.discount'
  | 'payment.reverse'
  | 'invoice.view'
  | 'expense.record'
  | 'ledger.view'
  | 'journal.manual'
  | 'vendor.manage'
  | 'accounts.close_period'
  // reports
  | 'report.revenue'
  | 'report.pnl'
  | 'report.balance_sheet'
  | 'report.attendance'
  | 'report.gst_export'
  // equipment
  | 'equipment.view'
  | 'equipment.manage'
  | 'equipment.transfer'
  // training
  | 'assessment.record'
  | 'measurement.record'
  | 'workout.assign'
  | 'workout.log_session'
  | 'diet.assign'
  | 'exercise_food.manage'
  | 'report.progress.generate'
  | 'photo.view'
  // staff & admin
  | 'staff.manage'
  | 'coach.assign_client'
  | 'branch.manage'
  | 'settings.gym'
  | 'audit_log.view';

export interface Grant {
  readonly scope: Scope;
  /**
   * Needs a second factor — a manager's PIN, or an approval request.
   * Everything marked here is also written to the audit log.
   */
  readonly elevated?: boolean;
  /** Ceiling as a percentage, used by `payment.discount`. */
  readonly capPercent?: number;
}

type Matrix = Readonly<Partial<Record<Permission, Grant>>>;

const ALL: Grant = { scope: 'all' };
const BRANCH: Grant = { scope: 'branch' };
const ASSIGNED: Grant = { scope: 'assigned' };
const SELF: Grant = { scope: 'self' };

const ADMIN: Matrix = {
  'member.view': ALL, 'member.create': ALL, 'member.edit': ALL,
  'member.delete': { scope: 'all', elevated: true },
  'health.view': ALL,
  'checkin.record': ALL, 'checkin.view': ALL,
  'plan.view': ALL, 'plan.manage': ALL,
  'membership.assign': ALL,
  'membership.extend_expiry': { scope: 'all', elevated: true },
  'membership.freeze': ALL,
  'payment.collect': ALL,
  'payment.discount': { scope: 'all', capPercent: 100 },
  'payment.reverse': { scope: 'all', elevated: true },
  'invoice.view': ALL,
  'expense.record': ALL,
  'ledger.view': ALL,
  'journal.manual': { scope: 'all', elevated: true },
  'vendor.manage': ALL,
  'accounts.close_period': { scope: 'all', elevated: true },
  'report.revenue': ALL, 'report.pnl': ALL, 'report.balance_sheet': ALL,
  'report.attendance': ALL, 'report.gst_export': ALL,
  'equipment.view': ALL, 'equipment.manage': ALL,
  'equipment.transfer': { scope: 'all', elevated: true },
  'assessment.record': ALL, 'measurement.record': ALL,
  'workout.assign': ALL, 'workout.log_session': ALL, 'diet.assign': ALL,
  'exercise_food.manage': ALL,
  'report.progress.generate': ALL,
  'photo.view': { scope: 'all', elevated: true },
  'staff.manage': ALL, 'coach.assign_client': ALL,
  'branch.manage': ALL, 'settings.gym': ALL, 'audit_log.view': ALL,
};

const BRANCH_MANAGER: Matrix = {
  'member.view': BRANCH, 'member.create': BRANCH, 'member.edit': BRANCH,
  'health.view': BRANCH,
  'checkin.record': BRANCH, 'checkin.view': BRANCH,
  'plan.view': BRANCH,
  'membership.assign': BRANCH,
  'membership.extend_expiry': { scope: 'branch', elevated: true },
  'membership.freeze': BRANCH,
  'payment.collect': BRANCH,
  'payment.discount': { scope: 'branch', capPercent: 25 },
  'invoice.view': BRANCH,
  'expense.record': BRANCH,
  'ledger.view': BRANCH,
  // Their own branch's P&L — never another branch's, and no balance sheet.
  'report.revenue': BRANCH, 'report.pnl': BRANCH, 'report.attendance': BRANCH,
  'equipment.view': BRANCH, 'equipment.manage': BRANCH,
  'assessment.record': BRANCH, 'measurement.record': BRANCH,
  'workout.assign': BRANCH, 'workout.log_session': BRANCH, 'diet.assign': BRANCH,
  'report.progress.generate': BRANCH,
  'photo.view': { scope: 'branch', elevated: true },
  'coach.assign_client': BRANCH,
  'audit_log.view': BRANCH,
};

const FRONT_DESK: Matrix = {
  'member.view': BRANCH, 'member.create': BRANCH, 'member.edit': BRANCH,
  // Deliberately absent: health.view. Medical conditions and body-fat numbers
  // are not counter-desk data.
  'checkin.record': BRANCH, 'checkin.view': BRANCH,
  'plan.view': BRANCH,
  'membership.assign': BRANCH,
  // Deliberately absent: membership.extend_expiry. Assigning a paid plan is
  // routine; pushing an expiry date forward is giving away inventory.
  'payment.collect': BRANCH,
  'payment.discount': { scope: 'branch', capPercent: 10, elevated: true },
  'invoice.view': BRANCH,
  // Deliberately absent: report.revenue, report.pnl, ledger.view.
  'report.attendance': BRANCH,
  'equipment.view': BRANCH,
  'report.progress.generate': BRANCH,
};

const COACH: Matrix = {
  'member.view': ASSIGNED,
  'health.view': ASSIGNED,
  'checkin.record': ASSIGNED, 'checkin.view': ASSIGNED,
  'report.attendance': ASSIGNED,
  'equipment.view': BRANCH,
  'assessment.record': ASSIGNED, 'measurement.record': ASSIGNED,
  'workout.assign': ASSIGNED, 'workout.log_session': ASSIGNED, 'diet.assign': ASSIGNED,
  'report.progress.generate': ASSIGNED,
  'photo.view': { scope: 'assigned', elevated: true },
  // A coach touches no money at all. That is the point of the role.
};

const MEMBER: Matrix = {
  'member.view': SELF,
  'health.view': SELF,
  'checkin.record': SELF, 'checkin.view': SELF,
  'plan.view': SELF,
  'payment.collect': SELF,
  'invoice.view': SELF,
  'report.attendance': SELF,
  'report.progress.generate': SELF,
  'photo.view': SELF,
  'workout.log_session': SELF,
};

const ACCOUNTANT: Matrix = {
  'invoice.view': ALL,
  'ledger.view': ALL,
  'report.revenue': ALL, 'report.pnl': ALL, 'report.balance_sheet': ALL,
  'report.gst_export': ALL,
  'vendor.manage': ALL,
  'audit_log.view': ALL,
  // Read-only on money. Cannot take payments or touch members.
};

export const ROLE_PERMISSIONS: Readonly<Record<Role, Matrix>> = {
  ADMIN,
  BRANCH_MANAGER,
  FRONT_DESK,
  COACH,
  MEMBER,
  ACCOUNTANT,
};

export interface Actor {
  readonly userId: string;
  readonly role: Role;
  /** Branches this user is posted to. Empty for ADMIN, who reaches all. */
  readonly branchIds: readonly string[];
  /** For COACH — the members assigned to them. */
  readonly assignedMemberIds?: readonly string[];
  /** For MEMBER — their own member record. */
  readonly memberId?: string;
}

/** What is being acted on. Omit fields that don't apply. */
export interface Target {
  readonly branchId?: string;
  readonly memberId?: string;
}

export interface Decision {
  readonly allowed: boolean;
  readonly scope?: Scope;
  readonly elevated: boolean;
  readonly capPercent?: number;
  /** Why it was refused. Safe to log; not written for the user to read. */
  readonly reason?: string;
}

const DENY = (reason: string): Decision => ({ allowed: false, elevated: false, reason });

/**
 * The single authority on access, shared by api, web, desktop and mobile.
 *
 * The UI uses it to hide what the server would refuse, so the two can never
 * disagree — but the server must still call it on every request. Hiding a
 * button is UX, not access control.
 */
export function can(actor: Actor, permission: Permission, target: Target = {}): Decision {
  const grant = ROLE_PERMISSIONS[actor.role]?.[permission];
  if (!grant) return DENY(`Role ${actor.role} has no grant for ${permission}.`);

  const base = {
    allowed: true as const,
    scope: grant.scope,
    elevated: grant.elevated ?? false,
    ...(grant.capPercent !== undefined ? { capPercent: grant.capPercent } : {}),
  };

  switch (grant.scope) {
    case 'all':
      return base;

    case 'branch': {
      if (!target.branchId) return base; // listing across the user's own branches
      return actor.branchIds.includes(target.branchId)
        ? base
        : DENY(`${actor.role} is not posted to branch ${target.branchId}.`);
    }

    case 'assigned': {
      if (!target.memberId) return base;
      return actor.assignedMemberIds?.includes(target.memberId)
        ? base
        : DENY(`Member ${target.memberId} is not assigned to ${actor.userId}.`);
    }

    case 'self': {
      if (!target.memberId) return base;
      return actor.memberId === target.memberId
        ? base
        : DENY(`${actor.userId} may only act on their own record.`);
    }
  }
}

/** Convenience for call sites that only need a boolean. */
export function allowed(actor: Actor, permission: Permission, target: Target = {}): boolean {
  return can(actor, permission, target).allowed;
}

/**
 * Whether a discount is within the actor's ceiling.
 * Above it, the sale still happens — it just becomes an approval request
 * rather than a silent giveaway.
 */
export function discountWithinCap(
  actor: Actor,
  percent: number,
  target: Target = {},
): { ok: boolean; capPercent: number; needsApproval: boolean } {
  const d = can(actor, 'payment.discount', target);
  const capPercent = d.allowed ? (d.capPercent ?? 0) : 0;
  return { ok: d.allowed && percent <= capPercent, capPercent, needsApproval: percent > capPercent };
}

/** Branch ids this actor may read for a permission. `null` means all branches. */
export function visibleBranches(actor: Actor, permission: Permission): readonly string[] | null {
  const d = can(actor, permission);
  if (!d.allowed) return [];
  return d.scope === 'all' ? null : actor.branchIds;
}
