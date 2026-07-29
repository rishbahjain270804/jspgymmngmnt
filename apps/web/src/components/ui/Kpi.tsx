import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { useCountUp } from '../../lib/hooks';

/**
 * KPI card.
 *
 * The number animates up on mount, but `format` is applied to the animated
 * value only for display — the accessible name always states the final,
 * exact figure, so a screen reader never announces a number mid-count.
 */
export interface KpiProps {
  label: string;
  /** The real value. Pass the number so it can count; pass `display` to format it. */
  value: number;
  format?: (n: number) => string;
  /** Final formatted value, when it can't be derived from the number alone. */
  display?: string;
  icon?: IconName;
  hint?: ReactNode;
  delta?: { value: string; direction: 'up' | 'down' };
  onClick?: () => void;
  index?: number;
}

export function Kpi({
  label,
  value,
  format = (n) => Math.round(n).toLocaleString('en-IN'),
  display,
  icon,
  hint,
  delta,
  onClick,
  index = 0,
}: KpiProps) {
  const animated = useCountUp(value);
  const shown = display ?? format(value);

  const inner = (
    <>
      <span className="kpi__label">
        {icon ? <Icon name={icon} size={14} /> : null}
        {label}
      </span>
      <span className="kpi__value" aria-hidden="true">
        {format(animated)}
      </span>
      <span className="visually-hidden">
        {label}: {shown}
      </span>
      {delta || hint ? (
        <span className="kpi__foot">
          {delta ? (
            <span className={`delta delta--${delta.direction}`}>
              <Icon name={delta.direction === 'up' ? 'trend-up' : 'trend-down'} size={13} />
              {delta.value}
            </span>
          ) : null}
          {hint}
        </span>
      ) : null}
    </>
  );

  const style = { '--i': index } as React.CSSProperties;

  if (onClick) {
    return (
      <button type="button" className="kpi kpi--interactive rise" style={style} onClick={onClick}>
        {inner}
      </button>
    );
  }

  return (
    <div className="kpi rise" style={style}>
      {inner}
    </div>
  );
}
