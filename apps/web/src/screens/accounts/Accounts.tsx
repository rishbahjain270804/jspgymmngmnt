import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ACCOUNTS, formatDate, fromInclusive, paise } from '@oan/core';
import {
  Button,
  Card,
  CardBody,
  CardHead,
  Dialog,
  DrillValue,
  EmptyState,
  Icon,
  Input,
  Kpi,
  Pill,
  Segmented,
  Tabs,
  PermissionState,
  type TabItem,
} from '../../components/ui';
import { useSession } from '../../demo/session';
import {
  BRANCHES,
  EXPENSES,
  PNL_LINES,
  TODAY,
  branchById,
  netProfit,
  pnlTotals,
} from '../../demo/data';
import { collectedOn, dayBook, expensesIn, membersWithDues, dues } from '../../demo/selectors';
import { inr, inrShort } from '../../lib/money';

type Tab = 'pnl' | 'daybook' | 'expenses' | 'receivables' | 'gst';

/**
 * Accounts.
 *
 * The screen most likely to close the sale, and the gap that runs the other
 * way from the ERP v2 spec — that document's "Finance" is flat payments and
 * expenses tables with no chart of accounts, no double-entry, no deferred
 * revenue and no branch P&L. This is all of that.
 *
 * Every figure drills to the document behind it. That's Tally's habit, and
 * it is the reason accountants trust Tally: no number is ever a dead end.
 */
