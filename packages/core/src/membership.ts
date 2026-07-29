/**
 * Memberships — expiry, status, and the check-in verdict.
 *
 * This is the module that stops the biggest revenue leak in the business:
 * expired members training for weeks because nobody at the counter could tell.
 */

import {
  type IsoDate,
  addDays,
  addMonths,
  daysBetween,
  isLastDayOfMonth,
  lastDayOfMonth,
  today as todayIn,
} from './date.js';
import type { Paise } from './money.js';
import type { PriceBasis } from './gst.js';

/** A membership is shown as expiring this many days before it lapses. */
export const EXPIRING_SOON_DAYS = 7;

export type DurationUnit = 'DAY' | 'MONTH' | 'YEAR';

/** Whether a plan is valid at one branch or everywhere. Research §10 Q10. */
export type BranchAccess = 'HOME_ONLY' | 'ALL_BRANCHES';

export interface PlanTerms {
  readonly durationUnit: DurationUnit;
  readonly durationCount: number;
}

/**
 * A plan as it was at the moment of sale.
 *
 * Snapshotted onto the membership, never referenced live — if the Admin edits
 * a plan's price next month, what 200 members already bought must not change.
 */
export interface PlanSnapshot extends PlanTerms {
  readonly planId: string;
  readonly name: string;
  readonly price: Paise;
  readonly priceBasis: PriceBasis;
  readonly gstRate: number;
  readonly branchAccess: BranchAccess;
}

export interface Freeze {
  readonly from: IsoDate;
  /** Absent while the freeze is still running. */
  readonly to?: IsoDate;
}

export interface Membership {
  readonly id: string;
  readonly memberId: string;
  readonly branchId: string;
  readonly plan: PlanSnapshot;
  readonly startsOn: IsoDate;
  /** Last day the member may train, inclusive, before any freeze extension. */
  readonly expiresOn: IsoDate;
  readonly balanceDue: Paise;
  readonly cancelledOn?: IsoDate;
  readonly freezes?: readonly Freeze[];
}

/**
 * The last day a membership is valid, inclusive.
 *
 * A one-month plan bought on 15 Jan runs through 14 Feb. Month-end starts get
 * the whole target month — 31 Jan + 1 month is 28 Feb, not 27 Feb — because
 * clamping first and then subtracting a day would quietly short-change anyone
 * who joined on the 29th, 30th or 31st.
 */
export function computeExpiry(startsOn: IsoDate, terms: PlanTerms): IsoDate {
  const { durationUnit, durationCount } = terms;

  if (!Number.isInteger(durationCount) || durationCount < 1) {
    throw new RangeError(`Duration count must be a positive whole number, received ${durationCount}.`);
  }

  if (durationUnit === 'DAY') {
    // A one-day pass bought today is valid today.
    return addDays(startsOn, durationCount - 1);
  }

  const months = durationUnit === 'YEAR' ? durationCount * 12 : durationCount;
  const shifted = addMonths(startsOn, months);

  return isLastDayOfMonth(startsOn) ? lastDayOfMonth(shifted) : addDays(shifted, -1);
}

/** Days a completed freeze added back to the membership. */
export function frozenDays(freezes: readonly Freeze[] = []): number {
  return freezes.reduce((sum, f) => (f.to ? sum + daysBetween(f.from, f.to) + 1 : sum), 0);
}

/** Expiry after freeze extensions are applied. This is the date staff should see. */
export function effectiveExpiry(m: Membership): IsoDate {
  const extra = frozenDays(m.freezes);
  return extra > 0 ? addDays(m.expiresOn, extra) : m.expiresOn;
}

export function activeFreeze(m: Membership, on: IsoDate): Freeze | undefined {
  return m.freezes?.find((f) => f.from <= on && (!f.to || f.to >= on));
}

export type MembershipStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'FROZEN' | 'CANCELLED';

export function deriveStatus(m: Membership, on: IsoDate = todayIn()): MembershipStatus {
  if (m.cancelledOn && m.cancelledOn <= on) return 'CANCELLED';
  if (activeFreeze(m, on)) return 'FROZEN';

  const expiry = effectiveExpiry(m);
  if (on > expiry) return 'EXPIRED';

  return daysBetween(on, expiry) <= EXPIRING_SOON_DAYS ? 'EXPIRING' : 'ACTIVE';
}

