-- =============================================================================
-- 0004 — Equipment, measurements, and the audit log
-- Engine: MySQL 8.0
-- =============================================================================

-- Equipment -------------------------------------------------------------------
-- Promoted out of "later" because once there is more than one location,
-- "what do I own and where is it" is a question only software answers (§13).
-- Broken machines are also a leading churn indicator, so this is a retention
-- feature wearing an inventory costume.
CREATE TABLE equipment_category (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  name            VARCHAR(80)  NOT NULL,
  parent_id       CHAR(36),
  sort_order      INT          NOT NULL DEFAULT 0,
  UNIQUE KEY equipment_category_name (name),
  CONSTRAINT fk_eqcat_parent FOREIGN KEY (parent_id) REFERENCES equipment_category(id)
) ENGINE=InnoDB;

CREATE TABLE equipment (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  asset_tag       VARCHAR(40),
  name            VARCHAR(120) NOT NULL,
  category_id     CHAR(36),
  branch_id       CHAR(36)     NOT NULL,
  quantity        INT          NOT NULL DEFAULT 1,
  `condition`     ENUM('WORKING','NEEDS_SERVICE','OUT_OF_ORDER','RETIRED')
                    NOT NULL DEFAULT 'WORKING',
  serial_no       VARCHAR(80),
  photo_url       VARCHAR(500),
  vendor_name     VARCHAR(120),
  purchased_on    DATE,
  cost_paise      BIGINT,
  warranty_until  DATE,
  last_service_on DATE,
  next_service_on DATE,
  notes           TEXT,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at     TIMESTAMP(3) NULL,

  -- Materialised predicates standing in for Postgres partial indexes.
  is_archived     TINYINT(1) AS (archived_at IS NOT NULL) STORED,
  is_faulty       TINYINT(1) AS (`condition` IN ('NEEDS_SERVICE','OUT_OF_ORDER')) STORED,

  CONSTRAINT equipment_quantity_non_negative CHECK (quantity >= 0),
  CONSTRAINT equipment_cost_non_negative CHECK (cost_paise IS NULL OR cost_paise >= 0),

  UNIQUE KEY equipment_asset_tag (asset_tag),
  KEY equipment_by_branch (branch_id, is_archived),
  -- Drives the "out of order" count that rolls up on the owner's dashboard.
  KEY equipment_faulty (branch_id, is_faulty),
  KEY equipment_service_due (next_service_on),
  CONSTRAINT fk_equipment_branch   FOREIGN KEY (branch_id)   REFERENCES branch(id),
  CONSTRAINT fk_equipment_category FOREIGN KEY (category_id) REFERENCES equipment_category(id)
) ENGINE=InnoDB;

CREATE TABLE equipment_log (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  equipment_id    CHAR(36)     NOT NULL,
  branch_id       CHAR(36)     NOT NULL,
  -- FAULT_REPORTED lets front desk and coaches flag a machine without giving
  -- them edit rights on the register itself (§12).
  event           VARCHAR(40)  NOT NULL,
  condition_after ENUM('WORKING','NEEDS_SERVICE','OUT_OF_ORDER','RETIRED'),
  note            VARCHAR(400),
  cost_paise      BIGINT,
  logged_by       CHAR(36),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT eqlog_cost_non_negative CHECK (cost_paise IS NULL OR cost_paise >= 0),
  KEY equipment_log_by_equipment (equipment_id, created_at DESC),
  CONSTRAINT fk_eqlog_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
  CONSTRAINT fk_eqlog_branch    FOREIGN KEY (branch_id)    REFERENCES branch(id),
  CONSTRAINT fk_eqlog_staff     FOREIGN KEY (logged_by)    REFERENCES staff(id)
) ENGINE=InnoDB;

-- Moving an asset between branches is Admin-only and worth its own record.
CREATE TABLE equipment_transfer (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  equipment_id    CHAR(36)     NOT NULL,
  from_branch_id  CHAR(36)     NOT NULL,
  to_branch_id    CHAR(36)     NOT NULL,
  transferred_on  DATE         NOT NULL DEFAULT (CURRENT_DATE),
  approved_by     CHAR(36),
  note            VARCHAR(300),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT transfer_between_different_branches CHECK (from_branch_id <> to_branch_id),
  CONSTRAINT fk_transfer_equipment FOREIGN KEY (equipment_id)   REFERENCES equipment(id),
  CONSTRAINT fk_transfer_from      FOREIGN KEY (from_branch_id) REFERENCES branch(id),
  CONSTRAINT fk_transfer_to        FOREIGN KEY (to_branch_id)   REFERENCES branch(id),
  CONSTRAINT fk_transfer_staff     FOREIGN KEY (approved_by)    REFERENCES staff(id)
) ENGINE=InnoDB;


