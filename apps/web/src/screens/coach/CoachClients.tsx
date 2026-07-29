import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '@oan/core';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Input,
  Pill,
  StatusPill,
  PermissionState,
} from '../../components/ui';
import { useSession } from '../../demo/session';
import { MEMBERS, maskPhone } from '../../demo/data';
import { daysSinceLastVisit, measurementsFor, statusOf } from '../../demo/selectors';

/** A coach's full client list — `assigned` scope, narrower than their branch. */
export function CoachClients() {
  const { actor, allowed } = useSession();
  const nav = useNavigate();
  const [q, setQ] = useState('');

  if (!allowed('member.view')) {
    return (
      <div className="page">
        <PermissionState what="client records" />
      </div>
    );
  }

  const all = MEMBERS.filter((m) => actor.assignedMemberIds?.includes(m.id));
  const rows = all.filter((m) => {
    const digits = q.replace(/\D/g, '');
    if (!q.trim()) return true;
    if (digits.length >= 3) return m.phone.includes(digits);
    return m.name.toLowerCase().includes(q.trim().toLowerCase());
  });

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="eyebrow">Assigned to me</span>
          <h1 className="page__title">Clients</h1>
          <p className="page__lede">
            Your own clients, not the branch's whole roster — {all.length} people.
          </p>
        </div>
      </div>

      <Input
        icon="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by phone or name…"
        aria-label="Search clients"
        inputMode="numeric"
      />

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="members"
            title={q ? `No client matches “${q}”` : 'No clients assigned yet'}
            body={
              q
                ? 'Only your own clients are searchable here.'
                : 'A branch manager assigns clients to you. Once they do, they appear here.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table table--clickable table--responsive">
              <caption className="visually-hidden">Assigned clients</caption>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Programme</th>
                  <th scope="col">Membership</th>
                  <th scope="col">Last trained</th>
                  <th scope="col">Measurements</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const gap = daysSinceLastVisit(m);
                  const measures = measurementsFor(m.id).length;
                  return (
                    <tr key={m.id} onClick={() => nav(`/members/${m.id}`)}>
                      <td data-label="Client">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
                          <Avatar name={m.name} size={32} />
                          <span>
                            <span style={{ fontWeight: 'var(--w-medium)' }}>{m.name}</span>
                            <br />
                            <span className="tnum" style={{ fontSize: 'var(--t-caption)', color: 'var(--text-3)' }}>
                              {maskPhone(m.phone)}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td data-label="Programme" style={{ color: 'var(--text-2)' }}>
                        {m.program}
                      </td>
                      <td data-label="Membership">
                        <StatusPill status={statusOf(m)} small />
                      </td>
                      <td data-label="Last trained">
                        {gap === null ? (
                          <span style={{ color: 'var(--text-3)' }}>Never</span>
                        ) : gap >= 14 ? (
                          <span style={{ color: 'var(--bad-fg)' }}>{gap} days ago</span>
                        ) : gap === 0 ? (
                          'Today'
                        ) : (
                          `${gap}d ago · ${formatDate(m.visits[0]!)}`
                        )}
                      </td>
                      <td data-label="Measurements">
                        {measures > 0 ? (
                          <Pill tone="neutral" small icon="ruler">
                            {measures} recorded
                          </Pill>
                        ) : (
                          <span style={{ color: 'var(--text-3)' }}>None yet</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="dumbbell"
                          onClick={() => nav(`/coach/session/${m.id}`)}
                        >
                          Log
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
