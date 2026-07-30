import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type IsoDate,
  type Paise,
  type PaymentMode,
  computeExpiry,
  paise,
  uuidv7,
} from '@oan/core';
import { ASSETS, INVOICES, MEASUREMENTS, MEMBERS, RECENT_CHECKINS, TODAY } from './data';
import type { Asset, Invoice, Measurement, Member } from './types';

/**
 * A row on the check-in log. The seeded rows carry only the member and a
 * wall-clock time; ones recorded during a demo also carry the branch, the
 * date and the verdict that was shown, so "who came in today" stays honest
 * when you switch branches.
 */
export interface CheckInRow {
  member: Member;
  at: string;
  date?: IsoDate;
  branchId?: string;
  level?: 'GREEN' | 'AMBER' | 'RED';
  code?: string;
}

/**
 * The demo's mutable world.
 *
 * Without this, every screen kept its own `useState` copy of the fixtures and
 * nothing survived a navigation. That is fatal for a walkthrough: you collect
 * ₹4,000 from a member, walk back to their record, and they still owe ₹4,000 —
 * which is the exact moment a customer stops believing the software works.
 *
 * So actions here mutate one shared world, and it is persisted to
 * sessionStorage: a mid-demo refresh (or an accidental back button) does not
 * wipe what you just showed. `reset()` puts it back to the seeded state for
 * the next person you show it to.
 *
 * This is still demo data — no server, no MySQL. But every number a viewer
 * can change now changes everywhere it appears, which is what makes it read
 * as a product rather than a slide deck.
 */

const KEY = 'oan.demo.world.v1';

export interface World {
  members: Member[];
  checkIns: CheckInRow[];
  invoices: Invoice[];
  assets: Asset[];
  measurements: Record<string, Measurement[]>;
  /** Set once the user has changed anything, so the UI can offer a reset. */
  touched: boolean;
}

function seed(): World {
  return {
    members: MEMBERS.map((m) => ({ ...m, membership: { ...m.membership } })),
    checkIns: [...RECENT_CHECKINS],
    invoices: [...INVOICES],
    assets: ASSETS.map((a) => ({ ...a })),
    measurements: { ...MEASUREMENTS },
    touched: false,
  };
}

function load(): World {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return seed();
    const saved = JSON.parse(raw) as World;
    // A stale shape from an older build should not white-screen a live demo.
    if (!Array.isArray(saved.members) || saved.members.length === 0) return seed();
    return saved;
  } catch {
    return seed();
  }
}

export interface CollectInput {
  memberId: string;
  /** Total the invoice was raised for, tax inclusive. */
  total: Paise;
  /** What the member actually handed over now. */
  received: Paise;
  mode: PaymentMode;
  planName: string;
  /** Present when this payment renews the plan rather than clearing dues. */
  renewal?: { planId: string; durationUnit: 'DAY' | 'MONTH' | 'YEAR'; durationCount: number };
}

interface StoreValue extends World {
  today: IsoDate;
  recordCheckIn: (input: {
    member: Member;
    branchId: string;
    level: 'GREEN' | 'AMBER' | 'RED';
    code: string;
  }) => void;
  /** Whether this member has already been logged in today at this branch. */
  hasCheckedInToday: (memberId: string, branchId: string) => boolean;
  collect: (input: CollectInput) => Invoice;
  reportFault: (assetId: string, fault: string) => void;
  recordMeasurement: (memberId: string, m: Measurement) => void;
  reset: () => void;
}

