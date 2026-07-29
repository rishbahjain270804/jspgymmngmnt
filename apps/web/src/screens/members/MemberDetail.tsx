import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { daysBetween, formatDate } from '@oan/core';
import {
  Avatar,
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
  Tabs,
  Timeline,
  TimelineItem,
  PermissionState,
  type TabItem,
} from '../../components/ui';
import { useSession } from '../../demo/session';
import { TODAY, branchById, formatPhone, staffById } from '../../demo/data';
import {
  attendance,
  invoicesFor,
  measurementsFor,
  memberById,
  progressDelta,
  statusOf,
} from '../../demo/selectors';
import { ProgressReport } from '../progress/ProgressReport';
import { inr } from '../../lib/money';
import type { Member } from '../../demo/types';

type TabKey = 'profile' | 'membership' | 'payments' | 'attendance' | 'progress' | 'workout' | 'diet';

/**
 * The member record.
 *
 * Seven tabs, but front desk sees four. Progress, Workout and Diet need
 * `health.view`, which counter staff don't get — medical conditions and
 * body-fat numbers are not counter-desk data. The tabs aren't disabled for
 * them, they simply aren't rendered.
 */
export function MemberDetail() {
  const { memberId } = useParams();
  const { allowed, can } = useSession();
  const nav = useNavigate();
  const [tab, setTab] = useState<TabKey>('profile');
  const [printing, setPrinting] = useState(false);

  const member = memberById(memberId);

  if (!member) {
    return (
      <div className="page">
        <EmptyState
          icon="search"
          title="No such member"
          body="This record doesn't exist, or it belongs to a branch outside your access."
          action={
            <Button variant="secondary" icon="arrow-left" onClick={() => nav('/members')}>
              Back to members
            </Button>
          }
        />
      </div>
    );
  }

  const target = { branchId: member.branchId, memberId: member.id };
  if (!allowed('member.view', target)) {
    return (
      <div className="page">
        <PermissionState what="this member's record" />
      </div>
    );
  }

  const canHealth = allowed('health.view', target);
  const canMoney = allowed('invoice.view', target);
  const status = statusOf(member);
  const left = daysBetween(TODAY, member.membership.expiresOn);
  const branch = branchById(member.branchId);
  const coach = staffById(member.coachId);

  const tabs: TabItem<TabKey>[] = [
    { value: 'profile', label: 'Profile', icon: 'user' },
    { value: 'membership', label: 'Membership', icon: 'receipt' },
    { value: 'payments', label: 'Payments', icon: 'wallet', hidden: !canMoney },
    { value: 'attendance', label: 'Attendance', icon: 'calendar' },
    { value: 'progress', label: 'Progress', icon: 'activity', hidden: !canHealth },
    { value: 'workout', label: 'Workout', icon: 'dumbbell', hidden: !canHealth },
    { value: 'diet', label: 'Diet', icon: 'flame', hidden: !canHealth },
  ];

  return (
    <div className="page">
      <div className="page__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)' }}>
          <Avatar name={member.name} size={56} />
          <div>
            <span className="eyebrow">
              <Link to={`/members/branch/${member.branchId}`} className="crumb">
                {branch.name}
              </Link>{' '}
              · {member.code} · joined {formatDate(member.joinedOn)}
            </span>
            <h1 className="page__title">{member.name}</h1>
            <p className="page__lede tnum">
              {formatPhone(member.phone)} · {member.gender} · {member.age}
            </p>
          </div>
        </div>
        <div className="page__actions">
          <Button
            variant="secondary"
            icon="whatsapp"
            onClick={() => window.open(`https://wa.me/91${member.phone}`, '_blank', 'noopener')}
          >
            WhatsApp
          </Button>
          {allowed('payment.collect', target) ? (
            <Button variant="primary" icon="wallet" onClick={() => nav(`/collect?member=${member.id}`)}>
              Collect payment
            </Button>
          ) : null}
        </div>
      </div>

      {/* Status banner — the one thing anyone opening this record wants first. */}
      <Card pad>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', flexWrap: 'wrap' }}>
          <StatusPill status={status} />
          <span style={{ fontWeight: 'var(--w-semibold)' }}>{member.membership.plan.name}</span>
          <span style={{ color: 'var(--text-2)' }}>
            {status === 'EXPIRED'
              ? `expired ${formatDate(member.membership.expiresOn)}`
              : `expires ${formatDate(member.membership.expiresOn)} · ${left} days`}
          </span>
          {member.membership.balanceDue > 0 ? (
            <Pill tone="warn" icon="wallet">
              {inr(member.membership.balanceDue)} outstanding
            </Pill>
          ) : null}
          <span style={{ marginLeft: 'auto', minWidth: 180 }}>
            <Progress
              value={Math.max(0, Math.min(100, (left / 365) * 100))}
              label={`${left} days remaining of this membership`}
              tone={status === 'EXPIRED' ? 'var(--bad)' : status === 'EXPIRING' ? 'var(--warn)' : 'var(--ok)'}
            />
          </span>
        </div>
      </Card>

      <Tabs value={tab} onChange={setTab} items={tabs} label="Member record" />

      {tab === 'profile' ? <ProfileTab member={member} canHealth={canHealth} /> : null}
      {tab === 'membership' ? <MembershipTab member={member} /> : null}
      {tab === 'payments' ? <PaymentsTab member={member} canReverse={can('payment.reverse').allowed} /> : null}
      {tab === 'attendance' ? <AttendanceTab member={member} /> : null}
      {tab === 'progress' ? (
        <ProgressTab member={member} onPrint={() => setPrinting(true)} />
      ) : null}
      {tab === 'workout' ? <WorkoutTab coachName={coach?.name} /> : null}
      {tab === 'diet' ? <DietTab /> : null}

      {printing ? <ProgressReport member={member} onClose={() => setPrinting(false)} /> : null}
    </div>
  );
}