/** Days left, inclusive of today. Zero on the last valid day, negative once lapsed. */
export function daysRemaining(m: Membership, on: IsoDate = todayIn()): number {
  return daysBetween(on, effectiveExpiry(m));
}

// ---------------------------------------------------------------------------
// Check-in verdict — the hero screen
// ---------------------------------------------------------------------------

export type VerdictLevel = 'GREEN' | 'AMBER' | 'RED';

export type VerdictCode =
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'DUES_PENDING'
  | 'WRONG_BRANCH'
  | 'FROZEN'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'NO_MEMBERSHIP';

export interface CheckInVerdict {
  readonly level: VerdictLevel;
  readonly code: VerdictCode;
  /** The large text on the counter screen. */
  readonly headline: string;
  /** One line telling staff *why*, so amber is never ambiguous. */
  readonly detail: string;
  /** Whether the check-in should be recorded. */
  readonly allow: boolean;
  /** What the button under the verdict should do. */
  readonly action?: 'COLLECT_PAYMENT' | 'OFFER_RENEWAL' | 'RESUME_MEMBERSHIP' | 'OVERRIDE';
}

/**
 * Decide what the counter screen shows.
 *
 * Precedence is fixed and deliberate: three different situations produce amber
 * — dues, wrong branch, expiring — and staff must be able to tell them apart at
 * a glance, each with its own reason line and its own next action. An amber
 * that just says "warning" makes the person at the counter guess.
 */
export function checkInVerdict(
  m: Membership | undefined,
  atBranchId: string,
  on: IsoDate = todayIn(),
): CheckInVerdict {
  if (!m) {
    return {
      level: 'RED',
      code: 'NO_MEMBERSHIP',
      headline: 'NO ACTIVE MEMBERSHIP',
      detail: 'This member has no plan on record.',
      allow: false,
      action: 'COLLECT_PAYMENT',
    };
  }

  const status = deriveStatus(m, on);
  const expiry = effectiveExpiry(m);

  if (status === 'CANCELLED') {
    return {
      level: 'RED',
      code: 'CANCELLED',
      headline: 'CANCELLED',
      detail: `Membership was cancelled on ${m.cancelledOn}.`,
      allow: false,
      action: 'COLLECT_PAYMENT',
    };
  }

  if (status === 'EXPIRED') {
    const over = -daysRemaining(m, on);
    return {
      level: 'RED',
      code: 'EXPIRED',
      headline: 'EXPIRED',
      detail: `Expired ${over} day${over === 1 ? '' : 's'} ago, on ${expiry}.`,
      allow: false,
      action: 'COLLECT_PAYMENT',
    };
  }

  if (status === 'FROZEN') {
    return {
      level: 'AMBER',
      code: 'FROZEN',
      headline: 'PAUSED',
      detail: 'This membership is currently frozen.',
      allow: false,
      action: 'RESUME_MEMBERSHIP',
    };
  }

  if (m.plan.branchAccess === 'HOME_ONLY' && m.branchId !== atBranchId) {
    return {
      level: 'AMBER',
      code: 'WRONG_BRANCH',
      headline: 'OTHER BRANCH',
      detail: 'This plan is valid at their home branch only.',
      allow: false,
      action: 'OVERRIDE',
    };
  }

  if (m.balanceDue > 0) {
    return {
      level: 'AMBER',
      code: 'DUES_PENDING',
      headline: 'DUES PENDING',
      detail: `Balance outstanding on this membership.`,
      allow: true,
      action: 'COLLECT_PAYMENT',
    };
  }

  if (status === 'EXPIRING') {
    const left = daysRemaining(m, on);
    return {
      level: 'AMBER',
      code: 'EXPIRING_SOON',
      headline: 'EXPIRING SOON',
      detail:
        left === 0
          ? 'Last day of this membership.'
          : `${left} day${left === 1 ? '' : 's'} left, expires ${expiry}.`,
      allow: true,
      action: 'OFFER_RENEWAL',
    };
  }

  return {
    level: 'GREEN',
    code: 'ACTIVE',
    headline: 'WELCOME BACK',
    detail: `${m.plan.name} · ${daysRemaining(m, on)} days left.`,
    allow: true,
  };
}
