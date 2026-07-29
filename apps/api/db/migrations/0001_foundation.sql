-- =============================================================================
-- 0001 — Foundation: branches, staff, members, plans, memberships, check-ins
-- Engine: MySQL 8.0 (InnoDB, utf8mb4)
--
-- Shape decisions carried from the research doc:
--   §8   one OAN brand, many branches. There is deliberately NO organizations
--        table — this is multi-BRANCH, not multi-tenant (§18).
--   §8   money is BIGINT paise, never DECIMAL or float.
--   §15  branch_id is mandatory on everything operational.
--   §16  nothing financial is ever hard-deleted or edited in place.
--
-- MySQL specifics:
--   · ids are application-generated UUIDv7 in CHAR(36) — time-ordered so they
--     append to the InnoDB clustered index instead of fragmenting it, and
--     known before insert, which MySQL needs since it has no RETURNING.
--   · DATE for calendar dates (expiry, start) — never converted by timezone.
--     TIMESTAMP for instants, with the server pinned to UTC.
--   · MySQL has no partial indexes, so `WHERE`-style indexes are expressed as
--     STORED generated columns that are then indexed. Same effect, and the
--     predicate lives in one place instead of being repeated in queries.
-- =============================================================================

-- Branches --------------------------------------------------------------------
CREATE TABLE branch (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  code            VARCHAR(16)  NOT NULL,
  name            VARCHAR(120) NOT NULL,
  address         VARCHAR(400),
  city            VARCHAR(80)  NOT NULL DEFAULT 'Jaipur',
  state_code      CHAR(2)      NOT NULL DEFAULT '08',      -- Rajasthan, GST place of supply
  phone           VARCHAR(20),
  -- Same-state branches share a GSTIN; a branch in another state needs its own.
  gstin           VARCHAR(15),
  -- Per-branch invoice series keeps the books auditable across locations (§8).
  invoice_prefix  VARCHAR(12)  NOT NULL,
  invoice_seq     BIGINT       NOT NULL DEFAULT 0,
  opens_at        TIME,
  closes_at       TIME,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at     TIMESTAMP(3) NULL,
  UNIQUE KEY branch_code_unique (code)
) ENGINE=InnoDB;


-- Staff -----------------------------------------------------------------------
-- Login is phone + OTP (§4). Email is optional because many staff have none.
CREATE TABLE staff (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  phone           VARCHAR(20)  NOT NULL,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(160),
  role            ENUM('ADMIN','BRANCH_MANAGER','FRONT_DESK','COACH','ACCOUNTANT') NOT NULL,
  -- Short PIN for elevated actions at a shared counter terminal (§12).
  pin_hash        VARCHAR(255),
  photo_url       VARCHAR(500),
  joined_on       DATE,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at     TIMESTAMP(3) NULL,
  UNIQUE KEY staff_phone_unique (phone)
) ENGINE=InnoDB;

