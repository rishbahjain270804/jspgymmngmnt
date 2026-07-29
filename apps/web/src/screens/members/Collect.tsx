import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  type PaymentMode,
  breakdown,
  discountWithinCap,
  formatDate,
  paise,
  percentOf,
  rupees,
} from '@oan/core';
import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHead,
  EmptyState,
  Icon,
  Input,
  Pill,
  Segmented,
  StatusPill,
  PermissionState,
} from '../../components/ui';
import { useSession } from '../../demo/session';
import { PLANS, TODAY, branchById, maskPhone, planById } from '../../demo/data';
import { memberById, searchMembers, statusOf } from '../../demo/selectors';
import type { Member } from '../../demo/types';
import { inr } from '../../lib/money';

/**
 * Collect payment.
 *
 * Two things foreign software gets wrong here, and both are normal in Jaipur:
 *
 * 1. **Part payment is first-class.** "₹3,000 now, ₹2,000 next week" is not
 *    an edge case, so the balance and its due date sit on the main form.
 * 2. **GST is computed, never typed.** `breakdown()` splits the inclusive
 *    price into taxable value, CGST and SGST — the same function the invoice
 *    and the ledger use, so the receipt and the books cannot disagree.
 *
 * A discount above the role's cap becomes an approval request rather than a
 * silent giveaway.
 */
