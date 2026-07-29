/**
 * The decision engine.
 *
 * Every recommendation here is arithmetic over records that already exist in
 * the app, and every one carries the steps that produced its figure. Nothing
 * is modelled, scored or predicted.
 *
 * That constraint is deliberate (§18). A churn probability computed from
 * seeded history is a number with no source, and an owner who has run this
 * floor for ten years will ask where it came from. "23 memberships lapse this
 * week, here they are, they are worth ₹1,04,400 at the prices those members
 * are already paying" survives that question, because every clause in it is a
 * row someone can go and look at.
 *
 * So the engine ranks by rupees at stake, and shows its working.
 */

import { type Paise, daysBetween, formatINR, paise } from '@oan/core';
import { BRANCHES, TODAY } from './data';
import {
  absentMembers,
  assetsIn,
  dues,
  expiringSoon,
  membersIn,
  membersWithDues,
  outOfOrder,
} from './selectors';
import type { Member } from './types';

/* ------------------------------- Shape -------------------------------- */

/**
 * One line of the working.
 *
 * `value` arrives formatted because the arithmetic and its presentation must
 * not drift apart — a step that says "₹1,04,400" is the same number the
 * headline claims, not a second rounding of it.
 */
export interface DerivationStep {
  readonly label: string;
  readonly value: string;
  /** Which records the step counted, so the figure can be audited. */
  readonly source: string;
}

/**
 * Whether the figure is money to be brought in or money being lost.
 *
 * Without this the ranking quietly implies ₹50,000 of renewals and ₹50,000 of
 * idle capital are the same thing to a business. They are not, and conflating
 * them is exactly the sort of tell that costs a demo its credibility.
 */
export type Direction = 'INFLOW' | 'COST';

export type RecommendationKind = 'RENEWAL' | 'DUES' | 'ABSENCE' | 'DOWNTIME';

export interface Recommendation {
  readonly id: RecommendationKind;
  readonly tone: 'warn' | 'bad' | 'neutral';
  readonly direction: Direction;
  /** What is true, in the owner's words. */
  readonly title: string;
  /** What to do about it — one imperative, matching the screen it opens. */
  readonly action: string;
  readonly href: string;
  /** Rupees at stake, in paise. */
  readonly amount: Paise;
  /** How many real records the figure is computed over. */
  readonly records: number;
  readonly derivation: readonly DerivationStep[];
  /**
   * Stated where the arithmetic needed an input the data does not contain.
   * An assumption an owner can argue with is honest; a hidden one is not.
   */
  readonly assumption?: string;
}

const money = (n: number): string => formatINR(paise(Math.round(n)), { paise: false });
const count = (n: number): string => n.toLocaleString('en-IN');
const days = (n: number): string => `${count(n)} day${n === 1 ? '' : 's'}`;

/** Days a membership runs, inclusive of both ends. */
const termDays = (m: Member): number =>
  daysBetween(m.membership.startsOn, m.membership.expiresOn) + 1;

/**
 * Revenue the branch earns per day, from memberships it currently holds.
 *
 * Each running membership recognises its price evenly across its term — the
 * same accrual the P&L uses (§14). Summed, that is what a day of trading is
 * worth here, computed rather than assumed.
 */
function earnedPerDay(branchId?: string | null): number {
  return membersIn(branchId).reduce((s, m) => {
    const term = termDays(m);
    if (term <= 0 || daysBetween(TODAY, m.membership.expiresOn) < 0) return s;
    return s + m.membership.plan.price / term;
  }, 0);
}

/* ---------------------------- The signals ----------------------------- */

/**
 * Renewals falling due inside the expiry window.
 *
 * Valued at what each member is already paying, not at list price — the
 * quarterly member who renews quarterly is worth their own plan, and averaging
 * the catalogue would overstate the week by whatever the annual plans skew.
 */
