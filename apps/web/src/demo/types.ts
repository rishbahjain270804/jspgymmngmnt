import type {
  IsoDate,
  Membership,
  Paise,
  PaymentMode,
  PlanSnapshot,
  Role,
} from '@oan/core';

/** Demo-only view models. The rules they feed come from @oan/core. */

export interface Branch {
  id: string;
  name: string;
  short: string;
  address: string;
  gstin: string;
  invoicePrefix: string;
  openedOn: IsoDate;
  managerId: string;
  hours: string;
}

export interface Staff {
  id: string;
  name: string;
  role: Role;
  branchId: string;
  phone: string;
  since: IsoDate;
  /** Coaches only. */
  clientIds?: string[];
  certification?: string;
}

export interface Member {
  id: string;
  code: string;
  name: string;
  phone: string;
  gender: 'M' | 'F';
  age: number;
  branchId: string;
  joinedOn: IsoDate;
  program: string;
  coachId?: string;
  goal?: string;
  medicalNote?: string;
  membership: Membership;
  paidToDate: Paise;
  /** Descending — most recent visit first. */
  visits: IsoDate[];
}

export interface Invoice {
  id: string;
  number: string;
  memberId: string;
  branchId: string;
  date: IsoDate;
  planName: string;
  total: Paise;
  received: Paise;
  balance: Paise;
  mode: PaymentMode;
}

export interface Expense {
  id: string;
  date: IsoDate;
  branchId: string;
  accountCode: string;
  head: string;
  amount: Paise;
  vendor: string;
  mode: PaymentMode;
  note?: string;
}

export type EquipmentCondition = 'WORKING' | 'NEEDS_SERVICE' | 'OUT_OF_ORDER';

export interface Asset {
  id: string;
  tag: string;
  name: string;
  category: 'Cardio' | 'Strength machines' | 'Free weights' | 'Functional';
  branchId: string;
  condition: EquipmentCondition;
  purchasedOn: IsoDate;
  cost: Paise;
  vendor: string;
  warrantyTo: IsoDate;
  lastServicedOn: IsoDate;
  nextServiceOn: IsoDate;
  downSince?: IsoDate;
  fault?: string;
}

export interface Measurement {
  date: IsoDate;
  weightKg: number;
  bodyFatPct: number;
  leanKg: number;
  waistIn: number;
  chestIn: number;
  armIn: number;
  byStaffId: string;
  note?: string;
}

export interface PlanCatalogueItem extends PlanSnapshot {
  program: string;
  popular?: boolean;
  activeCount: number;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  actorRole: Role;
  action: string;
  detail: string;
  branchId: string;
  /** Financial records are never hard-deleted — reversals appear here. */
  reversal?: boolean;
}

export interface Notification {
  id: string;
  kind: 'expiry' | 'equipment' | 'absence' | 'payment' | 'approval';
  title: string;
  body: string;
  at: string;
  branchId: string;
  read: boolean;
  href?: string;
}
