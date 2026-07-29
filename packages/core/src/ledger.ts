/**
 * The ledger — double-entry underneath, no accounting UI on top.
 *
 * Front desk collects a payment; these rules post the entries. Nobody in an
 * operational role ever sees a journal, because a gym has about a dozen
 * transaction shapes and no more. What makes accounting software heavy is the
 * *interface* — voucher types, ledger pickers, Tally-style keyboard flows —
 * not the ledger itself.
 *
 * The chart of accounts lives here, in versioned code rather than as data
 * someone types in. It is the backbone of every financial report, and a typo
 * in the tree is a wrong balance sheet.
 */

import type { IsoDate } from './date.js';
import { type Paise, ZERO, add, paise } from './money.js';
import type { GstBreakdown } from './gst.js';

// ---------------------------------------------------------------------------
// Groups — nature is inherited from the primary ancestor, never re-declared
// ---------------------------------------------------------------------------

export type AccountNature = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export interface LedgerGroup {
  readonly code: string;
  readonly name: string;
  readonly parent: string | null;
  /** Set only on primary groups. Descendants inherit it. */
  readonly nature?: AccountNature;
  /** Direct expenses and incomes hit gross profit; indirect hit net profit. */
  readonly affectsGrossProfit?: boolean;
}

export const GROUPS: readonly LedgerGroup[] = [
  { code: 'CA', name: 'Current Assets', parent: null, nature: 'ASSET' },
  { code: 'CA-CASH', name: 'Cash-in-Hand', parent: 'CA' },
  { code: 'CA-BANK', name: 'Bank Accounts', parent: 'CA' },
  { code: 'CA-GATEWAY', name: 'Payment Gateway Receivable', parent: 'CA' },
  { code: 'CA-DEBTORS', name: 'Sundry Debtors', parent: 'CA' },
  { code: 'CA-STOCK', name: 'Stock-in-Hand', parent: 'CA' },

  { code: 'FA', name: 'Fixed Assets', parent: null, nature: 'ASSET' },

  { code: 'CL', name: 'Current Liabilities', parent: null, nature: 'LIABILITY' },
  { code: 'CL-CREDITORS', name: 'Sundry Creditors', parent: 'CL' },
  { code: 'CL-TAX', name: 'Duties & Taxes', parent: 'CL' },
  { code: 'CL-DEFERRED', name: 'Deferred Revenue', parent: 'CL' },
  { code: 'CL-PROVISIONS', name: 'Provisions', parent: 'CL' },

  { code: 'EQ', name: 'Capital Account', parent: null, nature: 'EQUITY' },

  { code: 'INC', name: 'Sales Accounts', parent: null, nature: 'INCOME' },
  { code: 'INC-IND', name: 'Indirect Incomes', parent: null, nature: 'INCOME' },

  {
    code: 'EXP-DIR',
    name: 'Direct Expenses',
    parent: null,
    nature: 'EXPENSE',
    affectsGrossProfit: true,
  },
  { code: 'EXP-IND', name: 'Indirect Expenses', parent: null, nature: 'EXPENSE' },
] as const;

const GROUP_BY_CODE = new Map(GROUPS.map((g) => [g.code, g]));

/** Walk to the primary ancestor. Enforces "nature is inherited, never re-declared". */
export function natureOf(groupCode: string): AccountNature {
  let g = GROUP_BY_CODE.get(groupCode);
  const seen = new Set<string>();
  while (g) {
    if (g.nature) return g.nature;
    if (seen.has(g.code)) throw new Error(`Cycle in ledger groups at "${g.code}".`);
    seen.add(g.code);
    g = g.parent ? GROUP_BY_CODE.get(g.parent) : undefined;
  }
  throw new Error(`Ledger group "${groupCode}" has no primary ancestor with a nature.`);
}

// ---------------------------------------------------------------------------
// Accounts — always leaves. A ledger can never have a child.
// ---------------------------------------------------------------------------