export function Collect() {
  const [params] = useSearchParams();
  const { actor, allowed, branchId, branches, role } = useSession();
  const nav = useNavigate();

  const preset = memberById(params.get('member') ?? undefined);
  const [member, setMember] = useState<Member | undefined>(preset);
  const [q, setQ] = useState('');

  const scope = branchId ?? branches[0]?.id ?? null;

  if (!allowed('payment.collect')) {
    return (
      <div className="page">
        <PermissionState what="collecting payments" />
      </div>
    );
  }

  if (!member) {
    const hits = searchMembers(q, scope, 6);
    return (
      <div className="page">
        <div className="page__head">
          <div>
            <span className="eyebrow">Front desk</span>
            <h1 className="page__title">Collect payment</h1>
            <p className="page__lede">Find the member first — phone number is fastest.</p>
          </div>
        </div>

        <Card pad>
          <Input
            icon="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Phone number or name…"
            aria-label="Find a member"
            inputMode="numeric"
            autoFocus
          />
          <div className="stack" style={{ gap: 2, marginTop: 'var(--s-3)' }}>
            {hits.map((m) => (
              <button key={m.id} type="button" className="hit" onClick={() => setMember(m)}>
                <Avatar name={m.name} size={34} />
                <span>
                  <span className="hit__name" style={{ fontSize: 'var(--t-body)' }}>
                    {m.name}
                  </span>
                  <br />
                  <span className="hit__meta">
                    {maskPhone(m.phone)} · {m.membership.plan.name}
                  </span>
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                  {m.membership.balanceDue > 0 ? (
                    <Pill tone="warn" small icon="wallet">
                      {inr(m.membership.balanceDue)} due
                    </Pill>
                  ) : null}
                  <StatusPill status={statusOf(m)} small />
                </span>
              </button>
            ))}
            {q.trim().length >= 3 && hits.length === 0 ? (
              <EmptyState
                icon="search"
                title={`Nobody on “${q}”`}
                body="Check the number, or register them from Members first."
              />
            ) : null}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <CollectForm
      member={member}
      onBack={() => {
        setMember(undefined);
        nav('/collect', { replace: true });
      }}
      capRole={role}
      actor={actor}
    />
  );
}

function CollectForm({
  member,
  onBack,
  actor,
}: {
  member: Member;
  onBack: () => void;
  capRole: string;
  actor: Parameters<typeof discountWithinCap>[0];
}) {
  const nav = useNavigate();
  const [planId, setPlanId] = useState(member.membership.plan.planId);
  const [discountPct, setDiscountPct] = useState(0);
  const [mode, setMode] = useState<PaymentMode>('UPI');
  const [receivedRupees, setReceivedRupees] = useState<string>('');
  const [done, setDone] = useState(false);

  const plan = planById(planId);
  const branch = branchById(member.branchId);

  const cap = discountWithinCap(actor, discountPct, { branchId: member.branchId });

  const gross = plan.price;
  const discount = percentOf(gross, Math.min(discountPct, 100));
  const payable = paise(gross - discount);

  // GST comes from the rules package — the counter never types a tax figure.
  const gst = useMemo(
    () => breakdown(payable, plan.priceBasis, plan.gstRate, 'INTRA_STATE'),
    [payable, plan.priceBasis, plan.gstRate],
  );

  const received = receivedRupees === '' ? payable : rupees(Number(receivedRupees) || 0);
  const balance = paise(Math.max(0, payable - received));
  const overpaid = received > payable;

  if (done) {
    return (
      <div className="page">
        <Card>
          <EmptyState
            icon="check-circle"
            title="Payment recorded"
            body={
              <>
                {inr(received)} received from {member.name} by {mode.replace('_', ' ').toLowerCase()}.
                {balance > 0 ? ` ${inr(balance)} carried as a balance.` : ' Nothing outstanding.'}{' '}
                The receipt is ready to send.
              </>
            }
            action={
              <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button
                  variant="primary"
                  icon="whatsapp"
                  onClick={() =>
                    window.open(
                      `https://wa.me/91${member.phone}?text=${encodeURIComponent(
                        `Hi ${member.name.split(' ')[0]}, we've received ${inr(received)} for your ${plan.name} at OAN Fitness ${branch.short}. ${balance > 0 ? `Balance ${inr(balance)}.` : 'Paid in full.'} Thank you!`,
                      )}`,
                      '_blank',
                      'noopener',
                    )
                  }
                >
                  Send receipt on WhatsApp
                </Button>
                <Button variant="secondary" icon="printer" onClick={() => window.print()}>
                  Print receipt
                </Button>
                <Button variant="ghost" onClick={() => nav(`/members/${member.id}`)}>
                  Open member
                </Button>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
          <Button variant="ghost" iconOnly icon="arrow-left" onClick={onBack}>
            Back
          </Button>
          <Avatar name={member.name} size={44} />
          <div>
            <span className="eyebrow">{branch.name} · GSTIN {branch.gstin}</span>
            <h1 className="page__title" style={{ fontSize: 'var(--t-h3)' }}>
              {member.name}
            </h1>
            <span className="card__sub tnum">
              {maskPhone(member.phone)} · {member.code}
            </span>
          </div>
        </div>
        <StatusPill status={statusOf(member)} />
      </div>

      <div className="split-main">
        <div className="stack" style={{ gap: 'var(--s-4)' }}>
          <Card>
            <CardHead title="Plan" sub="What they're paying for" />
            <CardBody>
              <div className="field">
                <label className="field__label" htmlFor="plan">
                  Membership plan
                </label>
                <select
                  className="input"
                  id="plan"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                >
                  {PLANS.map((p) => (
                    <option key={p.planId} value={p.planId}>
                      {p.name} — {inr(p.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: 'var(--s-4)' }}>
                <Input
                  label="Discount"
                  type="number"
                  min={0}
                  max={100}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value))))}
                  affix={<span>%</span>}
                  hint={
                    cap.needsApproval
                      ? undefined
                      : `Your cap is ${cap.capPercent}%. Above that it becomes an approval request.`
                  }
                  {...(cap.needsApproval
                    ? { error: `${discountPct}% is above your ${cap.capPercent}% cap — this will be sent to an Admin for approval, not applied silently.` }
                    : {})}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Pay now" sub="Part payment is normal — record what actually changed hands" />
            <CardBody>
              <div className="field" style={{ marginBottom: 'var(--s-4)' }}>
                <span className="field__label">Mode</span>
                <Segmented
                  label="Payment mode"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'UPI', label: 'UPI', icon: 'upi' },
                    { value: 'CASH', label: 'Cash', icon: 'cash' },
                    { value: 'CARD', label: 'Card', icon: 'card' },
                    { value: 'BANK_TRANSFER', label: 'Transfer', icon: 'wallet' },
                  ]}
                />
              </div>

              <Input
                label="Amount received"
                type="number"
                inputMode="decimal"
                value={receivedRupees}
                placeholder={String(payable / 100)}
                onChange={(e) => setReceivedRupees(e.target.value)}
                affix={<span>₹</span>}
                hint={`Leave blank for the full ${inr(payable)}.`}
                {...(overpaid
                  ? { error: 'More than the invoice total. Take the excess as an advance instead.' }
                  : {})}
              />

              {balance > 0 && !overpaid ? (
                <div className="balance-note rise">
                  <Icon name="alert" size={16} />
                  <span>
                    <b>{inr(balance)}</b> will be carried as a balance on this membership.
                  </span>
                  <Input
                    type="date"
                    aria-label="Balance due date"
                    defaultValue={TODAY}
                    style={{ maxWidth: 170 }}
                  />
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        {/* The computed side. Nothing here is typed by the person at the counter. */}
        <Card raised>
          <CardHead title="Breakdown" sub="Computed — SAC 999723" />
          <CardBody>
            <dl className="ledger">
              <Row label="Price (incl. GST)" value={inr(gross)} />
              {discount > 0 ? (
                <Row label={`Discount ${discountPct}%`} value={`− ${inr(discount)}`} muted />
              ) : null}
              <Row label="Taxable value" value={inr(gst.taxable)} muted />
              <Row label={`CGST ${gst.rate / 2}%`} value={inr(gst.cgst)} muted />
              <Row label={`SGST ${gst.rate / 2}%`} value={inr(gst.sgst)} muted />
              <div className="ledger__rule" />
              <Row label="Total payable" value={inr(gst.total)} strong />
              <Row label="Received now" value={inr(received)} />
              {balance > 0 ? <Row label="Balance due" value={inr(balance)} warn /> : null}
            </dl>

            <div className="stack" style={{ gap: 'var(--s-2)', marginTop: 'var(--s-5)' }}>
              <Button
                variant="primary"
                size="lg"
                block
                icon="whatsapp"
                disabled={overpaid || cap.needsApproval}
                onClick={() => setDone(true)}
              >
                Save and send on WhatsApp
              </Button>
              <Button
                variant="secondary"
                block
                icon="printer"
                disabled={overpaid || cap.needsApproval}
                onClick={() => setDone(true)}
              >
                Save and print receipt
              </Button>
              {cap.needsApproval ? (
                <Button variant="secondary" block icon="shield">
                  Request Admin approval for {discountPct}%
                </Button>
              ) : null}
            </div>

            <p className="card__sub" style={{ marginTop: 'var(--s-4)' }}>
              Invoice {branch.invoicePrefix}/26-27 · dated {formatDate(TODAY)}. Saving posts a
              sales voucher: cash or gateway debited, deferred revenue and output tax credited.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
  warn,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`ledger__row ${strong ? 'is-strong' : ''}`}>
      <dt style={{ color: muted ? 'var(--text-3)' : undefined }}>{label}</dt>
      <dd className="tnum" style={{ color: warn ? 'var(--warn-fg)' : undefined }}>
        {value}
      </dd>
    </div>
  );
}
