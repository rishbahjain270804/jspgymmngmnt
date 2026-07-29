/**
 * Selectors — every aggregate the screens display.
 *
 * Kept apart from the data so the roll-up pattern (§13) exists in exactly one
 * place: pass a branch id for Level 2, pass nothing for the Level 1 total.
 */

import {
  type IsoDate,
  type MembershipStatus,
  type Paise,
  daysBetween,
  deriveStatus,
  paise,
} from '@oan/core';
import {
  ASSETS,
  EXPENSES,
  INVOICES,
  MEASUREMENTS,
  MEMBERS,
  TODAY,
} from './data';
import type { Asset, Invoice, Measurement, Member } from './types';

/** Re-exported so screens have one import for "give me data". */
export { memberById, branchById, staffById } from './data';

const byBranch = <T extends { branchId: string }>(xs: T[], branchId?: string | null): T[] =>
  branchId ? xs.filter((x) => x.branchId === branchId) : xs;

export const membersIn = (branchId?: string | null): Member[] => byBranch(MEMBERS, branchId);

export const statusOf = (m: Member, on: IsoDate = TODAY): MembershipStatus =>
  deriveStatus(m.membership, on);

export interface MemberStats {
  active: number;
  expiring: number;
  expired: number;
  frozen: number;
  newThisMonth: number;
  total: number;
}

export function memberStats(branchId?: string | null): MemberStats {
  const list = membersIn(branchId);
  const s: MemberStats = {
    active: 0,
    expiring: 0,
    expired: 0,
    frozen: 0,
    newThisMonth: 0,
    total: list.length,
  };
  const monthStart = TODAY.slice(0, 7);
  for (const m of list) {
    const st = statusOf(m);
    if (st === 'ACTIVE' || st === 'EXPIRING') s.active++;
    if (st === 'EXPIRING') s.expiring++;
    if (st === 'EXPIRED') s.expired++;
    if (st === 'FROZEN') s.frozen++;
    if (m.joinedOn.startsWith(monthStart)) s.newThisMonth++;
  }
  return s;
}

/** Everyone whose plan runs out within `days`, soonest first. */
export function expiringSoon(branchId?: string | null, days = 7): Member[] {
  return membersIn(branchId)
    .filter((m) => {
      const st = statusOf(m);
      if (st !== 'EXPIRING' && st !== 'ACTIVE') return false;
      return daysBetween(TODAY, m.membership.expiresOn) <= days;
    })
    .sort((a, b) => (a.membership.expiresOn < b.membership.expiresOn ? -1 : 1));
}

/** "Trainers who notice when you skip a day" — OAN's promise, as a query. */
export function absentMembers(branchId?: string | null, days = 14): Member[] {
  return membersIn(branchId)
    .filter((m) => {
      const st = statusOf(m);
      if (st === 'EXPIRED' || st === 'CANCELLED') return false;
      const last = m.visits[0];
      return !last || daysBetween(last, TODAY) >= days;
    })
    .sort((a, b) => {
      const av = a.visits[0] ?? ('0000-00-00' as IsoDate);
      const bv = b.visits[0] ?? ('0000-00-00' as IsoDate);
      return av < bv ? -1 : 1;
    });
}

export const daysSinceLastVisit = (m: Member): number | null =>
  m.visits[0] ? daysBetween(m.visits[0], TODAY) : null;

/** Attendance over a window, for the member record's 30-day summary. */
export function attendance(m: Member, days = 30): { attended: number; of: number; longestGap: number } {
  const cutoff = m.visits.filter((v) => daysBetween(v, TODAY) < days);
  let longestGap = 0;
  for (let i = 1; i < cutoff.length; i++) {
    const gap = daysBetween(cutoff[i]!, cutoff[i - 1]!) - 1;
    if (gap > longestGap) longestGap = gap;
  }
  // OAN runs six days a week, so the denominator excludes Sundays.
  const of = Math.round(days * (6 / 7));
  return { attended: cutoff.length, of, longestGap };
}

export const dues = (branchId?: string | null): Paise =>
  paise(membersIn(branchId).reduce((s, m) => s + m.membership.balanceDue, 0));

export const membersWithDues = (branchId?: string | null): Member[] =>
  membersIn(branchId)
    .filter((m) => m.membership.balanceDue > 0)
    .sort((a, b) => b.membership.balanceDue - a.membership.balanceDue);

/* ------------------------------- Money -------------------------------- */

export const invoicesIn = (branchId?: string | null): Invoice[] => byBranch(INVOICES, branchId);

