-- =============================================================================
-- 0002 — The ledger: groups, accounts, vouchers, postings, invoices, payments
-- Engine: MySQL 8.0
--
-- Double-entry underneath, no accounting UI on top (§14).
--
-- HOW THE BALANCE GUARANTEE SURVIVES THE MOVE TO MySQL
-- -----------------------------------------------------------------------------
-- Postgres could defer a constraint trigger to commit, so an unbalanced voucher
-- simply could not be committed. MySQL has no deferrable constraints, so the
-- same guarantee is rebuilt from three parts:
--
--   1. `voucher.total_dr_paise` / `total_cr_paise` are maintained by a trigger
--      on every posting, so a voucher always knows its own sums.
--   2. `voucher.posted_at` is NULL until the voucher is proven balanced. A
--      voucher with lines that do not tie is a DRAFT, never a posted entry.
--   3. `sp_post_voucher` is the sanctioned write path: it inserts the header
--      and all lines, checks the sums, and only then stamps `posted_at` —
--      raising SQLSTATE 45000 and rolling back if they differ.
--
-- Reports read `v_posting` (posted vouchers only), so a draft can never reach
-- a P&L. This is arguably clearer than the Postgres version: "balanced" became
-- an explicit, queryable state instead of an invisible constraint.
-- =============================================================================

-- Groups ----------------------------------------------------------------------
-- Hierarchical. Nature is declared only on primary groups and inherited by
-- descendants (§15.2 rule 1) — a child of Current Assets can never be income.
CREATE TABLE ledger_group (
  code            VARCHAR(20)  NOT NULL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  parent_code     VARCHAR(20),
  nature          ENUM('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'),
  affects_gross_profit TINYINT(1) NOT NULL DEFAULT 0,
  sort_order      INT          NOT NULL DEFAULT 0,
  -- A primary group declares nature; a sub-group inherits and must not.
  CONSTRAINT group_nature_rule CHECK (
    (parent_code IS NULL AND nature IS NOT NULL) OR
    (parent_code IS NOT NULL AND nature IS NULL)
  ),
  KEY group_by_parent (parent_code),
  CONSTRAINT fk_group_parent FOREIGN KEY (parent_code) REFERENCES ledger_group(code)
) ENGINE=InnoDB;


-- Accounts --------------------------------------------------------------------
-- Always leaves. An account can never have a child (§15.2 rule 2) — that is
-- what groups are for. Enforced by there being no parent column here at all.
CREATE TABLE ledger_account (
  code            VARCHAR(20)  NOT NULL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  group_code      VARCHAR(20)  NOT NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY account_by_group (group_code),
  CONSTRAINT fk_account_group FOREIGN KEY (group_code) REFERENCES ledger_group(code)
) ENGINE=InnoDB;


-- Vouchers --------------------------------------------------------------------
CREATE TABLE voucher (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  type            ENUM('RECEIPT','PAYMENT','CONTRA','SALES','PURCHASE',
                       'CREDIT_NOTE','DEBIT_NOTE','JOURNAL') NOT NULL,
  voucher_date    DATE         NOT NULL,
  branch_id       CHAR(36)     NOT NULL,
  narration       VARCHAR(300),
  reference       VARCHAR(80),
  -- Set when this voucher reverses another. The original stays exactly as
  -- posted; the pair nets to zero and both remain on the record (§16).
  reverses_id     CHAR(36),
  created_by      CHAR(36),
  -- The counter runs offline-tolerant and resends on reconnect. Without this a
  -- dropped connection mid-save becomes a double charge (§16.1).
  idempotency_key VARCHAR(80),

  -- Running sums, maintained by trg_posting_after_insert.
  total_dr_paise  BIGINT       NOT NULL DEFAULT 0,
  total_cr_paise  BIGINT       NOT NULL DEFAULT 0,
  -- NULL until proven balanced. Reports never read a draft.
  posted_at       TIMESTAMP(3) NULL,

  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  -- Deliberately no updated_at. Vouchers are never edited.

  UNIQUE KEY voucher_idempotent (idempotency_key),
  UNIQUE KEY voucher_reverses_once (reverses_id),
  KEY voucher_by_branch_date (branch_id, voucher_date DESC),
  KEY voucher_by_date (voucher_date DESC),
  KEY voucher_posted (posted_at),
  CONSTRAINT fk_voucher_branch   FOREIGN KEY (branch_id)   REFERENCES branch(id),
  CONSTRAINT fk_voucher_reverses FOREIGN KEY (reverses_id) REFERENCES voucher(id),
  CONSTRAINT fk_voucher_staff    FOREIGN KEY (created_by)  REFERENCES staff(id)
) ENGINE=InnoDB;