export interface Account {
  readonly code: string;
  readonly name: string;
  readonly group: string;
}

export const ACCOUNTS = {
  CASH: { code: '1110', name: 'Cash in Hand', group: 'CA-CASH' },
  BANK: { code: '1120', name: 'Bank Account', group: 'CA-BANK' },
  GATEWAY: { code: '1130', name: 'Payment Gateway Receivable', group: 'CA-GATEWAY' },
  MEMBER_DUES: { code: '1141', name: 'Member Dues', group: 'CA-DEBTORS' },
  STOCK: { code: '1150', name: 'Supplement Stock', group: 'CA-STOCK' },

  EQUIPMENT: { code: '1510', name: 'Gym Equipment', group: 'FA' },
  ACC_DEPRECIATION: { code: '1590', name: 'Accumulated Depreciation', group: 'FA' },

  CREDITORS: { code: '2110', name: 'Sundry Creditors', group: 'CL-CREDITORS' },
  OUTPUT_CGST: { code: '2121', name: 'Output CGST', group: 'CL-TAX' },
  OUTPUT_SGST: { code: '2122', name: 'Output SGST', group: 'CL-TAX' },
  OUTPUT_IGST: { code: '2123', name: 'Output IGST', group: 'CL-TAX' },
  INPUT_CGST: { code: '2124', name: 'Input CGST', group: 'CL-TAX' },
  INPUT_SGST: { code: '2125', name: 'Input SGST', group: 'CL-TAX' },
  DEFERRED_MEMBERSHIP: {
    code: '2131',
    name: 'Deferred Membership Revenue',
    group: 'CL-DEFERRED',
  },
  DEFERRED_PT: { code: '2132', name: 'Deferred PT Revenue', group: 'CL-DEFERRED' },
  SALARY_PAYABLE: { code: '2141', name: 'Salary Payable', group: 'CL-PROVISIONS' },
  COMMISSION_PAYABLE: { code: '2142', name: 'Coach Commission Payable', group: 'CL-PROVISIONS' },

  CAPITAL: { code: '3100', name: "Owner's Capital", group: 'EQ' },
  RETAINED: { code: '3200', name: 'Retained Earnings', group: 'EQ' },

  MEMBERSHIP_INCOME: { code: '4100', name: 'Membership Income', group: 'INC' },
  PT_INCOME: { code: '4200', name: 'Personal Training Income', group: 'INC' },
  REGISTRATION_FEE: { code: '4300', name: 'Registration Fee', group: 'INC' },
  CLASS_INCOME: { code: '4400', name: 'Class & Event Income', group: 'INC' },
  LOCKER_INCOME: { code: '4500', name: 'Locker Rental Income', group: 'INC' },
  DAY_PASS_INCOME: { code: '4600', name: 'Day Pass Income', group: 'INC' },
  SUPPLEMENT_SALES: { code: '4700', name: 'Supplement Sales', group: 'INC' },
  LATE_FEE: { code: '4920', name: 'Late Fee', group: 'INC-IND' },

  // Direct — the cost of running the floor. Gross profit is contribution per branch.
  COACH_SALARY: { code: '5100', name: 'Coach Salaries', group: 'EXP-DIR' },
  COACH_COMMISSION: { code: '5200', name: 'Coach Commission', group: 'EXP-DIR' },
  RENT: { code: '5300', name: 'Rent — Gym Premises', group: 'EXP-DIR' },
  ELECTRICITY: { code: '5400', name: 'Electricity & Water', group: 'EXP-DIR' },
  EQUIPMENT_MAINTENANCE: { code: '5500', name: 'Equipment Maintenance', group: 'EXP-DIR' },
  CONSUMABLES: { code: '5600', name: 'Gym Consumables', group: 'EXP-DIR' },

  // Indirect — brand-level overhead.
  ADMIN_SALARY: { code: '6100', name: 'Admin & Reception Salaries', group: 'EXP-IND' },
  MARKETING: { code: '6200', name: 'Marketing & Advertising', group: 'EXP-IND' },
  SOFTWARE: { code: '6300', name: 'Software Subscriptions', group: 'EXP-IND' },
  BANK_CHARGES: { code: '6400', name: 'Bank & Gateway Charges', group: 'EXP-IND' },
  HOUSEKEEPING: { code: '6500', name: 'Housekeeping', group: 'EXP-IND' },
  PROFESSIONAL_FEES: { code: '6600', name: 'Professional Fees', group: 'EXP-IND' },
  DEPRECIATION: { code: '6800', name: 'Depreciation', group: 'EXP-IND' },
  MISC: { code: '6900', name: 'Miscellaneous', group: 'EXP-IND' },
} as const satisfies Record<string, Account>;

