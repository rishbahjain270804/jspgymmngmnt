import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { daysBetween, formatDate } from '@oan/core';
import {
  Button,
  Card,
  CardBody,
  CardHead,
  EmptyState,
  Icon,
  LineChart,
  Pill,
  Progress,
  StatusPill,
  Timeline,
  TimelineItem,
} from '../../components/ui';
import { TODAY, branchById, staffById } from '../../demo/data';
import {
  attendance,
  invoicesFor,
  measurementsFor,
  memberById,
  progressDelta,
  statusOf,
} from '../../demo/selectors';
import { useSession } from '../../demo/session';
import { inr } from '../../lib/money';
import './member-app.css';

/**
 * The member's phone app.
 *
 * Four tabs, `self` scope, and no staff chrome at all — it is a different
 * front end onto the same rules, which is the point of §2: one backend,
 * several thin role-specific apps, so nobody ever sees a feature that isn't
 * theirs.
 *
 * Rendered here in a phone frame on desktop so it can be shown in a
 * walkthrough beside the counter screens.
 */

const ME = 'mb-1042'; // Rahul Sharma, the member the wireframes follow.

const TABS = [
  { to: '/app/member', label: 'Me', icon: 'user' as const, end: true },
  { to: '/app/member/progress', label: 'Progress', icon: 'activity' as const },
  { to: '/app/member/plan', label: 'Plan', icon: 'receipt' as const },
  { to: '/app/member/pay', label: 'Pay', icon: 'wallet' as const },
];

export function MemberApp() {
  const nav = useNavigate();
  const { theme, setTheme } = useSession();
  const member = memberById(ME);

  if (!member) return null;

  return (
    <div className="phone-stage">
      <aside className="phone-note only-desktop">
        <span className="eyebrow">Member app</span>
        <h1 className="phone-note__title">The four tabs a member gets</h1>
        <p className="phone-note__body">
          Their plan, their attendance, their progress, their payments — nothing else exists for
          them. The QR on the first tab is what the counter scans, so a member never queues to
          sign a book.
        </p>
        <div className="phone-note__actions">
          <Button variant="secondary" icon="arrow-left" onClick={() => nav('/')}>
            Back to the staff app
          </Button>
          <Button
            variant="ghost"
            icon={theme === 'dark' ? 'sun' : 'moon'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? 'Light' : 'Dark'} theme
          </Button>
        </div>
      </aside>

      <div className="phone">
        <div className="phone__screen">
          <header className="phone__header">
            <span className="brand__mark" style={{ width: 26, height: 26, fontSize: 10 }}>
              OAN
            </span>
            <span style={{ fontWeight: 'var(--w-semibold)' }}>{member.name.split(' ')[0]}</span>
            <Button variant="ghost" size="sm" iconOnly icon="bell" style={{ marginLeft: 'auto' }}>
              Notifications
            </Button>
          </header>

          <main className="phone__body">
            <Routes>
              <Route index element={<MeTab />} />
              <Route path="progress" element={<ProgressTab />} />
              <Route path="plan" element={<PlanTab />} />
              <Route path="pay" element={<PayTab />} />
              <Route path="*" element={<Navigate to="/app/member" replace />} />
            </Routes>
          </main>

          <nav className="phone__tabs" aria-label="Member app">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) => `phone__tab ${isActive ? 'is-active' : ''}`}
              >
                <Icon name={t.icon} size={19} />
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}

function useMe() {
  return memberById(ME)!;
}

