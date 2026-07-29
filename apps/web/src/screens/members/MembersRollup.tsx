import { Navigate, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHead,
  Icon,
  Kpi,
  Section,
  SkeletonKpis,
  PermissionState,
} from '../../components/ui';
import { useSession } from '../../demo/session';
import { BRANCHES, PLANS } from '../../demo/data';
import { memberStats } from '../../demo/selectors';
import { useSimulatedLoad } from '../../lib/hooks';
import { inr } from '../../lib/money';

/**
 * Members — Level 1, the roll-up.
 *
 * Total outside, branch-wise inside. This is the pattern every branch-scoped
 * entity follows, and the reason the product doesn't feel heavy: there is no
 * merged list of 1,240 members across branches, because that list is exactly
 * what makes gym software feel heavy.
 *
 * A branch manager never reaches this screen. Not because it's hidden, but
 * because the aggregate is a permission rather than a page — `visibleBranches`
 * returns their own branch, so they are sent straight to Level 2.
 */
export function MembersRollup() {
  const { canRollUp, branches, allowed } = useSession();
  const nav = useNavigate();
  const loading = useSimulatedLoad();

  if (!allowed('member.view')) {
    return (
      <div className="page">
        <PermissionState what="the member register" />
      </div>
    );
  }

  // Scope decides the entry point (§13).
  if (!canRollUp) {
    const only = branches[0]?.id;
    return only ? <Navigate to={`/members/branch/${only}`} replace /> : null;
  }

  const total = memberStats(null);

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="eyebrow">All branches</span>
          <h1 className="page__title">Members</h1>
          <p className="page__lede">
            One number, then the split. Open a branch to reach its actual register.
          </p>
        </div>
        <div className="page__actions">
          <Button variant="primary" icon="plus" onClick={() => nav(`/members/branch/${BRANCHES[0]!.id}`)}>
            Add member
          </Button>
        </div>
      </div>

      {loading ? (
        <SkeletonKpis count={4} />
      ) : (
        <div className="grid-kpi">
          <Kpi index={0} label="Total active" value={total.active} icon="members" />
          <Kpi index={1} label="Expiring within 7 days" value={total.expiring} icon="clock" />
          <Kpi index={2} label="Expired" value={total.expired} icon="x-circle" />
          <Kpi index={3} label="New this month" value={total.newThisMonth} icon="trend-up" />
        </div>
      )}

      <Section eyebrow="Split by branch — open one to see its register" title="By branch" index={1}>
        <div className="rollup">
          {BRANCHES.map((b) => {
            const s = memberStats(b.id);
            return (
              <button
                key={b.id}
                type="button"
                className="rollup__branch"
                onClick={() => nav(`/members/branch/${b.id}`)}
              >
                <span>
                  <span className="rollup__name">{b.name}</span>
                  <br />
                  <span className="rollup__addr">{b.address}</span>
                </span>
                <span className="rollup__figures">
                  <span className="figure">
                    <span className="figure__value">{s.active.toLocaleString('en-IN')}</span>
                    <span className="figure__label">Active</span>
                  </span>
                  <span className="figure">
                    <span className="figure__value" style={{ color: 'var(--warn-fg)' }}>
                      {s.expiring}
                    </span>
                    <span className="figure__label">Expiring</span>
                  </span>
                  <span className="figure">
                    <span className="figure__value" style={{ color: 'var(--bad-fg)' }}>
                      {s.expired}
                    </span>
                    <span className="figure__label">Expired</span>
                  </span>
                  <Icon name="chevron-right" size={20} />
                </span>
              </button>
            );
          })}
        </div>
        <p className="card__sub">
          Aggregate only. There is deliberately no merged list of{' '}
          {total.total.toLocaleString('en-IN')} members across branches.
        </p>
      </Section>

      {/* Plans live inside Members: a plan is only meaningful as something a
          member is on. A separate nav item would be a settings page pretending
          to be a module (§13). */}
      <Section
        eyebrow="Settings · Admin only"
        title="Plans & pricing"
        index={2}
        action={
          <Button variant="secondary" size="sm" icon="plus">
            Add plan
          </Button>
        }
      >
        <Card>
          <CardHead
            title={`${PLANS.length} plans across OAN's eight programmes`}
            sub="Change a price here and the next invoice uses it. Existing memberships keep the price they were sold at."
          />
          <CardBody>
            <div className="table-wrap">
              <table className="table table--responsive">
                <caption className="visually-hidden">Membership plans and pricing</caption>
                <thead>
                  <tr>
                    <th scope="col">Plan</th>
                    <th scope="col">Programme</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Branch access</th>
                    <th scope="col" className="num">
                      Price
                    </th>
                    <th scope="col" className="num">
                      On this plan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PLANS.map((p) => (
                    <tr key={p.planId}>
                      <td data-label="Plan">
                        <span style={{ fontWeight: 'var(--w-medium)' }}>{p.name}</span>
                        {p.popular ? (
                          <span className="pill pill--brand pill--sm" style={{ marginLeft: 8 }}>
                            <Icon name="sparkle" size={11} />
                            Most sold
                          </span>
                        ) : null}
                      </td>
                      <td data-label="Programme" style={{ color: 'var(--text-2)' }}>
                        {p.program}
                      </td>
                      <td data-label="Duration">
                        {p.durationCount} {p.durationUnit.toLowerCase()}
                        {p.durationCount > 1 ? 's' : ''}
                      </td>
                      <td data-label="Branch access">
                        <span className={`pill pill--${p.branchAccess === 'ALL_BRANCHES' ? 'brand' : 'neutral'} pill--sm`}>
                          <Icon name={p.branchAccess === 'ALL_BRANCHES' ? 'branches' : 'map-pin'} size={11} />
                          {p.branchAccess === 'ALL_BRANCHES' ? 'All branches' : 'Home branch'}
                        </span>
                      </td>
                      <td data-label="Price" className="num">
                        {inr(p.price)}
                        <span style={{ color: 'var(--text-3)', fontSize: 'var(--t-caption)' }}>
                          {' '}
                          incl. GST
                        </span>
                      </td>
                      <td data-label="On this plan" className="num">
                        {p.activeCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </Section>
    </div>
  );
}
