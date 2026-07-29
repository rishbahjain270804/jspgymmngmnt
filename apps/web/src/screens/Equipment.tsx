import { useState } from 'react';
import { daysBetween, formatDate } from '@oan/core';
import {
  Button,
  Card,
  CardHead,
  Dialog,
  EmptyState,
  Icon,
  Input,
  Kpi,
  Pill,
  Section,
  SkeletonKpis,
  PermissionState,
} from '../components/ui';
import { useSession } from '../demo/session';
import { ASSETS, BRANCHES, TODAY, branchById } from '../demo/data';
import { assetStats, assetsByCategory, assetsIn, outOfOrder } from '../demo/selectors';
import { useSimulatedLoad } from '../lib/hooks';
import { inrShort } from '../lib/money';
import type { Asset } from '../demo/types';

/**
 * Equipment.
 *
 * The clearest demonstration of the roll-up: total units outside, branch-wise
 * inside, in one screen with no explanation needed. Once there is more than
 * one location, "what do I own and where is it" becomes a question only
 * software can answer.
 *
 * Deliberately an asset register with a condition flag and a service date —
 * not a CMMS. If it grows work orders and technician scheduling it has become
 * a different product.
 */
export function Equipment() {
  const { branchId, canRollUp, branches, allowed } = useSession();
  const loading = useSimulatedLoad();
  const [faulting, setFaulting] = useState<Asset | null>(null);

  if (!allowed('equipment.view')) {
    return (
      <div className="page">
        <PermissionState what="the equipment register" />
      </div>
    );
  }

  const scope = canRollUp ? branchId : (branches[0]?.id ?? null);
  const stats = assetStats(scope);
  const down = outOfOrder(scope);
  const canManage = allowed('equipment.manage', scope ? { branchId: scope } : {});

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="eyebrow">{scope ? branchById(scope).name : 'All branches'}</span>
          <h1 className="page__title">Equipment</h1>
          <p className="page__lede">
            What OAN owns, where it is, and what's broken. Asset value{' '}
            {inrShort(stats.value)}.
          </p>
        </div>
        <div className="page__actions">
          {canManage ? (
            <Button variant="primary" icon="plus">
              Add asset
            </Button>
          ) : (
            <Button variant="primary" icon="wrench" onClick={() => setFaulting(ASSETS[0]!)}>
              Report a fault
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonKpis count={4} />
      ) : (
        <div className="grid-kpi">
          <Kpi index={0} label="Total units" value={stats.total} icon="equipment" />
          <Kpi index={1} label="Working" value={stats.working} icon="check-circle" />
          <Kpi index={2} label="Out of order" value={stats.outOfOrder} icon="x-circle" hint="Blocking assigned programmes" />
          <Kpi index={3} label="Service overdue" value={stats.serviceDue} icon="wrench" />
        </div>
      )}

      {/* The roll-up: category × branch in a single grid. */}
      {canRollUp && !branchId ? (
        <Section eyebrow="By category × branch" title="What's where" index={1}>
          <Card>
            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">Equipment count by category and branch</caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    {BRANCHES.map((b) => (
                      <th key={b.id} scope="col" className="num">
                        {b.short}
                      </th>
                    ))}
                    <th scope="col" className="num">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assetsByCategory(null).map((c) => (
                    <tr key={c.category}>
                      <td style={{ fontWeight: 'var(--w-medium)' }}>{c.category}</td>
                      {BRANCHES.map((b) => {
                        const cell = assetsByCategory(b.id).find((x) => x.category === c.category);
                        return (
                          <td key={b.id} className="num">
                            {cell?.total ?? 0}
                            {cell && cell.down > 0 ? (
                              <span className="pill pill--bad pill--sm" style={{ marginLeft: 8 }}>
                                <Icon name="x-circle" size={11} />
                                {cell.down} down
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                      <td className="num" style={{ fontWeight: 'var(--w-semibold)' }}>
                        {c.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="card__sub">
            Mansarovar has {assetsIn('br-ms').filter((a) => a.category === 'Cardio').length} cardio
            machines for {(460).toLocaleString('en-IN')} members — a capacity question visible in
            one screen.
          </p>
        </Section>
      ) : null}

      <Section
        eyebrow={`Blocks ${down.length ? '3 assigned programmes' : 'nothing'}`}
        title="Out of order"
        index={2}
      >
        {down.length === 0 ? (
          <Card>
            <EmptyState
              icon="check-circle"
              title="Everything is working"
              body="No machine is out of order at this branch. Service dates are still worth watching."
            />
          </Card>
        ) : (
          <div className="stack" style={{ gap: 'var(--s-2)' }}>
            {down.map((a) => (
              <div className="attention" key={a.id}>
                <span className="attention__icon attention__icon--bad">
                  <Icon name="wrench" size={18} />
                </span>
                <span className="attention__text">
                  <span className="attention__title">
                    {a.name} <span className="tnum" style={{ color: 'var(--text-3)' }}>#{a.tag}</span> ·{' '}
                    {branchById(a.branchId).short}
                  </span>
                  <span className="attention__body">{a.fault}</span>
                </span>
                <Pill tone="bad" small icon="clock">
                  Down {a.downSince ? daysBetween(a.downSince, TODAY) : 0} days
                </Pill>
                {canManage ? (
                  <Button variant="secondary" size="sm" icon="wrench">
                    Log service
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section eyebrow="Asset register" title={scope ? branchById(scope).name : 'All branches'} index={3}>
        <Card>
          <CardHead
            title={`${assetsIn(scope).length} assets`}
            sub="Every unit, its condition, and when it was last serviced"
          />
          <div className="table-wrap">
            <table className="table table--responsive">
              <caption className="visually-hidden">Full asset register</caption>
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Category</th>
                  {!scope ? <th scope="col">Branch</th> : null}
                  <th scope="col">Condition</th>
                  <th scope="col">Next service</th>
                  <th scope="col" className="num">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {assetsIn(scope)
                  .slice(0, 24)
                  .map((a) => (
                    <tr key={a.id}>
                      <td data-label="Asset">
                        <span style={{ fontWeight: 'var(--w-medium)' }}>{a.name}</span>{' '}
                        <span className="tnum" style={{ color: 'var(--text-3)' }}>
                          #{a.tag}
                        </span>
                      </td>
                      <td data-label="Category" style={{ color: 'var(--text-2)' }}>
                        {a.category}
                      </td>
                      {!scope ? (
                        <td data-label="Branch" style={{ color: 'var(--text-2)' }}>
                          {branchById(a.branchId).short}
                        </td>
                      ) : null}
                      <td data-label="Condition">
                        <ConditionPill condition={a.condition} />
                      </td>
                      <td data-label="Next service">
                        {a.nextServiceOn <= TODAY ? (
                          <span style={{ color: 'var(--warn-fg)' }}>
                            Overdue · {formatDate(a.nextServiceOn)}
                          </span>
                        ) : (
                          formatDate(a.nextServiceOn)
                        )}
                      </td>
                      <td data-label="Cost" className="num">
                        {inrShort(a.cost)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="card__foot">
            Showing 24 of {assetsIn(scope).length}. Front desk and coaches can report a fault but
            not edit the register.
          </div>
        </Card>
      </Section>

      <ReportFaultDialog asset={faulting} onClose={() => setFaulting(null)} />
    </div>
  );
}

function ConditionPill({ condition }: { condition: Asset['condition'] }) {
  if (condition === 'WORKING')
    return (
      <Pill tone="ok" small>
        Working
      </Pill>
    );
  if (condition === 'NEEDS_SERVICE')
    return (
      <Pill tone="warn" small icon="wrench">
        Needs service
      </Pill>
    );
  return (
    <Pill tone="bad" small>
      Out of order
    </Pill>
  );
}

function ReportFaultDialog({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  return (
    <Dialog
      open={asset !== null}
      onClose={onClose}
      title="Report a fault"
      sub="Anyone on the floor can do this — it doesn't change the register"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="check" onClick={onClose}>
            Report it
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 'var(--s-4)' }}>
        <Input label="Asset tag" icon="qr" defaultValue={asset?.tag ?? ''} hint="Or scan the tag with the phone app." />
        <div className="field">
          <label className="field__label" htmlFor="fault-what">
            What's wrong
          </label>
          <textarea
            className="input"
            id="fault-what"
            placeholder="Belt slipping under load; motor smells hot"
          />
        </div>
        <Pill tone="neutral" small icon="alert">
          The branch manager is notified straight away
        </Pill>
      </div>
    </Dialog>
  );
}
