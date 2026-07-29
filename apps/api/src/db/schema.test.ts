import mysql from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ALL_ACCOUNTS,
  GROUPS,
  fromInclusive,
  postMembershipSale,
  rupees,
  uuidv7,
} from '@oan/core';
import { dbConfig } from './connect.js';
import { migrate } from './migrate.js';

let db: mysql.Connection;
let branchId: string;
let otherBranchId: string;
let memberId: string;

/** Each test file gets a throwaway database, so runs never contaminate each other. */
const TEST_DB = `oan_test_${Date.now().toString(36)}`;

async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [r] = await db.query(sql, params);
  return r as T[];
}
async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  return (await rows<T>(sql, params))[0] as T;
}

beforeAll(async () => {
  const cfg = dbConfig();
  const admin = await mysql.createConnection({ ...cfg, database: undefined, multipleStatements: true });
  await admin.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4`);
  await admin.end();

  db = await mysql.createConnection({ ...cfg, database: TEST_DB, dateStrings: true, timezone: 'Z' });
  await migrate(db);

  branchId = uuidv7();
  otherBranchId = uuidv7();
  memberId = uuidv7();

  await db.query(
    `INSERT INTO branch (id, code, name, invoice_prefix, gstin) VALUES (?, 'VDN', 'Vidhyadhar Nagar', 'VDN', '08AAAAA0000A1Z5')`,
    [branchId],
  );
  await db.query(
    `INSERT INTO branch (id, code, name, invoice_prefix) VALUES (?, 'BR2', 'Branch 2', 'BR2')`,
    [otherBranchId],
  );
  await db.query(`INSERT INTO member (id, phone, name, home_branch_id) VALUES (?, '9800032849', 'Rahul Sharma', ?)`, [
    memberId,
    branchId,
  ]);
}, 120_000);

afterAll(async () => {
  if (db) {
    await db.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await db.end();
  }
});

describe('migrations', () => {
  it('apply cleanly against MySQL 8', async () => {
    const t = await one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?`,
      [TEST_DB],
    );
    expect(Number(t.n)).toBeGreaterThan(18);
  });

  it('are recorded so a re-run is a no-op', async () => {
    const applied = await migrate(db);
    expect(applied).toEqual([]);
  });

  it('created the routine that carries the balance guarantee', async () => {
    const r = await rows<{ ROUTINE_NAME: string }>(
      `SELECT ROUTINE_NAME FROM information_schema.routines WHERE routine_schema = ?`,
      [TEST_DB],
    );
    expect(r.map((x) => x.ROUTINE_NAME)).toContain('sp_post_voucher');
  });

  it('needs no stored FUNCTION, so migrations never require SUPER', async () => {
    // Creating a FUNCTION with binlog on demands SUPER or a loosened server
    // setting. Nature resolution is a recursive view instead, so deploying a
    // migration on managed MySQL needs no elevated privilege.
    const r = await rows<{ n: number }>(
      `SELECT COUNT(*) AS n FROM information_schema.routines WHERE routine_schema = ? AND routine_type = 'FUNCTION'`,
      [TEST_DB],
    );
    expect(Number(r[0]!.n)).toBe(0);
  });
});

