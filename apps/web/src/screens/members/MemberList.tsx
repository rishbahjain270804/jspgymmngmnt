import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { daysBetween } from '@oan/core';
import {
  Avatar,
  Button,
  Card,
  Dialog,
  EmptyState,
  Icon,
  Input,
  Pill,
  Segmented,
  SkeletonRows,
  StatusPill,
  STATUS_TONE,
  TONE_VAR,
  PermissionState,
} from '../../components/ui';
import { useSession } from '../../demo/session';
import { PLANS, TODAY, branchById, maskPhone } from '../../demo/data';
import { membersIn, statusOf } from '../../demo/selectors';
import type { Member } from '../../demo/types';
import { useSimulatedLoad } from '../../lib/hooks';
import { inr } from '../../lib/money';

type Filter = 'all' | 'active' | 'expiring' | 'expired';

const PAGE = 40;

/**
 * Members — Level 2, one branch.
 *
 * Search is phone-number-first: it's how staff and members both think about
 * identity, and it's what someone at a counter can ask for over noise.
 * Status colour rides on every row, so the expiring list needs no separate
 * screen — it's this screen with a filter.
 */
export function MemberList() {
  const { branchId: paramBranch } = useParams();
  const { allowed, canRollUp, branches } = useSession();
  const nav = useNavigate();
  const loading = useSimulatedLoad();

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE);
  const [adding, setAdding] = useState(false);

  // A branch-scoped user can only ever be on their own branch's list.
  const branchId = canRollUp ? (paramBranch ?? null) : (branches[0]?.id ?? null);
  const branch = branchId ? branchById(branchId) : null;
  const all = membersIn(branchId);

  const counts = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;
    for (const m of all) {
      const s = statusOf(m);
      if (s === 'ACTIVE' || s === 'EXPIRING') active++;
      if (s === 'EXPIRING') expiring++;
      if (s === 'EXPIRED') expired++;
    }
    return { active, expiring, expired };
  }, [all]);

  const rows = useMemo(() => {
    const digits = q.replace(/\D/g, '');
    const text = q.trim().toLowerCase();

    return all
      .filter((m) => {
        const s = statusOf(m);
        if (filter === 'active' && s !== 'ACTIVE' && s !== 'EXPIRING') return false;
        if (filter === 'expiring' && s !== 'EXPIRING') return false;
        if (filter === 'expired' && s !== 'EXPIRED') return false;
        if (!q.trim()) return true;
        if (digits.length >= 3) return m.phone.includes(digits);
        return m.name.toLowerCase().includes(text) || m.code.toLowerCase().includes(text);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [all, q, filter]);

  const page = rows.slice(0, shown);

  // Checked after the hooks, never before — the hook order has to be the same
  // on every render, including the render where access is refused.
  if (!allowed('member.view', branchId ? { branchId } : {})) {
    return (
      <div className="page">
        <PermissionState what="this branch's member register" />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="eyebrow">
            {canRollUp ? <Link to="/members" className="crumb">Members</Link> : 'Members'} ·{' '}
            {branch?.address.split(',').slice(-2).join(',').trim()}
          </span>
          <h1 className="page__title">{branch?.name ?? 'All members'}</h1>
        </div>
        <div className="page__actions">
          <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
            Add member
          </Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar__search">
          <Input
            icon="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShown(PAGE);
            }}
            placeholder="Search by phone or name…"
            aria-label="Search members by phone number or name"
            inputMode="numeric"
            {...(q ? { affix: <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => setQ('')} aria-label="Clear search"><Icon name="x" size={14} /></button> } : {})}
          />
        </div>
        <Segmented
          label="Filter by membership status"
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setShown(PAGE);
          }}
          options={[
            { value: 'all', label: 'All', count: all.length },
            { value: 'active', label: 'Active', count: counts.active },
            { value: 'expiring', label: 'Expiring', count: counts.expiring },
            { value: 'expired', label: 'Expired', count: counts.expired },
          ]}
        />
      </div>

      <Card>
        {loading ? (
          <div style={{ padding: 'var(--s-3)' }}>
            <SkeletonRows rows={8} cols={4} />
          </div>
        ) : rows.length === 0 ? (
          q ? (
            <EmptyState
              icon="search"
              title={`No member on “${q}”`}
              body="Nobody at this branch matches. Check the number, or register them — it takes under two minutes."
              action={
                <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
                  Add member
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="members"
              title="No members here yet"
              body="Once someone joins at this branch they'll appear here, newest first."
              action={
                <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
                  Add the first member
                </Button>
              }
            />
          )
        ) : (
          <>
            <div className="table-wrap">
              <table className="table table--clickable table--responsive">
                <caption className="visually-hidden">
                  Members at {branch?.name}, {rows.length} matching
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="num">
                      Remaining
                    </th>
                    <th scope="col" className="num">
                      Balance
                    </th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((m) => (
                    <MemberRow key={m.id} member={m} onOpen={() => nav(`/members/${m.id}`)} />
                  ))}
                </tbody>
              </table>
            </div>

            {shown < rows.length ? (
              <div style={{ padding: 'var(--s-4)', textAlign: 'center' }}>
                <Button variant="secondary" onClick={() => setShown((s) => s + PAGE)}>
                  Show {Math.min(PAGE, rows.length - shown)} more · {rows.length - shown} left
                </Button>
              </div>
            ) : (
              <div className="card__foot">
                Showing all {rows.length.toLocaleString('en-IN')} matching members.
              </div>
            )}
          </>
        )}
      </Card>

      <AddMemberDialog open={adding} onClose={() => setAdding(false)} branchName={branch?.name ?? ''} />
    </div>
  );
}

