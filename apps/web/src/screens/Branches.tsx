import { formatDate } from '@oan/core';
import {
  Button,
  Card,
  CardBody,
  CardHead,
  Icon,
  Pill,
  Section,
  PermissionState,
} from '../components/ui';
import { useSession } from '../demo/session';
import { BRANCHES, STAFF } from '../demo/data';
import { assetStats, memberStats } from '../demo/selectors';
import { inr, inrShort } from '../lib/money';
import { netProfit, pnlTotals } from '../demo/data';

/**
 * Branches — the one module with no Level 2.
 *
 * A branch list has nothing above it to roll up into. It's also where
 * brand-wide settings sit, since GSTIN and invoice series are per place of
 * business anyway.
 */
export function Branches() {
  const { allowed } = useSession();

  if (!allowed('branch.manage')) {
    return (
      <div className="page">
        <PermissionState what="branch settings" who="an Admin" />
      </div>
    );
  }

  const net = netProfit();
  const income = pnlTotals('income');

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="eyebrow">One brand, many locations</span>
          <h1 className="page__title">Branches</h1>
          <p className="page__lede">
            OAN is one business with two addresses — not two businesses. One member base, one plan
            catalogue, one set of books that splits by branch.
          </p>
        </div>
        <div className="page__actions">
          <Button variant="primary" icon="plus">
            Add branch
          </Button>
        </div>
      </div>

      {BRANCHES.map((b, i) => {
        const members = memberStats(b.id);
        const assets = assetStats(b.id);
        const staff = STAFF.filter((s) => s.branchId === b.id);
        const manager = STAFF.find((s) => s.id === b.managerId);
        const branchNet = b.id === 'br-vn' ? net.vn : net.ms;
        const branchIncome = b.id === 'br-vn' ? income.vn : income.ms;

        return (
          <Section key={b.id} eyebrow={`Opened ${formatDate(b.openedOn)}`} title={b.name} index={i}>
            <Card>
              <CardHead
                title={b.address}
                sub={`${b.hours} · six days a week`}
                action={
                  <Pill tone={branchNet > 5000000 ? 'ok' : 'warn'} icon={branchNet > 5000000 ? 'check-circle' : 'alert'}>
                    Net {inr(branchNet)}
                  </Pill>
                }
              />
              <CardBody>
                <div className="defs">
                  <Def label="Manager">{manager?.name ?? 'Not assigned'}</Def>
                  <Def label="Staff">{staff.length} people</Def>
                  <Def label="Active members">{members.active.toLocaleString('en-IN')}</Def>
                  <Def label="Equipment">
                    {assets.total} units · {inrShort(assets.value)}
                  </Def>
                  <Def label="Income this month">{inrShort(branchIncome)}</Def>
                  <Def label="Out of order">
                    {assets.outOfOrder > 0 ? (
                      <span style={{ color: 'var(--bad-fg)' }}>{assets.outOfOrder} machines</span>
                    ) : (
                      'None'
                    )}
                  </Def>
                </div>
              </CardBody>

              {/* Settings live inside the module they belong to. */}
              <CardBody className="branch-settings">
                <span className="eyebrow">Settings · Admin only</span>
                <div className="defs" style={{ marginTop: 'var(--s-3)' }}>
                  <Def label="GSTIN">
                    <span className="tnum">{b.gstin}</span>
                  </Def>
                  <Def label="Invoice series">
                    <span className="tnum">{b.invoicePrefix}/26-27/····</span>
                  </Def>
                  <Def label="Place of supply">Rajasthan (08)</Def>
                  <Def label="Opening hours">{b.hours}</Def>
                </div>
                <div style={{ display: 'flex', gap: 'var(--s-2)', marginTop: 'var(--s-4)', flexWrap: 'wrap' }}>
                  <Button variant="secondary" size="sm" icon="edit">
                    Edit details
                  </Button>
                  <Button variant="secondary" size="sm" icon="receipt">
                    Invoice settings
                  </Button>
                  <Button variant="secondary" size="sm" icon="clock">
                    Opening hours
                  </Button>
                </div>
              </CardBody>
            </Card>
          </Section>
        );
      })}

      <Card pad>
        <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-start' }}>
          <span className="attention__icon attention__icon--neutral">
            <Icon name="branches" size={18} />
          </span>
          <p style={{ fontSize: 'var(--t-body)', color: 'var(--text-2)', maxWidth: '72ch' }}>
            Branches is the one module that doesn't roll up — there is nothing above a branch
            list. Every other module in the product does: a total outside, branch by branch
            inside.
          </p>
        </div>
      </Card>
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