describe('chart of accounts stays in step with @oan/core', () => {
  it('seeds exactly the accounts the posting rules reference', async () => {
    const r = await rows<{ code: string }>(`SELECT code FROM ledger_account ORDER BY code`);
    // Drift here means a posting rule can reference an account that does not
    // exist — a runtime failure at the counter rather than in CI.
    expect(r.map((x) => x.code).sort()).toEqual(ALL_ACCOUNTS.map((a) => a.code).sort());
  });

  it('files every account under the group @oan/core expects', async () => {
    const r = await rows<{ code: string; group_code: string }>(
      `SELECT code, group_code FROM ledger_account`,
    );
    const byCode = new Map(r.map((x) => [x.code, x.group_code]));
    for (const a of ALL_ACCOUNTS) {
      expect(byCode.get(a.code), `account ${a.code} (${a.name})`).toBe(a.group);
    }
  });

  it('seeds exactly the groups @oan/core declares', async () => {
    const r = await rows<{ code: string }>(`SELECT code FROM ledger_group`);
    expect(r.map((x) => x.code).sort()).toEqual(GROUPS.map((g) => g.code).sort());
  });

  it('resolves nature by inheritance, matching natureOf()', async () => {
    for (const [group, expected] of [
      ['CA-CASH', 'ASSET'],
      ['CL-DEFERRED', 'LIABILITY'],
      ['CL-TAX', 'LIABILITY'],
      ['EXP-DIR', 'EXPENSE'],
      ['INC', 'INCOME'],
      ['EQ', 'EQUITY'],
    ] as const) {
      const r = await one<{ nature: string }>(`SELECT nature FROM v_ledger_group_nature WHERE code = ?`, [group]);
      expect(r?.nature, group).toBe(expected);
    }
  });

  it('gives every group exactly one inherited nature — no orphans, no duplicates', async () => {
    const groups = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM ledger_group`);
    const resolved = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM v_ledger_group_nature`);
    expect(Number(resolved.n)).toBe(Number(groups.n));
  });

  it('exposes each account with the nature @oan/core would compute', async () => {
    const r = await rows<{ code: string; nature: string }>(`SELECT code, nature FROM v_ledger_account`);
    const byCode = new Map(r.map((x) => [x.code, x.nature]));
    expect(byCode.get('1141')).toBe('ASSET');      // Member Dues
    expect(byCode.get('2131')).toBe('LIABILITY');  // Deferred Membership Revenue
    expect(byCode.get('4100')).toBe('INCOME');     // Membership Income
    expect(byCode.get('5300')).toBe('EXPENSE');    // Rent
    expect(byCode.size).toBe(ALL_ACCOUNTS.length);
  });

  it('refuses a sub-group that re-declares nature', async () => {
    await expect(
      db.query(`INSERT INTO ledger_group (code, name, parent_code, nature) VALUES ('CA-BAD','Rogue','CA','INCOME')`),
    ).rejects.toThrow(/group_nature_rule|CONSTRAINT/i);
  });
});