function renewals(branchId?: string | null): Recommendation | null {
  const due = expiringSoon(branchId, 7);
  if (due.length === 0) return null;

  const value = due.reduce((s, m) => s + m.membership.plan.price, 0);
  const soonest = due[0]!;

  return {
    id: 'RENEWAL',
    tone: 'warn',
    direction: 'INFLOW',
    title: `${count(due.length)} memberships lapse within 7 days`,
    action: 'Call the renewal list',
    href: '/members',
    amount: paise(value),
    records: due.length,
    derivation: [
      {
        label: 'Memberships with an effective expiry inside 7 days',
        value: count(due.length),
        source: 'Members · expiry after freeze extensions',
      },
      {
        label: 'Summed at each member’s current plan price',
        value: money(value),
        source: 'Plan snapshot on each membership, GST inclusive',
      },
      {
        label: 'Average renewal',
        value: money(value / due.length),
        source: `${money(value)} ÷ ${due.length}`,
      },
      {
        label: 'Soonest to lapse',
        value: `${soonest.name} · ${days(daysBetween(TODAY, soonest.membership.expiresOn))}`,
        source: `Member ${soonest.code}`,
      },
    ],
  };
}

/** Part payments already invoiced and still uncollected. A straight sum. */
function receivables(branchId?: string | null): Recommendation | null {
  const owing = membersWithDues(branchId);
  if (owing.length === 0) return null;

  const total = dues(branchId);
  const largest = owing[0]!;

  return {
    id: 'DUES',
    tone: 'bad',
    direction: 'INFLOW',
    title: `${count(owing.length)} members carrying a balance`,
    action: 'Open receivables',
    href: '/accounts/receivables',
    amount: total,
    records: owing.length,
    derivation: [
      {
        label: 'Memberships with a balance outstanding',
        value: count(owing.length),
        source: 'Members · balance due on membership',
      },
      {
        label: 'Sum of those balances',
        value: money(total),
        source: 'Already invoiced, not yet received',
      },
      {
        label: 'Largest single balance',
        value: money(largest.membership.balanceDue),
        source: `${largest.name} · ${largest.code}`,
      },
    ],
  };
}

/**
 * Members who have stopped coming while their plan is still running.
 *
 * Valued as the unearned portion of what they have already paid — price times
 * the share of the term still ahead of them. That figure is deferred revenue
 * in the accounting sense (§14): it is on the books, it has not been earned,
 * and if they do not come back it is the amount that leaves with them.
 *
 * This is the closest honest thing to a churn number. It says what is at
 * stake, and declines to say how likely losing it is.
 */
function absence(branchId?: string | null): Recommendation | null {
  const quiet = absentMembers(branchId, 14);
  if (quiet.length === 0) return null;

  let unearned = 0;
  let daysLeft = 0;

  for (const m of quiet) {
    const term = termDays(m);
    const left = daysBetween(TODAY, m.membership.expiresOn);
    if (term <= 0 || left <= 0) continue;
    daysLeft += left;
    unearned += m.membership.plan.price * (left / term);
  }

  const longest = quiet[0]!;
  const since = longest.visits[0];

  return {
    id: 'ABSENCE',
    tone: 'neutral',
    direction: 'COST',
    title: `${count(quiet.length)} members absent 14 days or more`,
    action: 'Open the coach worklist',
    href: '/coach/clients',
    amount: paise(Math.round(unearned)),
    records: quiet.length,
    derivation: [
      {
        label: 'Members with a running plan and no visit in 14 days',
        value: count(quiet.length),
        source: 'Members · most recent visit',
      },
      {
        label: 'Plan days still unexpired across them',
        value: days(daysLeft),
        source: 'Today to expiry, per membership',
      },
      {
        label: 'Unearned value of those days',
        value: money(unearned),
        source: 'plan price × days left ÷ plan length, summed',
      },
      {
        label: 'Quietest',
        value: since ? `${longest.name} · ${days(daysBetween(since, TODAY))}` : longest.name,
        source: since ? `Last visit ${since}` : 'No visit on record',
      },
    ],
  };
}

/**
 * Machines out of order, valued as the service the branch was paid for and
 * did not deliver.
 *
 * Members pay for a floor, not for one machine, so a day with 4 of 146 units
 * dead is a day where 2.7% of what they bought was not there. Multiply the
 * branch's daily earned revenue by that share, across the days each machine
 * has been down.
 *
 * The earlier version of this valued the idle *capital* instead — purchase
 * cost amortised over the days down. That was arithmetic too, and it was the
 * wrong quantity: it answered "what is this machine worth sitting still",
 * which no owner asks, and produced a figure small enough to make the whole
 * screen look unserious. What is lost is the training, not the asset.
 */