-- Postings --------------------------------------------------------------------
-- The single table every financial report aggregates over. Get this right and
-- P&L, balance sheet, branch comparison and ageing are almost free (§15.9).
CREATE TABLE posting (
  id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  voucher_id      CHAR(36)     NOT NULL,
  account_code    VARCHAR(20)  NOT NULL,

  dr_paise        BIGINT       NOT NULL DEFAULT 0,
  cr_paise        BIGINT       NOT NULL DEFAULT 0,

  -- Mandatory. A posting without a branch is a bug, not a default (§15.9).
  branch_id       CHAR(36)     NOT NULL,
  -- Optional second axis: gym floor / personal training / aerobics / retail.
  cost_centre_id  CHAR(36),

  -- Dimensions, not ledgers. Members are rows in a table; a member's balance
  -- is a query, not an account (§15.9).
  member_id       CHAR(36),
  vendor_id       CHAR(36),
  staff_id        CHAR(36),
  invoice_id      CHAR(36),

  narration       VARCHAR(300),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  -- Exactly one side, and never zero.
  CONSTRAINT posting_one_side CHECK (
    (dr_paise > 0 AND cr_paise = 0) OR (cr_paise > 0 AND dr_paise = 0)
  ),
  CONSTRAINT posting_non_negative CHECK (dr_paise >= 0 AND cr_paise >= 0),

  KEY posting_by_voucher (voucher_id),
  KEY posting_by_account_branch (account_code, branch_id),
  KEY posting_by_branch (branch_id),
  KEY posting_by_member (member_id),
  CONSTRAINT fk_posting_voucher FOREIGN KEY (voucher_id)   REFERENCES voucher(id),
  CONSTRAINT fk_posting_account FOREIGN KEY (account_code) REFERENCES ledger_account(code),
  CONSTRAINT fk_posting_branch  FOREIGN KEY (branch_id)    REFERENCES branch(id),
  CONSTRAINT fk_posting_member  FOREIGN KEY (member_id)    REFERENCES member(id),
  CONSTRAINT fk_posting_staff   FOREIGN KEY (staff_id)     REFERENCES staff(id)
) ENGINE=InnoDB;


-- Invoices --------------------------------------------------------------------
CREATE TABLE invoice (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  -- Per-branch series. GST wants an unbroken sequence per place of business.
  invoice_no      VARCHAR(40)  NOT NULL,
  branch_id       CHAR(36)     NOT NULL,
  member_id       CHAR(36),
  membership_id   CHAR(36),
  invoice_date    DATE         NOT NULL DEFAULT (CURRENT_DATE),

  -- The GST breakdown exactly as computed by @oan/core. Stored, not recomputed:
  -- a later rate change must not rewrite a historical invoice.
  taxable_paise   BIGINT       NOT NULL,
  cgst_paise      BIGINT       NOT NULL DEFAULT 0,
  sgst_paise      BIGINT       NOT NULL DEFAULT 0,
  igst_paise      BIGINT       NOT NULL DEFAULT 0,
  total_paise     BIGINT       NOT NULL,
  gst_rate        DECIMAL(5,2) NOT NULL,
  discount_paise  BIGINT       NOT NULL DEFAULT 0,
  discount_approved_by CHAR(36),

  gstin           VARCHAR(15),
  place_of_supply VARCHAR(40),
  sac_code        VARCHAR(10)  NOT NULL DEFAULT '999723',
  status          ENUM('ISSUED','PART_PAID','PAID','CANCELLED') NOT NULL DEFAULT 'ISSUED',
  voucher_id      CHAR(36),
  created_by      CHAR(36),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  -- The invariant the whole GST filing depends on (see gst.ts).
  CONSTRAINT invoice_ties CHECK (
    taxable_paise + cgst_paise + sgst_paise + igst_paise = total_paise
  ),
  -- Intra-state splits CGST+SGST; inter-state is IGST alone. Never both.
  CONSTRAINT invoice_gst_treatment CHECK (
    igst_paise = 0 OR (cgst_paise = 0 AND sgst_paise = 0)
  ),
  CONSTRAINT invoice_non_negative CHECK (
    taxable_paise >= 0 AND cgst_paise >= 0 AND sgst_paise >= 0
    AND igst_paise >= 0 AND total_paise >= 0 AND discount_paise >= 0
  ),

  UNIQUE KEY invoice_no_per_branch (branch_id, invoice_no),
  KEY invoice_by_member (member_id, invoice_date DESC),
  KEY invoice_by_branch_date (branch_id, invoice_date DESC),
  KEY invoice_unpaid (branch_id, status),
  CONSTRAINT fk_invoice_branch     FOREIGN KEY (branch_id)     REFERENCES branch(id),
  CONSTRAINT fk_invoice_member     FOREIGN KEY (member_id)     REFERENCES member(id),
  CONSTRAINT fk_invoice_membership FOREIGN KEY (membership_id) REFERENCES membership(id),
  CONSTRAINT fk_invoice_voucher    FOREIGN KEY (voucher_id)    REFERENCES voucher(id)
) ENGINE=InnoDB;