describe('the ledger cannot be written crooked', () => {
  async function postVoucher(lines: object[], id = uuidv7(), idem: string | null = null) {
    await db.query(`CALL sp_post_voucher(?,?,?,?,?,?,?,?,?, CAST(? AS JSON))`, [
      id, 'JOURNAL', '2026-07-29', branchId, 'test', null, null, idem, null,
      JSON.stringify(lines),
    ]);
    return id;
  }

  it('posts a balanced voucher and marks it posted', async () => {
    const id = await postVoucher([
      { account_code: '1110', dr: 100000, cr: 0 },
      { account_code: '4100', dr: 0, cr: 100000 },
    ]);
    const v = await one<{ total_dr_paise: number; total_cr_paise: number; posted_at: string | null }>(
      `SELECT total_dr_paise, total_cr_paise, posted_at FROM voucher WHERE id = ?`,
      [id],
    );
    expect(Number(v.total_dr_paise)).toBe(100000);
    expect(Number(v.total_cr_paise)).toBe(100000);
    expect(v.posted_at).not.toBeNull();
  });

  it('rejects an unbalanced voucher and leaves nothing behind', async () => {
    const id = uuidv7();
    await expect(
      postVoucher(
        [
          { account_code: '1110', dr: 100000, cr: 0 },
          { account_code: '4100', dr: 0, cr: 90000 },
        ],
        id,
      ),
    ).rejects.toThrow(/does not balance/);

    // Rolled back entirely — no orphan header, no orphan lines.
    expect(await rows(`SELECT id FROM voucher WHERE id = ?`, [id])).toHaveLength(0);
    expect(await rows(`SELECT id FROM posting WHERE voucher_id = ?`, [id])).toHaveLength(0);
  });

  it('rejects a voucher with no lines', async () => {
    await expect(postVoucher([])).rejects.toThrow(/at least one posting line/);
  });

  it('never lets a draft voucher reach a report', async () => {
    // A voucher written outside sp_post_voucher stays unposted, and v_posting
    // is what every financial report reads.
    const id = uuidv7();
    await db.query(
      `INSERT INTO voucher (id, type, voucher_date, branch_id) VALUES (?, 'JOURNAL', '2026-07-29', ?)`,
      [id, branchId],
    );
    await db.query(
      `INSERT INTO posting (voucher_id, account_code, dr_paise, cr_paise, branch_id) VALUES (?, '1110', 5000, 0, ?)`,
      [id, branchId],
    );

    expect(await rows(`SELECT id FROM posting WHERE voucher_id = ?`, [id])).toHaveLength(1);
    expect(await rows(`SELECT id FROM v_posting WHERE voucher_id = ?`, [id])).toHaveLength(0);
  });

  it('refuses to add a line to an already-posted voucher', async () => {
    const id = await postVoucher([
      { account_code: '1110', dr: 1000, cr: 0 },
      { account_code: '4100', dr: 0, cr: 1000 },
    ]);
    await expect(
      db.query(
        `INSERT INTO posting (voucher_id, account_code, dr_paise, cr_paise, branch_id) VALUES (?, '1110', 1, 0, ?)`,
        [id, branchId],
      ),
    ).rejects.toThrow(/already posted/);
  });

  it('rejects a posting that is both debit and credit, or neither', async () => {
    const id = uuidv7();
    await db.query(`INSERT INTO voucher (id, type, voucher_date, branch_id) VALUES (?, 'JOURNAL', '2026-07-29', ?)`, [id, branchId]);
    for (const [dr, cr] of [[500, 500], [0, 0]] as const) {
      await expect(
        db.query(
          `INSERT INTO posting (voucher_id, account_code, dr_paise, cr_paise, branch_id) VALUES (?, '1110', ?, ?, ?)`,
          [id, dr, cr, branchId],
        ),
      ).rejects.toThrow(/posting_one_side|CONSTRAINT/i);
    }
  });

  it('rejects a negative amount — reverse, do not negate', async () => {
    const id = uuidv7();
    await db.query(`INSERT INTO voucher (id, type, voucher_date, branch_id) VALUES (?, 'JOURNAL', '2026-07-29', ?)`, [id, branchId]);
    await expect(
      db.query(
        `INSERT INTO posting (voucher_id, account_code, dr_paise, cr_paise, branch_id) VALUES (?, '1110', -100, 0, ?)`,
        [id, branchId],
      ),
    ).rejects.toThrow(/CONSTRAINT|posting_/i);
  });

  it('rejects a posting with no branch', async () => {
    const id = uuidv7();
    await db.query(`INSERT INTO voucher (id, type, voucher_date, branch_id) VALUES (?, 'JOURNAL', '2026-07-29', ?)`, [id, branchId]);
    await expect(
      db.query(
        `INSERT INTO posting (voucher_id, account_code, dr_paise, cr_paise, branch_id) VALUES (?, '1110', 100, 0, NULL)`,
        [id],
      ),
    ).rejects.toThrow(/branch_id|null/i);
  });

  it('makes a repeated idempotency key a hard failure, not a double post', async () => {
    const lines = [
      { account_code: '1110', dr: 2500, cr: 0 },
      { account_code: '4100', dr: 0, cr: 2500 },
    ];
    await postVoucher(lines, uuidv7(), 'idem-abc');
    await expect(postVoucher(lines, uuidv7(), 'idem-abc')).rejects.toThrow(/Duplicate entry|duplicate/i);
  });
});

