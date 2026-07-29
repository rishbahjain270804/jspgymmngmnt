-- Migration: 0006_demo_seed
-- Description: Inserts realistic demo data (branches, staff, members, checkins)
-- Note: Uses deterministic UUIDs using simple hashes so we can easily join.
-- Note: In a real migration script we assume it runs via MySQL client.

INSERT INTO membership_plan (id, name, duration_unit, duration_count, price_paise, price_basis, gst_rate, branch_access) VALUES 
('plan_monthly_std', 'Monthly Standard', 'MONTH', 1, 150000, 'INCLUSIVE', 18.00, 'HOME_ONLY'), 
('plan_quarterly_std', 'Quarterly Standard', 'MONTH', 3, 400000, 'INCLUSIVE', 18.00, 'HOME_ONLY'),
('plan_annual_pro', 'Annual Pro', 'MONTH', 12, 1200000, 'INCLUSIVE', 18.00, 'ALL_BRANCHES')
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO staff (id, phone, name, pin_hash, role) VALUES
('staff_admin', '9800000001', 'Demo Admin', 'hash', 'ADMIN'),
('staff_mgr', '9800000002', 'Demo Manager', 'hash', 'BRANCH_MANAGER'),
('staff_fd', '9800000003', 'Demo Front Desk', 'hash', 'FRONT_DESK')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- First branch already exists from migration 1, add one more
INSERT INTO branch (id, code, name, invoice_prefix, is_active, created_at) VALUES 
('b2', 'MLV', 'Malviya Nagar', 'OAN-MLV-', 1, DATE_SUB(CURRENT_DATE, INTERVAL 1 YEAR))
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Set manager/fd to Malviya Nagar
INSERT IGNORE INTO staff_branch (staff_id, branch_id) VALUES 
('staff_mgr', 'b2'),
('staff_fd', 'b2');

-- Seed Members for Malviya Nagar
INSERT INTO member (id, home_branch_id, member_no, name, phone, joined_on, sex, goal) VALUES
('mem_1', 'b2', 201, 'Rohit Sharma', '9876543201', '2025-01-10', 'MALE', 'Weight Loss'),
('mem_2', 'b2', 202, 'Aditi Verma', '9876543202', '2025-02-15', 'FEMALE', 'Muscle Gain'),
('mem_3', 'b2', 203, 'Karan Singh', '9876543203', '2025-05-01', 'MALE', 'Fitness'),
('mem_4', 'b2', 204, 'Neha Gupta', '9876543204', DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY), 'FEMALE', 'Cardio'),
('mem_5', 'b2', 205, 'Vikram Patel', '9876543205', DATE_SUB(CURRENT_DATE, INTERVAL 14 MONTH), 'MALE', 'Weight Loss')
ON DUPLICATE KEY UPDATE member_no=VALUES(member_no);

-- Seed Memberships
INSERT INTO membership (id, member_id, branch_id, plan_id, plan_snapshot, starts_on, expires_on, cancelled_on, balance_due_paise) VALUES
('ms_1', 'mem_1', 'b2', 'plan_annual_pro', '{}', '2025-01-10', '2026-01-09', NULL, 0),       -- Active
('ms_2', 'mem_2', 'b2', 'plan_quarterly_std', '{}', DATE_SUB(CURRENT_DATE, INTERVAL 85 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 5 DAY), NULL, 0), -- Expiring soon
('ms_3', 'mem_3', 'b2', 'plan_monthly_std', '{}', DATE_SUB(CURRENT_DATE, INTERVAL 2 MONTH), DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH), CURRENT_DATE, 0), -- Expired last month
('ms_4', 'mem_4', 'b2', 'plan_quarterly_std', '{}', DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 85 DAY), NULL, 150000), -- Active with dues
('ms_5', 'mem_5', 'b2', 'plan_annual_pro', '{}', DATE_SUB(CURRENT_DATE, INTERVAL 14 MONTH), DATE_SUB(CURRENT_DATE, INTERVAL 2 MONTH), CURRENT_DATE, 0) -- Long expired
ON DUPLICATE KEY UPDATE balance_due_paise=VALUES(balance_due_paise);

-- Seed some checkins for today and last few days (for 'Rohit' and 'Neha' only)
INSERT INTO check_in (id, member_id, branch_id, on_date, at, method, verdict_level, verdict_code) VALUES
('chk_1', 'mem_1', 'b2', CURRENT_DATE, CURRENT_TIMESTAMP, 'MANUAL', 'GREEN', 'VALID_PLAN'),
('chk_2', 'mem_4', 'b2', CURRENT_DATE, CURRENT_TIMESTAMP, 'MANUAL', 'GREEN', 'VALID_PLAN'),
('chk_3', 'mem_2', 'b2', DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY), 'MANUAL', 'AMBER', 'EXPIRING_SOON')
ON DUPLICATE KEY UPDATE method=VALUES(method);