export const ALL_ACCOUNTS: readonly Account[] = Object.values(ACCOUNTS);

const ACCOUNT_BY_CODE = new Map(ALL_ACCOUNTS.map((a) => [a.code, a]));

export function accountByCode(code: string): Account {
  const a = ACCOUNT_BY_CODE.get(code);
  if (!a) throw new Error(`Unknown account code "${code}".`);
  return a;
}

export function accountNature(code: string): AccountNature {
  return natureOf(accountByCode(code).group);
}

// ---------------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------------

export type VoucherType =
  | 'RECEIPT'
  | 'PAYMENT'
  | 'CONTRA'
  | 'SALES'
  | 'PURCHASE'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'JOURNAL';

export type PaymentMode = 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';

/** Where the money lands. UPI and card sit in gateway receivable until settled. */
export const MODE_ACCOUNT: Readonly<Record<PaymentMode, Account>> = {
  CASH: ACCOUNTS.CASH,
  UPI: ACCOUNTS.GATEWAY,
  CARD: ACCOUNTS.GATEWAY,
  BANK_TRANSFER: ACCOUNTS.BANK,
  CHEQUE: ACCOUNTS.BANK,
};

export interface PostingLine {
  readonly accountCode: string;
  readonly dr: Paise;
  readonly cr: Paise;
  /** Mandatory on every line. A posting without a branch is a bug, not a default. */
  readonly branchId: string;
  readonly memberId?: string;
  readonly vendorId?: string;
  readonly staffId?: string;
  readonly invoiceId?: string;
  /** Optional second axis — gym floor / personal training / aerobics / retail. */
  readonly costCentreId?: string;
  readonly narration?: string;
}

export interface Voucher {
  readonly type: VoucherType;
  readonly date: IsoDate;
  readonly branchId: string;
  readonly lines: readonly PostingLine[];
  readonly narration?: string;
  readonly reference?: string;
  /**
   * Set by the caller so a retry cannot post twice. Required in practice
   * because the front desk runs offline-tolerant and will resend on reconnect.
   */
  readonly idempotencyKey?: string;
}

function dr(accountCode: string, amount: Paise, rest: Omit<PostingLine, 'accountCode' | 'dr' | 'cr'>): PostingLine {
  return { accountCode, dr: amount, cr: ZERO, ...rest };
}

function cr(accountCode: string, amount: Paise, rest: Omit<PostingLine, 'accountCode' | 'dr' | 'cr'>): PostingLine {
  return { accountCode, dr: ZERO, cr: amount, ...rest };
}

export function totalDr(lines: readonly PostingLine[]): Paise {
  return add(...lines.map((l) => l.dr));
}

export function totalCr(lines: readonly PostingLine[]): Paise {
  return add(...lines.map((l) => l.cr));
}

/**
 * Balanced by construction — a voucher that doesn't balance never exists.
 *
 * Validation happens here rather than in a database constraint so that every
 * shell (api, web, desktop, mobile) fails the same way, before anything is sent.
 */