describe('append-only', () => {
  let postedId: string;

  beforeAll(async () => {
    postedId = uuidv7();
    await db.query(`CALL sp_post_voucher(?,?,?,?,?,?,?,?,?, CAST(? AS JSON))`, [
      postedId, 'JOURNAL', '2026-07-29', branchId, 'append test', null, null, null, null,
      JSON.stringify([
        { account_code: '1110', dr: 7000, cr: 0 },
        { account_code: '4100', dr: 0, cr: 7000 },
      ]),
    ]);
  });

  it('refuses to edit or delete a posting', async () => {
    await expect(db.query(`UPDATE posting SET dr_paise = 1 WHERE voucher_id = ?`, [postedId])).rejects.toThrow(
      /append-only/,
    );
    await expect(db.query(`DELETE FROM posting WHERE voucher_id = ?`, [postedId])).rejects.toThrow(/append-only/);
  });

  it('refuses to change a voucher of record', async () => {
    await expect(db.query(`UPDATE voucher SET narration = 'x' WHERE id = ?`, [postedId])).rejects.toThrow(
      /append-only/,
    );
    await expect(db.query(`UPDATE voucher SET voucher_date = '2020-01-01' WHERE id = ?`, [postedId])).rejects.toThrow(
      /append-only/,
    );
    await expect(db.query(`DELETE FROM voucher WHERE id = ?`, [postedId])).rejects.toThrow(/append-only/);
  });

  it('refuses to un-post a voucher', async () => {
    await expect(db.query(`UPDATE voucher SET posted_at = NULL WHERE id = ?`, [postedId])).rejects.toThrow(
      /cannot be un-posted/,
    );
  });

  it('refuses to alter the audit log — an editable trail is not a trail', async () => {
    await db.query(`INSERT INTO audit_log (action, entity_table, entity_id) VALUES ('TEST','member','x')`);
    await expect(db.query(`UPDATE audit_log SET action = 'y'`)).rejects.toThrow(/append-only/);
    await expect(db.query(`DELETE FROM audit_log`)).rejects.toThrow(/append-only/);
  });
});

describe('invoices', () => {
  it('refuses a breakdown that does not tie to the total', async () => {
    await expect(
      db.query(
        `INSERT INTO invoice (id, invoice_no, branch_id, taxable_paise, cgst_paise, sgst_paise, total_paise, gst_rate)
         VALUES (?, 'BAD-1', ?, 1016949, 91526, 91525, 1200001, 18)`,
        [uuidv7(), branchId],
      ),
    ).rejects.toThrow(/invoice_ties|CONSTRAINT/i);
  });

  it('accepts the breakdown @oan/core computes for a ₹12,000 plan', async () => {
    const g = fromInclusive(rupees(12000));
    await db.query(
      `INSERT INTO invoice (id, invoice_no, branch_id, member_id, taxable_paise, cgst_paise, sgst_paise, total_paise, gst_rate)
       VALUES (?, 'VDN-1', ?, ?, ?, ?, ?, ?, 18)`,
      [uuidv7(), branchId, memberId, g.taxable, g.cgst, g.sgst, g.total],
    );
    const r = await one<{ total_paise: number }>(`SELECT total_paise FROM invoice WHERE invoice_no = 'VDN-1'`);
    expect(Number(r.total_paise)).toBe(1200000);
  });

  it('refuses CGST/SGST and IGST on the same invoice', async () => {
    await expect(
      db.query(
        `INSERT INTO invoice (id, invoice_no, branch_id, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise, gst_rate)
         VALUES (?, 'BAD-2', ?, 1000, 90, 90, 180, 1360, 18)`,
        [uuidv7(), branchId],
      ),
    ).rejects.toThrow(/invoice_gst_treatment|CONSTRAINT/i);
  });

  it('keeps invoice numbers unique per branch, but allows reuse across branches', async () => {
    await expect(
      db.query(
        `INSERT INTO invoice (id, invoice_no, branch_id, taxable_paise, total_paise, gst_rate) VALUES (?, 'VDN-1', ?, 100, 100, 0)`,
        [uuidv7(), branchId],
      ),
    ).rejects.toThrow(/Duplicate entry/i);

    // Same number at a different branch is fine — the series is per branch.
    await db.query(
      `INSERT INTO invoice (id, invoice_no, branch_id, taxable_paise, total_paise, gst_rate) VALUES (?, 'VDN-1', ?, 100, 100, 0)`,
      [uuidv7(), otherBranchId],
    );
  });
});

