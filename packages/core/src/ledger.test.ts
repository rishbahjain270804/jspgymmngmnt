import { describe, expect, it } from 'vitest';
import { isoDate } from './date.js';
import { fromInclusive } from './gst.js';
import { ZERO, add, rupees } from './money.js';
import {
  ACCOUNTS,
  ALL_ACCOUNTS,
  accountNature,
  buildVoucher,
  isBalanced,
  natureOf,
  postDuesCollection,
  postExpense,
  postMembershipSale,
  recogniseMembershipRevenue,
  reverseVoucher,
  totalCr,
  totalDr,
  trialBalance,
} from './ledger.js';

const DATE = isoDate('2026-07-29');
const BRANCH = 'vidhyadhar-nagar';

describe('chart of accounts', () => {
  it('inherits nature from the primary ancestor rather than re-declaring it', () => {
    expect(natureOf('CA-CASH')).toBe('ASSET');
    expect(natureOf('CL-DEFERRED')).toBe('LIABILITY');
    expect(natureOf('EXP-DIR')).toBe('EXPENSE');
    expect(accountNature(ACCOUNTS.MEMBER_DUES.code)).toBe('ASSET');
    expect(accountNature(ACCOUNTS.DEFERRED_MEMBERSHIP.code)).toBe('LIABILITY');
    expect(accountNature(ACCOUNTS.RENT.code)).toBe('EXPENSE');
    expect(accountNature(ACCOUNTS.MEMBERSHIP_INCOME.code)).toBe('INCOME');
  });

  it('resolves a nature for every account, so no account can fall out of a report', () => {
    for (const a of ALL_ACCOUNTS) {
      expect(() => accountNature(a.code), `${a.name} (${a.code})`).not.toThrow();
    }
  });

  it('uses unique codes', () => {
    const codes = ALL_ACCOUNTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('balanced by construction', () => {
  it('refuses a voucher that does not balance', () => {
    expect(() =>
      buildVoucher({
        type: 'JOURNAL',
        date: DATE,
        branchId: BRANCH,
        lines: [
          { accountCode: ACCOUNTS.CASH.code, dr: rupees(100), cr: ZERO, branchId: BRANCH },
          { accountCode: ACCOUNTS.MEMBERSHIP_INCOME.code, dr: ZERO, cr: rupees(90), branchId: BRANCH },
        ],
      }),
    ).toThrow(/does not balance/);
  });

  it('refuses a line with no branch — a posting without a branch is a bug', () => {
    expect(() =>
      buildVoucher({
        type: 'JOURNAL',
        date: DATE,
        branchId: BRANCH,
        lines: [
          { accountCode: ACCOUNTS.CASH.code, dr: rupees(100), cr: ZERO, branchId: '' },
          { accountCode: ACCOUNTS.MEMBERSHIP_INCOME.code, dr: ZERO, cr: rupees(100), branchId: BRANCH },
        ],
      }),
    ).toThrow(/no branchId/);
  });

  it('refuses negative amounts, unknown accounts and zero lines', () => {
    const line = (over: object) => ({
      accountCode: ACCOUNTS.CASH.code,
      dr: rupees(100),
      cr: ZERO,
      branchId: BRANCH,
      ...over,
    });
    const wrap = (l: object) =>
      buildVoucher({ type: 'JOURNAL', date: DATE, branchId: BRANCH, lines: [l as never] });

    expect(() => wrap(line({ dr: rupees(-1) }))).toThrow(/Reverse, don't negate/);
    expect(() => wrap(line({ accountCode: '9999' }))).toThrow(/Unknown account/);
    expect(() => wrap(line({ dr: ZERO, cr: ZERO }))).toThrow(/is zero/);
    expect(() => wrap(line({ cr: rupees(100) }))).toThrow(/both debit and credit/);
  });
});

describe('membership sale', () => {
  const gst = fromInclusive(rupees(12000));

  it('credits deferred revenue, not income — January is not the whole year', () => {
    const v = postMembershipSale({
      date: DATE,
      branchId: BRANCH,
      memberId: 'mem1',
      invoiceId: 'INV-001',
      gst,
      received: rupees(12000),
      mode: 'UPI',
    });

    const deferred = v.lines.find((l) => l.accountCode === ACCOUNTS.DEFERRED_MEMBERSHIP.code);
    expect(deferred?.cr).toBe(gst.taxable);
    expect(v.lines.some((l) => l.accountCode === ACCOUNTS.MEMBERSHIP_INCOME.code)).toBe(false);
    expect(isBalanced(v.lines)).toBe(true);
  });

  it('splits GST onto the right liability accounts', () => {
    const v = postMembershipSale({
      date: DATE, branchId: BRANCH, memberId: 'mem1', invoiceId: 'INV-001',
      gst, received: rupees(12000), mode: 'CASH',
    });
    const cgst = v.lines.find((l) => l.accountCode === ACCOUNTS.OUTPUT_CGST.code);
    const sgst = v.lines.find((l) => l.accountCode === ACCOUNTS.OUTPUT_SGST.code);
    expect(add(cgst!.cr, sgst!.cr)).toBe(gst.tax);
  });

  it('turns a part payment into a debtor balance, not a smaller sale', () => {
    const v = postMembershipSale({
      date: DATE, branchId: BRANCH, memberId: 'mem1', invoiceId: 'INV-001',
      gst, received: rupees(8000), mode: 'CASH',
    });

    const cash = v.lines.find((l) => l.accountCode === ACCOUNTS.CASH.code);
    const dues = v.lines.find((l) => l.accountCode === ACCOUNTS.MEMBER_DUES.code);

    expect(cash?.dr).toBe(rupees(8000));
    expect(dues?.dr).toBe(rupees(4000));
    // The sale is still the full ₹12,000.
    expect(totalCr(v.lines)).toBe(rupees(12000));
    expect(totalDr(v.lines)).toBe(rupees(12000));
  });

  it('routes UPI to gateway receivable and cash to the drawer', () => {
    const upi = postMembershipSale({
      date: DATE, branchId: BRANCH, memberId: 'm', invoiceId: 'I', gst,
      received: rupees(12000), mode: 'UPI',
    });
    expect(upi.lines.some((l) => l.accountCode === ACCOUNTS.GATEWAY.code)).toBe(true);

    const cash = postMembershipSale({
      date: DATE, branchId: BRANCH, memberId: 'm', invoiceId: 'I', gst,
      received: rupees(12000), mode: 'CASH',
    });
    expect(cash.lines.some((l) => l.accountCode === ACCOUNTS.CASH.code)).toBe(true);
  });

  it('stamps every line with the branch and the member', () => {
    const v = postMembershipSale({
      date: DATE, branchId: BRANCH, memberId: 'mem1', invoiceId: 'INV-001', gst,
      received: rupees(12000), mode: 'CASH',
    });
    expect(v.lines.every((l) => l.branchId === BRANCH && l.memberId === 'mem1')).toBe(true);
  });

  it('refuses an overpayment rather than inventing a negative balance', () => {
    expect(() =>
      postMembershipSale({
        date: DATE, branchId: BRANCH, memberId: 'm', invoiceId: 'I', gst,
        received: rupees(15000), mode: 'CASH',
      }),
    ).toThrow(/more than the invoice total/);
  });
});

describe('dues collection', () => {
  it('clears the debtor without touching income again', () => {
    const v = postDuesCollection({
      date: DATE, branchId: BRANCH, memberId: 'mem1', amount: rupees(4000), mode: 'UPI',
    });
    expect(v.lines.find((l) => l.accountCode === ACCOUNTS.MEMBER_DUES.code)?.cr).toBe(rupees(4000));
    expect(isBalanced(v.lines)).toBe(true);
  });
});

describe('revenue recognition', () => {
  it('moves deferred revenue into income, month by month', () => {
    const v = recogniseMembershipRevenue({
      date: DATE, branchId: BRANCH, memberId: 'mem1', amount: rupees(847),
    });
    expect(v.lines.find((l) => l.accountCode === ACCOUNTS.DEFERRED_MEMBERSHIP.code)?.dr).toBe(rupees(847));
    expect(v.lines.find((l) => l.accountCode === ACCOUNTS.MEMBERSHIP_INCOME.code)?.cr).toBe(rupees(847));
  });

  it('leaves nothing behind after a full year of recognition', () => {
    const gst = fromInclusive(rupees(12000));
    const sale = postMembershipSale({
      date: DATE, branchId: BRANCH, memberId: 'mem1', invoiceId: 'I', gst,
      received: rupees(12000), mode: 'UPI',
    });

    // ₹10,169.49 over 12 months, allocated so nothing is lost.
    const monthly = Math.floor(gst.taxable / 12);
    const lines = [...sale.lines];
    let recognised = 0;
    for (let i = 0; i < 12; i++) {
      const amount = i === 11 ? gst.taxable - recognised : monthly;
      recognised += amount;
      lines.push(
        ...recogniseMembershipRevenue({
          date: DATE, branchId: BRANCH, memberId: 'mem1', amount: amount as never,
        }).lines,
      );
    }

    const tb = trialBalance(lines);
    const deferred = tb.find((b) => b.accountCode === ACCOUNTS.DEFERRED_MEMBERSHIP.code)!;
    expect(deferred.dr).toBe(deferred.cr); // fully recognised, nets to zero
    const income = tb.find((b) => b.accountCode === ACCOUNTS.MEMBERSHIP_INCOME.code)!;
    expect(income.cr).toBe(gst.taxable);
  });
});

describe('expenses', () => {
  it('posts against a branch', () => {
    const v = postExpense({
      date: DATE, branchId: BRANCH, expenseAccountCode: ACCOUNTS.RENT.code,
      amount: rupees(85000), mode: 'BANK_TRANSFER',
    });
    expect(v.lines.find((l) => l.accountCode === ACCOUNTS.RENT.code)?.dr).toBe(rupees(85000));
    expect(isBalanced(v.lines)).toBe(true);
  });

  it('refuses to post an expense to a non-expense account', () => {
    expect(() =>
      postExpense({
        date: DATE, branchId: BRANCH, expenseAccountCode: ACCOUNTS.CASH.code,
        amount: rupees(100), mode: 'CASH',
      }),
    ).toThrow(/not an expense account/);
  });
});

describe('reversal', () => {
  it('mirrors the original so the pair nets to zero, leaving both on the record', () => {
    const gst = fromInclusive(rupees(12000));
    const sale = postMembershipSale({
      date: DATE, branchId: BRANCH, memberId: 'mem1', invoiceId: 'INV-001', gst,
      received: rupees(12000), mode: 'CASH',
    });
    const reversal = reverseVoucher(sale, isoDate('2026-08-01'), 'member cancelled');

    const combined = [...sale.lines, ...reversal.lines];
    expect(isBalanced(combined)).toBe(true);
    for (const b of trialBalance(combined)) {
      expect(b.dr, `account ${b.accountCode}`).toBe(b.cr);
    }
    expect(reversal.narration).toContain('member cancelled');
  });
});

describe('trial balance', () => {
  it('filters to one branch, which is what makes branch P&L possible', () => {
    const gst = fromInclusive(rupees(12000));
    const a = postMembershipSale({
      date: DATE, branchId: BRANCH, memberId: 'm1', invoiceId: 'I1', gst,
      received: rupees(12000), mode: 'CASH',
    });
    const b = postMembershipSale({
      date: DATE, branchId: 'branch-2', memberId: 'm2', invoiceId: 'I2', gst,
      received: rupees(12000), mode: 'CASH',
    });

    const all = [...a.lines, ...b.lines];
    const cashAll = trialBalance(all).find((x) => x.accountCode === ACCOUNTS.CASH.code)!;
    const cashHome = trialBalance(all, { branchId: BRANCH }).find(
      (x) => x.accountCode === ACCOUNTS.CASH.code,
    )!;

    expect(cashAll.dr).toBe(rupees(24000));
    expect(cashHome.dr).toBe(rupees(12000));
  });

  it('balances across every branch combined', () => {
    const gst = fromInclusive(rupees(5000));
    const lines = ['b1', 'b2', 'b3'].flatMap(
      (br, i) =>
        postMembershipSale({
          date: DATE, branchId: br, memberId: `m${i}`, invoiceId: `I${i}`, gst,
          received: rupees(3000), mode: 'CASH',
        }).lines,
    );
    expect(isBalanced(lines)).toBe(true);
  });
});
