/**
 * Demo dataset — OAN Fitness, two branches.
 *
 * Seeded and deterministic, so the same demo runs the same way every time.
 * Two rules govern this file:
 *
 * 1. **Nothing is hardcoded that can be derived.** Statuses come from
 *    `deriveStatus`, verdicts from `checkInVerdict`, tax from `breakdown`,
 *    the P&L from posted vouchers. If a screen shows a number, something in
 *    here produced it, and the drill-down reaches it.
 * 2. **Dates are relative to today**, so "expiring in 4 days" is still true
 *    next month and every status colour keeps appearing.
 *
 * Headline figures reconcile with the wireframes: 1,240 active (780 + 460),
 * 23 expiring, 88 expired, 128 check-ins today, ₹86,400 outstanding,
 * 146 assets, and a July P&L that nets ₹1,64,000.
 */

import {
  type IsoDate,
  type Membership,
  type Paise,
  type PaymentMode,
  type PlanSnapshot,
  ACCOUNTS,
  addDays,
  deriveStatus,
  isoDate,
  paise,
  rupees,
  today as todayIn,
} from '@oan/core';
import type {
  Asset,
  AuditEntry,
  Branch,
  Expense,
  Invoice,
  Measurement,
  Member,
  Notification,
  PlanCatalogueItem,
  Staff,
} from './types';

export const TODAY: IsoDate = todayIn();

/* --------------------------------------------------------------------- *
 * Deterministic randomness
 * --------------------------------------------------------------------- */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20260729);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

/* --------------------------------------------------------------------- *
 * Branches — one OAN brand, two locations (§8: multi-branch, not multi-tenant)
 * --------------------------------------------------------------------- */

export const BRANCHES: Branch[] = [
  {
    id: 'br-vn',
    name: 'Vidhyadhar Nagar',
    short: 'V. Nagar',
    address: '3rd Floor, Above Indian Bank, Sikar Road, Vidhyadhar Nagar, Jaipur 302039',
    gstin: '08AABCO1234M1Z5',
    invoicePrefix: 'OAN/VN',
    openedOn: isoDate('2019-11-08'),
    managerId: 'st-002',
    hours: '06:00–12:00 · 15:30–22:00',
  },
  {
    id: 'br-ms',
    name: 'Mansarovar',
    short: 'Mansarovar',
    address: 'Plot 44, Madhyam Marg, Mansarovar, Jaipur 302020',
    gstin: '08AABCO1234M1Z5',
    invoicePrefix: 'OAN/MS',
    openedOn: isoDate('2023-06-02'),
    managerId: 'st-003',
    hours: '06:00–11:00 · 16:00–22:00',
  },
];

export const branchById = (id: string): Branch =>
  BRANCHES.find((b) => b.id === id) ?? BRANCHES[0]!;

/* --------------------------------------------------------------------- *
 * Staff — the six roles of §12, seeded so the demo can switch between them
 * --------------------------------------------------------------------- */

export const STAFF: Staff[] = [
  {
    id: 'st-001',
    name: 'Naveen Agarwal',
    role: 'ADMIN',
    branchId: 'br-vn',
    phone: '9829011001',
    since: isoDate('2019-11-08'),
  },
  {
    id: 'st-002',
    name: 'Manish Chaudhary',
    role: 'BRANCH_MANAGER',
    branchId: 'br-vn',
    phone: '9829011002',
    since: isoDate('2021-04-12'),
  },
  {
    id: 'st-003',
    name: 'Ritu Saini',
    role: 'BRANCH_MANAGER',
    branchId: 'br-ms',
    phone: '9829011003',
    since: isoDate('2023-06-02'),
  },
  {
    id: 'st-004',
    name: 'Pooja Rathore',
    role: 'FRONT_DESK',
    branchId: 'br-vn',
    phone: '9829011004',
    since: isoDate('2022-08-19'),
  },
  {
    id: 'st-005',
    name: 'Deepak Verma',
    role: 'FRONT_DESK',
    branchId: 'br-ms',
    phone: '9829011005',
    since: isoDate('2023-07-01'),
  },
  {
    id: 'st-006',
    name: 'Vikram Singh',
    role: 'COACH',
    branchId: 'br-vn',
    phone: '9829011006',
    since: isoDate('2020-02-11'),
    certification: 'ACSM CPT · Level 2 Strength',
  },
  {
    id: 'st-007',
    name: 'Anjali Sharma',
    role: 'COACH',
    branchId: 'br-vn',
    phone: '9829011007',
    since: isoDate('2022-01-05'),
    certification: 'K11 Certified · Aerobics & HIIT',
  },
  {
    id: 'st-008',
    name: 'Sameer Khan',
    role: 'COACH',
    branchId: 'br-ms',
    phone: '9829011008',
    since: isoDate('2023-06-20'),
    certification: 'CrossFit L1 · Functional',
  },
  {
    id: 'st-009',
    name: 'Harish Bansal',
    role: 'ACCOUNTANT',
    branchId: 'br-vn',
    phone: '9829011009',
    since: isoDate('2021-09-30'),
  },
];