describe('a real membership sale from @oan/core round-trips into the ledger', () => {
  it('posts a part payment as cash plus a debtor balance, and balances', async () => {
    const gst = fromInclusive(rupees(12000));
    const voucher = postMembershipSale({
      date: '2026-07-29' as never,
      branchId,
      memberId,
      invoiceId: 'VDN-2',
      gst,
      received: rupees(8000),
      mode: 'CASH',
    });

    const vid = uuidv7();
    await db.query(`CALL sp_post_voucher(?,?,?,?,?,?,?,?,?, CAST(? AS JSON))`, [
      vid, voucher.type, voucher.date, branchId, voucher.narration ?? null,
      voucher.reference ?? null, null, null, null,
      JSON.stringify(
        voucher.lines.map((l) => ({
          account_code: l.accountCode,
          dr: l.dr,
          cr: l.cr,
          branch_id: l.branchId,
          member_id: l.memberId ?? null,
          narration: l.narration ?? null,
        })),
      ),
    ]);

    const v = await one<{ total_dr_paise: number; total_cr_paise: number }>(
      `SELECT total_dr_paise, total_cr_paise FROM voucher WHERE id = ?`,
      [vid],
    );
    expect(Number(v.total_dr_paise)).toBe(Number(v.total_cr_paise));
    expect(Number(v.total_dr_paise)).toBe(1200000);

    const byAccount = new Map(
      (await rows<{ account_code: string; dr_paise: number; cr_paise: number }>(
        `SELECT account_code, dr_paise, cr_paise FROM v_posting WHERE voucher_id = ?`,
        [vid],
      )).map((r) => [r.account_code, r]),
    );

    expect(Number(byAccount.get('1110')?.dr_paise)).toBe(800000); // cash taken
    expect(Number(byAccount.get('1141')?.dr_paise)).toBe(400000); // balance due
    // Credited to deferred revenue, never straight to income.
    expect(Number(byAccount.get('2131')?.cr_paise)).toBe(gst.taxable);
    expect(byAccount.has('4100')).toBe(false);
  });
});

describe('check-in', () => {
  it('records one per member per day per branch, so a double scan is not double footfall', async () => {
    await db.query(
      `INSERT INTO check_in (id, member_id, branch_id, on_date, verdict_level, verdict_code) VALUES (?, ?, ?, '2026-07-29', 'GREEN', 'ACTIVE')`,
      [uuidv7(), memberId, branchId],
    );
    await expect(
      db.query(
        `INSERT INTO check_in (id, member_id, branch_id, on_date, verdict_level, verdict_code) VALUES (?, ?, ?, '2026-07-29', 'GREEN', 'ACTIVE')`,
        [uuidv7(), memberId, branchId],
      ),
    ).rejects.toThrow(/Duplicate entry/i);
  });

  it('allows the same member at another branch on the same day', async () => {
    await db.query(
      `INSERT INTO check_in (id, member_id, branch_id, on_date, verdict_level, verdict_code) VALUES (?, ?, ?, '2026-07-29', 'AMBER', 'WRONG_BRANCH')`,
      [uuidv7(), memberId, otherBranchId],
    );
  });

  it('rejects a repeated idempotency key, so an offline retry cannot double-post', async () => {
    await db.query(
      `INSERT INTO check_in (id, member_id, branch_id, on_date, verdict_level, verdict_code, idempotency_key) VALUES (?, ?, ?, '2026-08-01', 'GREEN', 'ACTIVE', 'ck-1')`,
      [uuidv7(), memberId, branchId],
    );
    await expect(
      db.query(
        `INSERT INTO check_in (id, member_id, branch_id, on_date, verdict_level, verdict_code, idempotency_key) VALUES (?, ?, ?, '2026-08-02', 'GREEN', 'ACTIVE', 'ck-1')`,
        [uuidv7(), memberId, branchId],
      ),
    ).rejects.toThrow(/Duplicate entry/i);
  });
});

