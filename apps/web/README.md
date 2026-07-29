# @oan/web — the demo slice

The UI for OAN Fitness: one brand, two branches, six modules. No backend —
every screen runs against seeded data in the browser.

```bash
pnpm install
pnpm --filter @oan/web dev      # http://localhost:5173
pnpm --filter @oan/web test     # 53 checks
pnpm --filter @oan/web build
```

## What it is

Built from `Rishabhwireframes.html` (layout and content) and
`Rishabhresearch.md` §9 (demo scope), §12 (RBAC), §13 (modules and nav),
§14 (accounting), §17 (member data). Visual design was the open part — the
wireframes say so explicitly — and that is what this adds.

**No business rule is implemented here.** Membership status, check-in
verdicts, GST splits, discount caps and ledger postings all come from
`@oan/core`, the same pure functions the API will call. If a number appears on
a screen, something in `src/demo/` produced it and the drill-down reaches it.

## The one design rule that matters

Status colour means **membership state** and nothing else. Nothing else in the
product is green, amber or red — so when someone at a counter sees colour, it
means exactly one thing. Colour never travels alone either: every status pill
carries a glyph and a word, so the verdict survives greyscale printing, a
projector, and colour-vision deficiency.

## Where things live

```
src/
  styles/          tokens (dual theme), base, shared layout
  components/ui/   primitives — button, card, pill, table, KPI, charts, states
  components/app/  the shell: role-filtered sidebar, header, ⌘K palette
  demo/            seeded data, selectors, session (role + branch scope)
  screens/         one folder per module
  lib/             hooks, money formatting
```

## Roles

Sign in from the sidebar switcher. Same app, different scope — nav is filtered
by omission, so front desk has no greyed-out Accounts item to wonder about.

| Role | Nav items | Sees |
|---|---|---|
| Admin | 6 | All branches, roll-up first |
| Branch manager | 5 | Own branch, no roll-up |
| Front desk | 3 | Own branch, money hidden |
| Coach | 2 | Assigned clients, no money anywhere |
| Accountant | 2 | Books across branches |

## Theme

Dark by default, per §7 — it reads well on a counter screen. Light is a
toggle in the sidebar; both come from the same tokens, so no component knows
which one is on.

## What is deliberately not here

Lead CRM, class booking, PT packs, POS, marketing, biometrics, payment
gateway, AI. They are named on `/roadmap` with the reason, rather than mocked
up — a screen in a demo reads as a promise.