function Def({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="def__label">{label}</div>
      <div className="def__value">{children}</div>
    </div>
  );
}

function ProfileTab({ member, canHealth }: { member: Member; canHealth: boolean }) {
  const branch = branchById(member.branchId);
  const coach = staffById(member.coachId);
  const att = attendance(member, 30);

  return (
    <div className="split-2">
      <Card>
        <CardHead title="Goal & intake" />
        <CardBody>
          <div className="defs">
            <Def label="Programme">{member.program}</Def>
            <Def label="Goal">{member.goal ?? 'Not recorded'}</Def>
            <Def label="Joined">{formatDate(member.joinedOn)}</Def>
            <Def label="Age / gender">
              {member.age} · {member.gender === 'M' ? 'Male' : 'Female'}
            </Def>
          </div>
          {canHealth ? (
            <div style={{ marginTop: 'var(--s-5)' }}>
              <div className="def__label">Medical notes</div>
              <div className="def__value">
                {member.medicalNote ?? 'None recorded at intake.'}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 'var(--s-5)' }}>
              <Pill tone="neutral" icon="lock" small>
                Medical notes need health access
              </Pill>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="stack" style={{ gap: 'var(--s-4)' }}>
        <Card>
          <CardHead title="Coach & branch" />
          <CardBody>
            <div className="defs">
              <Def label="Coach">
                {coach ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={coach.name} size={24} />
                    {coach.name}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-3)' }}>Not assigned</span>
                )}
              </Def>
              <Def label="Home branch">{branch.name}</Def>
              <Def label="Access">
                {member.membership.plan.branchAccess === 'ALL_BRANCHES'
                  ? 'Any OAN branch'
                  : 'This branch only'}
              </Def>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Attendance · 30 days" />
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)' }}>
              <span className="stat__value" style={{ fontSize: 'var(--t-h2)' }}>
                {att.attended}
              </span>
              <span style={{ color: 'var(--text-2)' }}>of {att.of} training days</span>
            </div>
            <div style={{ marginTop: 'var(--s-3)' }}>
              <Progress
                value={(att.attended / att.of) * 100}
                label={`${att.attended} visits out of ${att.of} training days`}
              />
            </div>
            <p className="card__sub" style={{ marginTop: 'var(--s-3)' }}>
              Longest gap {att.longestGap} day{att.longestGap === 1 ? '' : 's'}.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function MembershipTab({ member }: { member: Member }) {
  const m = member.membership;
  const status = statusOf(member);

  return (
    <div className="split-2">
      <Card>
        <CardHead title="Current membership" sub="Priced at the rate it was sold at" />
        <CardBody>
          <div className="defs">
            <Def label="Plan">{m.plan.name}</Def>
            <Def label="Programme">{member.program}</Def>
            <Def label="Started">{formatDate(m.startsOn)}</Def>
            <Def label="Expires">{formatDate(m.expiresOn)}</Def>
            <Def label="Price">{inr(m.plan.price)} incl. GST</Def>
            <Def label="Status">
              <StatusPill status={status} small />
            </Def>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Actions" />
        <CardBody>
          <div className="stack" style={{ gap: 'var(--s-3)' }}>
            <Button variant="primary" icon="refresh" block>
              Renew this plan
            </Button>
            <Button variant="secondary" icon="pause" block>
              Freeze membership
            </Button>
            <Button variant="secondary" icon="calendar" block>
              Change plan
            </Button>
            <p className="card__sub">
              Extending an expiry date needs Admin approval — it's the one change that quietly
              gives away money, so it's logged as an elevated action.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function PaymentsTab({ member, canReverse }: { member: Member; canReverse: boolean }) {
  const invoices = invoicesFor(member.id);

  return (
    <Card>
      <CardHead
        title="Payment history"
        sub="Financial records are never deleted — a correction posts a reversal"
        action={
          member.membership.balanceDue > 0 ? (
            <Pill tone="warn" icon="wallet">
              {inr(member.membership.balanceDue)} outstanding
            </Pill>
          ) : null
        }
      />
      {invoices.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="No payments recorded"
          body="Once this member pays, every receipt and its GST split appear here."
        />
      ) : (
        <div className="table-wrap">
          <table className="table table--responsive">
            <caption className="visually-hidden">Payment history for {member.name}</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Invoice</th>
                <th scope="col">For</th>
                <th scope="col">Mode</th>
                <th scope="col" className="num">Total</th>
                <th scope="col" className="num">Received</th>
                <th scope="col" className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 12).map((i) => (
                <tr key={i.id}>
                  <td data-label="Date">{formatDate(i.date)}</td>
                  <td data-label="Invoice" className="tnum" style={{ color: 'var(--text-2)' }}>
                    {i.number}
                  </td>
                  <td data-label="For">{i.planName}</td>
                  <td data-label="Mode">
                    <Pill tone="neutral" small icon={i.mode === 'CASH' ? 'cash' : i.mode === 'UPI' ? 'upi' : 'card'}>
                      {i.mode.replace('_', ' ')}
                    </Pill>
                  </td>
                  <td data-label="Total" className="num">{inr(i.total)}</td>
                  <td data-label="Received" className="num">{inr(i.received)}</td>
                  <td data-label="Balance" className="num">
                    {i.balance > 0 ? (
                      <span style={{ color: 'var(--warn-fg)' }}>{inr(i.balance)}</span>
                    ) : (
                      <span style={{ color: 'var(--text-3)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canReverse ? (
        <div className="card__foot">
          As Admin you can reverse a receipt. The original stays; a credit note is posted against
          it, and both appear in the audit log.
        </div>
      ) : null}
    </Card>
  );
}

function AttendanceTab({ member }: { member: Member }) {
  const att = attendance(member, 30);
  // Twelve weeks of squares, most recent last.
  const days = Array.from({ length: 84 }, (_, i) => {
    const d = 83 - i;
    const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    return { date, went: member.visits.includes(date as never) };
  });

  return (
    <div className="split-main">
      <Card>
        <CardHead title="Last twelve weeks" sub="One square per day — OAN runs six days a week" />
        <CardBody>
          <div className="heat" role="img" aria-label={`${att.attended} visits in the last 30 days`}>
            {days.map((d) => (
              <span
                key={d.date}
                className={`heat__cell ${d.went ? 'is-on' : ''}`}
                title={`${d.date}${d.went ? ' — trained' : ''}`}
              />
            ))}
          </div>
          <p className="card__sub" style={{ marginTop: 'var(--s-4)' }}>
            {att.attended} of {att.of} training days in the last 30. Longest gap {att.longestGap}{' '}
            day{att.longestGap === 1 ? '' : 's'}.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Recent visits" />
        <CardBody>
          <Timeline>
            {member.visits.slice(0, 6).map((v, i) => (
              <TimelineItem key={v} when={formatDate(v)} title="Checked in" highlight={i === 0} icon="check">
                {i === 0 ? 'Most recent visit' : null}
              </TimelineItem>
            ))}
          </Timeline>
        </CardBody>
      </Card>
    </div>
  );
}

function ProgressTab({ member, onPrint }: { member: Member; onPrint: () => void }) {
  const rows = measurementsFor(member.id);
  const delta = progressDelta(member.id);

  if (!delta || rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="ruler"
          title="No measurements yet"
          body="Record a baseline — weight, body fat, waist and chest — and the chart starts from there. OAN already promises body-composition tracking; this is where it lives."
          action={<Button variant="primary" icon="plus">Record measurement</Button>}
        />
      </Card>
    );
  }

  const chrono = [...rows].reverse();

  return (
    <div className="stack" style={{ gap: 'var(--s-5)' }}>
      <div className="page__head">
        <span className="eyebrow">
          {formatDate(delta.baseline.date)} — {formatDate(delta.latest.date)}
        </span>
        <div className="page__actions">
          <Button variant="secondary" icon="plus">
            Record measurement
          </Button>
          <Button variant="primary" icon="printer" onClick={onPrint}>
            Generate report
          </Button>
        </div>
      </div>

      <div className="grid-kpi">
        <MeasureStat label="Weight" value={`${delta.latest.weightKg} kg`} delta={delta.weight} unit="kg" goodWhenDown />
        <MeasureStat label="Body fat" value={`${delta.latest.bodyFatPct}%`} delta={delta.bodyFat} unit="pp" goodWhenDown />
        <MeasureStat label="Lean mass" value={`${delta.latest.leanKg} kg`} delta={delta.lean} unit="kg" />
        <MeasureStat label="Waist" value={`${delta.latest.waistIn} in`} delta={delta.waist} unit="in" goodWhenDown />
      </div>

      <Card>
        <CardHead title="Weight & body fat" sub={`${chrono.length} measurements`} />
        <CardBody>
          <LineChart
            caption={`Weight and body fat for ${member.name}`}
            labels={chrono.map((r) => formatDate(r.date).slice(0, 6))}
            series={[
              {
                name: 'Weight (kg)',
                color: 'var(--chart-1)',
                points: chrono.map((r) => r.weightKg),
                format: (n) => `${n.toFixed(1)}`,
              },
              {
                name: 'Body fat (%)',
                color: 'var(--chart-2)',
                points: chrono.map((r) => r.bodyFatPct),
                format: (n) => `${n.toFixed(1)}`,
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Measurement log" />
        <div className="table-wrap">
          <table className="table table--responsive">
            <caption className="visually-hidden">Measurement history</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col" className="num">Weight</th>
                <th scope="col" className="num">Body fat</th>
                <th scope="col" className="num">Lean</th>
                <th scope="col" className="num">Waist</th>
                <th scope="col">Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  <td data-label="Date">{formatDate(r.date)}</td>
                  <td data-label="Weight" className="num">{r.weightKg} kg</td>
                  <td data-label="Body fat" className="num">{r.bodyFatPct}%</td>
                  <td data-label="Lean" className="num">{r.leanKg} kg</td>
                  <td data-label="Waist" className="num">{r.waistIn} in</td>
                  <td data-label="Recorded by" style={{ color: 'var(--text-2)' }}>
                    {staffById(r.byStaffId)?.name ?? '—'}
                    {r.note ? ` · ${r.note}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MeasureStat({
  label,
  value,
  delta,
  unit,
  goodWhenDown,
}: {
  label: string;
  value: string;
  delta: number;
  unit: string;
  goodWhenDown?: boolean;
}) {
  const down = delta < 0;
  const good = goodWhenDown ? down : !down;
  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">{value}</span>
      <span className="kpi__foot">
        <span
          className="stat__delta"
          style={{ color: good ? 'var(--brand)' : 'var(--text-2)' }}
        >
          <Icon name={down ? 'arrow-down' : 'arrow-up'} size={13} />
          {Math.abs(delta)} {unit}
        </span>
        since baseline
      </span>
    </div>
  );
}

function WorkoutTab({ coachName }: { coachName?: string }) {
  return (
    <Card>
      <EmptyState
        icon="dumbbell"
        title="No programme assigned"
        body={
          coachName
            ? `${coachName} can assign a split from a template, then log sessions against it from the phone.`
            : 'Assign a coach first, then a programme can be attached from a template.'
        }
        action={<Button variant="primary" icon="plus">Assign from template</Button>}
      />
    </Card>
  );
}

function DietTab() {
  return (
    <Card>
      <EmptyState
        icon="flame"
        title="No diet plan assigned"
        body="Plans are built from Indian foods in household measures — a katori, a roti, a glass — because nobody weighs a roti in grams."
        action={<Button variant="primary" icon="plus">Assign a plan</Button>}
      />
    </Card>
  );
}