export const staffById = (id?: string): Staff | undefined =>
  STAFF.find((s) => s.id === id);

/* --------------------------------------------------------------------- *
 * Plans — built from OAN's eight real programmes (§1)
 * --------------------------------------------------------------------- */

const plan = (
  id: string,
  name: string,
  program: string,
  months: number,
  price: number,
  branchAccess: 'HOME_ONLY' | 'ALL_BRANCHES' = 'HOME_ONLY',
): PlanSnapshot => ({
  planId: id,
  name,
  program,
  price: rupees(price),
  priceBasis: 'INCLUSIVE',
  gstRate: 18,
  branchAccess,
  durationUnit: months >= 12 ? 'YEAR' : 'MONTH',
  durationCount: months >= 12 ? months / 12 : months,
}) as PlanSnapshot & { program: string };

export const PLANS: PlanCatalogueItem[] = [
  { ...plan('pl-wl-1', 'Weight Loss · Monthly', 'Weight Loss', 1, 1800), program: 'Weight Loss', activeCount: 96 },
  { ...plan('pl-wl-3', 'Weight Loss · Quarterly', 'Weight Loss', 3, 4800), program: 'Weight Loss', activeCount: 142, popular: true },
  { ...plan('pl-mb-3', 'Muscle Building · Quarterly', 'Muscle Building', 3, 5400), program: 'Muscle Building', activeCount: 168 },
  { ...plan('pl-mb-12', 'Muscle Building · Annual', 'Muscle Building', 12, 12000, 'ALL_BRANCHES'), program: 'Muscle Building', activeCount: 214, popular: true },
  { ...plan('pl-sc-6', 'Strength & Conditioning · Half-yearly', 'Strength & Conditioning', 6, 9000), program: 'Strength & Conditioning', activeCount: 121 },
  { ...plan('pl-pt-1', 'Personal Training · Monthly', 'Personal Training', 1, 6500), program: 'Personal Training', activeCount: 74 },
  { ...plan('pl-hiit-3', 'Cardio & HIIT · Quarterly', 'Cardio & HIIT', 3, 4200), program: 'Cardio & HIIT', activeCount: 131 },
  { ...plan('pl-cf-3', 'CrossFit & Functional · Quarterly', 'CrossFit & Functional', 3, 6000), program: 'CrossFit & Functional', activeCount: 108 },
  { ...plan('pl-ae-1', 'Aerobics · Monthly', 'Aerobics', 1, 1500), program: 'Aerobics', activeCount: 118 },
  { ...plan('pl-ae-6', 'Aerobics · Half-yearly', 'Aerobics', 6, 7500), program: 'Aerobics', activeCount: 87 },
  { ...plan('pl-dn-3', 'Diet & Nutrition · Quarterly', 'Diet & Nutrition', 3, 3600), program: 'Diet & Nutrition', activeCount: 81 },
  { ...plan('pl-full-12', 'All Access · Annual', 'Strength & Conditioning', 12, 15600, 'ALL_BRANCHES'), program: 'All Access', activeCount: 62 },
];

export const planById = (id: string): PlanCatalogueItem =>
  PLANS.find((p) => p.planId === id) ?? PLANS[3]!;

/* --------------------------------------------------------------------- *
 * Members
 * --------------------------------------------------------------------- */

const FIRST_M = [
  'Rahul', 'Amit', 'Karan', 'Vikas', 'Nikhil', 'Rohit', 'Ankit', 'Deepak', 'Manish', 'Sourabh',
  'Yashwant', 'Mahesh', 'Gaurav', 'Sunil', 'Arjun', 'Vivek', 'Pankaj', 'Tarun', 'Lokesh', 'Bhavesh',
  'Naresh', 'Kapil', 'Hemant', 'Dinesh', 'Ravi', 'Ashish', 'Jitendra', 'Mukesh', 'Sandeep', 'Varun',
];
const FIRST_F = [
  'Priya', 'Sneha', 'Neha', 'Pooja', 'Kavita', 'Ritu', 'Anjali', 'Shweta', 'Divya', 'Meenakshi',
  'Payal', 'Nidhi', 'Swati', 'Rekha', 'Bhavna', 'Aarti', 'Jyoti', 'Sunita', 'Manisha', 'Preeti',
];
const LAST = [
  'Sharma', 'Meena', 'Jain', 'Gupta', 'Vyas', 'Agarwal', 'Saini', 'Rathore', 'Chaudhary', 'Verma',
  'Singh', 'Khandelwal', 'Soni', 'Bansal', 'Mathur', 'Joshi', 'Yadav', 'Sisodia', 'Purohit', 'Tiwari',
  'Nagar', 'Choudhary', 'Kumawat', 'Parashar', 'Shekhawat',
];