describe('dates survive the round trip', () => {
  it('returns a calendar date as the same string it went in as', async () => {
    // The bug this guards: a Date object rendered in IST showing 30 Dec for a
    // membership that expires on the 31st.
    const planId = uuidv7();
    await db.query(
      `INSERT INTO membership_plan (id, name, duration_unit, duration_count, price_paise) VALUES (?, 'Annual', 'YEAR', 1, 1200000)`,
      [planId],
    );
    const id = uuidv7();
    await db.query(
      `INSERT INTO membership (id, member_id, branch_id, plan_id, plan_snapshot, starts_on, expires_on)
       VALUES (?, ?, ?, ?, CAST('{}' AS JSON), '2026-01-01', '2026-12-31')`,
      [id, memberId, branchId, planId],
    );
    const m = await one<{ starts_on: string; expires_on: string }>(
      `SELECT starts_on, expires_on FROM membership WHERE id = ?`,
      [id],
    );
    expect(m.starts_on).toBe('2026-01-01');
    expect(m.expires_on).toBe('2026-12-31');
  });
});

describe('memberships', () => {
  let planId: string;
  beforeAll(async () => {
    planId = uuidv7();
    await db.query(
      `INSERT INTO membership_plan (id, name, duration_unit, duration_count, price_paise) VALUES (?, 'Quarterly', 'MONTH', 3, 400000)`,
      [planId],
    );
  });

  it('refuses an expiry before the start date', async () => {
    await expect(
      db.query(
        `INSERT INTO membership (id, member_id, branch_id, plan_id, plan_snapshot, starts_on, expires_on)
         VALUES (?, ?, ?, ?, CAST('{}' AS JSON), '2026-07-01', '2026-06-01')`,
        [uuidv7(), memberId, branchId, planId],
      ),
    ).rejects.toThrow(/membership_dates|CONSTRAINT/i);
  });

  it('refuses a negative balance due', async () => {
    await expect(
      db.query(
        `INSERT INTO membership (id, member_id, branch_id, plan_id, plan_snapshot, starts_on, expires_on, balance_due_paise)
         VALUES (?, ?, ?, ?, CAST('{}' AS JSON), '2026-07-01', '2026-09-30', -1)`,
        [uuidv7(), memberId, branchId, planId],
      ),
    ).rejects.toThrow(/CONSTRAINT|balance/i);
  });
});

describe('equipment', () => {
  it('refuses a transfer from a branch to itself', async () => {
    const eq = uuidv7();
    await db.query(`INSERT INTO equipment (id, name, branch_id) VALUES (?, 'Treadmill TM-07', ?)`, [eq, branchId]);
    await expect(
      db.query(`INSERT INTO equipment_transfer (id, equipment_id, from_branch_id, to_branch_id) VALUES (?, ?, ?, ?)`, [
        uuidv7(), eq, branchId, branchId,
      ]),
    ).rejects.toThrow(/transfer_between_different_branches|CONSTRAINT/i);
  });

  it('materialises the faulty flag that stands in for a partial index', async () => {
    const eq = uuidv7();
    await db.query(
      "INSERT INTO equipment (id, name, branch_id, `condition`) VALUES (?, 'Leg press LP-02', ?, 'OUT_OF_ORDER')",
      [eq, branchId],
    );
    const r = await one<{ is_faulty: number }>(`SELECT is_faulty FROM equipment WHERE id = ?`, [eq]);
    expect(Number(r.is_faulty)).toBe(1);
  });
});
