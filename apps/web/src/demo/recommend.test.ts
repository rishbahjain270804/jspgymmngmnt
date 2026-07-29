import { describe, expect, it } from 'vitest';
import { formatINR } from '@oan/core';
import { recommendations, stakeSummary } from './recommend';
import { dues } from './selectors';

/**
 * The engine's one promise is that every figure it shows can be followed back
 * to records in the app. These assertions are that promise, made checkable:
 * the working must contain the headline, and the branch figures must roll up
 * into the brand figure exactly — same as every other number in the demo.
 */

const money = (p: number) => formatINR(p as never, { paise: false });

describe('every recommendation shows its working', () => {
  it('states the headline figure inside its own derivation', () => {
    for (const r of recommendations(null)) {
      const shown = r.derivation.map((d) => d.value);
      expect(shown, `${r.id} never shows ${money(r.amount)} in its steps`).toContain(
        money(r.amount),
      );
    }
  });

  it('cites a source for every step — no figure without a provenance', () => {
    for (const r of recommendations(null)) {
      for (const step of r.derivation) {
        expect(step.source.length, `${r.id}: "${step.label}" has no source`).toBeGreaterThan(0);
      }
    }
  });

  it('is only ever computed over records that exist', () => {
    for (const r of recommendations(null)) {
      expect(r.records, `${r.id} was emitted with no records`).toBeGreaterThan(0);
      expect(Number.isInteger(r.amount)).toBe(true);
      expect(r.amount).toBeGreaterThanOrEqual(0);
    }
  });

  it('declares an assumption wherever the arithmetic needed one', () => {
    // Downtime is the only signal reaching for something the data does not
    // hold — how much of the floor's value each machine carries. It has to
    // say so out loud. If another signal starts guessing, it says so here too.
    const downtime = recommendations(null).find((r) => r.id === 'DOWNTIME');
    expect(downtime?.assumption?.length ?? 0).toBeGreaterThan(20);

    const guessing: string[] = ['DOWNTIME'];
    for (const r of recommendations(null)) {
      if (guessing.includes(r.id)) continue;
      expect(r.assumption, `${r.id} carries an undeclared assumption`).toBeUndefined();
    }
  });
});

describe('branch roll-up', () => {
  it('sums Level 2 into Level 1 exactly, for every signal', () => {
    const all = recommendations(null);
    const vn = recommendations('br-vn');
    const ms = recommendations('br-ms');

    for (const r of all) {
      const a = vn.find((x) => x.id === r.id)?.amount ?? 0;
      const b = ms.find((x) => x.id === r.id)?.amount ?? 0;
      // Pro-rata and amortised figures round per branch, so allow the paise
      // that rounding can move — but nothing larger than that.
      expect(Math.abs(r.amount - (a + b)), `${r.id} does not roll up`).toBeLessThanOrEqual(2);
      expect(r.records).toBe(
        (vn.find((x) => x.id === r.id)?.records ?? 0) + (ms.find((x) => x.id === r.id)?.records ?? 0),
      );
    }
  });

  it('agrees with the receivables selector the accounts screen uses', () => {
    const owed = recommendations(null).find((r) => r.id === 'DUES');
    expect(owed?.amount).toBe(dues(null));
  });
});

describe('ranking', () => {
  it('orders by rupees at stake, largest first', () => {
    const amounts = recommendations(null).map((r) => r.amount);
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
  });

  it('keeps money coming in separate from money going out', () => {
    const s = stakeSummary(null);
    const rs = recommendations(null);
    expect(s.inflow).toBe(
      rs.filter((r) => r.direction === 'INFLOW').reduce((t, r) => t + r.amount, 0),
    );
    expect(s.cost).toBe(rs.filter((r) => r.direction === 'COST').reduce((t, r) => t + r.amount, 0));
    // Renewals are money to collect; idle capital is money already lost. A
    // single blended "opportunity" number would hide that difference.
    expect(s.inflow).not.toBe(s.cost);
  });
});