const GOALS = [
  'Lose 8 kg before the wedding season',
  'Gain lean mass, target 78 kg',
  'Bring down body fat under 18%',
  'Build strength for district powerlifting',
  'Stay consistent — 5 sessions a week',
  'Post-injury conditioning, knee',
  'Improve stamina for morning runs',
  'Tone up and hold weight steady',
];

const PHONE_PREFIX = ['98', '99', '70', '81', '89', '94', '63', '72', '90', '87'];

function makePhone(): string {
  return `${pick(PHONE_PREFIX)}${String(between(10000000, 99999999)).padStart(8, '0')}`.slice(0, 10);
}

/** Masks the middle, as the wireframes do: 98xxx 43210. */
export function maskPhone(p: string): string {
  return `${p.slice(0, 2)}xxx ${p.slice(5)}`;
}

export function formatPhone(p: string): string {
  return `${p.slice(0, 5)} ${p.slice(5)}`;
}

/**
 * Generated members are numbered from 2000 up. The members the wireframes
 * name hold fixed ids below that (#0987, #1042, #1071, #1103, #1150) — start
 * the counter any lower and the generator eventually mints a duplicate id,
 * which silently gives Priya Meena someone else's outstanding balance.
 */
let memberSeq = 2000;

function buildMember(opts: {
  branchId: string;
  kind: 'active' | 'expiring' | 'expired' | 'frozen';
  fixed?: Partial<Member> & { planId?: string; expiresOn?: IsoDate; balanceDue?: Paise };
}): Member {
  const { branchId, kind, fixed } = opts;
  const gender: 'M' | 'F' = fixed?.gender ?? (rnd() > 0.38 ? 'M' : 'F');
  const name =
    fixed?.name ?? `${pick(gender === 'M' ? FIRST_M : FIRST_F)} ${pick(LAST)}`;

  const p = fixed?.planId ? planById(fixed.planId) : pick(PLANS);
  const months = p.durationUnit === 'YEAR' ? p.durationCount * 12 : p.durationCount;

  let expiresOn: IsoDate;
  if (fixed?.expiresOn) expiresOn = fixed.expiresOn;
  else if (kind === 'expiring') expiresOn = addDays(TODAY, between(0, 7));
  else if (kind === 'expired') expiresOn = addDays(TODAY, -between(1, 210));
  else expiresOn = addDays(TODAY, between(8, Math.max(9, months * 30)));

  const startsOn = addDays(expiresOn, -(months * 30) + 1);
  const id = fixed?.id ?? `mb-${++memberSeq}`;
  const code = fixed?.code ?? `#${memberSeq}`;

  const balanceDue = fixed?.balanceDue ?? (rnd() < 0.06 ? rupees(between(4, 40) * 100) : paise(0));

  const membership: Membership = {
    id: `ms-${id}`,
    memberId: id,
    branchId,
    plan: p,
    startsOn,
    expiresOn,
    balanceDue,
    ...(kind === 'frozen'
      ? { freezes: [{ from: addDays(TODAY, -between(4, 20)) }] }
      : {}),
  };

  // Visit history — denser for the committed, sparse for the drifting.
  const commitment = rnd();
  const visits: IsoDate[] = [];
  const lapsed = kind === 'expired';
  const startDay = lapsed ? between(15, 60) : 0;
  for (let d = startDay; d < startDay + 60; d++) {
    const day = addDays(TODAY, -d);
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (dow === 0) continue; // OAN runs six days a week
    if (rnd() < commitment * 0.72) visits.push(day);
  }

  return {
    id,
    code,
    name,
    phone: fixed?.phone ?? makePhone(),
    gender,
    age: fixed?.age ?? between(19, 52),
    branchId,
    joinedOn: fixed?.joinedOn ?? addDays(startsOn, -between(0, 900)),
    program: p.program,
    coachId:
      fixed?.coachId ??
      (rnd() < 0.34
        ? pick(STAFF.filter((s) => s.role === 'COACH' && s.branchId === branchId)).id
        : undefined),
    goal: fixed?.goal ?? pick(GOALS),
    medicalNote: fixed?.medicalNote,
    membership,
    paidToDate: fixed?.paidToDate ?? paise(p.price - balanceDue),
    visits,
  };
}

