import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../ui/Icon';
import { StatusPill } from '../ui/StatusPill';
import { useSession } from '../../demo/session';
import { maskPhone } from '../../demo/data';
import { searchMembers, statusOf } from '../../demo/selectors';
import { NAV } from './nav';
import { useModal } from '../../lib/hooks';

/**
 * ⌘K. Phone-number-first, like every other search in the product: type three
 * digits and you get members; type letters and you get members and pages.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role, branchId, canRollUp } = useSession();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useModal(open, onClose);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      // Focus the field, not the first result.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const members = useMemo(
    () => (q.trim() ? searchMembers(q, canRollUp ? branchId : branchId, 6) : []),
    [q, branchId, canRollUp],
  );

  const pages = useMemo(() => {
    const items = NAV[role].map((n) => ({ to: n.to, label: n.label, icon: n.icon }));
    const extra: { to: string; label: string; icon: IconName }[] = [
      { to: '/checkin', label: 'Check-in counter', icon: 'checkin' },
      { to: '/roadmap', label: 'Product roadmap', icon: 'sparkle' },
    ];
    const all = [...items, ...extra];
    if (!q.trim()) return all;
    return all.filter((p) => p.label.toLowerCase().includes(q.trim().toLowerCase()));
  }, [role, q]);

  const rows = useMemo(
    () => [
      ...members.map((m) => ({ kind: 'member' as const, id: m.id, member: m })),
      ...pages.map((p) => ({ kind: 'page' as const, id: p.to, page: p })),
    ],
    [members, pages],
  );

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const go = (i: number) => {
    const row = rows[i];
    if (!row) return;
    onClose();
    nav(row.kind === 'member' ? `/members/${row.member.id}` : row.page.to);
  };

  return createPortal(
    <div
      className="palette-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
      >
        <div className="palette__input">
          <Icon name="search" size={19} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Phone number, member name, or a page…"
            aria-label="Search"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, rows.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                go(active);
              }
            }}
          />
        </div>

        <div className="palette__list" role="listbox" aria-label="Results">
          {rows.length === 0 ? (
            <div style={{ padding: 'var(--s-6)', textAlign: 'center', color: 'var(--text-3)' }}>
              Nothing matches “{q}”. Try the last five digits of a phone number.
            </div>
          ) : null}

          {members.length ? <div className="eyebrow menu__label">Members</div> : null}
          {rows.map((row, i) =>
            row.kind === 'member' ? (
              <button
                key={row.id}
                type="button"
                role="option"
                aria-selected={i === active}
                data-active={i === active}
                className="palette__item"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(i)}
              >
                <Icon name="user" size={17} />
                <span>
                  <span style={{ fontWeight: 'var(--w-medium)' }}>{row.member.name}</span>
                  <span style={{ color: 'var(--text-3)' }}> · {maskPhone(row.member.phone)}</span>
                </span>
                <span className="palette__meta">
                  <StatusPill status={statusOf(row.member)} small />
                </span>
              </button>
            ) : (
              <button
                key={row.id}
                type="button"
                role="option"
                aria-selected={i === active}
                data-active={i === active}
                className="palette__item"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(i)}
              >
                <Icon name={row.page.icon} size={17} />
                {row.page.label}
                <span className="palette__meta">Page</span>
              </button>
            ),
          )}
        </div>

        <div className="palette__foot">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span>esc to close</span>
          <span style={{ marginLeft: 'auto' }}>Search is phone-number-first</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
