import { useNavigate } from 'react-router-dom';
import {
  BarCompare,
  Button,
  Card,
  CardBody,
  CardHead,
  EmptyState,
  Icon,
  type IconName,
  Kpi,
  LineChart,
  Section,
  Segmented,
  SkeletonKpis,
  PermissionState,
} from '../components/ui';
import { useSession } from '../demo/session';
import {
  BRANCHES,
  COLLECTED_TODAY,
  EARNED_TODAY_ACCRUAL,
  REVENUE_TREND,
  branchById,
  checkInsToday,
  netProfit,
  pnlTotals,
} from '../demo/data';
import { dues, memberStats } from '../demo/selectors';
import { type Recommendation, recommendations, stakeSummary } from '../demo/recommend';
import { useSimulatedLoad } from '../lib/hooks';
import { inr, inrShort } from '../lib/money';

/**
 * Owner dashboard.
 *
 * Six numbers above the fold, then the branch comparison, then the trend.
 * The branch switcher and the cash/accrual toggle live in the header and
 * apply to everything below — they are not per-card filters.
 *
 * "What to do next" is the screen's real job. Revenue tells an owner how the
 * month went; those rows are the ones still fixable today, ranked by what
 * they are worth and each carrying the arithmetic that produced its figure.
 * The rows used to be hand-written prose with a count beside them — the
 * engine replaced the prose, not the intent.
 */

/** Branch share of a brand-wide figure, so scoping a KPI stays honest. */
const SHARE: Record<string, number> = { 'br-vn': 0.64, 'br-ms': 0.36 };

export function Dashboard() {
  const { branchId, canRollUp, branches, allowed, basis, setBasis } = useSession();
  const nav = useNavigate();
  const loading = useSimulatedLoad();

  if (!allowed('report.revenue')) {
    return (
      <div className="page">
        <PermissionState what="branch revenue" who="an Admin" />
      </div>
    );
  }

  const scope = canRollUp ? branchId : (branches[0]?.id ?? null);
  const members = memberStats(scope);
  const profit = netProfit();
  const outstanding = dues(scope);
  const income = pnlTotals('income');
  const recs = recommendations(scope);
  const stake = stakeSummary(scope);

  const share = scope ? (SHARE[scope] ?? 0.5) : 1;
  const collected = COLLECTED_TODAY * share;
  const earned = EARNED_TODAY_ACCRUAL * share;
  const scopeNet = !scope ? profit.total : scope === 'br-vn' ? profit.vn : profit.ms;

  const title = scope ? branchById(scope).name : 'All branches';

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="eyebrow">
            Today ·{' '}
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </span>
          <h1 className="page__title">{title}</h1>
          <p className="page__lede">
            {basis === 'CASH'
              ? 'Cash basis — what actually came in.'
              : 'Accrual basis — what was earned, whether or not it has been collected yet.'}
          </p>
        </div>
        <div className="page__actions">
          <Segmented
            label="Accounting basis"
            value={basis}
            onChange={setBasis}
            options={[
              { value: 'CASH', label: 'Cash' },
              { value: 'ACCRUAL', label: 'Accrual' },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <SkeletonKpis count={6} />
      ) : (
        <div className="grid-kpi">
          <Kpi
            index={0}
            label="Collected today"
            value={collected}
            format={inr}
            display={inr(collected)}
            icon="wallet"
            hint="Cash, UPI and card"
            onClick={() => nav('/accounts/daybook')}
          />
          <Kpi
            index={1}
            label="Earned today"
            value={earned}
            format={inr}
            display={inr(earned)}
            icon="book"
            hint="Recognised from deferred revenue"
          />
          <Kpi
            index={2}
            label="Net profit · this month"
            value={scopeNet}
            format={inrShort}
            display={inrShort(scopeNet)}
            icon="trend-up"
            delta={{ value: '12%', direction: 'up' }}
            onClick={() => nav('/accounts')}
          />
          <Kpi
            index={3}
            label="Check-ins today"
            value={checkInsToday(scope)}
            icon="checkin"
            hint={`${members.active.toLocaleString('en-IN')} active members`}
          />
          <Kpi
            index={4}
            label="Expiring within 7 days"
            value={members.expiring}
            icon="clock"
            hint="Renewals to chase"
            onClick={() => nav('/members')}
          />
          <Kpi
            index={5}
            label="Outstanding dues"
            value={outstanding}
            format={inr}
            display={inr(outstanding)}
            icon="alert"
            hint="Part payments not yet cleared"
            onClick={() => nav('/accounts/receivables')}
          />
        </div>
      )}

      {canRollUp && !branchId ? (
        <Section eyebrow="This month" title="Branch comparison" index={1}>
          <div className="split-2">
            <Card>
              <CardHead title="Revenue" sub="What each branch collected" />
              <CardBody>
                <BarCompare
                  caption="Revenue this month by branch"
                  format={inrShort}
                  rows={[
                    { label: 'V. Nagar', value: income.vn, color: 'var(--chart-1)' },
                    { label: 'Mansarovar', value: income.ms, color: 'var(--chart-2)' },
                  ]}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHead
                title="Net profit"
                sub="The number revenue alone hides"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    iconRight="chevron-right"
                    onClick={() => nav('/accounts')}
                  >
                    Open P&amp;L
                  </Button>
                }
              />
              <CardBody>
                <BarCompare
                  caption="Net profit this month by branch"
                  format={inrShort}
                  rows={[
                    { label: 'V. Nagar', value: profit.vn, color: 'var(--chart-1)' },
                    { label: 'Mansarovar', value: profit.ms, color: 'var(--chart-3)' },
                  ]}
                />
                <p className="card__sub" style={{ marginTop: 'var(--s-4)' }}>
                  Mansarovar collects {inrShort(income.ms)} and keeps {inr(profit.ms)}. Revenue
                  alone said it was fine.
                </p>
              </CardBody>
            </Card>
          </div>
        </Section>
      ) : null}

      <Section eyebrow="Six months" title="Revenue trend" index={2}>
        <Card>
          <CardBody>
            <LineChart
              caption="Monthly revenue by branch, February to July"
              labels={REVENUE_TREND.labels}
              series={
                scope
                  ? [
                      {
                        name: branchById(scope).short,
                        color: 'var(--chart-1)',
                        points: (scope === 'br-vn' ? REVENUE_TREND.vn : REVENUE_TREND.ms).map(
                          (v) => v * 100,
                        ),
                        format: inrShort,
                      },
                    ]
                  : [
                      {
                        name: 'V. Nagar',
                        color: 'var(--chart-1)',
                        points: REVENUE_TREND.vn.map((v) => v * 100),
                        format: inrShort,
                      },
                      {
                        name: 'Mansarovar',
                        color: 'var(--chart-2)',
                        points: REVENUE_TREND.ms.map((v) => v * 100),
                        format: inrShort,
                      },
                    ]
              }
            />
          </CardBody>
        </Card>
      </Section>

      <Section
        eyebrow="Ranked by rupees at stake"
        title="What to do next"
        index={3}
        action={
          recs.length ? (
            <p className="card__sub">
              <b className="tnum">{inr(stake.inflow)}</b> to collect ·{' '}
              <b className="tnum">{inr(stake.cost)}</b> at risk, over{' '}
              {stake.records.toLocaleString('en-IN')} records
            </p>
          ) : null
        }
      >
        <div className="stack" style={{ gap: 'var(--s-2)' }}>
          {recs.length ? (
            recs.map((r) => (
              <RecommendationRow key={r.id} rec={r} onOpen={() => nav(r.href)} />
            ))
          ) : (
            <EmptyState
              icon="check-circle"
              title="Nothing needs chasing"
              body="No expiries this week, no balances outstanding, no machines down."
            />
          )}
        </div>
      </Section>

      {BRANCHES.length > 1 && canRollUp && !branchId ? (
        <p className="card__sub">
          Every figure above is scoped by the branch switcher in the header. Pick a branch to see
          the same screen for one location.
        </p>
      ) : null}
    </div>
  );
}

