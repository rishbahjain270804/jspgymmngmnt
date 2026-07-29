/**
 * Calendar dates as `YYYY-MM-DD` strings, not `Date` objects.
 *
 * A membership expires on a *calendar day*, not at an instant. Using `Date`
 * here means a member in Jaipur can be shown as expired a day early because
 * the server ran in UTC — the classic bug in this domain. Strings have no
 * timezone to get wrong, and all arithmetic below is done in UTC internally
 * so it never crosses a DST or offset boundary.
 */

/** A calendar date in `YYYY-MM-DD` form. */
export type IsoDate = string & { readonly __brand: unique symbol };

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDate(value: string): IsoDate {
  if (!ISO_RE.test(value)) {
    throw new RangeError(`Expected a YYYY-MM-DD date, received "${value}".`);
  }
  const d = toUtc(value as IsoDate);
  if (Number.isNaN(d.getTime())) throw new RangeError(`"${value}" is not a real date.`);
  // Reject 2026-02-31 and friends, which Date silently rolls forward.
  if (fromUtc(d) !== value) throw new RangeError(`"${value}" is not a real date.`);
  return value as IsoDate;
}

function toUtc(d: IsoDate): Date {
  return new Date(`${d}T00:00:00.000Z`);
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today in the gym's timezone. Defaults to IST — OAN is in Jaipur. */
export function today(timeZone = 'Asia/Kolkata', now: Date = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD, which is exactly what we want.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now) as IsoDate;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d) as IsoDate;
}

/**
 * Add calendar months, clamping to the end of the target month.
 * `addMonths('2026-01-31', 1)` → `2026-02-28`, not `2026-03-03`.
 */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const d = toUtc(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
  d.setUTCDate(Math.min(day, lastDay));
  return fromUtc(d) as IsoDate;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function lastDayOfMonth(date: IsoDate): IsoDate {
  const d = toUtc(date);
  const last = daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
  d.setUTCDate(last);
  return fromUtc(d) as IsoDate;
}

export function isLastDayOfMonth(date: IsoDate): boolean {
  return lastDayOfMonth(date) === date;
}

/** Whole days from `a` to `b`. Negative when `b` is earlier. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const ms = toUtc(b).getTime() - toUtc(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function isBefore(a: IsoDate, b: IsoDate): boolean {
  return a < b;
}

export function isAfter(a: IsoDate, b: IsoDate): boolean {
  return a > b;
}

export function isOnOrBefore(a: IsoDate, b: IsoDate): boolean {
  return a <= b;
}

export function isOnOrAfter(a: IsoDate, b: IsoDate): boolean {
  return a >= b;
}

/** Human form for receipts and reports — `28 Feb 2027`. */
export function formatDate(date: IsoDate): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(toUtc(date));
}
