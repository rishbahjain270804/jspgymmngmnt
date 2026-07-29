import type { Role } from '@oan/core';
import type { IconName } from '../ui/Icon';

/**
 * Navigation, per role.
 *
 * Straight from the doc's nav table (§13 / wireframes §04). Admin sees six
 * items, manager five, front desk three, coach two — and the counts are the
 * point: "if a screen has more than seven things on it, it's the wrong
 * screen… and the count that matters is per role."
 *
 * Nav is filtered by omission, never disabled. A front-desk user has no
 * greyed-out Accounts item to wonder about; for them it does not exist.
 * Check-in is deliberately absent from the Admin sidebar — it's a counter
 * job, reachable from ⌘K when an owner wants to look at it.
 */

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Shown in the mobile tab bar. At most four; the rest go under "More". */
  mobile?: boolean;
  end?: boolean;
}

export const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', mobile: true },
    { to: '/members', label: 'Members', icon: 'members', mobile: true },
    { to: '/equipment', label: 'Equipment', icon: 'equipment' },
    { to: '/staff', label: 'Staff', icon: 'staff' },
    { to: '/branches', label: 'Branches', icon: 'branches' },
    { to: '/accounts', label: 'Accounts', icon: 'accounts', mobile: true },
  ],
  BRANCH_MANAGER: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', mobile: true },
    { to: '/members', label: 'Members', icon: 'members', mobile: true },
    { to: '/equipment', label: 'Equipment', icon: 'equipment' },
    { to: '/staff', label: 'Staff', icon: 'staff' },
    { to: '/accounts', label: 'Accounts', icon: 'accounts', mobile: true },
  ],
  FRONT_DESK: [
    { to: '/checkin', label: 'Check-in', icon: 'checkin', mobile: true },
    { to: '/members', label: 'Members', icon: 'members', mobile: true },
    { to: '/collect', label: 'Collect', icon: 'collect', mobile: true },
  ],
  COACH: [
    { to: '/coach', label: 'Today', icon: 'activity', mobile: true, end: true },
    { to: '/coach/clients', label: 'Clients', icon: 'members', mobile: true },
  ],
  ACCOUNTANT: [
    { to: '/accounts', label: 'Accounts', icon: 'accounts', mobile: true },
    { to: '/audit', label: 'Audit log', icon: 'book', mobile: true },
  ],
  MEMBER: [
    { to: '/app/member', label: 'Me', icon: 'user', mobile: true, end: true },
    { to: '/app/member/progress', label: 'Progress', icon: 'activity', mobile: true },
    { to: '/app/member/plan', label: 'Plan', icon: 'receipt', mobile: true },
    { to: '/app/member/pay', label: 'Pay', icon: 'wallet', mobile: true },
  ],
};

/** Where each role lands after signing in. Scope decides the entry point. */
export const HOME: Record<Role, string> = {
  ADMIN: '/dashboard',
  BRANCH_MANAGER: '/dashboard',
  FRONT_DESK: '/checkin',
  COACH: '/coach',
  ACCOUNTANT: '/accounts',
  MEMBER: '/app/member',
};