-- Posting to branches is an assignment, not a column — staff and coaches can
-- float between locations (§8). ADMIN needs no rows here; their scope is 'all'.
CREATE TABLE staff_branch (
  staff_id        CHAR(36)     NOT NULL,
  branch_id       CHAR(36)     NOT NULL,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (staff_id, branch_id),
  KEY staff_branch_by_branch (branch_id),
  CONSTRAINT fk_staff_branch_staff  FOREIGN KEY (staff_id)  REFERENCES staff(id)  ON DELETE CASCADE,
  CONSTRAINT fk_staff_branch_branch FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- Members ---------------------------------------------------------------------
CREATE TABLE member (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  -- Human-facing member number, unique across the brand.
  member_no       BIGINT       NOT NULL AUTO_INCREMENT UNIQUE,
  -- Phone is identity here; many members have no email at all (§4).
  phone           VARCHAR(20)  NOT NULL,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(160),
  sex             ENUM('MALE','FEMALE','OTHER'),
  date_of_birth   DATE,
  address         VARCHAR(400),
  emergency_name  VARCHAR(120),
  emergency_phone VARCHAR(20),
  photo_url       VARCHAR(500),
  -- The branch a member belongs to. Cross-branch access depends on their plan.
  home_branch_id  CHAR(36)     NOT NULL,
  assigned_coach_id CHAR(36),
  joined_on       DATE         NOT NULL DEFAULT (CURRENT_DATE),
  goal            VARCHAR(200),
  source          VARCHAR(60),                              -- walk-in, instagram, referral
  notes           TEXT,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at     TIMESTAMP(3) NULL,

  -- MySQL has no partial index, so the "still active" predicate is materialised.
  is_archived     TINYINT(1) AS (archived_at IS NOT NULL) STORED,

  UNIQUE KEY member_phone_unique (phone),
  -- Phone-first search is the single most-used query in the product (§7).
  KEY member_by_phone (phone),
  KEY member_by_branch (home_branch_id, is_archived),
  KEY member_by_coach (assigned_coach_id),
  FULLTEXT KEY member_by_name (name),
  CONSTRAINT fk_member_branch FOREIGN KEY (home_branch_id) REFERENCES branch(id),
  CONSTRAINT fk_member_coach  FOREIGN KEY (assigned_coach_id) REFERENCES staff(id)
) ENGINE=InnoDB;

-- Health data lives in its own table so it can be permission-gated separately.
-- Front desk has no health access at all (§12/§17) — enforced by never joining
-- this table for their requests, not by hiding fields in the UI.
CREATE TABLE member_health (
  member_id       CHAR(36)     NOT NULL PRIMARY KEY,
  blood_group     VARCHAR(8),
  conditions      TEXT,
  injuries        TEXT,
  medications     TEXT,
  allergies       TEXT,
  parq            JSON,                                     -- PAR-Q answers
  doctor_clearance TINYINT(1)  NOT NULL DEFAULT 0,
  -- Explicit consent, with a date. The DPDP Act makes this a legal question,
  -- not an etiquette one (§17).
  photo_consent   TINYINT(1)   NOT NULL DEFAULT 0,
  photo_consent_on DATE,
  marketing_consent TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_health_member FOREIGN KEY (member_id) REFERENCES member(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- Plans -----------------------------------------------------------------------
-- Plans are brand-wide (§8) — defined once, sold at every branch.
CREATE TABLE membership_plan (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  description     VARCHAR(400),
  duration_unit   ENUM('DAY','MONTH','YEAR') NOT NULL,
  duration_count  INT          NOT NULL,
  price_paise     BIGINT       NOT NULL,
  -- Whether price_paise includes GST. Getting this backwards is an 18% error
  -- on every invoice, which is why it is stored and never inferred (§10 Q20).
  price_basis     ENUM('INCLUSIVE','EXCLUSIVE') NOT NULL DEFAULT 'INCLUSIVE',
  gst_rate        DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  branch_access   ENUM('HOME_ONLY','ALL_BRANCHES') NOT NULL DEFAULT 'HOME_ONLY',
  -- Student / Couple / Corporate variants (§3).
  audience        VARCHAR(40),
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  sort_order      INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at     TIMESTAMP(3) NULL,
  CONSTRAINT plan_duration_positive CHECK (duration_count >= 1),
  CONSTRAINT plan_price_non_negative CHECK (price_paise >= 0)
) ENGINE=InnoDB;


-- Memberships -----------------------------------------------------------------
CREATE TABLE membership (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  member_id       CHAR(36)     NOT NULL,
  branch_id       CHAR(36)     NOT NULL,
  plan_id         CHAR(36)     NOT NULL,

  -- The plan AS SOLD. Editing a plan's price later must not rewrite what
  -- hundreds of members already bought (§8).
  plan_snapshot   JSON         NOT NULL,

  starts_on       DATE         NOT NULL,
  -- Last day the member may train, inclusive, before freeze extensions.
  expires_on      DATE         NOT NULL,
  balance_due_paise BIGINT     NOT NULL DEFAULT 0,
  cancelled_on    DATE,
  cancel_reason   VARCHAR(200),
  created_by      CHAR(36),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  -- Materialised predicates standing in for Postgres partial indexes.
  is_live         TINYINT(1) AS (cancelled_on IS NULL) STORED,
  has_dues        TINYINT(1) AS (balance_due_paise > 0) STORED,

  CONSTRAINT membership_dates CHECK (expires_on >= starts_on),
  CONSTRAINT membership_balance_non_negative CHECK (balance_due_paise >= 0),

  KEY membership_by_member (member_id, expires_on DESC),
  -- Drives the expiring/expired lists, the module that pays for the software (§3).
  KEY membership_by_expiry (is_live, expires_on),
  KEY membership_by_branch_expiry (branch_id, is_live, expires_on),
  KEY membership_with_dues (branch_id, has_dues),
  CONSTRAINT fk_membership_member FOREIGN KEY (member_id) REFERENCES member(id),
  CONSTRAINT fk_membership_branch FOREIGN KEY (branch_id) REFERENCES branch(id),
  CONSTRAINT fk_membership_plan   FOREIGN KEY (plan_id)   REFERENCES membership_plan(id),
  CONSTRAINT fk_membership_staff  FOREIGN KEY (created_by) REFERENCES staff(id)
) ENGINE=InnoDB;

-- Freezes extend expiry by the days frozen (see membership.ts).
CREATE TABLE membership_freeze (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  membership_id   CHAR(36)     NOT NULL,
  from_date       DATE         NOT NULL,
  to_date         DATE,                                     -- null while running
  reason          VARCHAR(200),
  created_by      CHAR(36),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT freeze_dates CHECK (to_date IS NULL OR to_date >= from_date),
  KEY freeze_by_membership (membership_id),
  CONSTRAINT fk_freeze_membership FOREIGN KEY (membership_id) REFERENCES membership(id) ON DELETE CASCADE,
  CONSTRAINT fk_freeze_staff FOREIGN KEY (created_by) REFERENCES staff(id)
) ENGINE=InnoDB;


-- Check-ins -------------------------------------------------------------------
CREATE TABLE check_in (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  member_id       CHAR(36)     NOT NULL,
  -- Where it happened, which is not necessarily the member's home branch.
  branch_id       CHAR(36)     NOT NULL,
  membership_id   CHAR(36),
  on_date         DATE         NOT NULL,
  at              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  method          ENUM('QR','PHONE','MANUAL','BIOMETRIC') NOT NULL DEFAULT 'PHONE',

  -- What the counter screen showed, kept for the record. An override that let
  -- an amber member train needs to be answerable for afterwards.
  verdict_level   ENUM('GREEN','AMBER','RED') NOT NULL,
  verdict_code    VARCHAR(32)  NOT NULL,
  overridden_by   CHAR(36),

  recorded_by     CHAR(36),
  -- The front desk runs offline-tolerant and resends on reconnect; this stops
  -- a retry becoming a second check-in (§16).
  idempotency_key VARCHAR(80),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  -- One check-in per member per day per branch — a member scanning twice in
  -- the 6:30am rush must not double-count the footfall.
  UNIQUE KEY check_in_once_per_day (member_id, branch_id, on_date),
  UNIQUE KEY check_in_idempotent (idempotency_key),
  KEY check_in_by_member (member_id, on_date DESC),
  KEY check_in_by_branch_date (branch_id, on_date DESC),
  KEY check_in_live (branch_id, at DESC),
  CONSTRAINT fk_checkin_member     FOREIGN KEY (member_id)     REFERENCES member(id),
  CONSTRAINT fk_checkin_branch     FOREIGN KEY (branch_id)     REFERENCES branch(id),
  CONSTRAINT fk_checkin_membership FOREIGN KEY (membership_id) REFERENCES membership(id),
  CONSTRAINT fk_checkin_recorder   FOREIGN KEY (recorded_by)   REFERENCES staff(id),
  CONSTRAINT fk_checkin_override   FOREIGN KEY (overridden_by) REFERENCES staff(id)
) ENGINE=InnoDB;