const machineDaysDown = (branchId?: string | null): number =>
  outOfOrder(branchId).reduce((s, a) => s + (a.downSince ? daysBetween(a.downSince, TODAY) : 0), 0);

/**
 * One branch's downtime cost.
 *
 * Always computed per branch, never brand-wide in one shot: revenue per
 * machine is not the same at both locations, so a blended calculation gives a
 * total that does not match the two branch screens added together. §13 is
 * strict about that — an owner who adds up the branches and lands somewhere
 * else stops trusting every other figure on the page.
 */
function downtimeAt(branchId: string): number {
  const fleet = assetsIn(branchId).length;
  if (fleet === 0) return 0;
  return earnedPerDay(branchId) * (machineDaysDown(branchId) / fleet);
}

function downtime(branchId?: string | null): Recommendation | null {
  const down = outOfOrder(branchId);
  if (down.length === 0) return null;

  const fleet = assetsIn(branchId).length;
  if (fleet === 0) return null;

  const scopes = branchId ? [branchId] : BRANCHES.map((b) => b.id);
  const cost = scopes.reduce((s, id) => s + downtimeAt(id), 0);

  const perDay = earnedPerDay(branchId);
  const machineDays = machineDaysDown(branchId);
  const worst = down[0]!;
  const sharePct = ((down.length / fleet) * 100).toFixed(1);

  return {
    id: 'DOWNTIME',
    tone: 'bad',
    direction: 'COST',
    title: `${count(down.length)} machines out of order`,
    action: 'Open the equipment register',
    href: '/equipment',
    amount: paise(Math.round(cost)),
    records: down.length,
    assumption:
      'Treats the floor as worth the same per machine. A dead treadmill and a dead ' +
      'dumbbell rack are not equal, and this figure does not know the difference.',
    derivation: [
      {
        label: 'Machines out of order',
        value: `${count(down.length)} of ${count(fleet)} · ${sharePct}%`,
        source: 'Equipment register · condition',
      },
      {
        label: 'Machine-days lost so far',
        value: days(machineDays),
        source: 'Down-since date to today, per machine',
      },
      {
        label: 'Membership revenue earned per day',
        value: money(perDay),
        source: 'plan price ÷ term, summed over running memberships',
      },
      {
        label: 'Service paid for and not delivered',
        value: money(cost),
        source: branchId
          ? `${money(perDay)} × ${machineDays} machine-days ÷ ${fleet} machines`
          : 'computed per branch and summed — revenue per machine differs by location',
      },
      {
        label: 'Longest down',
        value: worst.downSince ? `${worst.name} · ${days(daysBetween(worst.downSince, TODAY))}` : worst.name,
        source: `${worst.tag}${worst.fault ? ` · ${worst.fault}` : ''}`,
      },
    ],
  };
}

/* ------------------------------ Ranking ------------------------------- */

/**
 * Every signal that has records behind it, biggest rupee figure first.
 *
 * Ranking is by size alone. There is no weighting, because a weighting would
 * be a judgement about this gym that the data has not earned — and the owner
 * reading the screen holds that judgement already.
 */
export function recommendations(branchId?: string | null): Recommendation[] {
  return [renewals(branchId), receivables(branchId), absence(branchId), downtime(branchId)]
    .filter((r): r is Recommendation => r !== null)
    .sort((a, b) => b.amount - a.amount);
}

/** Headline for the section: what is coming in, what is going out. */
export function stakeSummary(branchId?: string | null): {
  inflow: Paise;
  cost: Paise;
  records: number;
} {
  const rs = recommendations(branchId);
  const sum = (d: Direction) =>
    paise(rs.filter((r) => r.direction === d).reduce((s, r) => s + r.amount, 0));
  return {
    inflow: sum('INFLOW'),
    cost: sum('COST'),
    records: rs.reduce((s, r) => s + r.records, 0),
  };
}
