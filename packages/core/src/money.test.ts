import { describe, expect, it } from 'vitest';
import {
  add,
  allocate,
  formatINR,
  formatINRShort,
  multiply,
  paise,
  percentOf,
  roundHalfAwayFromZero,
  rupees,
  subtract,
  toRupees,
} from './money.js';

describe('paise', () => {
  it('rejects fractional paise', () => {
    expect(() => paise(10.5)).toThrow(/whole number/);
  });

  it('converts rupees to paise', () => {
    expect(rupees(120.5)).toBe(12050);
    expect(rupees(12000)).toBe(1200000);
    expect(toRupees(paise(12050))).toBe(120.5);
  });

  it('survives the float trap that makes naive money code drift', () => {
    // 0.1 + 0.2 !== 0.3 in floating point. In paise it is exact.
    expect(add(rupees(0.1), rupees(0.2))).toBe(rupees(0.3));
  });
});

describe('rounding', () => {
  it('rounds half away from zero, symmetrically across zero', () => {
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
  });

  it('reverses a charge by exactly the same magnitude', () => {
    const charge = rupees(33.335);
    const refund = multiply(charge, -1);
    expect(add(charge, refund)).toBe(0);
  });
});

describe('arithmetic', () => {
  it('adds, subtracts and takes percentages', () => {
    expect(add(rupees(100), rupees(50))).toBe(rupees(150));
    expect(subtract(rupees(100), rupees(30))).toBe(rupees(70));
    expect(percentOf(rupees(100), 18)).toBe(rupees(18));
  });
});

describe('allocate', () => {
  it('never loses or invents a paisa', () => {
    const parts = allocate(rupees(100), [1, 1, 1]);
    expect(parts).toEqual([3334, 3333, 3333]);
    expect(add(...parts)).toBe(rupees(100));
  });

  it('splits by weight', () => {
    const parts = allocate(rupees(100), [3, 1]);
    expect(add(...parts)).toBe(rupees(100));
    expect(parts[0]).toBe(7500);
    expect(parts[1]).toBe(2500);
  });

  it('handles an odd number of paise in a two-way split', () => {
    const parts = allocate(paise(183051), [1, 1]);
    expect(parts).toEqual([91526, 91525]);
    expect(add(...parts)).toBe(paise(183051));
  });

  it('preserves the total for negative amounts too', () => {
    const parts = allocate(paise(-100), [1, 1, 1]);
    expect(add(...parts)).toBe(paise(-100));
  });

  it('rejects degenerate weights', () => {
    expect(() => allocate(rupees(1), [])).toThrow();
    expect(() => allocate(rupees(1), [0, 0])).toThrow();
    expect(() => allocate(rupees(1), [-1, 2])).toThrow();
  });
});

describe('formatting', () => {
  it('groups digits the Indian way, not the western way', () => {
    // ₹1,64,000 — lakh grouping. Not ₹164,000.
    expect(formatINR(rupees(164000), { paise: false })).toContain('1,64,000');
  });

  it('drops decimals on whole rupees', () => {
    expect(formatINR(rupees(12000))).not.toContain('.00');
    expect(formatINR(rupees(120.5))).toContain('.50');
  });

  it('abbreviates on the lakh/crore scale for dashboards', () => {
    expect(formatINRShort(rupees(180000))).toBe('₹1.8L');
    expect(formatINRShort(rupees(24000000))).toBe('₹2.4Cr');
    expect(formatINRShort(rupees(48200))).toBe('₹48k');
  });
});