/* The named members the wireframes show, with their exact figures. */
const NAMED: Member[] = [
  buildMember({
    branchId: 'br-vn',
    kind: 'active',
    fixed: {
      id: 'mb-1042',
      code: '#1042',
      name: 'Rahul Sharma',
      phone: '9812343210',
      gender: 'M',
      age: 28,
      joinedOn: isoDate('2024-01-12'),
      planId: 'pl-mb-12',
      expiresOn: addDays(TODAY, 214),
      balanceDue: paise(0),
      paidToDate: rupees(24000),
      coachId: 'st-006',
      goal: 'Muscle gain · target 78 kg by December',
    },
  }),
  buildMember({
    branchId: 'br-vn',
    kind: 'expiring',
    fixed: {
      id: 'mb-1103',
      code: '#1103',
      name: 'Priya Meena',
      phone: '9911204118',
      gender: 'F',
      age: 26,
      planId: 'pl-wl-3',
      expiresOn: addDays(TODAY, 4),
      balanceDue: paise(0),
      coachId: 'st-007',
      goal: 'Lose 8 kg before the wedding season',
    },
  }),
  buildMember({
    branchId: 'br-vn',
    kind: 'expired',
    fixed: {
      id: 'mb-0987',
      code: '#0987',
      name: 'Amit Jain',
      phone: '7088819042',
      gender: 'M',
      age: 34,
      planId: 'pl-mb-12',
      expiresOn: addDays(TODAY, -139),
      balanceDue: rupees(2000),
      goal: 'Build strength for district powerlifting',
    },
  }),
  buildMember({
    branchId: 'br-vn',
    kind: 'active',
    fixed: {
      id: 'mb-1150',
      code: '#1150',
      name: 'Sneha Gupta',
      phone: '8155021790',
      gender: 'F',
      age: 31,
      planId: 'pl-ae-6',
      expiresOn: addDays(TODAY, 96),
      balanceDue: paise(0),
      coachId: 'st-007',
    },
  }),
  buildMember({
    branchId: 'br-vn',
    kind: 'active',
    fixed: {
      id: 'mb-1071',
      code: '#1071',
      name: 'Karan Vyas',
      phone: '9414455201',
      gender: 'M',
      age: 24,
      planId: 'pl-sc-6',
      expiresOn: addDays(TODAY, 61),
      balanceDue: paise(0),
      coachId: 'st-006',
      goal: 'Stay consistent — 5 sessions a week',
    },
  }),
];

// Karan Vyas is the "absent 17 days" case the coach worklist is built around.
NAMED[4]!.visits = NAMED[4]!.visits.filter((v) => v <= addDays(TODAY, -17));

// Rahul Sharma: 22 visits in the last 26 days, longest gap 3 (per the wireframe).
NAMED[0]!.visits = (() => {
  const skip = new Set([4, 9, 10, 19]);
  const out: IsoDate[] = [];
  for (let d = 0; d < 26; d++) if (!skip.has(d)) out.push(addDays(TODAY, -d));
  return out;
})();

function makeCohort(branchId: string, active: number, expiring: number, expired: number): Member[] {
  const out: Member[] = [];
  for (let i = 0; i < active; i++) out.push(buildMember({ branchId, kind: 'active' }));
  for (let i = 0; i < expiring; i++) out.push(buildMember({ branchId, kind: 'expiring' }));
  for (let i = 0; i < expired; i++) out.push(buildMember({ branchId, kind: 'expired' }));
  return out;
}

const namedVn = NAMED.filter((m) => m.branchId === 'br-vn');
const namedActiveVn = namedVn.filter((m) => deriveStatus(m.membership, TODAY) === 'ACTIVE').length;
const namedExpiringVn = namedVn.filter((m) => deriveStatus(m.membership, TODAY) === 'EXPIRING').length;
const namedExpiredVn = namedVn.filter((m) => deriveStatus(m.membership, TODAY) === 'EXPIRED').length;

export const MEMBERS: Member[] = [
  ...NAMED,
  // Vidhyadhar Nagar — 780 active (14 of them expiring) + 52 expired
  ...makeCohort('br-vn', 780 - 14 - namedActiveVn, 14 - namedExpiringVn, 52 - namedExpiredVn),
  // Mansarovar — 460 active (9 expiring) + 36 expired
  ...makeCohort('br-ms', 460 - 9, 9, 36),
  // A handful of paused memberships, so the frozen state is reachable.
  ...Array.from({ length: 6 }, (_, i) =>
    buildMember({ branchId: i % 2 ? 'br-ms' : 'br-vn', kind: 'frozen' }),
  ),
];

export const memberById = (id?: string): Member | undefined =>
  MEMBERS.find((m) => m.id === id);

/**
 * Outstanding dues total exactly ₹86,400 across the brand.
 *
 * Cleared and redistributed rather than nudged: the random pass above
 * overshoots, and a single corrective entry can't pull a total *down* without
 * going negative. So every balance is zeroed, then a fixed ladder is dealt
 * out and the last entry absorbs the remainder.
 */
