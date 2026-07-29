import { describe, expect, it } from 'vitest';
import { isUuid, uuidv7, uuidv7Time } from './id.js';

const RAND = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

describe('uuidv7', () => {
  it('produces a well-formed uuid', () => {
    expect(isUuid(uuidv7())).toBe(true);
  });

  it('sets version 7 and the RFC variant', () => {
    const id = uuidv7(Date.now(), RAND);
    expect(id[14]).toBe('7'); // version nibble
    expect('89ab').toContain(id[19]!.toLowerCase()); // variant nibble
  });

  it('round-trips the timestamp', () => {
    const t = 1_785_000_000_000;
    expect(uuidv7Time(uuidv7(t, RAND))).toBe(t);
  });

  it('sorts lexicographically in time order — the reason for using v7 at all', () => {
    const ids = [3, 1, 2, 5, 4].map((n) => uuidv7(1_700_000_000_000 + n * 1000, RAND));
    const sorted = [...ids].sort();
    const byTime = [...ids].sort((a, b) => uuidv7Time(a) - uuidv7Time(b));
    expect(sorted).toEqual(byTime);
  });

  it('stays unique across a burst within the same millisecond', () => {
    const t = 1_785_000_000_000;
    const ids = new Set(Array.from({ length: 5000 }, () => uuidv7(t)));
    expect(ids.size).toBe(5000);
  });

  it('handles timestamps beyond 2^32 ms without truncating', () => {
    // 2^32 ms after the epoch is Feb 1970 + 49 days; real dates are far past it,
    // and a 32-bit bitwise shift would silently lose the high bits.
    const t = 4_294_967_296 + 12_345;
    expect(uuidv7Time(uuidv7(t, RAND))).toBe(t);
  });

  it('rejects bad input rather than producing a malformed id', () => {
    expect(() => uuidv7(-1)).toThrow(/non-negative/);
    expect(() => uuidv7(Date.now(), new Uint8Array(3))).toThrow(/10 random bytes/);
    expect(() => uuidv7Time('not-a-uuid')).toThrow();
  });
});

describe('isUuid', () => {
  it('accepts real uuids and rejects near-misses', () => {
    expect(isUuid('018f4c8a-1b2c-7d3e-8f4a-5b6c7d8e9f01')).toBe(true);
    expect(isUuid('018f4c8a1b2c7d3e8f4a5b6c7d8e9f01')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid('zzzzzzzz-1b2c-7d3e-8f4a-5b6c7d8e9f01')).toBe(false);
  });
});
