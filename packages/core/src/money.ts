/**
 * Money — always integer paise, never floats.
 *
 * Every amount in this system is an integer number of paise. Floating point
 * rupees drift, and drift in a ledger is unrecoverable: you cannot tell later
 * whether ₹0.01 was a rounding artefact or a real short payment.
 */

/** An integer number of paise. 100 paise = ₹1. */
export type Paise = number & { readonly __brand: unique symbol };

export const ZERO = 0 as Paise;

/**
 * Round half away from zero — the commercial convention.
 *
 * `Math.round` rounds .5 toward +Infinity, so it is asymmetric across zero
 * (`Math.round(-0.5) === -0`). Refunds and reversals are negative amounts, and
 * they must round by the same magnitude as the charge they reverse.
 */
export function roundHalfAwayFromZero(n: number): number {
  return n < 0 ? -Math.round(-n) : Math.round(n);
}

/** Construct Paise from an integer. Throws on non-integers — call `rupees()` instead. */
export function paise(n: number): Paise {
  if (!Number.isInteger(n)) {
    throw new RangeError(`Paise must be a whole number, received ${n}. Use rupees() to convert.`);
  }
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`Amount ${n} exceeds safe integer range.`);
  }
  return n as Paise;
}

/** Convert rupees to paise. `rupees(120.5)` → 12050. */
export function rupees(n: number): Paise {
  return paise(roundHalfAwayFromZero(n * 100));
}

/** Convert paise back to rupees as a plain number. For display and export only. */
export function toRupees(p: Paise): number {
  return p / 100;
}

export function add(...amounts: Paise[]): Paise {
  return paise(amounts.reduce((sum, a) => sum + a, 0));
}

export function subtract(a: Paise, b: Paise): Paise {
  return paise(a - b);
}

/** Multiply by a plain factor (e.g. quantity), rounding to whole paise. */
export function multiply(amount: Paise, factor: number): Paise {
  return paise(roundHalfAwayFromZero(amount * factor));
}

/** A percentage of an amount, rounded to whole paise. `percentOf(rupees(100), 18)` → ₹18.00 */
export function percentOf(amount: Paise, percent: number): Paise {
  return paise(roundHalfAwayFromZero((amount * percent) / 100));
}

export function isZero(p: Paise): boolean {
  return p === 0;
}

export function isNegative(p: Paise): boolean {
  return p < 0;
}

export function max(a: Paise, b: Paise): Paise {
  return (a > b ? a : b) as Paise;
}

export function min(a: Paise, b: Paise): Paise {
  return (a < b ? a : b) as Paise;
}

/**
 * Split an amount into parts by weight, with **no paise lost or invented**.
 *
 * The remainder from integer division is handed out one paise at a time to the
 * earliest parts, so the parts always sum exactly back to the total. This is
 * the only correct way to split money — `amount * weight` rounded per part
 * silently gains or loses paise.
 *
 * `allocate(rupees(100), [1, 1, 1])` → [₹33.34, ₹33.33, ₹33.33]
 */
export function allocate(total: Paise, weights: number[]): Paise[] {
  if (weights.length === 0) throw new RangeError('allocate() needs at least one weight.');
  if (weights.some((w) => w < 0)) throw new RangeError('allocate() weights must not be negative.');

  const weightTotal = weights.reduce((s, w) => s + w, 0);
  if (weightTotal === 0) throw new RangeError('allocate() weights must not sum to zero.');

  const sign = total < 0 ? -1 : 1;
  const magnitude = Math.abs(total);

  const parts = weights.map((w) => Math.floor((magnitude * w) / weightTotal));
  let remainder = magnitude - parts.reduce((s, p) => s + p, 0);

  for (let i = 0; remainder > 0; i = (i + 1) % parts.length, remainder--) {
    parts[i] = (parts[i] ?? 0) + 1;
  }

  return parts.map((p) => paise(p * sign));
}

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_WHOLE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format for display, with Indian digit grouping — ₹1,64,000.00, not ₹164,000.00.
 * Pass `{ paise: false }` to drop the decimals on whole-rupee amounts.
 */
export function formatINR(p: Paise, opts: { paise?: boolean } = {}): string {
  const showPaise = opts.paise ?? true;
  if (!showPaise || p % 100 === 0) return INR_WHOLE.format(toRupees(p));
  return INR.format(toRupees(p));
}

/**
 * Compact form for dashboards and mobile — ₹1.8L, ₹2.4Cr.
 * Uses the Indian lakh/crore scale, not the western K/M.
 */
export function formatINRShort(p: Paise): string {
  const r = Math.abs(toRupees(p));
  const sign = p < 0 ? '-' : '';
  if (r >= 1_00_00_000) return `${sign}₹${trim(r / 1_00_00_000)}Cr`;
  if (r >= 1_00_000) return `${sign}₹${trim(r / 1_00_000)}L`;
  if (r >= 1_000) return `${sign}₹${trim(r / 1_000)}k`;
  return formatINR(p, { paise: false });
}

function trim(n: number): string {
  return n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, '');
}
