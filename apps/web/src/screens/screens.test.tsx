// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { App } from '../App';
import { SessionProvider } from '../demo/session';
import { DemoStoreProvider } from '../demo/store';
import { STAFF } from '../demo/data';

/**
 * Render smoke tests.
 *
 * Every route, mounted for real, under each role. This is the check that a
 * screen throws — a bad hook order, an undefined member, a selector that
 * doesn't handle the all-branches case. Cheaper than opening twenty screens
 * by hand, and it runs on every change.
 *
 * It asserts what the screen is *for*, not how it looks: the check-in screen
 * has to offer a lookup, the P&L has to show a net figure, and front desk
 * must never see the word "profit" anywhere.
 */

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  // jsdom has no matchMedia, and the hooks that drive motion and layout use it.
  // Report reduced motion: the entrance animations and the loading skeletons
  // are decoration, and a test should assert on the settled screen.
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

function renderAt(path: string, staffId: string): string {
  localStorage.setItem('oan.staff', JSON.stringify(staffId));
  localStorage.setItem('oan.branch', 'null');
  // Each render starts from the seeded world, so one test's check-in or
  // payment cannot leak into the next one's assertions.
  sessionStorage.clear();

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <SessionProvider>
          <DemoStoreProvider>
            <App />
          </DemoStoreProvider>
        </SessionProvider>
      </MemoryRouter>,
    );
  });

  return container.textContent ?? '';
}

const ADMIN = 'st-001';
const MANAGER = 'st-002';
const FRONT_DESK = 'st-004';
const COACH = 'st-006';

const ADMIN_ROUTES = [
  '/dashboard',
  '/members',
  '/members/branch/br-vn',
  '/members/mb-1042',
  '/equipment',
  '/staff',
  '/branches',
  '/accounts',
  '/accounts/daybook',
  '/accounts/expenses',
  '/accounts/receivables',
  '/accounts/gst',
  '/audit',
  '/roadmap',
  '/checkin',
  '/collect',
];

describe('every screen renders', () => {
  it.each(ADMIN_ROUTES)('renders %s for an Admin', (path) => {
    const text = renderAt(path, ADMIN);
    expect(text.length).toBeGreaterThan(50);
  });

  it.each(['/checkin', '/members', '/collect'])('renders %s for front desk', (path) => {
    const text = renderAt(path, FRONT_DESK);
    expect(text.length).toBeGreaterThan(50);
  });

  it.each(['/coach', '/coach/clients', '/coach/session/mb-1042'])(
    'renders %s for a coach',
    (path) => {
      const text = renderAt(path, COACH);
      expect(text.length).toBeGreaterThan(50);
    },
  );

  it('renders the member phone app', () => {
    const text = renderAt('/app/member', ADMIN);
    expect(text).toContain('Rahul');
  });

  it('shows a friendly not-found rather than a blank page', () => {
    const text = renderAt('/nonsense', ADMIN);
    expect(text).toContain('No such screen');
  });

  it('handles a member id that does not exist', () => {
    const text = renderAt('/members/mb-does-not-exist', ADMIN);
    expect(text).toContain('No such member');
  });
});

describe('the screens do their job', () => {
  it('offers a lookup on the check-in counter', () => {
    const text = renderAt('/checkin', FRONT_DESK);
    expect(text).toMatch(/Check-in/);
    expect(text).toMatch(/In the gym now/i);
  });

  it('puts a net profit figure on the P&L', () => {
    const text = renderAt('/accounts', ADMIN);
    expect(text).toMatch(/Net profit/i);
    expect(text).toContain('1,57,000'); // Vidhyadhar Nagar
    expect(text).toContain('7,000'); // Mansarovar keeps almost nothing
  });

  it('shows the roll-up total and the branch split on Members', () => {
    const text = renderAt('/members', ADMIN);
    expect(text).toContain('1,240');
    expect(text).toContain('Vidhyadhar Nagar');
    expect(text).toContain('Mansarovar');
  });

  it('reports the equipment register as 146 units', () => {
    const text = renderAt('/equipment', ADMIN);
    expect(text).toContain('146');
    expect(text).toMatch(/Out of order/i);
  });
});

describe('scope is enforced in the UI, not just the rules', () => {
  it('never shows front desk the word profit, on any screen they can reach', () => {
    for (const path of ['/checkin', '/members', '/members/branch/br-vn', '/collect']) {
      const text = renderAt(path, FRONT_DESK).toLowerCase();
      expect(text).not.toContain('profit');
    }
  });

  it('refuses front desk the accounts screen with an explanation, not a blank', () => {
    const text = renderAt('/accounts', FRONT_DESK);
    expect(text).toMatch(/not part of your access/i);
  });

  it('refuses a coach the accounts screen too', () => {
    const text = renderAt('/accounts', COACH);
    expect(text).toMatch(/not part of your access/i);
  });

  it('hides health tabs from front desk on the member record', () => {
    const text = renderAt('/members/mb-1042', FRONT_DESK);
    expect(text).toContain('Rahul Sharma');
    expect(text).not.toContain('Body fat');
  });

  it('sends a branch manager straight to their own branch, not the roll-up', () => {
    // Level 1 is a permission, not a page: a manager has no aggregate to see.
    const text = renderAt('/members', MANAGER);
    expect(text).toContain('Vidhyadhar Nagar');
    expect(text).not.toContain('Split by branch');
  });

  it('gives a coach no financial access anywhere', () => {
    const text = renderAt('/coach', COACH);
    expect(text).toMatch(/No financial access/i);
  });
});

describe('the demo logins really are different apps', () => {
  it('shows six nav items to an Admin and three to front desk', () => {
    const admin = renderAt('/dashboard', ADMIN);
    for (const item of ['Dashboard', 'Members', 'Equipment', 'Staff', 'Branches', 'Accounts']) {
      expect(admin).toContain(item);
    }

    const desk = renderAt('/checkin', FRONT_DESK);
    expect(desk).toContain('Check-in');
    expect(desk).toContain('Collect');
    expect(desk).not.toContain('Branches');
  });

  it('seeds a login for every role the rules define', () => {
    const roles = new Set(STAFF.map((s) => s.role));
    expect(roles.has('ADMIN')).toBe(true);
    expect(roles.has('BRANCH_MANAGER')).toBe(true);
    expect(roles.has('FRONT_DESK')).toBe(true);
    expect(roles.has('COACH')).toBe(true);
    expect(roles.has('ACCOUNTANT')).toBe(true);
  });
});