const Ctx = createContext<StoreValue | null>(null);

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [world, setWorld] = useState<World>(load);
  const today = TODAY;

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(world));
    } catch {
      /* private mode — the demo just won't survive a refresh */
    }
  }, [world]);

  const isLoggedToday = useCallback(
    (list: CheckInRow[], memberId: string, branchId: string) =>
      list.some(
        (c) =>
          c.member.id === memberId &&
          (c.branchId ?? c.member.branchId) === branchId &&
          (c.date ?? TODAY) === TODAY,
      ),
    [],
  );

  const recordCheckIn = useCallback<StoreValue['recordCheckIn']>(
    (input) => {
      setWorld((w) => {
        // One per member per day per branch — the same rule the unique index
        // in 0001_foundation.sql enforces, so a double scan at the 6:30 rush
        // does not become double footfall.
        if (isLoggedToday(w.checkIns, input.member.id, input.branchId)) return w;

        const now = new Date();
        const row: CheckInRow = {
          member: input.member,
          at: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          date: TODAY,
          branchId: input.branchId,
          level: input.level,
          code: input.code,
        };

        return {
          ...w,
          touched: true,
          checkIns: [row, ...w.checkIns],
          members: w.members.map((m) =>
            m.id === input.member.id && m.visits[0] !== TODAY
              ? { ...m, visits: [TODAY, ...m.visits] }
              : m,
          ),
        };
      });
    },
    [isLoggedToday],
  );

  const hasCheckedInToday = useCallback<StoreValue['hasCheckedInToday']>(
    (memberId, branchId) => isLoggedToday(world.checkIns, memberId, branchId),
    [world.checkIns, isLoggedToday],
  );

  const collect = useCallback<StoreValue['collect']>(
    (input) => {
      const balance = paise(Math.max(0, input.total - input.received));
      const member = world.members.find((m) => m.id === input.memberId);
      const branchId = member?.branchId ?? '';

      const invoice: Invoice = {
        id: uuidv7(),
        number: `${branchId.slice(0, 3).toUpperCase()}-${String(world.invoices.length + 1).padStart(4, '0')}`,
        memberId: input.memberId,
        branchId,
        date: TODAY,
        planName: input.planName,
        total: input.total,
        received: input.received,
        balance,
        mode: input.mode,
      };

      setWorld((w) => ({
        ...w,
        touched: true,
        invoices: [invoice, ...w.invoices],
        members: w.members.map((m) => {
          if (m.id !== input.memberId) return m;

          // A renewal restarts the plan from today; a part payment against an
          // existing plan only moves the balance.
          const membership = input.renewal
            ? {
                ...m.membership,
                startsOn: TODAY,
                expiresOn: computeExpiry(TODAY, {
                  durationUnit: input.renewal.durationUnit,
                  durationCount: input.renewal.durationCount,
                }),
                balanceDue: balance,
                cancelledOn: undefined,
              }
            : { ...m.membership, balanceDue: paise(Math.max(0, m.membership.balanceDue - input.received)) };

          return {
            ...m,
            membership,
            paidToDate: paise(m.paidToDate + input.received),
          };
        }),
      }));

      return invoice;
    },
    [world.members, world.invoices.length],
  );

  const reportFault = useCallback<StoreValue['reportFault']>((assetId, fault) => {
    setWorld((w) => ({
      ...w,
      touched: true,
      assets: w.assets.map((a) =>
        a.id === assetId
          ? { ...a, condition: 'OUT_OF_ORDER', downSince: TODAY, fault }
          : a,
      ),
    }));
  }, []);

  const recordMeasurement = useCallback<StoreValue['recordMeasurement']>((memberId, m) => {
    setWorld((w) => ({
      ...w,
      touched: true,
      measurements: {
        ...w.measurements,
        [memberId]: [m, ...(w.measurements[memberId] ?? [])],
      },
    }));
  }, []);

  const reset = useCallback(() => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setWorld(seed());
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ...world,
      today,
      recordCheckIn,
      hasCheckedInToday,
      collect,
      reportFault,
      recordMeasurement,
      reset,
    }),
    [world, today, recordCheckIn, hasCheckedInToday, collect, reportFault, recordMeasurement, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDemo must be used inside <DemoStoreProvider>.');
  return v;
}

/** Members scoped to a branch, or all of them for an actor with `all` reach. */
export function useVisibleMembers(branchId: string | null): Member[] {
  const { members } = useDemo();
  return useMemo(
    () => (branchId ? members.filter((m) => m.branchId === branchId) : members),
    [members, branchId],
  );
}

/**
 * One member, live.
 *
 * Screens must not read the static `MEMBERS` fixture for anything a demo can
 * change — a balance cleared on the Collect screen has to be gone when you
 * open the member record ten seconds later.
 */
export function useMember(id?: string): Member | undefined {
  const { members } = useDemo();
  return useMemo(() => (id ? members.find((m) => m.id === id) : undefined), [members, id]);
}

/** Phone-first member search over the live world. Mirrors selectors.searchMembers. */
export function useMemberSearch(query: string, branchId: string | null, limit = 25): Member[] {
  const { members } = useDemo();
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const pool = branchId ? members.filter((m) => m.branchId === branchId) : members;
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 3) return pool.filter((m) => m.phone.includes(digits)).slice(0, limit);
    return pool
      .filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q))
      .slice(0, limit);
  }, [members, query, branchId, limit]);
}

/** Today's check-ins, optionally for one branch. */
export function useCheckInsToday(branchId: string | null): CheckInRow[] {
  const { checkIns } = useDemo();
  return useMemo(
    () =>
      checkIns.filter(
        (c) =>
          (c.date ?? TODAY) === TODAY &&
          (!branchId || (c.branchId ?? c.member.branchId) === branchId),
      ),
    [checkIns, branchId],
  );
}

/** What has actually been collected today, live — including demo payments. */
export function useCollectedToday(branchId: string | null): Paise {
  const { invoices } = useDemo();
  return useMemo(
    () =>
      paise(
        invoices
          .filter((i) => i.date === TODAY && (!branchId || i.branchId === branchId))
          .reduce((sum, i) => sum + i.received, 0),
      ),
    [invoices, branchId],
  );
}
