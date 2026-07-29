import type { MembershipStatus, VerdictLevel } from '@oan/core';
import { Icon, type IconName } from './Icon';

/**
 * The status pill.
 *
 * Two rules live here so no screen has to remember them:
 *
 * 1. Colour means membership state and nothing else (§7).
 * 2. Colour never travels alone — every pill carries a glyph and a word, so
 *    the state survives greyscale printing, a projector, and the ~8% of men
 *    with colour-vision deficiency who are over-represented in a gym.
 */

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral' | 'brand';

const TONE_ICON: Record<Tone, IconName> = {
  ok: 'check-circle',
  warn: 'alert',
  bad: 'x-circle',
  neutral: 'minus',
  brand: 'sparkle',
};

export const STATUS_TONE: Record<MembershipStatus, Tone> = {
  ACTIVE: 'ok',
  EXPIRING: 'warn',
  EXPIRED: 'bad',
  FROZEN: 'neutral',
  CANCELLED: 'neutral',
};

const STATUS_LABEL: Record<MembershipStatus, string> = {
  ACTIVE: 'Active',
  EXPIRING: 'Expiring',
  EXPIRED: 'Expired',
  FROZEN: 'Paused',
  CANCELLED: 'Cancelled',
};

const STATUS_ICON: Record<MembershipStatus, IconName> = {
  ACTIVE: 'check-circle',
  EXPIRING: 'alert',
  EXPIRED: 'x-circle',
  FROZEN: 'pause',
  CANCELLED: 'minus',
};

export const LEVEL_TONE: Record<VerdictLevel, Tone> = {
  GREEN: 'ok',
  AMBER: 'warn',
  RED: 'bad',
};

export const TONE_VAR: Record<Tone, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
  neutral: 'var(--neutral)',
  brand: 'var(--brand)',
};

export function Pill({
  tone = 'neutral',
  icon,
  small,
  children,
}: {
  tone?: Tone;
  icon?: IconName;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={`pill pill--${tone} ${small ? 'pill--sm' : ''}`}>
      <Icon name={icon ?? TONE_ICON[tone]} size={small ? 12 : 13} strokeWidth={2.1} />
      {children}
    </span>
  );
}

/** Membership state, rendered the same way everywhere it appears. */
export function StatusPill({
  status,
  small,
}: {
  status: MembershipStatus;
  small?: boolean;
}) {
  return (
    <Pill tone={STATUS_TONE[status]} icon={STATUS_ICON[status]} small={small}>
      {STATUS_LABEL[status]}
    </Pill>
  );
}