const REC_ICON: Record<Recommendation['id'], IconName> = {
  RENEWAL: 'clock',
  DUES: 'wallet',
  ABSENCE: 'activity',
  DOWNTIME: 'wrench',
};

/**
 * One recommendation, with its arithmetic one keystroke away.
 *
 * The working is a native `<details>` — it is keyboard-operable and
 * screen-reader-announced without a line of state, and this screen has no
 * business reimplementing a disclosure widget. Collapsed by default because
 * the owner reading the dashboard wants the figure; the derivation is for the
 * moment they don't believe it, which is exactly when it has to be there.
 */
function RecommendationRow({ rec, onOpen }: { rec: Recommendation; onOpen: () => void }) {
  return (
    <details className="rec">
      <summary className="rec__head">
        <span className={`attention__icon attention__icon--${rec.tone}`}>
          <Icon name={REC_ICON[rec.id]} size={18} />
        </span>
        <span className="attention__text">
          <span className="attention__title">{rec.title}</span>
          <span className="attention__body">
            {rec.direction === 'INFLOW' ? 'To collect' : 'At risk'} · computed over{' '}
            {rec.records.toLocaleString('en-IN')} records · show the working
          </span>
        </span>
        <b className={`rec__amount tnum rec__amount--${rec.direction.toLowerCase()}`}>
          {inr(rec.amount)}
        </b>
        <Icon name="chevron-down" size={18} className="rec__caret" />
      </summary>

      <div className="rec__work">
        <table className="work">
          <tbody>
            {rec.derivation.map((step) => (
              <tr key={step.label}>
                <th scope="row">
                  {step.label}
                  <small>{step.source}</small>
                </th>
                <td className="tnum">{step.value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {rec.assumption ? (
          <p className="rec__assume">
            <Icon name="alert" size={14} />
            {rec.assumption}
          </p>
        ) : null}

        <Button variant="secondary" size="sm" iconRight="chevron-right" onClick={onOpen}>
          {rec.action}
        </Button>
      </div>
    </details>
  );
}
