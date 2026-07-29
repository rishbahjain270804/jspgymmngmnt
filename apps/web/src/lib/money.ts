import { type Paise, formatINR, formatINRShort, paise } from '@oan/core';

/**
 * Formatting helpers for the UI layer.
 *
 * `Paise` is a branded integer in @oan/core, which is exactly right for the
 * rules but noisy in a component that has just multiplied something by a
 * ratio. These take a plain number of paise, round it once, and hand it back
 * to the real formatter — so rounding happens in one place rather than at
 * every call site.
 */

export const inr = (amountInPaise: number, opts?: { paise?: boolean }): string =>
  formatINR(paise(Math.round(amountInPaise)), opts ?? { paise: false });

export const inrShort = (amountInPaise: number): string =>
  formatINRShort(paise(Math.round(amountInPaise)));

/** Rupee figures for chart axes, where ₹ would crowd the gutter. */
export const inrAxis = (amountInPaise: number): string => inrShort(amountInPaise);

export const toPaise = (n: number): Paise => paise(Math.round(n));
