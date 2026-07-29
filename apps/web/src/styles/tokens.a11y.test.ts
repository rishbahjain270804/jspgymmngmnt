import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Contrast is measured, not asserted in a comment.
 *
 * Jai's ERP v2 spec listed "WCAG AA contrast compliance" as a standard, and
 * two tokens were quietly under it. A prose standard cannot fail a build, so
 * this reads the real stylesheet and does the arithmetic. Change a colour and
 * drop a pair below its threshold and this test says so, in both themes.
 */

const CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'tokens.css'),
  'utf8',
);

type Theme = 'light' | 'dark';

/** Read a token as its light and dark hex values. */
function token(name: string): Record<Theme, string> {
  const pair = new RegExp(
    `--${name}\\s*:\\s*light-dark\\(\\s*(#[0-9a-f]{3,8})\\s*,\\s*(#[0-9a-f]{3,8})\\s*\\)`,
    'i',
  ).exec(CSS);
  if (pair) return { light: pair[1]!, dark: pair[2]! };

  const flat = new RegExp(`--${name}\\s*:\\s*(#[0-9a-f]{3,8})\\s*;`, 'i').exec(CSS);
  if (flat) return { light: flat[1]!, dark: flat[1]! };

  throw new Error(`Token --${name} not found, or not a plain colour.`);
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA: 4.5 for body text, 3 for large text and for UI boundaries. */
const AA_TEXT = 4.5;
const AA_LARGE = 3;

interface Pair {
  fg: string;
  bg: string;
  min: number;
  why: string;
}

const PAIRS: Pair[] = [
  { fg: 'text', bg: 'bg', min: AA_TEXT, why: 'body copy on the page' },
  { fg: 'text', bg: 'surface', min: AA_TEXT, why: 'body copy on a card' },
  { fg: 'text', bg: 'surface-2', min: AA_TEXT, why: 'body copy on a raised card' },
  { fg: 'text', bg: 'surface-3', min: AA_TEXT, why: 'body copy on the deepest surface' },
  { fg: 'text-2', bg: 'surface', min: AA_TEXT, why: 'secondary copy on a card' },
  { fg: 'text-2', bg: 'bg', min: AA_TEXT, why: 'secondary copy on the page' },
  // This token carries 12px eyebrows and captions, so it gets the full text
  // threshold rather than the large-text excuse.
  { fg: 'text-3', bg: 'surface', min: AA_TEXT, why: '12px eyebrows and captions' },
  { fg: 'text-3', bg: 'bg', min: AA_TEXT, why: 'captions on the page' },
  { fg: 'brand-fg', bg: 'brand', min: AA_TEXT, why: 'label on a primary button' },
  { fg: 'brand-text', bg: 'surface', min: AA_TEXT, why: 'brand used as link text' },
  { fg: 'brand-text', bg: 'bg', min: AA_TEXT, why: 'brand link on the page' },
  { fg: 'brand-fg', bg: 'ok', min: AA_TEXT, why: 'text on the green verdict slab' },
  { fg: 'ok-fg', bg: 'surface', min: AA_TEXT, why: 'an Active pill on a card' },
  { fg: 'warn-fg', bg: 'surface', min: AA_TEXT, why: 'an Expiring pill on a card' },
  { fg: 'bad-fg', bg: 'surface', min: AA_TEXT, why: 'an Expired pill on a card' },
  // Non-text boundaries only need 3:1.
  { fg: 'focus', bg: 'bg', min: AA_LARGE, why: 'focus ring against the page' },
  { fg: 'focus', bg: 'surface', min: AA_LARGE, why: 'focus ring against a card' },
  { fg: 'line-strong', bg: 'surface', min: 1.4, why: 'a visible divider' },
];

describe('token contrast meets WCAG AA', () => {
  for (const theme of ['light', 'dark'] as const) {
    describe(theme, () => {
      for (const p of PAIRS) {
        it(`${p.fg} on ${p.bg} — ${p.why}`, () => {
          const ratio = contrast(token(p.fg)[theme], token(p.bg)[theme]);
          expect(
            Number(ratio.toFixed(2)),
            `--${p.fg} on --${p.bg} in ${theme} is ${ratio.toFixed(2)}:1, needs ${p.min}:1`,
          ).toBeGreaterThanOrEqual(p.min);
        });
      }
    });
  }
});

describe('the palette keeps its promises', () => {
  it('declares every colour once, so the two themes cannot drift apart', () => {
    // The previous stylesheet repeated the whole light palette inside a
    // prefers-color-scheme block. Editing one copy and not the other is a
    // silent bug, so the duplicate must not come back.
    const duplicateBlock = /@media\s*\(prefers-color-scheme:\s*light\)/.test(CSS);
    expect(duplicateBlock, 'light palette should be expressed with light-dark(), not a second copy').toBe(false);
  });

  it('declares each token once in the base palette', () => {
    // Only the base :root block — the prefers-contrast and forced-colors
    // blocks below it legitimately re-declare a handful of tokens.
    const base = CSS.slice(0, CSS.indexOf('@media'));
    const pairs = [...base.matchAll(/--([\w-]+)\s*:\s*light-dark\(/g)].map((m) => m[1]!);
    const seen = new Set(pairs);
    const dupes = pairs.filter((p, i) => pairs.indexOf(p) !== i);
    expect(dupes, `tokens declared twice: ${dupes.join(', ')}`).toEqual([]);
    expect(seen.size).toBeGreaterThan(30);
  });

  it('uses the brand colour from oan.jspcoders.app', () => {
    // Lifted from their stylesheet: --color-brand / --color-brand-dark /
    // --color-on-brand. Pinned here so a later "tidy-up" cannot quietly drift
    // the product away from the client's actual brand.
    expect(token('brand').dark).toBe('#00e63c');
    expect(token('brand-active').dark).toBe('#00be31');
    expect(token('brand-fg').dark).toBe('#06120a');
  });

  it('never puts white on the brand green', () => {
    // White on #00e63c is 1.7:1 — invisible. Bright greens take dark text,
    // which is why --brand-fg is their near-black rather than #fff.
    for (const theme of ['light', 'dark'] as const) {
      expect(contrast('#ffffff', token('brand')[theme])).toBeLessThan(4.5);
      expect(contrast(token('brand-fg')[theme], token('brand')[theme])).toBeGreaterThan(4.5);
    }
  });

  it('keeps amber and red out of the brand and chart ramps', () => {
    // Green is now shared with the brand by design, but a chart series or a
    // button in amber or red would be indistinguishable from a warning.
    for (const name of ['brand', 'brand-hover', 'brand-active', 'brand-text', 'chart-1', 'chart-2', 'chart-3']) {
      for (const theme of ['light', 'dark'] as const) {
        const hex = token(name)[theme].replace('#', '');
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        expect(
          r > g && r > b,
          `--${name} (${theme}) is red-dominant, which reads as a warning`,
        ).toBe(false);
      }
    }
  });

  it('supports the accessibility modes a Windows kiosk actually meets', () => {
    expect(CSS).toMatch(/@media\s*\(prefers-contrast:\s*more\)/);
    expect(CSS).toMatch(/@media\s*\(forced-colors:\s*active\)/);
  });
});
