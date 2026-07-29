-- =============================================================================
-- 0003 — Triggers and routines that make the ledger tamper-evident
--
-- These are the MySQL replacements for Postgres deferred constraint triggers.
-- Read 0002's header first; this file is the machinery that header describes.
-- =============================================================================

-- Nature by inheritance -------------------------------------------------------
-- Mirrors natureOf() in @oan/core: walk up to the primary ancestor and take its
-- nature. A child of Current Assets can never be income (§15.2 rule 1).
--
-- Deliberately a recursive view rather than a stored FUNCTION. MySQL refuses to
-- create a function while binary logging is on unless the account holds SUPER
-- (or the server sets log_bin_trust_function_creators), and requiring an
-- elevated privilege to deploy a migration is a bad trade on managed MySQL.
-- A view needs no such right, is set-based, and can be joined.
CREATE VIEW v_ledger_group_nature AS
WITH RECURSIVE walk (code, nature, parent_code) AS (
  SELECT code, nature, parent_code FROM ledger_group
  UNION ALL
  SELECT w.code, g.nature, g.parent_code
    FROM walk w
    JOIN ledger_group g ON g.code = w.parent_code
   WHERE w.nature IS NULL
)
SELECT code, nature FROM walk WHERE nature IS NOT NULL;

-- Accounts with their inherited nature — what every report groups by.
CREATE VIEW v_ledger_account AS
SELECT a.code,
       a.name,
       a.group_code,
       g.name AS group_name,
       n.nature,
       g.affects_gross_profit
  FROM ledger_account a
  JOIN ledger_group g          ON g.code = a.group_code
  JOIN v_ledger_group_nature n ON n.code = a.group_code;


-- Postings maintain the voucher's running totals ------------------------------
CREATE TRIGGER trg_posting_before_insert
BEFORE INSERT ON posting
FOR EACH ROW
BEGIN
  DECLARE v_posted TIMESTAMP(3);
  SELECT posted_at INTO v_posted FROM voucher WHERE id = NEW.voucher_id;
  -- Once a voucher is posted it is closed. Adding a line afterwards would
  -- change a figure that has already been reported.
  IF v_posted IS NOT NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Voucher is already posted. Reverse it instead of adding lines.';
  END IF;
END;

CREATE TRIGGER trg_posting_after_insert
AFTER INSERT ON posting
FOR EACH ROW
BEGIN
  UPDATE voucher
     SET total_dr_paise = total_dr_paise + NEW.dr_paise,
         total_cr_paise = total_cr_paise + NEW.cr_paise
   WHERE id = NEW.voucher_id;
END;


-- Append-only -----------------------------------------------------------------
-- The single largest fraud vector in a cash business is an edited or deleted
-- payment. Make it impossible rather than discouraged.
CREATE TRIGGER trg_posting_no_update
BEFORE UPDATE ON posting
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'posting is append-only. Reverse the voucher instead of editing it.';
END;

CREATE TRIGGER trg_posting_no_delete
BEFORE DELETE ON posting
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'posting is append-only. Reverse the voucher instead of deleting it.';
END;

-- A voucher's business columns are frozen. Only the running totals and the
-- posted_at stamp may change, because the triggers above and sp_post_voucher
-- need to write them.
CREATE TRIGGER trg_voucher_no_edit
BEFORE UPDATE ON voucher
FOR EACH ROW
BEGIN
  IF NOT (NEW.type <=> OLD.type)
     OR NOT (NEW.voucher_date <=> OLD.voucher_date)
     OR NOT (NEW.branch_id <=> OLD.branch_id)
     OR NOT (NEW.narration <=> OLD.narration)
     OR NOT (NEW.reference <=> OLD.reference)
     OR NOT (NEW.reverses_id <=> OLD.reverses_id)
     OR NOT (NEW.created_by <=> OLD.created_by)
     OR NOT (NEW.idempotency_key <=> OLD.idempotency_key)
     OR NOT (NEW.created_at <=> OLD.created_at)
  THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'voucher is append-only. Reverse it instead of editing it.';
  END IF;
  -- A posted voucher can never be un-posted.
  IF OLD.posted_at IS NOT NULL AND NEW.posted_at IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A posted voucher cannot be un-posted.';
  END IF;
END;

CREATE TRIGGER trg_voucher_no_delete
BEFORE DELETE ON voucher
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'voucher is append-only. Reverse it instead of deleting it.';
END;


-- The sanctioned write path ---------------------------------------------------
-- One call, one transaction. Either a balanced, posted voucher exists
-- afterwards or nothing does.
--
-- p_lines is a JSON array:
--   [{"account_code":"1110","dr":800000,"cr":0,"member_id":"...","narration":"..."}, ...]
CREATE PROCEDURE sp_post_voucher(
  IN p_id          CHAR(36),
  IN p_type        VARCHAR(20),
  IN p_date        DATE,
  IN p_branch_id   CHAR(36),
  IN p_narration   VARCHAR(300),
  IN p_reference   VARCHAR(80),
  IN p_created_by  CHAR(36),
  IN p_idem        VARCHAR(80),
  IN p_reverses_id CHAR(36),
  IN p_lines       JSON
)
MODIFIES SQL DATA
BEGIN
  DECLARE v_dr BIGINT DEFAULT 0;
  DECLARE v_cr BIGINT DEFAULT 0;
  DECLARE v_count INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET v_count = JSON_LENGTH(p_lines);
  IF v_count IS NULL OR v_count = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A voucher must have at least one posting line.';
  END IF;

  START TRANSACTION;

  INSERT INTO voucher (id, type, voucher_date, branch_id, narration, reference,
                       created_by, idempotency_key, reverses_id)
  VALUES (p_id, p_type, p_date, p_branch_id, p_narration, p_reference,
          p_created_by, p_idem, p_reverses_id);

  INSERT INTO posting (voucher_id, account_code, dr_paise, cr_paise, branch_id,
                       cost_centre_id, member_id, vendor_id, staff_id, invoice_id, narration)
  SELECT p_id, t.account_code, t.dr, t.cr,
         COALESCE(t.branch_id, p_branch_id),
         t.cost_centre_id, t.member_id, t.vendor_id, t.staff_id, t.invoice_id, t.narration
    FROM JSON_TABLE(p_lines, '$[*]' COLUMNS (
           account_code   VARCHAR(20) PATH '$.account_code',
           dr             BIGINT      PATH '$.dr'  DEFAULT '0' ON EMPTY,
           cr             BIGINT      PATH '$.cr'  DEFAULT '0' ON EMPTY,
           branch_id      CHAR(36)    PATH '$.branch_id',
           cost_centre_id CHAR(36)    PATH '$.cost_centre_id',
           member_id      CHAR(36)    PATH '$.member_id',
           vendor_id      CHAR(36)    PATH '$.vendor_id',
           staff_id       CHAR(36)    PATH '$.staff_id',
           invoice_id     CHAR(36)    PATH '$.invoice_id',
           narration      VARCHAR(300) PATH '$.narration'
         )) AS t;

  SELECT total_dr_paise, total_cr_paise INTO v_dr, v_cr FROM voucher WHERE id = p_id;

  IF v_dr <> v_cr THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Voucher does not balance: debits and credits differ.';
  END IF;

  -- Only now does it become a real entry that reports can see.
  UPDATE voucher SET posted_at = CURRENT_TIMESTAMP(3) WHERE id = p_id;

  COMMIT;
END;