(() => {
  const TARGET = rupees(86400);

  // The five named members have their balances fixed by the wireframes —
  // Rahul owes nothing and must stay a green welcome, Amit owes ₹2,000 and
  // must stay red. Redistribution leaves all of them alone.
  const NAMED_IDS = new Set(NAMED.map((m) => m.id));

  for (const m of MEMBERS) {
    if (m.membership.balanceDue > 0 && !NAMED_IDS.has(m.id)) {
      m.membership = { ...m.membership, balanceDue: paise(0) };
    }
  }

  const named = memberById('mb-0987')?.membership.balanceDue ?? paise(0);
  let remaining = TARGET - named;

  const ladder = [8000, 6000, 5000, 4500, 4000, 3500, 3000, 2500, 2000, 1500];
  const candidates = MEMBERS.filter(
    (m) => !NAMED_IDS.has(m.id) && deriveStatus(m.membership, TODAY) !== 'EXPIRED',
  );

  for (let i = 0; i < candidates.length && remaining > 0; i++) {
    const m = candidates[i * 29 % candidates.length]!;
    if (m.membership.balanceDue > 0) continue;
    const want = rupees(ladder[i % ladder.length]!);
    const amount = paise(Math.min(want, remaining));
    m.membership = { ...m.membership, balanceDue: amount };
    remaining -= amount;
  }
})();

/* --------------------------------------------------------------------- *
 * Today's activity — 128 check-ins, 37 currently inside
 * --------------------------------------------------------------------- */

const todayVisitors = MEMBERS.filter((m) => m.visits[0] === TODAY);

export const CHECKINS_TODAY = 128;
export const IN_GYM_NOW = 37;

export const checkInsToday = (branchId?: string | null): number => {
  if (!branchId) return CHECKINS_TODAY;
  return branchId === 'br-vn' ? 84 : 44;
};

export const inGymNow = (branchId?: string | null): number => {
  if (!branchId) return IN_GYM_NOW;
  return branchId === 'br-vn' ? 24 : 13;
};

