/**
 * GST — computed, never typed by a human.
 *
 * The invariant that matters: **taxable + cgst + sgst + igst === total, exactly.**
 * If those don't tie, the invoice is wrong and the GSTR filing derived from it
 * is wrong too. That is guaranteed here by deriving tax as `total - taxable`
 * and splitting it with `allocate()`, never by computing each part separately.
 */

import { type Paise, allocate, paise, roundHalfAwayFromZero, subtract, ZERO } from './money.js';

/**
 * 18% on health club and fitness centre services.
 * SAC 999723 — "physical well-being services including health club & fitness centre".
 * Confirm both with OAN's CA before the first real invoice (research §10 Q3).
 */
export const GST_RATE_MEMBERSHIP = 18;
export const SAC_FITNESS = '999723';

/**
 * Intra-state supplies split into CGST + SGST. Inter-state is a single IGST.
 * OAN's branches are all in Rajasthan for now, so everything is intra-state —
 * but a branch in another state would need its own GSTIN and IGST treatment.
 */
export type GstTreatment = 'INTRA_STATE' | 'INTER_STATE';

export interface GstBreakdown {
  /** Amount charged to the member, tax included. */
  readonly total: Paise;
  /** Value before tax — the amount that posts to an income ledger. */
  readonly taxable: Paise;
  readonly cgst: Paise;
  readonly sgst: Paise;
  readonly igst: Paise;
  /** Total tax, i.e. cgst + sgst + igst. */
  readonly tax: Paise;
  readonly rate: number;
  readonly treatment: GstTreatment;
}

function split(taxable: Paise, tax: Paise, rate: number, treatment: GstTreatment): GstBreakdown {
  const total = paise(taxable + tax);

  if (treatment === 'INTER_STATE') {
    return { total, taxable, cgst: ZERO, sgst: ZERO, igst: tax, tax, rate, treatment };
  }

  const [cgst, sgst] = allocate(tax, [1, 1]) as [Paise, Paise];
  return { total, taxable, cgst, sgst, igst: ZERO, tax, rate, treatment };
}

/**
 * The member was quoted a tax-inclusive price — the normal case in Indian gyms,
 * where "₹12,000 a year" means ₹12,000 out of pocket.
 *
 * Whether OAN quotes inclusive or exclusive is research §10 Q20, and it is
 * blocking: getting it backwards makes every invoice wrong by 18%.
 */
export function fromInclusive(
  total: Paise,
  rate: number = GST_RATE_MEMBERSHIP,
  treatment: GstTreatment = 'INTRA_STATE',
): GstBreakdown {
  assertRate(rate);
  const taxable = paise(roundHalfAwayFromZero((total * 100) / (100 + rate)));
  // Derived by subtraction so the parts always tie back to `total`.
  const tax = subtract(total, taxable);
  return split(taxable, tax, rate, treatment);
}

/** The price quoted excludes tax, and GST is added on top. */
export function fromExclusive(
  taxable: Paise,
  rate: number = GST_RATE_MEMBERSHIP,
  treatment: GstTreatment = 'INTRA_STATE',
): GstBreakdown {
  assertRate(rate);
  const tax = paise(roundHalfAwayFromZero((taxable * rate) / 100));
  return split(taxable, tax, rate, treatment);
}

/** How a plan's price is stated. Stored on the plan master, never guessed. */
export type PriceBasis = 'INCLUSIVE' | 'EXCLUSIVE';

export function breakdown(
  amount: Paise,
  basis: PriceBasis,
  rate: number = GST_RATE_MEMBERSHIP,
  treatment: GstTreatment = 'INTRA_STATE',
): GstBreakdown {
  return basis === 'INCLUSIVE'
    ? fromInclusive(amount, rate, treatment)
    : fromExclusive(amount, rate, treatment);
}

function assertRate(rate: number): void {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new RangeError(`GST rate must be between 0 and 100, received ${rate}.`);
  }
}