export function buildVoucher(v: Voucher): Voucher {
  if (v.lines.length === 0) {
    throw new Error('A voucher must have at least one posting line.');
  }

  for (const l of v.lines) {
    accountByCode(l.accountCode); // throws on unknown account
    if (!l.branchId) {
      throw new Error(`Posting to ${l.accountCode} has no branchId.`);
    }
    if (l.dr < 0 || l.cr < 0) {
      throw new Error(`Posting to ${l.accountCode} has a negative amount. Reverse, don't negate.`);
    }
    if (l.dr > 0 && l.cr > 0) {
      throw new Error(`Posting to ${l.accountCode} is both debit and credit. Split it into two lines.`);
    }
    if (l.dr === 0 && l.cr === 0) {
      throw new Error(`Posting to ${l.accountCode} is zero. Drop the line.`);
    }
  }

  const d = totalDr(v.lines);
  const c = totalCr(v.lines);
  if (d !== c) {
    throw new Error(`Voucher does not balance: debits ${d} paise, credits ${c} paise.`);
  }

  return v;
}

// ---------------------------------------------------------------------------
// Posting rules — the dozen shapes a gym actually has
// ---------------------------------------------------------------------------

export interface MembershipSaleInput {
  readonly date: IsoDate;
  readonly branchId: string;
  readonly memberId: string;
  readonly invoiceId: string;
  readonly gst: GstBreakdown;
  /** What the member handed over now. May be less than the total. */
  readonly received: Paise;
  readonly mode: PaymentMode;
  readonly idempotencyKey?: string;
}

/**
 * A membership sale, with part payment as a first-class case.
 *
 * "₹3,000 now, ₹2,000 next week" is normal in Indian gyms and is handled badly
 * by foreign software. The unpaid remainder becomes a debtor balance, not a
 * smaller sale.
 *
 * The credit goes to **deferred revenue, not income** — an annual plan sold in
 * January is not January's income. Recognition happens monthly, by
 * `recogniseMembershipRevenue`.
 */