function MemberRow({ member, onOpen }: { member: Member; onOpen: () => void }) {
  const status = statusOf(member);
  const left = daysBetween(TODAY, member.membership.expiresOn);
  const tone = STATUS_TONE[status];

  return (
    <tr
      className="row-rail"
      style={{ '--rail': TONE_VAR[tone] } as React.CSSProperties}
      onClick={onOpen}
    >
      <td data-label="Member">
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
          <Avatar name={member.name} size={34} />
          <span>
            <span style={{ fontWeight: 'var(--w-medium)' }}>{member.name}</span>
            <br />
            <span className="tnum" style={{ fontSize: 'var(--t-caption)', color: 'var(--text-3)' }}>
              {maskPhone(member.phone)} · {member.code}
            </span>
          </span>
        </span>
      </td>
      <td data-label="Plan" style={{ color: 'var(--text-2)' }}>
        {member.membership.plan.name}
      </td>
      <td data-label="Status">
        <StatusPill status={status} small />
      </td>
      <td data-label="Remaining" className="num tnum">
        {status === 'EXPIRED' ? (
          <span style={{ color: 'var(--bad-fg)' }}>{Math.abs(left)}d ago</span>
        ) : status === 'FROZEN' ? (
          '—'
        ) : (
          `${left}d`
        )}
      </td>
      <td data-label="Balance" className="num tnum">
        {member.membership.balanceDue > 0 ? (
          <span style={{ color: 'var(--warn-fg)', fontWeight: 'var(--w-semibold)' }}>
            {inr(member.membership.balanceDue)}
          </span>
        ) : (
          <span style={{ color: 'var(--text-3)' }}>—</span>
        )}
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {status === 'EXPIRING' || status === 'EXPIRED' ? (
            <Button
              variant="secondary"
              size="sm"
              icon="whatsapp"
              onClick={() =>
                window.open(
                  `https://wa.me/91${member.phone}?text=${encodeURIComponent(
                    `Hi ${member.name.split(' ')[0]}, your OAN Fitness membership ${
                      status === 'EXPIRED' ? 'has expired' : `expires in ${left} days`
                    }. Renew at the counter or reply here.`,
                  )}`,
                  '_blank',
                  'noopener',
                )
              }
            >
              Remind
            </Button>
          ) : null}
          {member.membership.balanceDue > 0 ? (
            <Button variant="primary" size="sm" icon="wallet">
              Collect
            </Button>
          ) : null}
        </span>
      </td>
    </tr>
  );
}

/** Registration in under two minutes: five fields, everything else behind More. */
function AddMemberDialog({
  open,
  onClose,
  branchName,
}: {
  open: boolean;
  onClose: () => void;
  branchName: string;
}) {
  const [more, setMore] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add member"
      sub={`Joining at ${branchName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="check" onClick={onClose}>
            Save and collect payment
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 'var(--s-4)' }}>
        <Input label="Mobile number" icon="phone" placeholder="98290 11001" inputMode="numeric" hint="This is their login, their receipt, and how we find them at the counter." />
        <Input label="Full name" icon="user" placeholder="Rahul Sharma" />
        <div className="split-2">
          <Input label="Age" inputMode="numeric" placeholder="28" />
          <div className="field">
            <span className="field__label">Gender</span>
            <Segmented
              label="Gender"
              value="M"
              onChange={() => undefined}
              options={[
                { value: 'M', label: 'Male' },
                { value: 'F', label: 'Female' },
              ]}
            />
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="add-plan">
            Plan
          </label>
          <select className="input" id="add-plan" defaultValue={PLANS[3]!.planId}>
            {PLANS.map((p) => (
              <option key={p.planId} value={p.planId}>
                {p.name} — {inr(p.price)}
              </option>
            ))}
          </select>
        </div>

        <Button variant="ghost" size="sm" icon={more ? 'chevron-down' : 'chevron-right'} onClick={() => setMore((m) => !m)}>
          {more ? 'Hide' : 'More'} — address, emergency contact, medical notes
        </Button>

        {more ? (
          <div className="stack rise" style={{ gap: 'var(--s-4)' }}>
            <Input label="Address" placeholder="Sector 4, Vidhyadhar Nagar" />
            <Input label="Emergency contact" icon="phone" inputMode="numeric" />
            <div className="field">
              <label className="field__label" htmlFor="add-med">
                Medical notes
              </label>
              <textarea
                className="input"
                id="add-med"
                placeholder="Knee injury, cleared for training from March"
              />
            </div>
            <Pill tone="neutral" small icon="lock">
              Medical notes are health data — counter staff can't see them
            </Pill>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
