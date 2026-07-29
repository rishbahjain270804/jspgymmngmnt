import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

/**
 * The four states every screen owes the user besides its happy path.
 * Written in the interface's voice: say what happened and what to do next.
 * Errors don't apologise, and an empty screen is an invitation to act.
 */

export function Skeleton({
  w = '100%',
  h = 14,
  radius,
  className = '',
}: {
  w?: string | number;
  h?: string | number;
  radius?: string;
  className?: string;
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width: w, height: h, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/** Placeholder rows that match the table they stand in for. */
export function SkeletonRows({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">Loading…</span>
      <div className="stack" style={{ gap: 'var(--s-1)' }}>
        {Array.from({ length: rows }, (_, r) => (
          <div
            key={r}
            style={{
              display: 'grid',
              gridTemplateColumns: `2fr ${'1fr '.repeat(Math.max(cols - 1, 1))}`,
              gap: 'var(--s-4)',
              padding: 'var(--s-3) var(--s-4)',
              alignItems: 'center',
            }}
          >
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton key={c} w={c === 0 ? '70%' : '48%'} h={c === 0 ? 16 : 12} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonKpis({ count = 6 }: { count?: number }) {
  return (
    <div className="grid-kpi" role="status" aria-busy="true">
      <span className="visually-hidden">Loading figures…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="kpi">
          <Skeleton w={90} h={11} />
          <Skeleton w={130} h={30} radius="var(--r-sm)" />
          <Skeleton w={70} h={11} />
        </div>
      ))}
    </div>
  );
}

function State({
  icon,
  variant,
  title,
  body,
  action,
}: {
  icon: IconName;
  variant?: 'bad' | 'lock';
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <div className={`state__icon ${variant ? `state__icon--${variant}` : ''}`}>
        <Icon name={icon} size={22} />
      </div>
      <h3 className="state__title">{title}</h3>
      <p className="state__body">{body}</p>
      {action ? <div style={{ marginTop: 'var(--s-2)' }}>{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return <State icon={icon} title={title} body={body} action={action} />;
}

export function ErrorState({
  title = "That didn't load",
  body,
  onRetry,
}: {
  title?: string;
  body?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div role="alert">
      <State
        icon="alert"
        variant="bad"
        title={title}
        body={
          body ??
          'The branch data stopped responding partway through. Nothing was changed. Try again, and if it keeps happening the counter can carry on offline.'
        }
        action={
          onRetry ? (
            <Button variant="secondary" icon="refresh" onClick={onRetry}>
              Try again
            </Button>
          ) : null
        }
      />
    </div>
  );
}

/**
 * Permission state. Says what is being withheld and who can lift it — never
 * a bare "Access denied", which leaves the person at the counter guessing.
 */
export function PermissionState({
  what = 'this',
  who = 'an Admin',
}: {
  what?: string;
  who?: string;
}) {
  return (
    <State
      icon="lock"
      variant="lock"
      title="Not part of your access"
      body={
        <>
          Your role doesn't include {what}. Ask {who} if you need it — they can change this from
          Staff without anyone signing out.
        </>
      }
    />
  );
}
