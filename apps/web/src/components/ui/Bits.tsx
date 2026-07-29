import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/** Avatar. Initials only — the product stores no member photographs. */
export function Avatar({
  name,
  size = 36,
  tone,
}: {
  name: string;
  size?: number;
  tone?: string;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        ...(tone ? { background: tone, color: '#fff', borderColor: 'transparent' } : {}),
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function Progress({
  value,
  max = 100,
  label,
  tone = 'var(--brand)',
}: {
  value: number;
  max?: number;
  label: string;
  tone?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className="progress__fill" style={{ width: `${pct}%`, background: tone }} />
    </div>
  );
}

export function Timeline({ children }: { children: ReactNode }) {
  return <ul className="timeline">{children}</ul>;
}

export function TimelineItem({
  icon,
  when,
  title,
  children,
  highlight,
}: {
  icon?: IconName;
  when: string;
  title: ReactNode;
  children?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <li className="timeline__item">
      <span className={`timeline__dot ${highlight ? 'timeline__dot--brand' : ''}`}>
        {icon ? (
          <Icon name={icon} size={9} strokeWidth={3} className={highlight ? 'on-brand' : ''} />
        ) : null}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="eyebrow">{when}</span>
        <span style={{ fontWeight: 'var(--w-medium)', fontSize: 'var(--t-body)' }}>{title}</span>
        {children ? (
          <span style={{ fontSize: 'var(--t-label)', color: 'var(--text-2)' }}>{children}</span>
        ) : null}
      </div>
    </li>
  );
}

/** Page section with an eyebrow. Keeps section rhythm identical everywhere. */
export function Section({
  eyebrow,
  title,
  action,
  children,
  index = 0,
}: {
  eyebrow?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  index?: number;
}) {
  return (
    <section className="section rise" style={{ '--i': index } as React.CSSProperties}>
      {eyebrow || title || action ? (
        <div className="section__head">
          <div>
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            {title ? <h2 className="section__title">{title}</h2> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * A figure that drills to its source document — Tally's habit, and the
 * wireframes' explicit layout rule: "every figure clicks to its source".
 */
export function DrillValue({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  if (!onClick) return <span className="tnum">{children}</span>;
  return (
    <button type="button" className="drill tnum" onClick={onClick} title={title}>
      {children}
    </button>
  );
}
