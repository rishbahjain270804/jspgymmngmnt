import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysBetween,
  formatDate,
  isLastDayOfMonth,
  isoDate,
  lastDayOfMonth,
  today,
} from './date.js';

describe('isoDate', () => {
  it('accepts real dates', () => {
    expect(isoDate('2026-02-28')).toBe('2026-02-28');
    expect(isoDate('2024-02-29')).toBe('2024-02-29'); // leap year
  });

  it('rejects dates that do not exist, which Date would silently roll forward', () => {
    expect(() => isoDate('2026-02-30')).toThrow();
    expect(() => isoDate('2026-13-01')).toThrow();
    expect(() => isoDate('2025-02-29')).toThrow(); // not a leap year
    expect(() => isoDate('28-02-2026')).toThrow();
  });
});

describe('addMonths', () => {
  it('clamps to the end of a shorter month', () => {
    expect(addMonths(isoDate('2026-01-31'), 1)).toBe('2026-02-28');
    expect(addMonths(isoDate('2024-01-31'), 1)).toBe('2024-02-29');
    expect(addMonths(isoDate('2026-03-31'), 1)).toBe('2026-04-30');
  });

  it('handles ordinary months and year boundaries', () => {
    expect(addMonths(isoDate('2026-01-15'), 1)).toBe('2026-02-15');
    expect(addMonths(isoDate('2026-12-15'), 1)).toBe('2027-01-15');
    expect(addMonths(isoDate('2026-01-15'), 12)).toBe('2027-01-15');
  });
});

describe('addDays', () => {
  it('crosses months and years', () => {
    expect(addDays(isoDate('2026-01-31'), 1)).toBe('2026-02-01');
    expect(addDays(isoDate('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(isoDate('2026-03-01'), -1)).toBe('2026-02-28');
  });
});

describe('daysBetween', () => {
  it('counts whole days in both directions', () => {
    expect(daysBetween(isoDate('2026-01-01'), isoDate('2026-01-31'))).toBe(30);
    expect(daysBetween(isoDate('2026-01-31'), isoDate('2026-01-01'))).toBe(-30);
    expect(daysBetween(isoDate('2026-01-01'), isoDate('2026-01-01'))).toBe(0);
  });

  it('is unaffected by DST, because everything is UTC internally', () => {
    // Northern-hemisphere DST window; a naive local-time diff would give 29.958 days.
    expect(daysBetween(isoDate('2026-03-01'), isoDate('2026-03-31'))).toBe(30);
  });
});

describe('month ends', () => {
  it('finds and identifies them', () => {
    expect(lastDayOfMonth(isoDate('2026-02-10'))).toBe('2026-02-28');
    expect(isLastDayOfMonth(isoDate('2026-02-28'))).toBe(true);
    expect(isLastDayOfMonth(isoDate('2026-02-27'))).toBe(false);
  });
});

describe('today', () => {
  it('reports the Jaipur date, not the UTC one', () => {
    // 18:45 UTC on 28 July is already 00:15 on 29 July in IST (+5:30).
    const instant = new Date('2026-07-28T18:45:00.000Z');
    expect(today('Asia/Kolkata', instant)).toBe('2026-07-29');
    expect(today('UTC', instant)).toBe('2026-07-28');
  });
});

describe('formatDate', () => {
  it('renders the human form used on receipts', () => {
    expect(formatDate(isoDate('2027-02-28'))).toMatch(/28 Feb 2027/);
  });
});