-- Payments --------------------------------------------------------------------
CREATE TABLE payment (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  branch_id       CHAR(36)     NOT NULL,
  member_id       CHAR(36),
  invoice_id      CHAR(36),
  amount_paise    BIGINT       NOT NULL,
  mode            ENUM('CASH','UPI','CARD','BANK_TRANSFER','CHEQUE') NOT NULL,
  paid_on         DATE         NOT NULL DEFAULT (CURRENT_DATE),
  -- UPI reference / cheque number / gateway id, for reconciliation.
  reference       VARCHAR(80),
  voucher_id      CHAR(36),
  collected_by    CHAR(36),
  reversed_by_id  CHAR(36),
  idempotency_key VARCHAR(80),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT payment_positive CHECK (amount_paise > 0),
  UNIQUE KEY payment_idempotent (idempotency_key),
  KEY payment_by_branch_date (branch_id, paid_on DESC),
  KEY payment_by_member (member_id, paid_on DESC),
  KEY payment_by_mode (branch_id, paid_on, mode),
  CONSTRAINT fk_payment_branch  FOREIGN KEY (branch_id)  REFERENCES branch(id),
  CONSTRAINT fk_payment_member  FOREIGN KEY (member_id)  REFERENCES member(id),
  CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id) REFERENCES invoice(id),
  CONSTRAINT fk_payment_voucher FOREIGN KEY (voucher_id) REFERENCES voucher(id),
  CONSTRAINT fk_payment_staff   FOREIGN KEY (collected_by) REFERENCES staff(id)
) ENGINE=InnoDB;


-- Expenses --------------------------------------------------------------------
-- A friendly face over a PAYMENT voucher. Front desk records "electricity
-- ₹8,400"; the ledger entry happens underneath and they never see it (§14).
CREATE TABLE expense (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  branch_id       CHAR(36)     NOT NULL,
  account_code    VARCHAR(20)  NOT NULL,
  amount_paise    BIGINT       NOT NULL,
  mode            ENUM('CASH','UPI','CARD','BANK_TRANSFER','CHEQUE') NOT NULL,
  spent_on        DATE         NOT NULL DEFAULT (CURRENT_DATE),
  vendor_name     VARCHAR(120),
  note            VARCHAR(300),
  bill_url        VARCHAR(500),
  voucher_id      CHAR(36),
  recorded_by     CHAR(36),
  approved_by     CHAR(36),
  idempotency_key VARCHAR(80),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT expense_positive CHECK (amount_paise > 0),
  UNIQUE KEY expense_idempotent (idempotency_key),
  KEY expense_by_branch_date (branch_id, spent_on DESC),
  KEY expense_by_account (account_code, spent_on DESC),
  CONSTRAINT fk_expense_branch  FOREIGN KEY (branch_id)    REFERENCES branch(id),
  CONSTRAINT fk_expense_account FOREIGN KEY (account_code) REFERENCES ledger_account(code),
  CONSTRAINT fk_expense_voucher FOREIGN KEY (voucher_id)   REFERENCES voucher(id)
) ENGINE=InnoDB;


-- Reports read only posted vouchers, never drafts ------------------------------
CREATE VIEW v_posting AS
SELECT p.*, v.voucher_date, v.type AS voucher_type, v.posted_at
FROM posting p
JOIN voucher v ON v.id = p.voucher_id
WHERE v.posted_at IS NOT NULL;