function MeTab() {
  const m = useMe();
  const left = daysBetween(TODAY, m.membership.expiresOn);
  const att = attendance(m, 30);
  const branch = branchById(m.branchId);

  return (
    <div className="stack" style={{ gap: 'var(--s-4)' }}>
      {/* The QR is the whole reason a member opens this app. */}
      <Card pad>
        <div className="qr-block">
          <div className="qr-block__code" aria-label="Your check-in QR code" role="img">
            <QrGlyph seed={m.code} />
          </div>
          <div>
            <span className="eyebrow">Show this at the counter</span>
            <div style={{ fontWeight: 'var(--w-semibold)', fontSize: 'var(--t-body)' }}>
              {m.name}
            </div>
            <div className="card__sub tnum">{m.code} · {branch.short}</div>
          </div>
        </div>
      </Card>

      <Card pad>
        <span className="eyebrow">{m.membership.plan.name}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)', marginTop: 4 }}>
          <span className="phone__big tnum">{left}</span>
          <span style={{ color: 'var(--text-2)' }}>days remaining</span>
        </div>
        <div style={{ marginTop: 'var(--s-3)' }}>
          <Progress
            value={Math.max(0, Math.min(100, (left / 365) * 100))}
            label={`${left} days remaining`}
            tone={left <= 7 ? 'var(--warn)' : 'var(--ok)'}
          />
        </div>
        <div style={{ marginTop: 'var(--s-3)' }}>
          <StatusPill status={statusOf(m)} small />
        </div>
      </Card>

      <Card pad>
        <span className="eyebrow">This month</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)', marginTop: 4 }}>
          <span className="phone__big tnum">{att.attended}</span>
          <span style={{ color: 'var(--text-2)' }}>visits</span>
        </div>
        <p className="card__sub" style={{ marginTop: 4 }}>
          Out of {att.of} training days. Longest gap {att.longestGap} days.
        </p>
      </Card>

      <Card pad>
        <span className="eyebrow">Recent visits</span>
        <div style={{ marginTop: 'var(--s-3)' }}>
          <Timeline>
            {m.visits.slice(0, 4).map((v, i) => (
              <TimelineItem key={v} when={formatDate(v)} title="Checked in" highlight={i === 0} icon="check" />
            ))}
          </Timeline>
        </div>
      </Card>
    </div>
  );
}

function ProgressTab() {
  const m = useMe();
  const delta = progressDelta(m.id);
  const rows = measurementsFor(m.id);

  if (!delta) {
    return (
      <EmptyState
        icon="ruler"
        title="No measurements yet"
        body="Ask your coach to take a baseline. After that this tab shows how you're changing."
      />
    );
  }

  const chrono = [...rows].reverse();

  return (
    <div className="stack" style={{ gap: 'var(--s-4)' }}>
      <div className="phone__grid">
        <Card pad>
          <span className="eyebrow">Weight</span>
          <div className="phone__big tnum">{delta.latest.weightKg}</div>
          <span className="stat__delta" style={{ color: 'var(--brand)' }}>
            <Icon name="arrow-down" size={12} />
            {Math.abs(delta.weight)} kg
          </span>
        </Card>
        <Card pad>
          <span className="eyebrow">Body fat</span>
          <div className="phone__big tnum">{delta.latest.bodyFatPct}%</div>
          <span className="stat__delta" style={{ color: 'var(--brand)' }}>
            <Icon name="arrow-down" size={12} />
            {Math.abs(delta.bodyFat)} pp
          </span>
        </Card>
      </div>

      <Card>
        <CardHead title="Since you started" sub={formatDate(delta.baseline.date)} />
        <CardBody>
          <LineChart
            height={170}
            caption="Your weight and body fat over time"
            labels={chrono.map((r) => formatDate(r.date).slice(0, 6))}
            series={[
              {
                name: 'Weight',
                color: 'var(--chart-1)',
                points: chrono.map((r) => r.weightKg),
                format: (n) => n.toFixed(1),
              },
            ]}
          />
        </CardBody>
      </Card>

      <Button variant="primary" block icon="whatsapp">
        Get my progress report
      </Button>
    </div>
  );
}