-- Measurements ----------------------------------------------------------------
-- A typed time series rather than a wide table: adding a new measurement never
-- means a migration, and every chart is the same query (§17.3).
CREATE TABLE measurement_type (
  code            VARCHAR(24)  NOT NULL PRIMARY KEY,
  name            VARCHAR(80)  NOT NULL,
  unit            VARCHAR(12)  NOT NULL,
  decimals        TINYINT      NOT NULL DEFAULT 1,
  -- Whether a rising value is good. This is what lets the UI colour a change
  -- green or red without hardcoding anything about body fat or lean mass.
  -- NULL where direction depends on the member's goal.
  higher_is_better TINYINT(1),
  sort_order      INT          NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE measurement (
  id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_id       CHAR(36)     NOT NULL,
  branch_id       CHAR(36)     NOT NULL,
  type_code       VARCHAR(24)  NOT NULL,
  taken_on        DATE         NOT NULL DEFAULT (CURRENT_DATE),
  value           DECIMAL(8,2) NOT NULL,
  taken_by        CHAR(36),
  note            VARCHAR(300),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY measurement_once_per_day (member_id, type_code, taken_on),
  KEY measurement_by_member (member_id, type_code, taken_on DESC),
  KEY measurement_by_date (branch_id, taken_on DESC),
  CONSTRAINT fk_measurement_member FOREIGN KEY (member_id) REFERENCES member(id) ON DELETE CASCADE,
  CONSTRAINT fk_measurement_branch FOREIGN KEY (branch_id) REFERENCES branch(id),
  CONSTRAINT fk_measurement_type   FOREIGN KEY (type_code) REFERENCES measurement_type(code),
  CONSTRAINT fk_measurement_staff  FOREIGN KEY (taken_by)  REFERENCES staff(id)
) ENGINE=InnoDB;

-- Photos are gated on member_health.photo_consent, which is a stored field with
-- a date — not an assumption (§17.1).
CREATE TABLE member_photo (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  member_id       CHAR(36)     NOT NULL,
  branch_id       CHAR(36)     NOT NULL,
  taken_on        DATE         NOT NULL DEFAULT (CURRENT_DATE),
  pose            VARCHAR(24),
  url             VARCHAR(500) NOT NULL,
  uploaded_by     CHAR(36),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY member_photo_by_member (member_id, taken_on DESC),
  CONSTRAINT fk_photo_member FOREIGN KEY (member_id) REFERENCES member(id) ON DELETE CASCADE,
  CONSTRAINT fk_photo_branch FOREIGN KEY (branch_id) REFERENCES branch(id),
  CONSTRAINT fk_photo_staff  FOREIGN KEY (uploaded_by) REFERENCES staff(id)
) ENGINE=InnoDB;


-- Audit log -------------------------------------------------------------------
-- MCA amended Rule 3(1) of the Companies (Accounts) Rules: from FY beginning
-- 1 Apr 2023, accounting software must record an edit log of every change, and
-- **the audit trail must not be disableable** (§16.1). There is deliberately no
-- on/off setting anywhere for this table.
CREATE TABLE audit_log (
  id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  at              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actor_staff_id  CHAR(36),
  actor_role      ENUM('ADMIN','BRANCH_MANAGER','FRONT_DESK','COACH','ACCOUNTANT'),
  action          VARCHAR(60)  NOT NULL,
  entity_table    VARCHAR(60)  NOT NULL,
  entity_id       VARCHAR(80),
  branch_id       CHAR(36),
  before_json     JSON,
  after_json      JSON,
  reason          VARCHAR(300),
  ip              VARCHAR(45),
  user_agent      VARCHAR(300),
  KEY audit_by_time (at DESC),
  KEY audit_by_entity (entity_table, entity_id, at DESC),
  KEY audit_by_actor (actor_staff_id, at DESC),
  KEY audit_by_branch (branch_id, at DESC),
  CONSTRAINT fk_audit_staff  FOREIGN KEY (actor_staff_id) REFERENCES staff(id),
  CONSTRAINT fk_audit_branch FOREIGN KEY (branch_id)      REFERENCES branch(id)
) ENGINE=InnoDB;

-- The log itself is immutable. An editable audit trail is not an audit trail.
CREATE TRIGGER trg_audit_no_update
BEFORE UPDATE ON audit_log
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is append-only.';
END;

CREATE TRIGGER trg_audit_no_delete
BEFORE DELETE ON audit_log
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is append-only.';
END;