export function Accounts() {
  const { tab: routeTab } = useParams();
  const nav = useNavigate();
  const { allowed, branchId, canRollUp, branches, basis, setBasis } = useSession();
  const [recording, setRecording] = useState(false);

  if (!allowed('ledger.view')) {
    return (
      <div className="page">
        <PermissionState
          what="the books"
          who="an Admin or the accountant"
        />
      </div>
    );
  }

  const tab = (routeTab as Tab) ?? 'pnl';
  const scope = canRollUp ? branchId : (branches[0]?.id ?? null);
  const canPnl = allowed('report.pnl', scope ? { branchId: scope } : {});

  const tabs: TabItem<Tab>[] = [
    { value: 'pnl', label: 'P&L', icon: 'trend-up', hidden: !canPnl },
    { value: 'daybook', label: 'Day book', icon: 'book' },
    { value: 'expenses', label: 'Expenses', icon: 'wallet' },
    { value: 'receivables', label: 'Receivables', icon: 'alert' },
    { value: 'gst', label: 'GST', icon: 'receipt' },
  ];

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="eyebrow">
            {scope ? branchById(scope).name : 'All branches'} ·{' '}
            {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </span>
          <h1 className="page__title">Accounts</h1>
          <p className="page__lede">
            Double-entry underneath, one screen on top. Front desk can never reach this.
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
          {allowed('expense.record') ? (
            <Button variant="primary" icon="plus" onClick={() => setRecording(true)}>
              Record expense
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={(t) => nav(t === 'pnl' ? '/accounts' : `/accounts/${t}`)}
        items={tabs}
        label="Accounts"
      />

      {tab === 'pnl' ? <Pnl scope={scope} /> : null}
      {tab === 'daybook' ? <DayBookTab scope={scope} /> : null}
      {tab === 'expenses' ? <ExpensesTab scope={scope} /> : null}
      {tab === 'receivables' ? <ReceivablesTab scope={scope} /> : null}
      {tab === 'gst' ? <GstTab scope={scope} /> : null}

      <RecordExpenseDialog open={recording} onClose={() => setRecording(false)} />
    </div>
  );
}

/* ------------------------------ P&L ----------------------------------- */

function Pnl({ scope }: { scope: string | null }) {
  const income = pnlTotals('income');
  const direct = pnlTotals('direct');
  const indirect = pnlTotals('indirect');
  const net = netProfit();

  const cols = scope ? BRANCHES.filter((b) => b.id === scope) : BRANCHES;
  const val = (line: { vn: number; ms: number }, branchId: string) =>
    (branchId === 'br-vn' ? line.vn : line.ms) * 100;

  const rowTotal = (line: { vn: number; ms: number }) =>
    scope ? val(line, scope) : (line.vn + line.ms) * 100;

  const sectionTotal = (t: { vn: number; ms: number }, branchId: string) =>
    branchId === 'br-vn' ? t.vn : t.ms;

  return (
    <div className="stack" style={{ gap: 'var(--s-5)' }}>
      <Card>
        <CardHead
          title="Profit & loss"
          sub="Every figure clicks through to the vouchers behind it"
          action={
            <Button variant="secondary" size="sm" icon="download">
              Export for the CA
            </Button>
          }
        />
        <div className="table-wrap">
          <table className="table pnl">
            <caption className="visually-hidden">Profit and loss by branch</caption>
            <thead>
              <tr>
                <th scope="col">Particulars</th>
                {cols.map((b) => (
                  <th key={b.id} scope="col" className="num">
                    {b.short}
                  </th>
                ))}
                {cols.length > 1 ? (
                  <th scope="col" className="num">
                    Total
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              <tr className="table__group">
                <td colSpan={cols.length + (cols.length > 1 ? 2 : 1)}>Income</td>
              </tr>
              {PNL_LINES.filter((l) => l.kind === 'income').map((l) => (
                <PnlRow key={l.head} line={l} cols={cols} val={val} rowTotal={rowTotal} />
              ))}
              <tr className="pnl__subtotal">
                <td>Total income</td>
                {cols.map((b) => (
                  <td key={b.id} className="num">
                    {inr(sectionTotal(income, b.id))}
                  </td>
                ))}
                {cols.length > 1 ? (
                  <td className="num">{inr(income.vn + income.ms)}</td>
                ) : null}
              </tr>

              <tr className="table__group">
                <td colSpan={cols.length + (cols.length > 1 ? 2 : 1)}>
                  Direct expenses — the cost of running the floor
                </td>
              </tr>
              {PNL_LINES.filter((l) => l.kind === 'direct').map((l) => (
                <PnlRow key={l.head} line={l} cols={cols} val={val} rowTotal={rowTotal} />
              ))}
              <tr className="pnl__subtotal">
                <td>Total direct expenses</td>
                {cols.map((b) => (
                  <td key={b.id} className="num">
                    {inr(sectionTotal(direct, b.id))}
                  </td>
                ))}
                {cols.length > 1 ? <td className="num">{inr(direct.vn + direct.ms)}</td> : null}
              </tr>

              <tr className="table__group">
                <td colSpan={cols.length + (cols.length > 1 ? 2 : 1)}>Indirect expenses</td>
              </tr>
              {PNL_LINES.filter((l) => l.kind === 'indirect').map((l) => (
                <PnlRow key={l.head} line={l} cols={cols} val={val} rowTotal={rowTotal} />
              ))}
              <tr className="pnl__subtotal">
                <td>Total indirect expenses</td>
                {cols.map((b) => (
                  <td key={b.id} className="num">
                    {inr(sectionTotal(indirect, b.id))}
                  </td>
                ))}
                {cols.length > 1 ? <td className="num">{inr(indirect.vn + indirect.ms)}</td> : null}
              </tr>

              <tr className="pnl__net">
                <td>Net profit</td>
                {cols.map((b) => (
                  <td key={b.id} className="num">
                    {inr(b.id === 'br-vn' ? net.vn : net.ms)}
                  </td>
                ))}
                {cols.length > 1 ? <td className="num">{inr(net.total)}</td> : null}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {!scope ? (
        <Card pad>
          <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-start' }}>
            <span className="attention__icon attention__icon--warn">
              <Icon name="alert" size={18} />
            </span>
            <p style={{ fontSize: 'var(--t-body)', color: 'var(--text-2)', maxWidth: '70ch' }}>
              <b style={{ color: 'var(--text)' }}>This is the whole point.</b> Mansarovar collects{' '}
              {inrShort(pnlTotals('income').ms)} and keeps {inr(net.ms)}. Revenue alone said it was
              fine — rent and coach salaries there are almost the same as Vidhyadhar Nagar's, on
              little over half the income.
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function PnlRow({
  line,
  cols,
  val,
  rowTotal,
}: {
  line: { head: string; accountCode: string; vn: number; ms: number };
  cols: typeof BRANCHES;
  val: (l: { vn: number; ms: number }, b: string) => number;
  rowTotal: (l: { vn: number; ms: number }) => number;
}) {
  return (
    <tr>
      <td>
        <span style={{ color: 'var(--text-2)' }}>{line.head}</span>{' '}
        <span className="tnum" style={{ color: 'var(--text-3)', fontSize: 'var(--t-caption)' }}>
          {line.accountCode}
        </span>
      </td>
      {cols.map((b) => (
        <td key={b.id} className="num">
          <DrillValue title="Open the vouchers behind this figure" onClick={() => undefined}>
            {inr(val(line, b.id))}
          </DrillValue>
        </td>
      ))}
      {cols.length > 1 ? <td className="num">{inr(rowTotal(line))}</td> : null}
    </tr>
  );
}

/* ---------------------------- Day book -------------------------------- */

function DayBookTab({ scope }: { scope: string | null }) {
  const [date, setDate] = useState(TODAY);
  const rows = dayBook(date as never, scope);
  const receipts = rows.filter((r) => r.kind === 'RECEIPT');
  const payments = rows.filter((r) => r.kind === 'PAYMENT');
  const inTotal = receipts.reduce((s, r) => s + r.amount, 0);
  const outTotal = payments.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="stack" style={{ gap: 'var(--s-5)' }}>
      <div className="toolbar">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value as never)}
          aria-label="Day book date"
          style={{ maxWidth: 200 }}
        />
        <div className="grid-kpi" style={{ flex: 1 }}>
          <Kpi label="Received" value={inTotal} format={inr} display={inr(inTotal)} icon="arrow-down" />
          <Kpi label="Paid out" value={outTotal} format={inr} display={inr(outTotal)} icon="arrow-up" />
          <Kpi
            label="Net movement"
            value={inTotal - outTotal}
            format={inr}
            display={inr(inTotal - outTotal)}
            icon="wallet"
          />
        </div>
      </div>

      <Card>
        <CardHead title={`Day book · ${formatDate(date as never)}`} sub={`${rows.length} vouchers`} />
        {rows.length === 0 ? (
          <EmptyState
            icon="book"
            title="Nothing posted on this date"
            body="Pick another day, or record an expense to start the day's entries."
          />
        ) : (
          <div className="table-wrap">
            <table className="table table--responsive">
              <caption className="visually-hidden">Day book entries</caption>
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Particulars</th>
                  <th scope="col">Account</th>
                  {!scope ? <th scope="col">Branch</th> : null}
                  <th scope="col">Mode</th>
                  <th scope="col" className="num">Amount</th>
                  <th scope="col">Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Type">
                      <Pill tone={r.kind === 'RECEIPT' ? 'brand' : 'neutral'} small icon={r.kind === 'RECEIPT' ? 'arrow-down' : 'arrow-up'}>
                        {r.kind === 'RECEIPT' ? 'Receipt' : 'Payment'}
                      </Pill>
                    </td>
                    <td data-label="Particulars" style={{ fontWeight: 'var(--w-medium)' }}>
                      {r.particulars}
                    </td>
                    <td data-label="Account" style={{ color: 'var(--text-2)' }}>
                      {r.account}
                    </td>
                    {!scope ? (
                      <td data-label="Branch" style={{ color: 'var(--text-2)' }}>
                        {branchById(r.branchId).short}
                      </td>
                    ) : null}
                    <td data-label="Mode">{r.mode.replace('_', ' ')}</td>
                    <td data-label="Amount" className="num">{inr(r.amount)}</td>
                    <td data-label="Reference" className="tnum" style={{ color: 'var(--text-3)' }}>
                      {r.reference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------- Expenses -------------------------------- */

function ExpensesTab({ scope }: { scope: string | null }) {
  const rows = expensesIn(scope).slice(0, 30);
  const total = expensesIn(scope).reduce((s, e) => s + e.amount, 0);

  return (
    <Card>
      <CardHead
        title="Expenses"
        sub={`${expensesIn(scope).length} entries · ${inr(total)} over four months`}
      />
      <div className="table-wrap">
        <table className="table table--responsive">
          <caption className="visually-hidden">Recorded expenses</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Head</th>
              <th scope="col">Vendor</th>
              {!scope ? <th scope="col">Branch</th> : null}
              <th scope="col">Mode</th>
              <th scope="col" className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td data-label="Date">{formatDate(e.date)}</td>
                <td data-label="Head" style={{ fontWeight: 'var(--w-medium)' }}>
                  {e.head}
                </td>
                <td data-label="Vendor" style={{ color: 'var(--text-2)' }}>
                  {e.vendor}
                </td>
                {!scope ? (
                  <td data-label="Branch" style={{ color: 'var(--text-2)' }}>
                    {branchById(e.branchId).short}
                  </td>
                ) : null}
                <td data-label="Mode">{e.mode.replace('_', ' ')}</td>
                <td data-label="Amount" className="num">{inr(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card__foot">Showing 30 most recent of {expensesIn(scope).length}.</div>
    </Card>
  );
}

/* --------------------------- Receivables ------------------------------ */

function ReceivablesTab({ scope }: { scope: string | null }) {
  const rows = membersWithDues(scope);
  const total = dues(scope);

  return (
    <div className="stack" style={{ gap: 'var(--s-5)' }}>
      <div className="grid-kpi">
        <Kpi label="Outstanding" value={total} format={inr} display={inr(total)} icon="alert" />
        <Kpi label="Members owing" value={rows.length} icon="members" />
        <Kpi
          label="Average balance"
          value={rows.length ? total / rows.length : 0}
          format={inr}
          display={inr(rows.length ? total / rows.length : 0)}
          icon="wallet"
        />
      </div>

      <Card>
        <CardHead title="Who owes what" sub="Part payments not yet cleared" />
        {rows.length === 0 ? (
          <EmptyState icon="check-circle" title="Nothing outstanding" body="Every membership at this branch is paid in full." />
        ) : (
          <div className="table-wrap">
            <table className="table table--responsive">
              <caption className="visually-hidden">Outstanding member balances</caption>
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Plan</th>
                  {!scope ? <th scope="col">Branch</th> : null}
                  <th scope="col" className="num">Balance</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 25).map((m) => (
                  <tr key={m.id}>
                    <td data-label="Member" style={{ fontWeight: 'var(--w-medium)' }}>
                      {m.name}
                    </td>
                    <td data-label="Plan" style={{ color: 'var(--text-2)' }}>
                      {m.membership.plan.name}
                    </td>
                    {!scope ? (
                      <td data-label="Branch" style={{ color: 'var(--text-2)' }}>
                        {branchById(m.branchId).short}
                      </td>
                    ) : null}
                    <td data-label="Balance" className="num" style={{ color: 'var(--warn-fg)', fontWeight: 'var(--w-semibold)' }}>
                      {inr(m.membership.balanceDue)}
                    </td>
                    <td>
                      <Button variant="secondary" size="sm" icon="whatsapp">
                        Remind
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------- GST ---------------------------------- */

function GstTab({ scope }: { scope: string | null }) {
  const collected = collectedOn(TODAY, scope);
  const gst = fromInclusive(paise(collected || 1));
  const branch = scope ? branchById(scope) : BRANCHES[0]!;

  return (
    <div className="stack" style={{ gap: 'var(--s-5)' }}>
      <Card pad>
        <div className="defs">
          <div>
            <div className="def__label">GSTIN</div>
            <div className="def__value tnum">{branch.gstin}</div>
          </div>
          <div>
            <div className="def__label">Place of supply</div>
            <div className="def__value">Rajasthan (08)</div>
          </div>
          <div>
            <div className="def__label">SAC — fitness services</div>
            <div className="def__value tnum">999723</div>
          </div>
          <div>
            <div className="def__label">Rate</div>
            <div className="def__value">18% — CGST 9% + SGST 9%</div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Output tax · today" sub="Split from inclusive prices by the rules package" />
        <CardBody>
          <dl className="ledger" style={{ maxWidth: 460 }}>
            <div className="ledger__row">
              <dt>Gross collected</dt>
              <dd className="tnum">{inr(gst.total)}</dd>
            </div>
            <div className="ledger__row">
              <dt>Taxable value</dt>
              <dd className="tnum">{inr(gst.taxable)}</dd>
            </div>
            <div className="ledger__row">
              <dt>Output CGST 9% · {ACCOUNTS.OUTPUT_CGST.code}</dt>
              <dd className="tnum">{inr(gst.cgst)}</dd>
            </div>
            <div className="ledger__row">
              <dt>Output SGST 9% · {ACCOUNTS.OUTPUT_SGST.code}</dt>
              <dd className="tnum">{inr(gst.sgst)}</dd>
            </div>
            <div className="ledger__rule" />
            <div className="ledger__row is-strong">
              <dt>Total tax payable</dt>
              <dd className="tnum">{inr(gst.tax)}</dd>
            </div>
          </dl>
        </CardBody>
        <div className="card__foot">
          <Button variant="secondary" size="sm" icon="download">
            Export GSTR-1 workings
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------- Record expense --------------------------- */

function RecordExpenseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record expense"
      sub="Posts a payment voucher against this branch"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="check" onClick={onClose}>
            Post it
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 'var(--s-4)' }}>
        <div className="field">
          <label className="field__label" htmlFor="ex-head">
            Expense head
          </label>
          <select className="input" id="ex-head" defaultValue={ACCOUNTS.RENT.code}>
            {[...new Set(EXPENSES.map((e) => e.head))].map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </div>
        <Input label="Amount" type="number" inputMode="decimal" affix={<span>₹</span>} placeholder="85000" />
        <Input label="Vendor" placeholder="Shree Balaji Properties" />
        <Input label="Date" type="date" defaultValue={TODAY} />
        <div className="field">
          <span className="field__label">Paid by</span>
          <Segmented
            label="Payment mode"
            value="BANK_TRANSFER"
            onChange={() => undefined}
            options={[
              { value: 'CASH', label: 'Cash', icon: 'cash' },
              { value: 'BANK_TRANSFER', label: 'Bank', icon: 'wallet' },
              { value: 'UPI', label: 'UPI', icon: 'upi' },
            ]}
          />
        </div>
        <Pill tone="neutral" small icon="book">
          Debits the expense head, credits cash or bank — automatically
        </Pill>
      </div>
    </Dialog>
  );
}