export const invoicesFor = (memberId: string): Invoice[] =>
  INVOICES.filter((i) => i.memberId === memberId).sort((a, b) => (a.date < b.date ? 1 : -1));

export const collectedOn = (date: IsoDate, branchId?: string | null): Paise =>
  paise(
    invoicesIn(branchId)
      .filter((i) => i.date === date)
      .reduce((s, i) => s + i.received, 0),
  );

/** The day book — every voucher on a date, receipts and payments together. */
export interface DayBookRow {
  id: string;
  kind: 'RECEIPT' | 'PAYMENT';
  particulars: string;
  account: string;
  branchId: string;
  mode: string;
  amount: Paise;
  reference: string;
}

export function dayBook(date: IsoDate, branchId?: string | null): DayBookRow[] {
  const receipts: DayBookRow[] = invoicesIn(branchId)
    .filter((i) => i.date === date)
    .map((i) => ({
      id: i.id,
      kind: 'RECEIPT' as const,
      particulars: MEMBERS.find((m) => m.id === i.memberId)?.name ?? 'Member',
      account: i.planName,
      branchId: i.branchId,
      mode: i.mode,
      amount: i.received,
      reference: i.number,
    }));

  const payments: DayBookRow[] = byBranch(EXPENSES, branchId)
    .filter((e) => e.date === date)
    .map((e) => ({
      id: e.id,
      kind: 'PAYMENT' as const,
      particulars: e.vendor,
      account: e.head,
      branchId: e.branchId,
      mode: e.mode,
      amount: e.amount,
      reference: e.accountCode,
    }));

  return [...receipts, ...payments];
}

export const expensesIn = (branchId?: string | null) => byBranch(EXPENSES, branchId);

/* ----------------------------- Equipment ------------------------------ */

export const assetsIn = (branchId?: string | null): Asset[] => byBranch(ASSETS, branchId);

export interface AssetStats {
  total: number;
  working: number;
  needsService: number;
  outOfOrder: number;
  serviceDue: number;
  value: Paise;
}

export function assetStats(branchId?: string | null): AssetStats {
  const list = assetsIn(branchId);
  return {
    total: list.length,
    working: list.filter((a) => a.condition === 'WORKING').length,
    needsService: list.filter((a) => a.condition === 'NEEDS_SERVICE').length,
    outOfOrder: list.filter((a) => a.condition === 'OUT_OF_ORDER').length,
    serviceDue: list.filter((a) => a.nextServiceOn <= TODAY).length,
    value: paise(list.reduce((s, a) => s + a.cost, 0)),
  };
}

export const outOfOrder = (branchId?: string | null): Asset[] =>
  assetsIn(branchId)
    .filter((a) => a.condition === 'OUT_OF_ORDER')
    .sort((a, b) => (a.downSince ?? TODAY) < (b.downSince ?? TODAY) ? -1 : 1);

export const assetsByCategory = (branchId?: string | null) => {
  const list = assetsIn(branchId);
  const cats = [...new Set(list.map((a) => a.category))];
  return cats.map((category) => ({
    category,
    total: list.filter((a) => a.category === category).length,
    down: list.filter((a) => a.category === category && a.condition === 'OUT_OF_ORDER').length,
  }));
};

/* ----------------------------- Progress ------------------------------- */

export const measurementsFor = (memberId: string): Measurement[] =>
  MEASUREMENTS[memberId] ?? [];

export function progressDelta(memberId: string) {
  const rows = measurementsFor(memberId);
  const latest = rows[0];
  const baseline = rows[rows.length - 1];
  if (!latest || !baseline) return null;
  return {
    latest,
    baseline,
    weight: +(latest.weightKg - baseline.weightKg).toFixed(1),
    bodyFat: +(latest.bodyFatPct - baseline.bodyFatPct).toFixed(1),
    lean: +(latest.leanKg - baseline.leanKg).toFixed(1),
    waist: +(latest.waistIn - baseline.waistIn).toFixed(1),
  };
}

/* ------------------------------ Search -------------------------------- */

/**
 * Phone-number-first, because that is how both staff and members think about
 * identity here (§7). Digits match the phone; letters match the name.
 */
export function searchMembers(query: string, branchId?: string | null, limit = 25): Member[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const digits = q.replace(/\D/g, '');
  const pool = membersIn(branchId);

  if (digits.length >= 3) {
    return pool.filter((m) => m.phone.includes(digits)).slice(0, limit);
  }
  return pool
    .filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q))
    .slice(0, limit);
}
