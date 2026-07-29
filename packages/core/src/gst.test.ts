import { describe, expect, it } from 'vitest';
import { breakdown, fromExclusive, fromInclusive, GST_RATE_MEMBERSHIP } from './gst.js';
import { add, formatINR, paise, rupees } from './money.js';

describe('GST from an inclusive price', () => {
  it('splits a ₹12,000 annual plan the way the invoice must read', () => {
    const g = fromInclusive(rupees(12000));

    expect(formatINR(g.total)).toContain('12,000');
    expect(g.taxable).toBe(1016949); // ₹10,169.49
    expect(g.cgst).toBe(91526); //     ₹915.26
    expect(g.sgst).toBe(91525); //     ₹915.25
    expect(g.igst).toBe(0);
    expect(g.rate).toBe(18);
  });

  it('always ties back to the total — the invariant the filing depends on', () => {
    for (let r = 1; r <= 5000; r++) {
      const total = rupees(r);
      const g = fromInclusive(total);
      expect(add(g.taxable, g.cgst, g.sgst, g.igst)).toBe(total);
      expect(add(g.taxable, g.tax)).toBe(total);
    }
  });

  it('uses a single IGST for inter-state supply, with no CGST/SGST', () => {
    const g = fromInclusive(rupees(12000), 18, 'INTER_STATE');
    expect(g.cgst).toBe(0);
    expect(g.sgst).toBe(0);
    expect(g.igst).toBe(183051);
    expect(add(g.taxable, g.igst)).toBe(rupees(12000));
  });
});

describe('GST added on top of an exclusive price', () => {
  it('adds 18% and still ties', () => {
    const g = fromExclusive(rupees(10000));
    expect(g.taxable).toBe(rupees(10000));
    expect(g.tax).toBe(rupees(1800));
    expect(g.total).toBe(rupees(11800));
    expect(add(g.taxable, g.cgst, g.sgst)).toBe(g.total);
  });

  it('ties for every rupee value', () => {
    for (let r = 1; r <= 5000; r++) {
      const g = fromExclusive(rupees(r));
      expect(add(g.taxable, g.cgst, g.sgst, g.igst)).toBe(g.total);
    }
  });
});

describe('price basis', () => {
  it('produces materially different invoices — this is why §10 Q20 blocks the build', () => {
    const quoted = rupees(12000);
    const inclusive = breakdown(quoted, 'INCLUSIVE');
    const exclusive = breakdown(quoted, 'EXCLUSIVE');

    expect(inclusive.total).toBe(rupees(12000));
    expect(exclusive.total).toBe(rupees(14160));
    // Getting the basis backwards is an 18% error on every single invoice.
    expect(exclusive.total - inclusive.total).toBe(rupees(2160));
  });
});

describe('guards', () => {
  it('rejects impossible rates', () => {
    expect(() => fromInclusive(rupees(100), -1)).toThrow(/between 0 and 100/);
    expect(() => fromInclusive(rupees(100), 101)).toThrow(/between 0 and 100/);
  });

  it('handles a zero-rated supply', () => {
    const g = fromInclusive(rupees(500), 0);
    expect(g.taxable).toBe(rupees(500));
    expect(g.tax).toBe(0);
  });

  it('defaults to the fitness services rate', () => {
    expect(GST_RATE_MEMBERSHIP).toBe(18);
    expect(fromInclusive(paise(100000)).rate).toBe(18);
  });
});