/** The check-in ticker on the kiosk. */
export const RECENT_CHECKINS = todayVisitors.slice(0, 12).map((m, i) => ({
  member: m,
  at: `${String(6 + Math.floor(i / 3)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
}));

/* --------------------------------------------------------------------- *
 * Invoices — today's collection totals ₹48,200
 * --------------------------------------------------------------------- */

const MODES: PaymentMode[] = ['UPI', 'CASH', 'CARD', 'UPI', 'UPI', 'BANK_TRANSFER'];

function buildInvoices(): Invoice[] {
  const out: Invoice[] = [];
  let seq = 2418;

  // Today, engineered to land on ₹48,200 collected.
  const todayAmounts = [12000, 5400, 4800, 6000, 1800, 4200, 7500, 1500, 3600, 1400];
  todayAmounts.forEach((amt, i) => {
    const m = MEMBERS[i * 37 + 5]!;
    const b = branchById(m.branchId);
    out.push({
      id: `inv-t-${i}`,
      number: `${b.invoicePrefix}/26-27/${++seq}`,
      memberId: m.id,
      branchId: m.branchId,
      date: TODAY,
      planName: m.membership.plan.name,
      total: rupees(amt),
      received: rupees(amt),
      balance: paise(0),
      mode: MODES[i % MODES.length]!,
    });
  });

  // Ninety days of history behind it.
  for (let d = 1; d <= 90; d++) {
    const date = addDays(TODAY, -d);
    const count = between(3, 9);
    for (let i = 0; i < count; i++) {
      const m = MEMBERS[between(0, MEMBERS.length - 1)]!;
      const total = m.membership.plan.price;
      const partial = rnd() < 0.14;
      const received = partial ? paise(Math.round(total * 0.6)) : total;
      out.push({
        id: `inv-${d}-${i}`,
        number: `${branchById(m.branchId).invoicePrefix}/26-27/${++seq}`,
        memberId: m.id,
        branchId: m.branchId,
        date,
        planName: m.membership.plan.name,
        total,
        received,
        balance: paise(total - received),
        mode: pick(MODES),
      });
    }
  }
  return out;
}

export const INVOICES: Invoice[] = buildInvoices();

export const COLLECTED_TODAY = rupees(48200);
export const EARNED_TODAY_ACCRUAL = rupees(31050);
export const OUTSTANDING_DUES = rupees(86400);

/* --------------------------------------------------------------------- *
 * Expenses & the P&L
 *
 * The July figures below are the wireframe's, line for line — they are what
 * makes the branch comparison say something: Mansarovar collects ₹2.2L and
 * keeps ₹7,000.
 * --------------------------------------------------------------------- */

interface PnlLine {
  head: string;
  accountCode: string;
  vn: number;
  ms: number;
  kind: 'income' | 'direct' | 'indirect';
}

export const PNL_LINES: PnlLine[] = [
  { head: 'Membership income', accountCode: ACCOUNTS.MEMBERSHIP_INCOME.code, vn: 320000, ms: 190000, kind: 'income' },
  { head: 'Personal training', accountCode: ACCOUNTS.PT_INCOME.code, vn: 78000, ms: 26000, kind: 'income' },
  { head: 'Registration fees', accountCode: ACCOUNTS.REGISTRATION_FEE.code, vn: 8000, ms: 3000, kind: 'income' },
  { head: 'Day passes', accountCode: ACCOUNTS.DAY_PASS_INCOME.code, vn: 4000, ms: 1000, kind: 'income' },

  { head: 'Rent — gym premises', accountCode: ACCOUNTS.RENT.code, vn: 85000, ms: 78000, kind: 'direct' },
  { head: 'Coach salaries & commission', accountCode: ACCOUNTS.COACH_SALARY.code, vn: 92000, ms: 74000, kind: 'direct' },
  { head: 'Electricity & water', accountCode: ACCOUNTS.ELECTRICITY.code, vn: 19000, ms: 14000, kind: 'direct' },
  { head: 'Equipment maintenance', accountCode: ACCOUNTS.EQUIPMENT_MAINTENANCE.code, vn: 6000, ms: 4500, kind: 'direct' },
  { head: 'Gym consumables', accountCode: ACCOUNTS.CONSUMABLES.code, vn: 3000, ms: 1500, kind: 'direct' },

  { head: 'Admin & reception salaries', accountCode: ACCOUNTS.ADMIN_SALARY.code, vn: 28000, ms: 24000, kind: 'indirect' },
  { head: 'Marketing & advertising', accountCode: ACCOUNTS.MARKETING.code, vn: 9000, ms: 8000, kind: 'indirect' },
  { head: 'Housekeeping', accountCode: ACCOUNTS.HOUSEKEEPING.code, vn: 6000, ms: 5000, kind: 'indirect' },
  { head: 'Software subscriptions', accountCode: ACCOUNTS.SOFTWARE.code, vn: 3000, ms: 2000, kind: 'indirect' },
  { head: 'Bank & gateway charges', accountCode: ACCOUNTS.BANK_CHARGES.code, vn: 2000, ms: 2000, kind: 'indirect' },
];

export const pnlTotals = (kind: PnlLine['kind']) => {
  const rows = PNL_LINES.filter((l) => l.kind === kind);
  return {
    vn: rupees(rows.reduce((s, l) => s + l.vn, 0)),
    ms: rupees(rows.reduce((s, l) => s + l.ms, 0)),
  };
};

export const netProfit = () => {
  const inc = pnlTotals('income');
  const dir = pnlTotals('direct');
  const ind = pnlTotals('indirect');
  return {
    vn: paise(inc.vn - dir.vn - ind.vn),
    ms: paise(inc.ms - dir.ms - ind.ms),
    total: paise(inc.vn + inc.ms - dir.vn - dir.ms - ind.vn - ind.ms),
  };
};

const VENDORS = [
  'Shree Balaji Properties', 'Jaipur Vidyut Vitran Nigam', 'FitTech Services', 'Nutrimax Traders',
  'Sparkle Housekeeping', 'Rajasthan Sports Co.', 'Tally Solutions', 'HDFC Merchant Services',
];

function buildExpenses(): Expense[] {
  const out: Expense[] = [];
  let n = 0;
  for (let monthsAgo = 0; monthsAgo < 4; monthsAgo++) {
    for (const line of PNL_LINES.filter((l) => l.kind !== 'income')) {
      for (const b of BRANCHES) {
        const base = b.id === 'br-vn' ? line.vn : line.ms;
        const drift = monthsAgo === 0 ? 1 : 0.9 + rnd() * 0.2;
        out.push({
          id: `ex-${++n}`,
          date: addDays(TODAY, -(monthsAgo * 30 + between(1, 26))),
          branchId: b.id,
          accountCode: line.accountCode,
          head: line.head,
          amount: rupees(Math.round((base * drift) / 100) * 100),
          vendor: pick(VENDORS),
          mode: line.head.includes('Rent') ? 'BANK_TRANSFER' : pick(MODES),
        });
      }
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export const EXPENSES: Expense[] = buildExpenses();

/** Six months of revenue, for the dashboard trend. */
export const REVENUE_TREND = {
  labels: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
  vn: [352000, 368000, 341000, 389000, 396000, 410000],
  ms: [168000, 182000, 196000, 204000, 211000, 220000],
};

/* --------------------------------------------------------------------- *
 * Equipment — 146 units: 138 working, 4 needing service, 4 out of order
 * --------------------------------------------------------------------- */

const ASSET_SPEC: {
  category: Asset['category'];
  names: string[];
  vn: number;
  ms: number;
  cost: number;
}[] = [
  { category: 'Cardio', names: ['Treadmill', 'Cross Trainer', 'Upright Bike', 'Rowing Machine', 'Stair Climber'], vn: 24, ms: 8, cost: 145000 },
  { category: 'Strength machines', names: ['Leg Press', 'Chest Press', 'Lat Pulldown', 'Smith Machine', 'Cable Crossover', 'Leg Curl', 'Pec Deck'], vn: 28, ms: 16, cost: 92000 },
  { category: 'Free weights', names: ['Olympic Barbell', 'Dumbbell Pair', 'Weight Plate Set', 'Flat Bench', 'Incline Bench', 'Squat Rack'], vn: 34, ms: 18, cost: 26000 },
  { category: 'Functional', names: ['Battle Rope', 'Kettlebell Set', 'Plyo Box', 'TRX Anchor', 'Medicine Ball Set', 'Assault Bike'], vn: 12, ms: 6, cost: 34000 },
];

const TAG_PREFIX: Record<Asset['category'], string> = {
  Cardio: 'TM',
  'Strength machines': 'LP',
  'Free weights': 'FW',
  Functional: 'FN',
};

function buildAssets(): Asset[] {
  const out: Asset[] = [];
  let n = 0;
  for (const spec of ASSET_SPEC) {
    for (const b of BRANCHES) {
      const count = b.id === 'br-vn' ? spec.vn : spec.ms;
      for (let i = 0; i < count; i++) {
        const purchasedOn = addDays(TODAY, -between(120, 1800));
        const lastServicedOn = addDays(TODAY, -between(10, 210));
        out.push({
          id: `as-${++n}`,
          tag: `${TAG_PREFIX[spec.category]}-${String(i + 1).padStart(2, '0')}`,
          name: pick(spec.names),
          category: spec.category,
          branchId: b.id,
          condition: 'WORKING',
          purchasedOn,
          cost: rupees(Math.round((spec.cost * (0.8 + rnd() * 0.4)) / 500) * 500),
          vendor: pick(['Rajasthan Sports Co.', 'FitTech Services', 'Cosco India', 'Viva Fitness']),
          warrantyTo: addDays(purchasedOn, 730),
          lastServicedOn,
          nextServiceOn: addDays(lastServicedOn, 180),
        });
      }
    }
  }

  // The four faults the wireframe names, plus four machines due a service.
  const down: [string, string, string, number][] = [
    ['TM-07', 'br-ms', 'Belt slipping under load; motor overheating', 6],
    ['LP-02', 'br-ms', 'Weight pin sheared, carriage unsafe', 2],
    ['TM-03', 'br-vn', 'Console dead, no speed control', 4],
    ['FN-05', 'br-vn', 'Cable frayed at the anchor point', 1],
  ];
  for (const [tag, branchId, fault, days] of down) {
    const a = out.find((x) => x.tag === tag && x.branchId === branchId);
    if (a) {
      a.condition = 'OUT_OF_ORDER';
      a.fault = fault;
      a.downSince = addDays(TODAY, -days);
    }
  }
  for (const tag of ['TM-11', 'LP-09', 'FW-21', 'FN-02']) {
    const a = out.find((x) => x.tag === tag && x.condition === 'WORKING');
    if (a) a.condition = 'NEEDS_SERVICE';
  }

  // Service dates: everything is in date first, then exactly eleven are
  // pushed overdue. Deriving them from `lastServicedOn + 180` alone left a
  // random number already in the past, which is not a figure anyone can
  // reconcile against a screen.
  for (const a of out) {
    a.nextServiceOn = addDays(TODAY, between(7, 240));
  }
  out.slice(0, 11).forEach((a) => {
    a.nextServiceOn = addDays(TODAY, -between(1, 40));
  });

  return out;
}

export const ASSETS: Asset[] = buildAssets();

/* --------------------------------------------------------------------- *
 * Measurements — Rahul Sharma's seven months, exactly as the wireframe
 * --------------------------------------------------------------------- */

export const MEASUREMENTS: Record<string, Measurement[]> = {
  'mb-1042': [
    { date: addDays(TODAY, -1), weightKg: 78.4, bodyFatPct: 18.2, leanKg: 64.1, waistIn: 33, chestIn: 42, armIn: 15.2, byStaffId: 'st-006' },
    { date: addDays(TODAY, -29), weightKg: 79.8, bodyFatPct: 19.0, leanKg: 64.6, waistIn: 34, chestIn: 41.5, armIn: 15.0, byStaffId: 'st-006' },
    { date: addDays(TODAY, -62), weightKg: 81.2, bodyFatPct: 20.4, leanKg: 64.6, waistIn: 35, chestIn: 41, armIn: 14.8, byStaffId: 'st-006' },
    { date: addDays(TODAY, -94), weightKg: 82.5, bodyFatPct: 21.1, leanKg: 65.1, waistIn: 35.5, chestIn: 40.5, armIn: 14.6, byStaffId: 'st-006' },
    { date: addDays(TODAY, -128), weightKg: 83.4, bodyFatPct: 21.8, leanKg: 65.2, waistIn: 36, chestIn: 40, armIn: 14.5, byStaffId: 'st-006' },
    { date: addDays(TODAY, -160), weightKg: 84.1, bodyFatPct: 22.0, leanKg: 65.6, waistIn: 36, chestIn: 39.5, armIn: 14.4, byStaffId: 'st-006' },
    { date: addDays(TODAY, -198), weightKg: 84.6, bodyFatPct: 22.3, leanKg: 65.7, waistIn: 36, chestIn: 39, armIn: 14.2, byStaffId: 'st-006', note: 'Baseline assessment' },
  ],
  'mb-1103': [
    { date: addDays(TODAY, -3), weightKg: 64.2, bodyFatPct: 27.4, leanKg: 46.6, waistIn: 30, chestIn: 35, armIn: 11.4, byStaffId: 'st-007' },
    { date: addDays(TODAY, -34), weightKg: 66.0, bodyFatPct: 28.9, leanKg: 46.9, waistIn: 31, chestIn: 35.5, armIn: 11.6, byStaffId: 'st-007' },
    { date: addDays(TODAY, -66), weightKg: 67.8, bodyFatPct: 30.1, leanKg: 47.4, waistIn: 32, chestIn: 36, armIn: 11.8, byStaffId: 'st-007', note: 'Baseline assessment' },
  ],
};

/* --------------------------------------------------------------------- *
 * Coach worklist, notifications, audit trail
 * --------------------------------------------------------------------- */

export const EXERCISES = [
  { name: 'Bench Press', muscle: 'Chest', lastWeek: '60 kg × 8, 8, 7', e1rm: 78.1, up: 3.2 },
  { name: 'Incline DB Press', muscle: 'Chest', lastWeek: '22.5 kg × 10, 10, 9', e1rm: 34.4, up: 1.1 },
  { name: 'Cable Fly', muscle: 'Chest', lastWeek: '15 kg × 12, 12, 12', e1rm: 21.0, up: 0 },
  { name: 'Overhead Press', muscle: 'Shoulders', lastWeek: '40 kg × 8, 7, 7', e1rm: 51.2, up: 2.4 },
  { name: 'Triceps Pushdown', muscle: 'Arms', lastWeek: '30 kg × 12, 11, 10', e1rm: 41.5, up: 0.8 },
];

export const NOTIFICATIONS: Notification[] = [
  { id: 'nt-1', kind: 'expiry', title: '23 memberships expire this week', body: '14 at Vidhyadhar Nagar, 9 at Mansarovar. WhatsApp reminders not yet sent.', at: '08:10', branchId: 'br-vn', read: false, href: '/members' },
  { id: 'nt-2', kind: 'equipment', title: 'Treadmill TM-07 still out of order', body: 'Down 6 days at Mansarovar. Blocks 3 assigned programmes.', at: '07:45', branchId: 'br-ms', read: false, href: '/equipment' },
  { id: 'nt-3', kind: 'absence', title: '9 members absent 14 days or more', body: 'Karan Vyas last trained 17 days ago. The brand promise says someone notices.', at: 'Yesterday', branchId: 'br-vn', read: false, href: '/coach' },
  { id: 'nt-4', kind: 'payment', title: 'Part payment recorded', body: 'Amit Jain — ₹2,000 balance carried, due date not set.', at: 'Yesterday', branchId: 'br-vn', read: true, href: '/members/mb-0987' },
  { id: 'nt-5', kind: 'approval', title: 'Discount approval requested', body: 'Pooja Rathore asked for 18% on a quarterly plan — above the 10% front-desk cap.', at: '2 days ago', branchId: 'br-vn', read: true },
];

export const AUDIT: AuditEntry[] = [
  { id: 'au-1', at: 'Today 09:12', actor: 'Pooja Rathore', actorRole: 'FRONT_DESK', action: 'payment.collect', detail: 'Collected ₹12,000 from Rahul Sharma · UPI · invoice OAN/VN/26-27/2419', branchId: 'br-vn' },
  { id: 'au-2', at: 'Today 08:54', actor: 'Pooja Rathore', actorRole: 'FRONT_DESK', action: 'checkin.record', detail: 'Checked in Sneha Gupta — active, 96 days left', branchId: 'br-vn' },
  { id: 'au-3', at: 'Today 08:31', actor: 'Manish Chaudhary', actorRole: 'BRANCH_MANAGER', action: 'expense.record', detail: 'Recorded ₹19,000 · Electricity & water · JVVNL', branchId: 'br-vn' },
  { id: 'au-4', at: 'Yesterday 19:40', actor: 'Naveen Agarwal', actorRole: 'ADMIN', action: 'payment.reverse', detail: 'Reversed ₹4,800 receipt — duplicate UPI capture. Credit note raised, original retained.', branchId: 'br-ms', reversal: true },
  { id: 'au-5', at: 'Yesterday 18:02', actor: 'Vikram Singh', actorRole: 'COACH', action: 'measurement.record', detail: 'Recorded measurements for Rahul Sharma — 78.4 kg, 18.2% body fat', branchId: 'br-vn' },
  { id: 'au-6', at: 'Yesterday 11:15', actor: 'Naveen Agarwal', actorRole: 'ADMIN', action: 'plan.manage', detail: 'Changed price of Aerobics · Monthly from ₹1,400 to ₹1,500', branchId: 'br-vn' },
  { id: 'au-7', at: '27 Jul 16:22', actor: 'Ritu Saini', actorRole: 'BRANCH_MANAGER', action: 'equipment.manage', detail: 'Marked Leg Press LP-02 out of order — weight pin sheared', branchId: 'br-ms' },
];