function PlanTab() {
  const m = useMe();
  const coach = staffById(m.coachId);
  const branch = branchById(m.branchId);

  return (
    <div className="stack" style={{ gap: 'var(--s-4)' }}>
      <Card pad>
        <span className="eyebrow">Current plan</span>
        <div style={{ fontSize: 'var(--t-section)', fontWeight: 'var(--w-bold)', marginTop: 4 }}>
          {m.membership.plan.name}
        </div>
        <p className="card__sub">
          {formatDate(m.membership.startsOn)} — {formatDate(m.membership.expiresOn)}
        </p>
        <div style={{ marginTop: 'var(--s-3)', display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
          <Pill tone="neutral" small icon={m.membership.plan.branchAccess === 'ALL_BRANCHES' ? 'branches' : 'map-pin'}>
            {m.membership.plan.branchAccess === 'ALL_BRANCHES' ? 'Any branch' : branch.short + ' only'}
          </Pill>
          <Pill tone="neutral" small icon="flame">
            {m.program}
          </Pill>
        </div>
      </Card>

      <Card pad>
        <span className="eyebrow">Your coach</span>
        <div style={{ marginTop: 6, fontWeight: 'var(--w-semibold)' }}>
          {coach?.name ?? 'Not assigned yet'}
        </div>
        {coach?.certification ? <p className="card__sub">{coach.certification}</p> : null}
      </Card>

      <Card pad>
        <span className="eyebrow">Your gym</span>
        <div style={{ marginTop: 6, fontWeight: 'var(--w-semibold)' }}>{branch.name}</div>
        <p className="card__sub">{branch.address}</p>
        <p className="card__sub" style={{ marginTop: 4 }}>{branch.hours}</p>
      </Card>

      <Card>
        <EmptyState
          icon="dumbbell"
          title="No workout plan yet"
          body="When your coach assigns a programme it appears here, so you're not carrying a paper chart."
        />
      </Card>
    </div>
  );
}

function PayTab() {
  const m = useMe();
  const invoices = invoicesFor(m.id);
  const due = m.membership.balanceDue;

  return (
    <div className="stack" style={{ gap: 'var(--s-4)' }}>
      <Card pad>
        <span className="eyebrow">Outstanding</span>
        <div className="phone__big tnum" style={{ color: due > 0 ? 'var(--warn-fg)' : undefined }}>
          {inr(due)}
        </div>
        <p className="card__sub">
          {due > 0 ? 'Payable at the counter or by UPI.' : 'Nothing due — you are paid up.'}
        </p>
        {due > 0 ? (
          <Button variant="primary" block icon="upi" style={{ marginTop: 'var(--s-3)' }}>
            Pay {inr(due)} by UPI
          </Button>
        ) : null}
      </Card>

      <Card>
        <CardHead title="Receipts" sub="Every payment, with its GST split" />
        {invoices.length === 0 ? (
          <EmptyState icon="receipt" title="No receipts yet" body="Your first payment will appear here." />
        ) : (
          <CardBody>
            <div className="stack" style={{ gap: 'var(--s-3)' }}>
              {invoices.slice(0, 6).map((i) => (
                <div className="phone__row" key={i.id}>
                  <span>
                    <span style={{ fontWeight: 'var(--w-medium)' }}>{i.planName}</span>
                    <br />
                    <span className="card__sub tnum">
                      {formatDate(i.date)} · {i.number}
                    </span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <span className="tnum" style={{ fontWeight: 'var(--w-semibold)' }}>
                      {inr(i.received)}
                    </span>
                    <br />
                    <Button variant="ghost" size="sm" icon="download">
                      Receipt
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}

/**
 * A deterministic QR-looking glyph. This is a demo — it encodes nothing, and
 * saying so here is cheaper than someone later discovering it the hard way.
 */
function QrGlyph({ seed }: { seed: string }) {
  const n = 11;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;

  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    cells.push(((h >>> 16) & 1) === 1);
  }
  // Finder squares in three corners, as a real QR has.
  const finder = (r: number, c: number) =>
    (r < 3 && c < 3) || (r < 3 && c >= n - 3) || (r >= n - 3 && c < 3);

  return (
    <svg viewBox={`0 0 ${n} ${n}`} width="100%" height="100%" shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      {Array.from({ length: n * n }, (_, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        const on = finder(r, c) ? (r % 2 === 0 || c % 2 === 0) : cells[i];
        return on ? <rect key={i} x={c} y={r} width={1} height={1} fill="#0d1420" /> : null;
      })}
    </svg>
  );
}
