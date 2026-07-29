import { useNavigate } from 'react-router-dom';
import { ROLE_PERMISSIONS, formatDate } from '@oan/core';
import type { Permission, Role } from '@oan/core';
import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHead,
  Icon,
  Kpi,
  Pill,
  Section,
  PermissionState,
} from '../components/ui';
import { useSession, ROLE_LABEL } from '../demo/session';
import { BRANCHES, STAFF, branchById, maskPhone } from '../demo/data';

/**
 * Staff, and the roles that live inside it.
 *
 * There is no settings hub in this product — configuration lives inside the
 * module it belongs to (§13). Roles & permissions belong to Staff, so this is
 * where the matrix is shown, and it's rendered straight from
 * `ROLE_PERMISSIONS` rather than a hand-kept copy. If the rules change, this
 * screen changes with them.
 */

/** The permissions worth showing an owner. The full matrix has forty-odd. */
const SHOWN: { key: Permission; label: string }[] = [
  { key: 'member.view', label: 'See members' },
  { key: 'checkin.record', label: 'Check members in' },
  { key: 'payment.collect', label: 'Collect payment' },
  { key: 'payment.discount', label: 'Give a discount' },
  { key: 'payment.reverse', label: 'Reverse a payment' },
  { key: 'health.view', label: 'See health data' },
  { key: 'report.revenue', label: 'See revenue' },
  { key: 'report.pnl', label: 'See profit & loss' },
  { key: 'expense.record', label: 'Record expenses' },
  { key: 'equipment.manage', label: 'Edit the asset register' },
  { key: 'staff.manage', label: 'Manage staff' },
  { key: 'audit_log.view', label: 'Read the audit log' },
];

const ROLES: Role[] = ['ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'COACH', 'ACCOUNTANT'];

export function Staff() {
  const { allowed, branchId, canRollUp, branches } = useSession();
  const nav = useNavigate();

  if (!allowed('staff.manage') && !allowed('member.view')) {
    return (
      <div className="page">
        <PermissionState what="staff records" />
      </div>
    );
  }

  const scope = canRollUp ? branchId : (branches[0]?.id ?? null);
  const list = scope ? STAFF.filter((s) => s.branchId === scope) : STAFF;
  const canManage = allowed('staff.manage');

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="eyebrow">{scope ? branchById(scope).name : 'All branches'}</span>
          <h1 className="page__title">Staff</h1>
          <p className="page__lede">
            Who works where, and what each role is allowed to do.
          </p>
        </div>
        {canManage ? (
          <div className="page__actions">
            <Button variant="primary" icon="plus">
              Add staff
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid-kpi">
        <Kpi index={0} label="Headcount" value={list.length} icon="staff" />
        <Kpi index={1} label="Coaches" value={list.filter((s) => s.role === 'COACH').length} icon="dumbbell" />
        <Kpi index={2} label="Front desk" value={list.filter((s) => s.role === 'FRONT_DESK').length} icon="checkin" />
        <Kpi index={3} label="Managers" value={list.filter((s) => s.role === 'BRANCH_MANAGER').length} icon="shield" />
      </div>

      <Section eyebrow="The team" title="People" index={1}>
        <Card>
          <div className="table-wrap">
            <table className="table table--responsive">
              <caption className="visually-hidden">Staff list</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Branch</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Since</th>
                  <th scope="col">Certification</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td data-label="Name">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
                        <Avatar name={s.name} size={32} />
                        <span style={{ fontWeight: 'var(--w-medium)' }}>{s.name}</span>
                      </span>
                    </td>
                    <td data-label="Role">
                      <Pill tone={s.role === 'ADMIN' ? 'brand' : 'neutral'} small icon="shield">
                        {ROLE_LABEL[s.role]}
                      </Pill>
                    </td>
                    <td data-label="Branch" style={{ color: 'var(--text-2)' }}>
                      {s.role === 'ADMIN' || s.role === 'ACCOUNTANT'
                        ? 'All branches'
                        : branchById(s.branchId).short}
                    </td>
                    <td data-label="Phone" className="tnum" style={{ color: 'var(--text-2)' }}>
                      {maskPhone(s.phone)}
                    </td>
                    <td data-label="Since">{formatDate(s.since)}</td>
                    <td data-label="Certification" style={{ color: 'var(--text-3)' }}>
                      {s.certification ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      {/* Settings inside the module they belong to — no settings tree. */}
      <Section eyebrow="Settings · Admin only" title="Roles & permissions" index={2}>
        <Card>
          <CardHead
            title="What each role may do"
            sub="Rendered from the rules package, not a copy of it — a branch manager has the same permission as an Admin at a narrower scope"
            action={
              <Button variant="ghost" size="sm" iconRight="chevron-right" onClick={() => nav('/audit')}>
                Audit log
              </Button>
            }
          />
          <div className="table-wrap">
            <table className="table matrix">
              <caption className="visually-hidden">Role permission matrix</caption>
              <thead>
                <tr>
                  <th scope="col">Permission</th>
                  {ROLES.map((r) => (
                    <th key={r} scope="col" className="num">
                      {ROLE_LABEL[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SHOWN.map((p) => (
                  <tr key={p.key}>
                    <td>{p.label}</td>
                    {ROLES.map((r) => {
                      const grant = ROLE_PERMISSIONS[r][p.key];
                      return (
                        <td key={r} className="num">
                          {grant ? (
                            <span
                              className={`scope scope--${grant.scope}`}
                              title={
                                grant.elevated
                                  ? 'Elevated — logged as a sensitive action'
                                  : grant.capPercent !== undefined
                                    ? `Capped at ${grant.capPercent}%`
                                    : undefined
                              }
                            >
                              {grant.scope === 'all'
                                ? 'All branches'
                                : grant.scope === 'branch'
                                  ? 'Own branch'
                                  : grant.scope === 'assigned'
                                    ? 'Assigned only'
                                    : 'Self'}
                              {grant.capPercent !== undefined ? ` · ${grant.capPercent}%` : ''}
                              {grant.elevated ? (
                                <Icon name="shield" size={11} strokeWidth={2.2} />
                              ) : null}
                            </span>
                          ) : (
                            <span className="scope scope--none" aria-label="Not permitted">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CardBody>
            <p className="card__sub">
              Front desk can give up to 10% and it needs approval; a branch manager 25%; an Admin
              any amount. Nobody but an Admin can reverse a payment, and that is logged as an
              elevated action — money-touching rules are the reason this matrix exists.
            </p>
          </CardBody>
        </Card>
      </Section>

      {canRollUp && !branchId ? (
        <Section eyebrow="By branch" title="Where everyone works" index={3}>
          <div className="rollup">
            {BRANCHES.map((b) => {
              const at = STAFF.filter((s) => s.branchId === b.id);
              return (
                <div key={b.id} className="rollup__branch" style={{ cursor: 'default' }}>
                  <span>
                    <span className="rollup__name">{b.name}</span>
                    <br />
                    <span className="rollup__addr">Manager · {STAFF.find((s) => s.id === b.managerId)?.name}</span>
                  </span>
                  <span className="rollup__figures">
                    <span className="figure">
                      <span className="figure__value">{at.length}</span>
                      <span className="figure__label">Staff</span>
                    </span>
                    <span className="figure">
                      <span className="figure__value">{at.filter((s) => s.role === 'COACH').length}</span>
                      <span className="figure__label">Coaches</span>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
