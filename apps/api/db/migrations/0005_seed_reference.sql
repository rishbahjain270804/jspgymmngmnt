-- =============================================================================
-- 0005 — Reference data: chart of accounts, measurement types, categories
--
-- The chart of accounts is seeded as versioned code, not typed in by a user.
-- It is the backbone of every financial report, and a typo in the tree is a
-- wrong balance sheet (§15.10). These rows mirror ACCOUNTS in
-- packages/core/src/ledger.ts exactly — a test compares the two and fails on
-- any drift, because a posting rule pointing at a missing account would fail
-- at the counter rather than in CI.
-- =============================================================================

-- Groups ----------------------------------------------------------------------
INSERT INTO ledger_group (code, name, parent_code, nature, affects_gross_profit, sort_order) VALUES
  ('CA',            'Current Assets',              NULL, 'ASSET',     0, 10),
  ('FA',            'Fixed Assets',                NULL, 'ASSET',     0, 20),
  ('CL',            'Current Liabilities',         NULL, 'LIABILITY', 0, 30),
  ('EQ',            'Capital Account',             NULL, 'EQUITY',    0, 40),
  ('INC',           'Sales Accounts',              NULL, 'INCOME',    0, 50),
  ('INC-IND',       'Indirect Incomes',            NULL, 'INCOME',    0, 60),
  -- Rent, floor electricity, coach pay and upkeep are DIRECT, so gross profit
  -- means "contribution per branch after the cost of running that floor" (§15.4).
  ('EXP-DIR',       'Direct Expenses',             NULL, 'EXPENSE',   1, 70),
  ('EXP-IND',       'Indirect Expenses',           NULL, 'EXPENSE',   0, 80);

INSERT INTO ledger_group (code, name, parent_code, sort_order) VALUES
  ('CA-CASH',       'Cash-in-Hand',                'CA', 11),
  ('CA-BANK',       'Bank Accounts',               'CA', 12),
  ('CA-GATEWAY',    'Payment Gateway Receivable',  'CA', 13),
  ('CA-DEBTORS',    'Sundry Debtors',              'CA', 14),
  ('CA-STOCK',      'Stock-in-Hand',               'CA', 15),
  ('CL-CREDITORS',  'Sundry Creditors',            'CL', 31),
  ('CL-TAX',        'Duties & Taxes',              'CL', 32),
  ('CL-DEFERRED',   'Deferred Revenue',            'CL', 33),
  ('CL-PROVISIONS', 'Provisions',                  'CL', 34);


-- Accounts --------------------------------------------------------------------
INSERT INTO ledger_account (code, name, group_code) VALUES
  -- Assets
  ('1110', 'Cash in Hand',                  'CA-CASH'),
  ('1120', 'Bank Account',                  'CA-BANK'),
  ('1130', 'Payment Gateway Receivable',    'CA-GATEWAY'),
  ('1141', 'Member Dues',                   'CA-DEBTORS'),
  ('1150', 'Supplement Stock',              'CA-STOCK'),
  ('1510', 'Gym Equipment',                 'FA'),
  ('1590', 'Accumulated Depreciation',      'FA'),
  -- Liabilities
  ('2110', 'Sundry Creditors',              'CL-CREDITORS'),
  ('2121', 'Output CGST',                   'CL-TAX'),
  ('2122', 'Output SGST',                   'CL-TAX'),
  ('2123', 'Output IGST',                   'CL-TAX'),
  ('2124', 'Input CGST',                    'CL-TAX'),
  ('2125', 'Input SGST',                    'CL-TAX'),
  ('2131', 'Deferred Membership Revenue',   'CL-DEFERRED'),
  ('2132', 'Deferred PT Revenue',           'CL-DEFERRED'),
  ('2141', 'Salary Payable',                'CL-PROVISIONS'),
  ('2142', 'Coach Commission Payable',      'CL-PROVISIONS'),
  -- Equity
  ('3100', 'Owner''s Capital',              'EQ'),
  ('3200', 'Retained Earnings',             'EQ'),
  -- Income
  ('4100', 'Membership Income',             'INC'),
  ('4200', 'Personal Training Income',      'INC'),
  ('4300', 'Registration Fee',              'INC'),
  ('4400', 'Class & Event Income',          'INC'),
  ('4500', 'Locker Rental Income',          'INC'),
  ('4600', 'Day Pass Income',               'INC'),
  ('4700', 'Supplement Sales',              'INC'),
  ('4920', 'Late Fee',                      'INC-IND'),
  -- Direct expenses — the cost of running the floor
  ('5100', 'Coach Salaries',                'EXP-DIR'),
  ('5200', 'Coach Commission',              'EXP-DIR'),
  ('5300', 'Rent — Gym Premises',           'EXP-DIR'),
  ('5400', 'Electricity & Water',           'EXP-DIR'),
  ('5500', 'Equipment Maintenance',         'EXP-DIR'),
  ('5600', 'Gym Consumables',               'EXP-DIR'),
  -- Indirect expenses — brand-level overhead
  ('6100', 'Admin & Reception Salaries',    'EXP-IND'),
  ('6200', 'Marketing & Advertising',       'EXP-IND'),
  ('6300', 'Software Subscriptions',        'EXP-IND'),
  ('6400', 'Bank & Gateway Charges',        'EXP-IND'),
  ('6500', 'Housekeeping',                  'EXP-IND'),
  ('6600', 'Professional Fees',             'EXP-IND'),
  ('6800', 'Depreciation',                  'EXP-IND'),
  ('6900', 'Miscellaneous',                 'EXP-IND');


-- Measurement types -----------------------------------------------------------
-- `higher_is_better` is NULL where direction depends on the member's goal —
-- weight is a win going down for a cut and up for a bulk, so the UI reads the
-- goal rather than assuming.
INSERT INTO measurement_type (code, name, unit, decimals, higher_is_better, sort_order) VALUES
  ('WEIGHT',      'Weight',             'kg',   1, NULL, 10),
  ('BODY_FAT',    'Body Fat',           '%',    1, 0,    20),
  ('LEAN_MASS',   'Lean Mass',          'kg',   1, 1,    30),
  ('BMI',         'BMI',                '',     1, NULL, 40),
  ('CHEST',       'Chest',              'in',   1, NULL, 50),
  ('WAIST',       'Waist',              'in',   1, 0,    60),
  ('HIP',         'Hip',                'in',   1, NULL, 70),
  ('ARM_L',       'Arm (left)',         'in',   1, 1,    80),
  ('ARM_R',       'Arm (right)',        'in',   1, 1,    90),
  ('THIGH_L',     'Thigh (left)',       'in',   1, NULL, 100),
  ('THIGH_R',     'Thigh (right)',      'in',   1, NULL, 110),
  ('NECK',        'Neck',               'in',   1, NULL, 120),
  ('RESTING_HR',  'Resting heart rate', 'bpm',  0, 0,    130),
  ('BP_SYS',      'BP systolic',        'mmHg', 0, NULL, 140),
  ('BP_DIA',      'BP diastolic',       'mmHg', 0, NULL, 150);
