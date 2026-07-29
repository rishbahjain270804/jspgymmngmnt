import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  type Actor,
  type Permission,
  type Role,
  type Target,
  allowed as coreAllowed,
  can as coreCan,
} from '@oan/core';
import { BRANCHES, MEMBERS, STAFF, staffById } from './data';
import { useStored } from '../lib/hooks';

/**
 * Session.
 *
 * Signing in is out of scope — this is a UI demo with no backend. What is
 * *not* faked is the access model: every permission question goes to
 * `can()` in @oan/core, the same pure function the API will call. So the
 * three demo logins really do produce three different apps, and nothing in
 * the UI decides for itself what a role may see.
 */

export type Theme = 'dark' | 'light';

/** Branch scope: `null` means "all branches", available only at `all` scope. */
export type BranchScope = string | null;

interface SessionValue {
  actor: Actor;
  staffId: string;
  name: string;
  role: Role;
  /** Branches this person may reach at all. */
  branches: typeof BRANCHES;
  /** The branch currently selected, or null for the roll-up. */
  branchId: BranchScope;
  setBranchId: (b: BranchScope) => void;
  /** True when this role may see the all-branch roll-up (Level 1). */
  canRollUp: boolean;
  signInAs: (staffId: string) => void;
  can: (p: Permission, t?: Target) => ReturnType<typeof coreCan>;
  allowed: (p: Permission, t?: Target) => boolean;
  theme: Theme;
  setTheme: (t: Theme) => void;
  basis: 'CASH' | 'ACCRUAL';
  setBasis: (b: 'CASH' | 'ACCRUAL') => void;
}

const Ctx = createContext<SessionValue | null>(null);

const THEME_KEY = 'oan.theme';

/** Theme is stored raw, not JSON — index.html reads it before React boots. */
function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [staffId, setStaffId] = useStored<string>('oan.staff', 'st-001');
  const [branchRaw, setBranchRaw] = useStored<BranchScope>('oan.branch', null);
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const [basis, setBasis] = useStored<'CASH' | 'ACCRUAL'>('oan.basis', 'CASH');

  const staff = staffById(staffId) ?? STAFF[0]!;

  const actor: Actor = useMemo(() => {
    const assigned = MEMBERS.filter((m) => m.coachId === staff.id).map((m) => m.id);
    return {
      userId: staff.id,
      role: staff.role,
      branchIds:
        staff.role === 'ADMIN' || staff.role === 'ACCOUNTANT'
          ? BRANCHES.map((b) => b.id)
          : [staff.branchId],
      assignedMemberIds: assigned,
    };
  }, [staff]);

  // Scope decides the entry point (§13). Someone with `branch` scope has no
  // roll-up to return to, so their branch is pinned rather than chosen.
  const reachable = useMemo(
    () => BRANCHES.filter((b) => actor.branchIds.includes(b.id)),
    [actor],
  );
  // Whoever is posted to more than one branch gets Level 1; everyone else
  // enters at Level 2, because for them the aggregate isn't a page they
  // could navigate to — it's a permission they don't hold.
  const canRollUp = reachable.length > 1;
  const branchId = canRollUp ? branchRaw : (reachable[0]?.id ?? null);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* private mode — the choice just won't survive a reload */
    }
  }, []);

  // Keep the DOM in step on first paint, in case index.html found nothing.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const signInAs = useCallback(
    (id: string) => {
      setStaffId(id);
      // Landing scope follows the role, not the previous session.
      setBranchRaw(null);
    },
    [setStaffId, setBranchRaw],
  );

  const value = useMemo<SessionValue>(
    () => ({
      actor,
      staffId: staff.id,
      name: staff.name,
      role: staff.role,
      branches: reachable,
      branchId,
      setBranchId: setBranchRaw,
      canRollUp,
      signInAs,
      can: (p, t) => coreCan(actor, p, t),
      allowed: (p, t) => coreAllowed(actor, p, t),
      theme,
      setTheme,
      basis,
      setBasis,
    }),
    [actor, staff, reachable, branchId, canRollUp, setBranchRaw, signInAs, theme, setTheme, basis, setBasis],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside <SessionProvider>.');
  return v;
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  BRANCH_MANAGER: 'Branch manager',
  FRONT_DESK: 'Front desk',
  COACH: 'Coach',
  MEMBER: 'Member',
  ACCOUNTANT: 'Accountant',
};
