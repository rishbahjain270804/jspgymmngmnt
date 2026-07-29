import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Bits';
import { Drawer } from '../ui/Overlay';
import { Pill } from '../ui/StatusPill';
import { Select } from '../ui/Field';
import { useSession, ROLE_LABEL } from '../../demo/session';
import { BRANCHES, NOTIFICATIONS, STAFF } from '../../demo/data';
import { CommandPalette } from './CommandPalette';
import { NAV } from './nav';
import { useShortcut } from '../../lib/hooks';
import './shell.css';

/** Breadcrumbs, derived from the path. Reads better than a hand-kept list. */
const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  members: 'Members',
  equipment: 'Equipment',
  staff: 'Staff',
  branches: 'Branches',
  accounts: 'Accounts',
  checkin: 'Check-in',
  collect: 'Collect payment',
  coach: 'Coach',
  clients: 'Clients',
  audit: 'Audit log',
  roadmap: 'Roadmap',
  branch: 'Branch',
  session: 'Session',
};

function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <nav className="header__crumbs" aria-label="Breadcrumb">
      <Link to="/" className="crumb">
        OAN
      </Link>
      {parts.map((p, i) => {
        const to = `/${parts.slice(0, i + 1).join('/')}`;
        const last = i === parts.length - 1;
        const label = LABELS[p] ?? decodeURIComponent(p);
        return (
          <span key={to} style={{ display: 'contents' }}>
            <Icon name="chevron-right" size={13} />
            {last ? (
              <span className="crumb crumb--current" aria-current="page">
                {label}
              </span>
            ) : (
              <Link to={to} className="crumb">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/**
 * Branch switcher. Only rendered for `all` scope — a branch manager has no
 * roll-up to switch to, so instead of a disabled control they see their
 * branch stated plainly. That's the RBAC model showing through the UI.
 */
function BranchSwitcher() {
  const { branchId, setBranchId, canRollUp, branches } = useSession();
  const [open, setOpen] = useState(false);

  if (!canRollUp) {
    return (
      <span className="branch-pick__btn" style={{ cursor: 'default' }}>
        <Icon name="map-pin" size={15} />
        {branches[0]?.name ?? '—'}
      </span>
    );
  }

  const current = branchId ? BRANCHES.find((b) => b.id === branchId)?.name : 'All branches';

  return (
    <div className="branch-pick" onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
    }}>
      <button
        type="button"
        className="branch-pick__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="branches" size={15} />
        {current}
        <Icon name="chevron-down" size={14} />
      </button>
      {open ? (
        <div className="menu" role="menu">
          <div className="eyebrow menu__label">Scope applies to every figure</div>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={branchId === null}
            className="menu__item"
            onClick={() => {
              setBranchId(null);
              setOpen(false);
            }}
          >
            <Icon name="branches" size={15} />
            All branches
            {branchId === null ? <Icon name="check" size={14} /> : null}
          </button>
          {BRANCHES.map((b) => (
            <button
              key={b.id}
              type="button"
              role="menuitemradio"
              aria-checked={branchId === b.id}
              className="menu__item"
              onClick={() => {
                setBranchId(b.id);
                setOpen(false);
              }}
            >
              <Icon name="map-pin" size={15} />
              {b.name}
              {branchId === b.id ? <Icon name="check" size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NotificationCentre({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { branchId, canRollUp } = useSession();
  const list = NOTIFICATIONS.filter((n) => (canRollUp && !branchId ? true : n.branchId === branchId));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Notifications"
      sub={`${list.filter((n) => !n.read).length} unread`}
    >
      {list.length === 0 ? (
        <p style={{ color: 'var(--text-2)' }}>
          Nothing needs attention at this branch right now.
        </p>
      ) : (
        <div className="stack" style={{ gap: 'var(--s-3)' }}>
          {list.map((n) => (
            <Link
              key={n.id}
              to={n.href ?? '#'}
              onClick={onClose}
              className="card card--pad card--interactive"
              style={{ opacity: n.read ? 0.62 : 1 }}
            >
              <div className="row" style={{ gap: 'var(--s-2)', marginBottom: 6 }}>
                <Pill
                  tone={n.kind === 'equipment' ? 'bad' : n.kind === 'expiry' ? 'warn' : 'neutral'}
                  small
                  icon={
                    n.kind === 'equipment'
                      ? 'wrench'
                      : n.kind === 'expiry'
                        ? 'clock'
                        : n.kind === 'payment'
                          ? 'wallet'
                          : n.kind === 'approval'
                            ? 'shield'
                            : 'activity'
                  }
                >
                  {n.kind}
                </Pill>
                <span style={{ marginLeft: 'auto', fontSize: 'var(--t-caption)', color: 'var(--text-3)' }}>
                  {n.at}
                </span>
              </div>
              <div style={{ fontWeight: 'var(--w-semibold)', fontSize: 'var(--t-body)' }}>
                {n.title}
              </div>
              <div style={{ fontSize: 'var(--t-label)', color: 'var(--text-2)', marginTop: 2 }}>
                {n.body}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Drawer>
  );
}

export function AppShell() {
  const { role, name, theme, setTheme, signInAs, staffId } = useSession();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useShortcut('k', () => setPaletteOpen(true));

  const items = NAV[role];
  const mobileItems = items.filter((i) => i.mobile).slice(0, 4);
  const unread = NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand__mark">OAN</span>
          <span>
            <span className="brand__name">OAN Fitness</span>
            <span className="brand__sub">Jaipur</span>
          </span>
        </Link>

        <nav className="nav" aria-label="Main">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `nav__link ${isActive ? 'is-active' : ''}`}
            >
              <Icon name={n.icon} size={18} className="nav__icon" />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          {/* Demo affordance — three logins, switched live, same app. */}
          <div className="role-switch">
            <span className="eyebrow">Demo · sign in as</span>
            <Select
              value={staffId}
              onChange={(e) => signInAs(e.target.value)}
              aria-label="Switch demo user"
            >
              {STAFF.filter((s) => s.role !== 'MEMBER').map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {ROLE_LABEL[s.role]}
                </option>
              ))}
            </Select>
          </div>

          <div className="who">
            <Avatar name={name} size={32} />
            <span>
              <span className="who__name">{name}</span>
              <br />
              <span className="who__role">{ROLE_LABEL[role]}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={theme === 'dark' ? 'sun' : 'moon'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{ marginLeft: 'auto' }}
            >
              Switch to {theme === 'dark' ? 'light' : 'dark'} theme
            </Button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="header">
          <Breadcrumbs />
          <span className="header__spacer" />
          <div className="header__tools">
            <button type="button" className="omni" onClick={() => setPaletteOpen(true)}>
              <Icon name="search" size={16} />
              <span>Search members…</span>
              <kbd className="kbd">⌘K</kbd>
            </button>
            <BranchSwitcher />
            <div className="bell">
              <Button
                variant="ghost"
                iconOnly
                icon="bell"
                onClick={() => setNotifOpen(true)}
                aria-label={`Notifications, ${unread} unread`}
              >
                Notifications
              </Button>
              {unread > 0 ? <span className="bell__dot" /> : null}
            </div>
          </div>
        </header>

        <main id="main">
          <Outlet />
        </main>

        <nav className="tabbar" aria-label="Main">
          {mobileItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `tabbar__link ${isActive ? 'is-active' : ''}`}
            >
              <Icon name={n.icon} size={20} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <NotificationCentre open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