export function postMembershipSale(input: MembershipSaleInput): Voucher {
  const { date, branchId, memberId, invoiceId, gst, received, mode } = input;

  if (received > gst.total) {
    throw new Error('Received more than the invoice total. Take the excess as an advance instead.');
  }

  const balance = paise(gst.total - received);
  const ref = { branchId, memberId, invoiceId };

  const lines: PostingLine[] = [];

  if (received > 0) {
    lines.push(dr(MODE_ACCOUNT[mode].code, received, { ...ref, narration: `Received by ${mode}` }));
  }
  if (balance > 0) {
    lines.push(dr(ACCOUNTS.MEMBER_DUES.code, balance, { ...ref, narration: 'Balance due' }));
  }

  lines.push(cr(ACCOUNTS.DEFERRED_MEMBERSHIP.code, gst.taxable, ref));
  if (gst.cgst > 0) lines.push(cr(ACCOUNTS.OUTPUT_CGST.code, gst.cgst, ref));
  if (gst.sgst > 0) lines.push(cr(ACCOUNTS.OUTPUT_SGST.code, gst.sgst, ref));
  if (gst.igst > 0) lines.push(cr(ACCOUNTS.OUTPUT_IGST.code, gst.igst, ref));

  return buildVoucher({
    type: 'SALES',
    date,
    branchId,
    lines,
    narration: 'Membership sale',
    reference: invoiceId,
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

/** Member clears an outstanding balance. */
export function postDuesCollection(input: {
  date: IsoDate;
  branchId: string;
  memberId: string;
  amount: Paise;
  mode: PaymentMode;
  invoiceId?: string;
  idempotencyKey?: string;
}): Voucher {
  const ref = {
    branchId: input.branchId,
    memberId: input.memberId,
    ...(input.invoiceId ? { invoiceId: input.invoiceId } : {}),
  };
  return buildVoucher({
    type: 'RECEIPT',
    date: input.date,
    branchId: input.branchId,
    lines: [
      dr(MODE_ACCOUNT[input.mode].code, input.amount, ref),
      cr(ACCOUNTS.MEMBER_DUES.code, input.amount, ref),
    ],
    narration: 'Dues cleared',
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

/**
 * Monthly revenue recognition — moves one period's worth of a plan from
 * deferred revenue into income.
 *
 * Without this, January looks excellent and February looks terrible purely
 * because of who happened to renew an annual plan.
 */
export function recogniseMembershipRevenue(input: {
  date: IsoDate;
  branchId: string;
  memberId: string;
  amount: Paise;
  idempotencyKey?: string;
}): Voucher {
  const ref = { branchId: input.branchId, memberId: input.memberId };
  return buildVoucher({
    type: 'JOURNAL',
    date: input.date,
    branchId: input.branchId,
    lines: [
      dr(ACCOUNTS.DEFERRED_MEMBERSHIP.code, input.amount, ref),
      cr(ACCOUNTS.MEMBERSHIP_INCOME.code, input.amount, ref),
    ],
    narration: 'Membership revenue recognised',
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

/** An expense paid at a branch — rent, electricity, salaries, maintenance. */
export function postExpense(input: {
  date: IsoDate;
  branchId: string;
  expenseAccountCode: string;
  amount: Paise;
  mode: PaymentMode;
  vendorId?: string;
  costCentreId?: string;
  narration?: string;
  idempotencyKey?: string;
}): Voucher {
  if (accountNature(input.expenseAccountCode) !== 'EXPENSE') {
    throw new Error(`Account ${input.expenseAccountCode} is not an expense account.`);
  }
  const ref = {
    branchId: input.branchId,
    ...(input.vendorId ? { vendorId: input.vendorId } : {}),
    ...(input.costCentreId ? { costCentreId: input.costCentreId } : {}),
  };
  return buildVoucher({
    type: 'PAYMENT',
    date: input.date,
    branchId: input.branchId,
    lines: [
      dr(input.expenseAccountCode, input.amount, ref),
      cr(MODE_ACCOUNT[input.mode].code, input.amount, ref),
    ],
    ...(input.narration ? { narration: input.narration } : {}),
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

/**
 * Reverse a voucher. Never edit, never delete.
 *
 * The original stays exactly as posted and a mirror-image entry cancels it, so
 * the trail shows what happened *and* that it was undone — which is the whole
 * point in a cash business, and what the MCA edit-log rule requires.
 */
export function reverseVoucher(original: Voucher, on: IsoDate, reason: string): Voucher {
  return buildVoucher({
    type: 'CREDIT_NOTE',
    date: on,
    branchId: original.branchId,
    lines: original.lines.map((l) => ({ ...l, dr: l.cr, cr: l.dr })),
    narration: `Reversal: ${reason}`,
    ...(original.reference ? { reference: original.reference } : {}),
  });
}

// ---------------------------------------------------------------------------
// Reporting primitives
// ---------------------------------------------------------------------------

export interface AccountBalance {
  readonly accountCode: string;
  readonly dr: Paise;
  readonly cr: Paise;
}

/**
 * Net balances per account, optionally for one branch.
 * Every report in the product is an aggregation over posting lines like this.
 */
export function trialBalance(
  lines: readonly PostingLine[],
  opts: { branchId?: string } = {},
): AccountBalance[] {
  const byAccount = new Map<string, { dr: number; cr: number }>();

  for (const l of lines) {
    if (opts.branchId && l.branchId !== opts.branchId) continue;
    const acc = byAccount.get(l.accountCode) ?? { dr: 0, cr: 0 };
    acc.dr += l.dr;
    acc.cr += l.cr;
    byAccount.set(l.accountCode, acc);
  }

  return [...byAccount.entries()]
    .map(([accountCode, { dr: d, cr: c }]) => ({
      accountCode,
      dr: paise(d),
      cr: paise(c),
    }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

/** The nightly integrity check: debits must equal credits, always, everywhere. */
export function isBalanced(lines: readonly PostingLine[]): boolean {
  return totalDr(lines) === totalCr(lines);
}
