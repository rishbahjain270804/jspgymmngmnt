import { Icon, type IconName } from './Icon';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  count?: number;
  /** Hidden from this role — the tab simply doesn't render. */
  hidden?: boolean;
}

/**
 * Tabs. Arrow keys move between them, as a tablist should.
 * Role filtering happens by omission: front desk never renders Progress,
 * Workout or Diet, so there is no disabled tab inviting a question.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: readonly TabItem<T>[];
  label: string;
}) {
  const visible = items.filter((i) => !i.hidden);

  const onKey = (e: React.KeyboardEvent) => {
    const i = visible.findIndex((t) => t.value === value);
    if (i < 0) return;
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % visible.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + visible.length) % visible.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = visible.length - 1;
    else return;
    e.preventDefault();
    const target = visible[next];
    if (target) onChange(target.value);
  };

  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {visible.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          className="tab"
          aria-selected={t.value === value}
          tabIndex={t.value === value ? 0 : -1}
          onClick={() => onChange(t.value)}
        >
          {t.icon ? <Icon name={t.icon} size={15} /> : null}
          {t.label}
          {t.count !== undefined ? <span className="tab__count tnum">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
