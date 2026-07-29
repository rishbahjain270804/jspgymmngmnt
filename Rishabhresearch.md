# OAN Gym — Gym Management Software Research

**Prepared for:** JSP Coders → OAN Fitness
**Date:** 29 July 2026
**Status:** Research complete. Stack and demo scope decided. Implementation not yet started.
**Companion doc:** `Jai.Research.pdf` — independent market research. Cross-checked in [§11](#11-cross-check-against-jais-research).

---

## Context

JSP Coders built the marketing site for **OAN Fitness** ([oan.jspcoders.app](https://oan.jspcoders.app)). OAN now wants gym management software, but neither side has built one before — nobody yet knows what the software should actually *do*. So: research first, code second.

Two hard constraints:

1. **UI must be light and friendly, not bulky/complex.** Existing gym software is notoriously bloated; that bloat is the reason small gyms abandon it and go back to a paper register.
2. **Must be native everywhere** — website, mobile app, `.exe` desktop, and more — from one codebase.

---

## 1. What we know about OAN Fitness (from their site)

This is the real spec source. Everything the software does should map to something here.

| Fact | What it implies for the software |
|---|---|
| **1000+ members coached**, 5.0 Google rating | Real scale. Search/lookup must stay fast at thousands of records. |
| **Two shifts, 6 days/week**: 6:00 AM–12:00 PM, 3:30 PM–10:00 PM | Two sharp check-in rushes daily. Check-in must be **sub-2-second**, one screen, no login per member. This is the single most important UX constraint. |
| **8 programs**: Weight Loss, Muscle Building, Strength & Conditioning, Personal Training, Cardio & HIIT, CrossFit & Functional, Aerobics, Diet & Nutrition | Plans aren't one-size. Need a **plan/package builder** — not hardcoded tiers. |
| **Aerobics = group music-led classes** | Needs **class scheduling + capacity + booking**. |
| **Personal Training = 1-on-1 certified trainers** | Needs **PT session packs** — sessions bought, used, remaining, trainer attribution. |
| **Diet & Nutrition, customized meal plans** | **Diet plan assignment** per member. |
| **"Progress tracking via body composition measurement"** | **Measurement log** (weight, body fat, chest/waist/arms) + progress charts. Already a promise on their site — the software should deliver it. |
| **"Trainers who notice when you skip a day"** | This is literally an **at-risk / absent-member alert**. Their brand promise = a software feature. |
| **No joining fee, first session free, cancel anytime** | **Trial/lead flow** is core, not an afterthought. |
| **WhatsApp booking, phone +91 80003 28049** | **WhatsApp is the communication channel**, not email. Email is nearly irrelevant here. |
| **Lockers + changing rooms** | Optional locker assignment module (low priority). |
| Site lists one location — 3rd Floor above Indian Bank, Sikar Road, Vidhyadhar Nagar, Jaipur — but **OAN has confirmed they need to manage multiple branches** | **Multi-branch from day one.** `branch_id` on every operational table, branch-scoped staff, consolidated + per-branch owner view. Not multi-*tenant* — one OAN brand, several locations. See §8. |

**Missing / to ask OAN:** actual plan prices, plan durations, current record-keeping method (register book? Excel? existing software?), staff headcount, whether they sell supplements, whether they have a biometric/access-control device already.

---

## 2. Who actually uses this software

Most gym software fails by building one app for everyone. There are **four distinct users** with almost no overlap in what they need:

| Role | Where they are | What they need | Screens |
|---|---|---|---|
| **Front desk / staff** | Standing at a counter, 40 people queueing, 6:30 AM | Check someone in. See if they've expired. Take a payment. Nothing else — **and only for their branch**. | 2–3 screens, huge touch targets |
| **Branch manager** | One location, on shift | Everything front desk sees, plus their own branch's revenue and expiring list — **not** other branches' | Dashboard scoped to one branch |
| **Admin / Owner** | Phone, at home, evening | How much money came in — **across all branches, and per branch**? Who's expiring? Who's stopped coming? Which branch is underperforming? | Dashboard + reports + branch switcher |
| **Coach / Trainer** | On the floor, phone in pocket | My clients today, log their PT session, update measurements/diet | Mobile-only, list-first |
| **Member** | Their own phone | My plan expiry, my attendance, my progress, book a class, pay | Mobile-only, 4 tabs max |

**Design conclusion:** this is not one UI. It's **one backend + four thin, role-specific frontends**. That is also exactly how you avoid the "bulky" problem — nobody ever sees a feature that isn't theirs.

---

## 3. Feature research — the full landscape

Compiled from vendor feature sets (Glofox, Gymdesk, GymMaster, Zen Planner, Wellyx, PushPress, Club-OS, Perfect Gym) and India-specific players (Akton, GymForce, AdviceFit, GymSathi, Get My Gym, EasyGym).

### Tier A — Core. Without these it is not gym software.

**1. Member management**
- Profile: name, phone, photo, DOB, gender, address, emergency contact, goal, join date
- Plan assigned, start date, **expiry date**, status (active / expiring / expired / frozen / cancelled)
- Member ID + QR code
- Documents: ID proof, medical declaration / PAR-Q, signed waiver
- Full history: all past plans, all payments, all check-ins

**2. Membership plans & packages**
- Owner-defined plans (name, duration, price, tax, what's included)
- Duration types: monthly / quarterly / half-yearly / annual / session-pack / day-pass
- Audience types common in India: **Student, Couple, Corporate**, PT plan, diet package — these are pricing variants, so the plan builder must handle them without code changes
- Add-ons: PT pack, diet plan, locker
- Discounts, coupons, referral credit
- **Freeze/pause** membership (injury, travel — very common in India, and a big goodwill feature)
- Upgrade / downgrade / transfer mid-plan with prorated amount

**3. Attendance / check-in** ← *the highest-frequency screen in the whole product*
- Methods: QR scan (member's phone or printed card), phone-number lookup, biometric device, manual tap
- **Instant visual verdict**: big green = active / amber = expiring in N days / red = expired
- Blocks the "member keeps working out for 3 weeks after expiry" revenue leak — cited as a top loss for manual Indian gyms
- Live "who's in the gym right now" count + list
- Shift-wise and hour-wise footfall reporting (directly useful given OAN's two-shift model)

**4. Billing & payments**
- Invoice on join and on every renewal
- **GST-compliant invoice** (GSTIN, HSN/SAC, CGST/SGST split, invoice series) — legally required in India
- Payment modes: **UPI**, cash, card, bank transfer, cheque
- **Partial payments / instalments and pending balance** — extremely common in Indian gyms and badly handled by foreign software
- Payment reconciliation: members pay via GPay/PhonePe/Paytm/cash and month-end matching is a documented nightmare — a daily collection log fixes it
- Auto-generated receipts sent on WhatsApp
- Refunds, due reminders, defaulter list

**5. Renewals & expiry management** ← *the module that pays for the software*
- Auto list: expiring in 7 / 3 / 1 days, expired today, expired 30+ days
- One-tap WhatsApp reminder from that list
- Renewal conversion rate tracking
- Industry data: gyms lose **30–50% of members annually**; churn spikes at ~90 days, ~6–7 months, and the 12-month renewal mark. Software that surfaces those moments is the entire ROI argument.

**6. Owner dashboard**
- Today: collection, check-ins, new joins, enquiries
- This month: revenue, new vs renewed, expiring count, churn
- Charts: revenue trend, member growth, footfall by hour
- Pending dues total
- **Branch filter on everything** — All branches / one branch, plus a side-by-side branch comparison

**6b. Multi-branch** (promoted out of "later" — OAN has confirmed they need it)
- Consolidated owner view across all locations, and per-branch drill-down
- Branch-scoped staff access; branch-scoped check-in terminals
- Revenue and footfall attributed to the branch where they happened
- Home-branch vs all-access memberships
- Per-branch GST invoice series
- See §8 for the full design implications

### Tier B — Strongly expected. Include most of these.

**7. Lead / enquiry CRM**
- Capture from walk-in, phone, website form, WhatsApp, Instagram
- Pipeline: New → Contacted → Trial booked → Trial done → Converted / Lost
- Follow-up date + reminder to staff (missed follow-ups are the #1 named cause of lost sales)
- **Trial session booking** — OAN already offers a free first session, so this connects directly to their site
- Source tracking → tells them which marketing actually works

**8. Class scheduling & booking** (their Aerobics program)
- Weekly timetable, trainer assigned, capacity, waitlist
- Member books from app; staff sees roster; attendance marked per class

**9. Personal training management**
- PT packs: sessions purchased / used / remaining, expiry
- Trainer-to-client assignment
- Session log with trainer confirmation
- Trainer commission / payout calculation

**10. Staff & coach management**
- Roles + permissions (Admin / branch manager / front desk / coach / member) — front desk must **not** see revenue reports. Full model in **§12**.
- Staff attendance & shift roster (matches OAN's two-shift structure)
- Salary / commission
- Audit log of who changed what (matters when cash is involved)

**11. Communication — WhatsApp first**
- Templates: welcome, receipt, expiry reminder, birthday, "we missed you", class reminder, offers
- Bulk broadcast to a filtered segment
- **Reality check:** WhatsApp Business API is paid and requires template pre-approval. A demo should use `wa.me` click-to-chat deep links (free, instant, works today) and treat the official API as a later upgrade.

**12. Progress & body measurements** (OAN promises this on their site — full design in **§17**)
- Fitness assessment at joining and every 4–12 weeks
- Weight, body fat %, BMI, lean mass, circumferences, BP, resting HR
- Before/after photos, with explicit consent
- Progress charts in the member app — the retention feature members actually *feel*
- **Printable branded progress report** — also the single best renewal tool

**13. Diet & workout plan assignment** (full design in **§17**)
- Exercise library → program templates → assigned program → session logs with sets/reps/weight
- **Workout efficiency**: volume load, estimated 1RM, progressive overload, adherence, **plateau alerts**
- Indian food master with household measures → diet templates → assigned plan → adherence log
- Member sees both in their app; coach logs sessions in under a minute
- Printable diet chart and workout card

**14. Accounting — masters, ledgers, expenses, P&L** (see **§14** for the full design)
- **Expenses**: rent, salaries, electricity, maintenance, marketing — recorded per branch
- **Double-entry ledger** posting automatically behind every payment and expense
- **Branch-wise P&L** — the question no competitor answers
- **Deferred revenue** — an annual plan is not one month's income
- GST output/input tracking and GSTR-ready export
- Receivables ageing, day book, cash book, vendor payables
- Cash vs accrual toggle — "collected" and "earned" are different numbers, and both are true

**15. Equipment / asset register** (promoted from Tier C — see §13)
- What machines exist, how many, **at which branch**
- Category, asset tag, photo, purchase cost, warranty
- Condition flag: working / needs service / out of order
- Service log and next-service-due date
- Rolls up to a per-branch total on the owner's view
- Broken equipment is a top member complaint and a real churn driver — this is a retention feature disguised as an inventory one

**16. Member mobile app**
- My plan + days remaining
- My attendance streak
- My progress charts
- Book class / see timetable
- Pay renewal via UPI
- My diet & workout plan
- Announcements

### Tier C — Later. Real features, but not for a demo.

- POS / supplement & merch inventory with stock, low-stock alerts, best-seller reports
- Locker allocation & rental billing
- Biometric / RFID / face-recognition hardware integration and turnstile access control
- Auto-debit UPI mandates (eNACH) for true recurring billing
- Referral program with automated rewards
- Google review automation
- AI churn prediction, AI diet generation
- Accounting export (Tally)
- Member self-service kiosk

---

## 4. India-specific requirements (where foreign software loses)

This is the wedge. Every global product is weak here, and every successful Indian gym product wins on exactly this list:

1. **UPI as the primary payment rail** — not cards. QR at the desk, payment link over WhatsApp.
2. **GST invoicing** — GSTIN, CGST/SGST split, proper invoice numbering. Non-negotiable, legally.
3. **WhatsApp, not email.** Indian gym members do not read email. Every notification path is WhatsApp.
4. **Cash is still real.** Must record cash cleanly and reconcile it against UPI and card at day-end.
5. **Partial payments & instalments.** "₹3000 now, ₹2000 next week" is normal and must be first-class.
6. **Biometric attendance** — cheap fingerprint devices (ESSL etc.) are already in many Indian gyms.
7. **Price sensitivity.** Indian gym software sells at **₹89–₹1,500/month**. Global tools cost 10–30× that, which is why they don't win here.
8. **Phone number is the identity.** Not email. Many members have no email at all. Login = phone + OTP.
9. **Offline tolerance.** Front-desk internet drops. Check-in must not die when the connection does.
10. **Regional language** — a Hindi toggle is a genuine differentiator for staff-facing screens.

---

## 5. The problems this software actually solves (the pitch to OAN)

Frame the demo around these five, not around a feature list:

| Problem today | Cost | Fix |
|---|---|---|
| Paper register at the desk; members skip signing; staff can't verify plan status during the 6:30 AM rush | Unknown footfall, no data | QR/phone check-in with instant colour-coded status |
| Expired members keep training for days or weeks unnoticed | **Direct revenue loss** | Red screen at check-in, automatic block |
| Nobody tracks who's expiring; renewals happen only if the member remembers | Largest single leak | Auto expiry list + one-tap WhatsApp |
| Cash + GPay + PhonePe + Paytm + card — month-end reconciliation is guesswork | Bookkeeping errors, leakage | Single collection ledger, day-end close by mode |
| A member stops coming for 3 weeks; nobody notices until they're gone | 30–50% annual churn | Absent-member alert — *this is literally OAN's own brand promise, automated* |

---

## 6. Competitor & pricing benchmark

| Product | Market | Notes |
|---|---|---|
| **Akton** | India | ₹89/mo entry. UPI + GST + WhatsApp + QR check-in, live gym crowd, branded app. Sets the price floor. |
| **GymForce** | India | Native UPI auto-debit, WhatsApp Business API, GST. Claims 2000+ gyms. |
| **AdviceFit** | India | Biometric attendance, AI retention, WhatsApp follow-ups, trainer workflows. |
| **GymSathi / Get My Gym / EasyGym / OkFit** | India | Small-gym focused, budget tier. |
| **Helmr / Fitlyn / FitGymSoftware / Organised Gym** | India | Small & medium gyms. Commonly shortlisted by Indian gym owners. |
| **UrbanGym** | India | Multi-branch focus. |
| **Glofox, Mindbody, Zen Planner, PushPress, GymMaster, Wellyx** | Global | Deep features, expensive, no UPI/GST/WhatsApp. Priced out of the Indian small-gym market. |
| **Perfect Gym, Club Automation, Motionsoft, Zenoti** | Enterprise | Access control, multi-site, large chains. Not relevant at OAN's scale. |

### Pricing bands (India)

| Tier | Monthly | Typical customer |
|---|---|---|
| Budget | ₹299–₹1,000 | Small gym, 50–200 members |
| Standard | ₹1,000–₹2,500 | Medium gym, 200–700 members |
| Premium | ₹2,500–₹5,000 | Multi-branch, 700–3,000 members |
| Enterprise | Custom quote | Chains, 3,000+ members |

Annual plans commonly land at ₹6,000–₹15,000/year for a single gym. **Watch the hidden costs** — WhatsApp messaging, onboarding, data migration, and GST are usually billed separately, which is where advertised prices stop matching the invoice.

**Takeaway:** the Indian market is price-anchored around ₹299–₹2,500/month for gyms of OAN's size, and competes on localisation + simplicity, not feature count. A clean, fast, genuinely simple product is a *stronger* position than a feature-matched one — and it matches the "not bulky" constraint exactly.

---

## 7. UI/UX direction — how to keep it un-bulky

Research consensus on front-desk software design:

- **One screen for the core job.** Everything needed to manage a member on a single simple layout — no navigating pages, no remembering workflows.
- **One action per screen**: one button, one decision, one goal.
- **Large tappable targets, oversized fonts, friendly icons, audio cue on successful check-in.** Staff should not need to squint or remember a password to check someone in.
- **3–5 top-level nav items maximum.**
- **Colour carries the meaning.** Green/amber/red status is readable in half a second across a counter.

Applied here:

- Front desk gets **3 screens**: Check-in, Members, Collect payment.
- Owner dashboard: **6 numbers above the fold**, charts below.
- Coach app: a **list of today's clients**, tap one to log a session.
- Member app: **4 tabs**.
- Progressive disclosure — advanced fields live behind "More", never on the default form.
- Dark UI suits the gym brand and reads well on a counter screen.
- Search is always phone-number-first.

> **Rule of thumb for the build: if a screen has more than 7 things on it, it's the wrong screen.**

---

## 8. Architecture — one codebase, native everywhere

**DECIDED: React + TypeScript monorepo — Tauri for `.exe`, Expo for mobile.**

```
apps/
  web/       React + Vite          -> website
  desktop/   Tauri 2 wrapper       -> .exe  (~5 MB installer, vs Electron ~100 MB)
  mobile/    Expo / React Native   -> Android + iOS
  api/       Node + TypeScript + Postgres
packages/
  core/      types, zod validation, API client, business rules  <- the important one
  ui/        shared design tokens + components
```

Team-skill fit is the primary selection driver in every stack comparison, and the existing OAN site indicates a JS/React shop. Tauri covers the `.exe` requirement at a fraction of Electron's size.

**The rule that makes this work:** every business rule — expiry calculation, GST split, plan pricing, status colour logic, validation — lives in `packages/core` and is imported by all three shells. Nothing business-critical is written twice. Web and desktop share literal pixels (Tauri renders the web build); mobile shares logic but has its own native UI.

*(Flutter was the considered alternative — genuinely one codebase to six platforms — but rejected on Dart ramp-up cost for a JS/TS team.)*

### Backend
- Node + TypeScript (Fastify) + **Postgres** — real money in relational data
- Auth: **phone + OTP**, role-based permissions
- Offline-tolerant check-in: queue locally, sync when the connection returns

### Product shape — DECIDED: single brand (OAN), multiple branches

**This is not multi-tenant SaaS.** There is one brand — OAN — with one owner, one set of plans, one member base, and one dashboard. What it has is **several physical locations**.

That distinction matters, because the two are often confused and they produce different systems:

| | Multi-branch (what we're building) | Multi-tenant SaaS (not this) |
|---|---|---|
| Brands | One — OAN | Many, unrelated |
| Data isolation | **Shared** — one owner sees everything | **Hard-walled** — gyms must never see each other |
| Plans | Defined once, used across branches | Per-tenant |
| Members | One member base, branch-attributed | Separate per tenant |
| Login | One OAN account, branch scoping by role | Tenant resolution before auth |
| Branding | OAN throughout | Per-tenant theming |

Building multi-branch is **simpler** than multi-tenant, not harder — no tenant resolution, no row-level isolation guarantees, no per-tenant config. But it is meaningfully more than single-gym, and it must be in the schema from day one. Retrofitting a branch dimension onto financial and attendance data that was written without one is exactly the rewrite worth avoiding.

### What multi-branch actually requires

- **`branch_id` on every operational table** — members, check-ins, payments, invoices, staff, plans-availability. Not a hedge; a real foreign key, populated and queried from day one.
- **Branch-scoped staff.** Front desk at Vidhyadhar Nagar sees that branch. The owner sees all branches plus a consolidated view.
- **A branch switcher** in the owner UI: "All branches" / individual branch, applied to every report.
- **Revenue attribution rule.** If a member of Branch A pays at Branch B, which branch's collection does it count toward? *Recommendation: credit the branch where the payment was taken, but keep the member's home branch on the record — so both "who collected it" and "whose member is it" are answerable.*
- **Home branch vs all-access on the membership.** A plan is either tied to one branch or valid everywhere. This is a pricing decision as much as a technical one, and it must exist on the plan record.
- **Check-in must know its own branch.** A front-desk terminal is bound to a branch; the check-in record stores where it happened. Cross-branch check-in then either works or is refused based on the plan's access type — and the refusal reason must be distinguishable from "expired" on screen.
- **Per-branch GST invoice series.** GST registration is per state, so OAN's Jaipur branches likely share one GSTIN — but invoice numbering should still be per-branch series to keep books clean and auditable.
- **Staff and trainers can be branch-specific or floating.** Model it as an assignment, not a column.

### Non-negotiable schema decisions (cheap now, painful later)
- **`branch_id` from day one**, on everything operational
- Money as **integer paise**, never floats
- Every payment is an immutable ledger row — never edit, only reverse
- Soft deletes + audit trail on anything financial
- Store plan **snapshots** on the membership record — if the owner edits a plan's price later, historical invoices must not change

---

## 9. Demo scope — DECIDED: full vertical slice, fewer features

The demo proves **two** things at once: that it solves OAN's revenue leak, *and* that the same product genuinely runs as a website, an `.exe`, and a phone app. Depth over breadth — every included feature works on all three shells, end to end, against a real database. No mock screens.

**The seven modules in the slice:**

1. **Members** — list with phone-first search, add/edit member, member detail with full history
2. **Plans & memberships** — create plans, assign to a member, automatic expiry date calculation, status derivation (active / expiring / expired). Lives inside Members (§13).
3. **Check-in** — QR + phone lookup, **big green/amber/red verdict**, live "in the gym now" count ← *the hero demo moment*
4. **Payments** — collect payment (UPI/cash), partial payment + pending balance, GST invoice, WhatsApp receipt via `wa.me`
5. **Equipment** — asset register with per-branch counts, condition flag, service dates ← *the clearest demonstration of the roll-up pattern*
6. **Accounts** — expense entry per branch, **branch-wise P&L**, day book, cash/accrual toggle ← *the most owner-impressive screen* (§14)
7. **Member progress** — measurements over time, progress chart, and one **printable branded progress report** ← *the member-facing proof, and a renewal tool* (§17)

Plus a **thin owner dashboard** — today's collection, check-ins, expiring count — because it's six numbers over data the slice already has, and it's what the owner looks at first.

**Multi-branch is in the slice**, not deferred. Seed **two branches** and demo:
- Owner dashboard with a **branch switcher**: All branches / Branch A / Branch B, applied to every number
- Front desk logged in at one branch, seeing only that branch
- A check-in recorded against the branch it happened at
- Payment collected at one branch, attributed correctly

This costs little once `branch_id` is in the schema, and it's the difference between OAN seeing "software for my gym" and "software for my business." Two branches is enough — the second one proves the model; a third proves nothing extra.

**RBAC is in the slice too.** Three seeded logins — Admin, branch manager, front desk — switched live during the demo. Same app, visibly different scope: Admin sees all branches with revenue, manager sees one branch with revenue, front desk sees that branch with money hidden. See §12.

**Each of the four ships on all three targets:**

| | Web (React) | Desktop (`.exe`, Tauri) | Mobile (Expo) |
|---|---|---|---|
| Members | full | full | list + detail |
| Plans | full | full | read-only |
| Check-in | yes | yes — front-desk kiosk mode | yes — QR scanner via camera |
| Payments | full | full | collect + receipt |
| Equipment | full | full | list + mark fault |
| Accounts | full | full | P&L + expense entry |
| Progress | full | full | record + view chart |
| Dashboard | yes | yes | yes |

Mobile is the natural place to demo the **camera QR scanner** — a capability the web build can't match, which makes the cross-platform point concretely rather than as a claim.

**Seed data:** ~50 realistic OAN members spread across their 8 programs, with backdated check-ins and payments, deliberately including expiring-soon, expired, and partial-payment cases so every screen looks alive and every status colour appears. Add **3–4 months of expenses per branch** (rent, salaries, electricity, maintenance) — without them the P&L shows pure profit and the demo's best screen falls flat. Seed the two branches with *different* profitability, so the branch comparison actually says something.

**Explicitly excluded** (name these as roadmap, don't build them): lead CRM, class booking, PT session packs, diet/workout plans, body measurements, staff management beyond basic roles, POS/inventory, lockers, biometric hardware, real payment gateway, WhatsApp Business API, AI.

---

## 10. Open questions for OAN

1. What do they use today — register book, Excel, or existing software?
2. Actual plan names, durations, and prices?
3. Do they have a GSTIN, and do they need GST invoices issued?
4. How many staff, and should front desk be able to see revenue?
5. Any existing biometric/fingerprint device?
6. Do they sell supplements? (decides whether POS matters)
7. Is a member-facing app wanted now, or staff-only first?
8. Is "1000+ members coached" **lifetime** or **currently active**? This changes their pricing tier (§6) and the load the check-in screen has to handle.

### Branch questions (now that multi-branch is confirmed)

9. **How many branches** — existing today, and planned? Their site lists only Vidhyadhar Nagar.
10. **Can a member train at any branch, or only their home branch?** If both are offered, all-access is presumably a higher-priced plan — which makes this a pricing decision, not just a technical one.
11. **Are all branches in Rajasthan?** Same-state branches share one GSTIN; a branch in another state needs its own registration.
12. **Are trainers fixed to a branch or do they float** between locations? Affects PT attribution and payroll.

### Access-control questions (§12)

13. **Should a branch manager see their own branch's revenue?** Assumed yes in §12 — confirm.
14. **What discount can front desk give without approval?** Needs a number. Assumed 10% as a placeholder.
15. **Who is allowed to extend a membership expiry date without payment?** Assumed owner and manager only, always audited. This is the single easiest way to leak money.
16. **Who handles refunds and payment reversals?** Assumed owner-only.
17. **Is the front desk terminal shared between staff on a shift?** Changes whether we need per-staff PINs for attribution — and attribution is what makes the cash reconciliation meaningful.

### Accounting questions (§14)

18. **Who does OAN's books today — an in-house accountant, or an external CA?** Decides whether we're replacing a workflow or feeding one.
19. **Are they on Tally?** If yes, a Tally-compatible export is worth more than a balance sheet in our UI.
20. **Are plan prices quoted GST-inclusive or exclusive** to members? The plan master must record which, or every invoice is off by 18%.
21. **Do they want accrual (deferred revenue) or just cash accounting?** Recommendation is to post both and toggle — but confirm they want to *see* accrual, since it makes reported monthly income look lower than the bank balance and that needs explaining once.
22. **Is rent/salary shared across branches or clearly separable?** Shared costs need an allocation rule before branch-wise P&L means anything.
23. **Do they pay coaches commission on PT sales?** If so, at what rate — it's a per-branch expense that changes branch profitability.

### Training & member-data questions (§17)

24. **What equipment do they measure with** — an InBody/BIA machine, calipers, or just tape and scale? Decides which assessment fields are real and which are aspirational.
25. **How often do they reassess** a member currently? Assumed 4–12 weeks.
26. **Do they already have diet charts and workout templates** on paper or in Excel? If so, that's the seed content and it should be digitised as-is rather than reinvented.
27. **Do coaches actually log sessions today?** If not, adoption is the risk, not the software — the session log has to take under a minute or it won't happen.
28. **Do they take progress photos, and do they have written consent?** Health data and photos need explicit consent under the DPDP Act, and it's a field we must capture.
29. **Should members be able to self-log** workouts and meals, or is logging coach-only? Changes the member app substantially.

Blocking answers, in order: **Q2/Q3** (plan prices, GSTIN) drive seed data and invoicing; **Q20** (GST inclusive or exclusive) is off-by-18% if wrong; **Q10** (home branch vs all-access) changes the membership schema; **Q15** (who can extend an expiry) is the permission that leaks revenue. Get those five before building. The rest can be assumed and corrected.

---

## 11. Cross-check against Jai's research

`Jai.Research.pdf` is independent market research (ChatGPT-sourced) covering the Indian gym software market generally. This document is OAN-specific product/UX/architecture work. Different angles, same market — so where they agree independently, confidence is high.

### Market size (new — this doc had no sizing)

- **~46,500+ gyms and fitness centres** in India
- **~12.3 million active gym members**
- Fitness industry **~₹16,200 crore**, growing double-digit annually
- Highly **fragmented** — mostly independent gyms
- **Most gyms still run on Excel, notebooks, WhatsApp, or basic billing software**

That last point is the real finding. The competition for OAN's business is not Glofox — it's a paper register. And it means the addressable market is large and mostly untouched.

### Where both documents independently agree

High confidence, treat as settled:

- **The core module list** — member management, attendance (QR/biometric/RFID), plans, GST+UPI billing, dues/renewal recovery, lead CRM, PT module, workout/diet plans, progress tracking, owner reports, staff roles, inventory, class booking, mobile apps
- **The four roles** — owner / reception / trainer / member, each with different permissions
- **India-first is the wedge** — GST, UPI, WhatsApp, biometric (ZKTeco, eSSL)
- **WhatsApp automation is essential, not optional**, in India
- **Renewal and dues recovery is the #1 owner pain** and the clearest ROI argument
- **Partial payments** must be first-class
- **The existing products are bad at UX** — Jai's list of market weaknesses reads: *old UI, slow mobile apps, difficult onboarding, too many clicks, weak analytics*. That is independent confirmation that the "not bulky" instinct is not a preference — it is the actual market gap.
- **Stack** — Next.js/React, React Native, Node, Postgres. Jai's doc explicitly notes the MERN/Next.js background, which is what the §8 decision was based on.

### What Jai's research adds

- Market sizing and fragmentation data (above)
- Customer segmentation by member count with matching budget bands (now folded into §6)
- Indian competitors this doc missed: Helmr, Fitlyn, FitGymSoftware, UrbanGym, Organised Gym, OkFit
- Plan variants specific to India: **Student, Couple, Corporate** (now in §3)
- Named payment gateways: **Razorpay, Cashfree**
- Named biometric vendors: **ZKTeco, eSSL**
- Build cost and timeline estimates (below)
- The **AI-first positioning** argument

### Build cost & timeline

| Version | Build effort (in-house) | Outsourced in India |
|---|---|---|
| MVP, single gym | 2–3 months | ₹3–5 lakh |
| Production SaaS | 6–8 months | ₹8–15 lakh |
| Enterprise / multi-branch + AI | 10–15 months | ₹20–50 lakh+ |

Running costs, early stage: domain ₹1,000–2,000/yr, cloud hosting ₹1,000–5,000/mo, database free tier initially, WhatsApp Business API per-message, SMS per-message, payment gateway setup + transaction fees.

**Useful for two things:** pricing the OAN engagement, and sanity-checking the §9 demo — a vertical-slice demo is days of work, not the 2–3 month MVP. Don't confuse the two when quoting.

### The multi-tenant question — RESOLVED

Jai's doc recommends multi-tenant SaaS from day one. **The answer is no** — but for a more precise reason than "single gym."

**OAN needs to manage multiple branches. It is not a platform for multiple gym brands.**

Those are different systems and the difference was worth pinning down (see §8 for the full comparison). We are building **one brand, many locations** — shared plans, shared member base, one owner seeing everything, branch-scoped staff. Not tenant isolation.

| | Chosen: multi-branch | Rejected: multi-tenant SaaS |
|---|---|---|
| Scope | OAN's locations | Any gym in India |
| Complexity | Moderate — a `branch_id` dimension | High — isolation, tenant config, per-tenant branding |
| Business model | Project / product for OAN | ₹500–₹2,500/mo × 46,500 gyms |
| Risk | Building for one customer's actual needs | Building for a customer that doesn't exist yet |

Jai's SaaS case isn't wrong on the market — §11's sizing data is real and the opportunity is genuine. It's wrong on *sequencing*. Building tenant isolation before there is a second customer is speculative work; building branch support when OAN has stated they need it is not.

**And the door stays open.** A multi-branch schema is most of the way to multi-tenant — branches already prove the data model can scope by location, filter every report by a dimension, and keep financials attributed correctly. Adding a tenant layer above branches later is additive work, not a rewrite. That's the difference between the two decisions, and it's why this ordering is the safe one.

### On AI-first

Jai's central thesis is an AI-first gym OS — AI receptionist on WhatsApp, AI sales follow-up, AI trainer, churn and revenue prediction. This doc placed AI in Tier C (later).

Both are right at different times. **AI is a strong differentiator and a weak demo.** Nothing in the AI list works without a year of real member data behind it — churn prediction on seeded data is a fabrication, and OAN will see through it. Ship the boring reliable slice first, earn the data, then the AI features become genuinely defensible rather than a demo trick.

Worth noting the sequencing in the pitch, though: it's the difference between "we built you software" and "we're building you a business system." Say it; just don't build it yet.

### What this doc has that Jai's doesn't

Jai's research is market-level and vendor-agnostic — it never mentions OAN. This doc adds the parts needed to actually build: the OAN-specific spec derived from their live site (§1), the four-role UI decomposition (§2), the concrete UX rules that keep it un-bulky (§7), the monorepo architecture and schema decisions (§8), the scoped demo (§9), and the questions to put to OAN (§10).

**Use both:** Jai's for the business case and pricing, this one for what to build.

---

## 12. User types & access control (RBAC)

In a gym, access control is not a security checkbox — it is a **cash-handling control**. Front desk staff take cash daily, and every meaningful abuse vector runs through a permission that was too generous: extending a friend's expiry for free, applying a silent discount, reversing a payment that was pocketed, deleting the record afterwards.

So the model has two jobs: keep each role's UI small (which is also how the product stays un-bulky), and make money-touching actions impossible or traceable.

### The access model: role × scope

Plain RBAC isn't enough here, because "can view revenue" means something different for an owner and a branch manager. Every permission is evaluated as **role + scope**:

| Scope | Meaning |
|---|---|
| `all` | Every branch — owner and accountant only |
| `branch:[ids]` | One or more specific branches — manager, front desk |
| `assigned` | Only records explicitly assigned to this user — a coach's clients |
| `self` | Only their own record — member |

A branch manager doesn't have a *weaker* permission than the owner; they have the **same permission at a narrower scope**. That keeps the permission list short and makes multi-branch fall out of the model instead of being bolted on.

### The six user types

| Role | Scope | What they're for |
|---|---|---|
| **Admin** (the owner) | `all` | Sees everything, everywhere. Sole authority over plans, pricing, staff, branches, and financial reversals. The only role that sees Level 1 aggregates (§13). |
| **Branch Manager** | `branch` | Runs one location. Sees their branch's revenue and members. Cannot change plan pricing or see other branches. |
| **Front Desk** | `branch` | Check-in, add members, collect payments. **No revenue reports.** No discounts above a cap. No edits to past records. |
| **Coach** | `assigned` | Their own clients only. Logs sessions, measurements, workout and diet plans. **Touches no money at all.** |
| **Member** | `self` | Their own plan, attendance, payments, progress. |
| **Accountant** *(optional)* | `all`, read-only | Financial reports and GST exports across branches. Cannot modify members or take payments. |

Six is the ceiling. Every additional role doubles the testing surface and is usually a scope difference in disguise — model it as scope, not as a new role.

### Permission matrix

`R` = read, `W` = create/edit, `—` = no access, `!` = requires elevation or is audited

| Permission | Admin | Manager | Front Desk | Coach | Member |
|---|---|---|---|---|---|
| `member.view` | R all | R branch | R branch | R assigned | R self |
| `member.create` | W | W | W | — | — |
| `member.edit` | W | W | W basic only | — | W own contact |
| `member.delete` | W ! | ! request | — | — | — |
| `checkin.record` | W | W | W | W assigned | W self (QR) |
| `checkin.view` | R all | R branch | R branch | R assigned | R self |
| `plan.view` | R | R | R | — | R |
| `plan.manage` (create/price) | W | — | — | — | — |
| `membership.assign` | W | W | W | — | — |
| `membership.extend_expiry` | W ! | W ! | — | — | — |
| `membership.freeze` | W | W | ! request | — | — |
| `payment.collect` | W | W | W | — | W self (UPI) |
| `payment.discount` | unlimited | up to cap | up to lower cap ! | — | — |
| `payment.reverse` / refund | W ! | ! request | — | — | — |
| `invoice.view` | R all | R branch | R branch | — | R self |
| `report.revenue` | R all | **R branch only** | **—** | — | — |
| `report.attendance` | R all | R branch | R branch | R assigned | R self |
| `report.gst_export` | R | — | — | — | — |
| `staff.manage` | W | R branch | — | — | — |
| `branch.manage` | W | — | — | — | — |
| `coach.assign_client` | W | W | — | — | — |
| `workout_diet.assign` | W | W | — | W assigned | R self |
| `measurement.record` | W | W | — | W assigned | R self |
| `health.view` (medical, injuries) | R all | R branch | **—** | R assigned | R self |
| `equipment.view` | R all | R branch | R branch | R branch | — |
| `equipment.manage` | W | W branch | ! report fault | ! report fault | — |
| `equipment.transfer` (between branches) | W ! | — | — | — | — |
| `expense.record` | W | W branch | — | — | — |
| `expense.approve` | W | ! above cap | — | — | — |
| `ledger.view` | R all | R branch | — | — | — |
| `report.pnl` | R all | **R branch only** | — | — | — |
| `report.balance_sheet` | R | — | — | — | — |
| `journal.manual` | W ! | — | — | — | — |
| `vendor.manage` | W | R | — | — | — |
| `accounts.close_period` | W ! | — | — | — | — |
| `settings.gym` | W | — | — | — | — |
| `audit_log.view` | R | R branch | — | — | — |

The three rows that matter most are `report.revenue`, `payment.discount`, and `membership.extend_expiry` — those are the ones that cost money when they're wrong.

### Money-touching rules

These sit alongside RBAC and are what actually prevent loss:

- **Payments are append-only.** No role can edit a payment. Corrections happen as a new reversing entry, authored by whoever made it. This is why `payment.reverse` is owner-level and audited.
- **Discount caps by role**, not just discount permission. Front desk gets a low ceiling (say 10%), manager higher, owner unlimited. Anything above a role's cap becomes a request the owner approves.
- **`membership.extend_expiry` is separated from `membership.assign`** deliberately. Assigning a paid plan is routine; silently pushing an expiry date forward is giving away inventory. Front desk should never have it.
- **Day-end cash reconciliation** per branch per staff member — declared cash vs system cash. This catches what permissions can't.
- **Audit log on everything marked `!`**, recording who, what, when, which branch, and before/after values. In a cash business this is the difference between suspecting a problem and proving one.

### Implementation notes

- **Enforce server-side, always.** Hiding a button is UX, not access control — every endpoint independently checks role + scope. Assume the client is hostile.
- **Scope belongs in the data layer, not controllers.** The query builder should apply branch scoping automatically. Relying on each controller to remember `WHERE branch_id = ?` guarantees that one of them eventually won't.
- **Deny by default.** Unknown permission = refused. New features are invisible until explicitly granted.
- **Permissions live in code, roles in the database.** Role→permission mappings are seeded and versioned, not hand-edited in production.
- **One `can(user, permission, resource)` helper in `packages/core`**, shared by API, web, desktop, and mobile — so the UI hides exactly what the server would refuse, and the rule is written once.
- **Front desk shouldn't need a password per action.** They log in once per shift on a shared terminal. Consider a short staff PIN for the `!` actions rather than full re-auth — fast enough for a counter, still attributable.
- **Login is phone + OTP** (§4), and the role comes from the staff record, not from anything the client sends.

### In the demo

RBAC is worth showing, because "front desk cannot see revenue" is a *selling point* to an owner, not a technical detail. Seed three logins — Admin, branch manager, front desk — and switch between them live. Same app, visibly different: Admin sees all branches and revenue, the manager sees one branch with its revenue, front desk sees the same branch with the money hidden entirely.

That demo also does double duty: it's the clearest possible proof that the UI isn't bulky, because each role's version is genuinely small.

---

## 13. Module structure & navigation

### The roll-up pattern

Every entity that exists at a branch follows the **same two-level shape**, and this is the organising idea for the whole UI:

> **Outside = the total across all branches. Inside = branch by branch.**

```
Members                                    ← Level 1: aggregate
  Total active            1,240
  ├─ Vidhyadhar Nagar       780
  └─ Branch 2               460
        │
        └── open ──▶  Member list for that branch   ← Level 2: records
```

The owner opens **Members** and sees one number plus a per-branch split. Clicking a branch drops into the actual member list for that branch. Identical behaviour for Staff, Equipment, and every other branch-scoped entity.

Two reasons this is the right call:

1. **It answers the owner's real question first.** "How many members do I have?" and "is Branch 2 dragging?" are the same screen. No report to run.
2. **It keeps every screen small.** The aggregate view holds a handful of numbers. The detail view holds one branch's records — never a merged list of thousands across locations, which is the thing that makes gym software feel heavy.

### It maps exactly onto RBAC scope

This is where the pattern earns its keep — the two levels *are* the two scopes from §12:

| Role | Scope | Where they enter |
|---|---|---|
| **Admin** | `all` | **Level 1** — aggregate, then drills into any branch |
| **Branch Manager** | `branch` | **Level 2 directly** — their branch's records. Level 1 simply doesn't exist for them. |
| **Front Desk** | `branch` | **Level 2 directly**, with money hidden |

One screen, built once. Scope decides the entry point. Nothing role-specific has to be designed twice, and there is no way for a manager to reach an aggregate that includes another branch — because the aggregate view is a permission, not a page they could navigate to.

### Top-level modules

**"Admin" is a role, not a module.** There is no settings hub in the nav — configuration lives inside the module it belongs to, reachable only by an Admin. That keeps the sidebar to five items and means nobody hunts through a settings tree for the thing they want.

| Module | Level 1 (aggregate) | Level 2 (per branch) | Settings inside it (Admin only) |
|---|---|---|---|
| **Dashboard** | Revenue, check-ins, expiring — all branches | Same, one branch | — |
| **Members** | Total active / expiring / expired, split by branch | Member list, add, detail *(profile · membership · payments · attendance · progress · workout · diet)*, collect payment | **Plans & pricing, exercise & food libraries, program & diet templates** (§17) |
| **Staff** | Headcount by role, split by branch | Staff & coach list, shifts, attendance | **Roles & permissions** |
| **Equipment** | Total units by category, split by branch | Asset list, condition, service log | Categories |
| **Branches** | The branch list — the one module with no Level 2 | Branch detail: address, hours, manager | **GSTIN, invoice series, gym settings** |
| **Accounts** (§14) | Consolidated P&L, cash position, receivables | Per-branch P&L, day book, cash book, expenses | **Chart of accounts, expense categories, vendors, items, tax rates** |

Six modules for an Admin. **Front desk still sees three** (Check-in, Members, Collect payment) — the §7 rule holds, because nav is filtered by role rather than shared.

Two deliberate placements:

- **Plans live inside Members**, because a plan is only ever meaningful as something a member is on. A separate "Plans" nav item would be a settings page pretending to be a module.
- **Branches doesn't roll up** — a branch list has nothing above it. It's also where brand-wide settings sit, since GSTIN and invoice series are per-place-of-business anyway (§8).

The **audit log** is not its own screen either: it renders in context, on the record it describes. You see a member's history on the member, a payment's reversal on the payment. A global log is available to Admin from Staff, for when the question is "what did this person do" rather than "what happened to this record."

### Hierarchy

```
OAN  (brand — one Admin, one plan catalogue, one member base)
│
└── Branch ........... Vidhyadhar Nagar / Branch 2 / …
    ├── Branch Manager ...... runs this branch
    ├── Staff / Front desk .. scoped to this branch
    ├── Coaches ............. scoped to this branch
    │    └── assigned Members
    ├── Members ............. home branch = this
    └── Equipment ........... physically located here
```

Members and Coaches attach to a **branch**; the branch manager manages both. A coach's client list is a further narrowing (`assigned` scope, §12) *inside* their branch — a coach sees their own clients, not the branch's whole roster.

### Equipment — promoted to a core module

This document originally had equipment maintenance in Tier C (later). **That was wrong for a multi-branch operation** — once there is more than one location, "what do I own and where is it" becomes a question only software can answer, and broken machines are one of the most common reasons members quit.

What the module holds:

- Name, **category** (cardio / strength / functional / free weights / accessories)
- **Quantity per branch** — the number that rolls up
- Asset tag or serial number, photo
- Purchase date, cost, vendor, warranty expiry
- **Condition**: working / needs service / out of order
- Service log with next-service-due date
- Branch location, and transfer history if moved between branches

Why an owner cares:

- **"Branch 2 has 4 treadmills for 460 members"** — a capacity problem visible in one screen
- **Out-of-order count per branch** — the leading indicator of member complaints
- **Warranty expiring** and **service overdue** — money saved and breakdowns avoided
- Asset value per branch for the books

Keep it light. This is an asset register with a condition flag and a service date — not a CMMS. If it grows work orders and technician scheduling, it has become a different product.

### What this changes elsewhere

- **§3** — Equipment moves from Tier C to Tier B, as a real module rather than a maintenance log
- **§12** — add `equipment.view` (manager/front-desk read at branch scope), `equipment.manage` (owner + manager, branch-scoped), `equipment.transfer` (owner only — it moves assets between branches)
- **§9** — Equipment **is** in the demo slice. It's the clearest demonstration of the roll-up pattern: total units outside, branch-wise inside, in one screen with no explanation needed.

---

## 14. Accounting layer — Masters, Ledgers, Dashboards

### Why this belongs in the product

Everything above tracks **revenue**. None of it answers the question an owner with multiple branches actually loses sleep over:

> **"Am I making money — and which branch is making it?"**

Revenue is not profit. A branch can collect ₹4 lakh a month and lose money on rent, salaries, electricity, and coach commission. Without an expense and ledger layer, the software reports a number that feels like success and isn't. This is also the single biggest gap in the competitor set — most Indian gym software stops at collections and hands a spreadsheet to a CA.

Multi-branch makes it acute. **Branch-wise P&L is the feature** — the owner's real question is which location to fix, expand, or close, and nothing else in the product can answer it.

### Masters — the reference data

"Masters" are the definitions everything else points at. The principle from §13 holds: **Masters is a concept, not a nav item.** Each master lives inside the module it belongs to, editable only by Admin.

| Master | Lives in | Holds |
|---|---|---|
| Member master | Members | Profile, home branch, ID, documents |
| **Plan master** | Members | Name, duration, price, GST rate, branch access type |
| Staff & Coach master | Staff | Role, branch, salary, commission % |
| Branch master | Branches | Address, hours, GSTIN, invoice series, manager |
| Equipment master | Equipment | Category, asset tag, cost, warranty |
| **Ledger master (chart of accounts)** | Accounts | The account tree below |
| **Expense category master** | Accounts | Rent, salary, electricity, maintenance… |
| **Vendor master** | Accounts | Supplier, GSTIN, payment terms, opening balance |
| **Item master** | Accounts | Supplements, merchandise — HSN, rate, stock |
| **Tax master** | Accounts | GST rates, HSN/SAC codes |
| Payment mode master | Accounts | Cash, UPI, card, bank, cheque — each mapped to a ledger |

Masters share one rule that matters more than it looks: **a master is never hard-deleted and never edited in place once transacted against.** Change a plan's price and you create a new version; the old invoices keep pointing at the old one (§8). The same applies to ledgers, items, and tax rates.

> **§15 has the full ERP model** — the complete master list, the ledger group tree, item groups vs categories, cost centres, voucher types, and the parent/child rules borrowed from Tally.

### Ledgers — the chart of accounts for a gym

Double-entry, five roots. This is a working starting chart, not a generic template:

**Assets**
- Cash in Hand — *one per branch*
- Bank Accounts
- UPI / Payment Gateway Receivable — money taken, not yet settled
- **Accounts Receivable (Member Dues)** — sub-ledger per member
- Equipment / Fixed Assets — *per branch*, ties to §13
- Accumulated Depreciation *(contra)*
- Inventory — supplements, merchandise
- Security Deposits — rent deposits

**Liabilities**
- Accounts Payable — sub-ledger per vendor
- **Deferred Membership Revenue** ← *the one everybody gets wrong; see below*
- GST Payable — Output CGST / Output SGST
- Salary & Commission Payable
- Loans

**Equity** — Owner's Capital, Retained Earnings, Drawings

**Income** — Membership, Personal Training, Registration/Admission Fee, Supplement Sales, Locker Rent, Class & Event, Other

**Expenses** — Rent *(per branch)*, Salaries & Wages, Coach Commission, Electricity & Water, Equipment Maintenance, Housekeeping & Sanitization, Marketing, Software & Subscriptions, Bank & Gateway Charges, Depreciation, Miscellaneous

Every ledger carries a **`branch_id` dimension** on its postings. That single fact is what makes branch-wise P&L possible, and it is why this has to be designed now rather than added later.

### Deferred revenue — the thing to get right

A member pays **₹12,000 in January for an annual plan**. Almost every small gym system books ₹12,000 of January income. That is wrong, and it makes January look great and February look terrible.

Correct treatment:

```
On collection (Jan):
  Dr  Bank / UPI                     12,000
      Cr  Deferred Membership Revenue        10,169
      Cr  Output GST @18%                     1,831

Each month, Jan–Dec:
  Dr  Deferred Membership Revenue        847
      Cr  Membership Income                     847
```

The ₹10,169 is a **liability** until the gym delivers the service. Income is recognised ₹847/month across twelve months.

Why it's worth doing:

- **Monthly P&L becomes real.** Otherwise every month's profit is an artefact of whoever happened to renew an annual plan.
- **It exposes the actual risk in the business** — a large deferred balance is service already sold and still owed. Gyms fail on exactly this.
- **Refunds compute correctly** on a mid-plan cancellation, because the unearned portion is a known number rather than a negotiation.

**Show both bases.** Indian gyms and their CAs think in cash; correct management accounting is accrual. The dashboard should carry a **Cash / Accrual toggle** — "₹4.2L collected" and "₹3.1L earned" are both true and answer different questions. Competitors show only the first. This is a genuine differentiator, and it costs nothing once the postings exist.

### Automatic posting — the move that keeps it un-bulky

**No operational role ever sees a journal entry.** Front desk collects a payment; the ledger entries happen underneath. This is possible because a gym has roughly a dozen transaction shapes and no more:

| What the user does | Dr | Cr |
|---|---|---|
| Collect membership payment | Cash/UPI *(branch)* | Deferred Revenue + Output GST |
| Monthly revenue recognition *(automatic)* | Deferred Revenue | Membership Income |
| Partial payment ₹3,000 of ₹5,000 | Cash 3,000 + Receivable 2,000 | Deferred Revenue + GST |
| Member clears dues | Cash/UPI | Accounts Receivable |
| Record an expense | Expense ledger *(branch)* | Cash/Bank |
| Pay salary | Salaries | Cash/Bank |
| Post coach commission | Coach Commission | Commission Payable |
| Purchase stock | Inventory + Input GST | Vendor Payable |
| Sell a supplement | Cash + COGS | Sales Income + Inventory |
| Refund / reversal | Deferred Revenue or Income | Cash/Bank |
| Depreciation *(automatic, monthly)* | Depreciation | Accumulated Depreciation |

Posting rules live in **`packages/core`** with the other business logic (§8), so web, desktop, and mobile all post identically.

Manual journal entry exists as an **Admin-only escape hatch** for opening balances, adjustments, and a CA's year-end entries. It is one screen, and nobody else can reach it.

### Accounting dashboard & reports

| Report | Answers |
|---|---|
| **Branch-wise P&L** ← *the one that matters* | Which branch actually makes money |
| Profit & Loss | Income vs expense, any period, any branch |
| Balance Sheet | What the business owns and owes |
| Trial Balance | Do the books balance |
| **Day Book** | Every transaction today, all branches |
| **Cash Book / Bank Book** | Per-branch cash position, day-end close |
| **Receivables ageing** | Who owes what, 0–30 / 30–60 / 60+ days |
| Payables | What's owed to vendors |
| **Deferred revenue schedule** | Service sold but not yet delivered |
| Expense analysis | Where the money goes, by category and branch |
| **GST summary** | Output tax, input credit, GSTR-1-ready export |
| Revenue per member / per sq ft | Efficiency across branches |

The **accounting dashboard** an Admin actually opens is six numbers, not twelve reports: collected, earned, expenses, **net profit**, outstanding dues, cash in hand — each with a branch filter and a cash/accrual toggle. The reports sit one level below, for when the number looks wrong.

### GST handling

- **18% GST on gym membership** in India (health club & fitness centre services)
- CGST 9% + SGST 9% within Rajasthan; IGST only if a branch is out of state
- Output GST posts automatically on every invoice; input credit on every vendor purchase
- **Per-branch invoice series** (§8), with branch GSTIN on the invoice
- GSTR-1-ready export — the CA's actual deliverable
- Prices are usually quoted **GST-inclusive** to members, so the plan master must record which way the price is stated and back out the tax correctly

### Where this sits in the nav

One new module, keeping the §13 shape:

| Module | Level 1 | Level 2 |
|---|---|---|
| **Accounts** | Consolidated P&L, cash position, receivables — all branches | Per-branch P&L, day book, cash book |

Nav goes to **six** for an Admin. Front desk still sees three — they never see Accounts at all. Branch managers see their own branch's P&L and nothing else.

New permissions for §12: `ledger.view`, `expense.record`, `expense.approve`, `journal.manual` *(Admin only)*, `report.pnl`, `report.balance_sheet`, `vendor.manage`, `accounts.close_period`. Front desk gets **none** of them; a manager gets `expense.record` at branch scope plus their own P&L.

### Scope: this is a fork, not an increment

Adding real accounting roughly doubles the product. Three honest options:

| | What it is | Cost | Verdict |
|---|---|---|---|
| **A. Full ERP** | Double-entry, balance sheet, payables, inventory, payroll | Large — this is a second product | Later, and only if OAN asks |
| **B. Export to Tally** | Operational software + expense log, hand the CA a file | Small | Underdelivers — no branch P&L, no live profit |
| **C. Double-entry engine, minimal UI** ✅ | Correct postings underneath, no journal screens, 6-number dashboard + branch P&L | Moderate | **Recommended** |

**C is the recommendation.** The engine is the cheap part — a dozen posting rules in `packages/core`. What makes accounting software heavy is the *interface*: journal forms, voucher types, ledger pickers, Tally-style keyboard flows. Skip all of it. Front desk collects payments and records expenses; the ledger is correct because it was posted automatically; the Admin sees profit per branch and can drill down when a number looks wrong.

That yields books a CA can actually use, and a UI a receptionist never has to learn.

### In the demo

The slice already collects payments — posting them properly is a small addition on top, and **branch-wise profit is the most owner-impressive screen in the whole product.**

Add to §9:
- **Expense entry** — record rent/electricity/salary against a branch
- **Branch-wise P&L** — income, expenses, net profit, side by side across two branches
- **Cash/accrual toggle** on the dashboard
- **Day book** — every transaction today
- Correct GST split and deferred revenue on membership sales, visible in the numbers

Excluded from the demo: balance sheet, payables, inventory/COGS, payroll, manual journals, depreciation, GSTR export. All real, none needed to make the point.

---

## 15. The ERP data model — Masters, Groups, Ledgers, Items

§14 established *that* we need accounting. This is *how* it's structured. Tally is the reference because it's what every Indian CA knows, and because its model has survived thirty years of real books — but we borrow its structure, not its interface.

### 15.1 How Tally actually models it

Tally ships with **28 predefined ledger groups — 15 primary and 13 sub-groups** — and exactly **two predefined ledgers** (Cash, and Profit & Loss A/c). Everything else is user-created underneath that skeleton.

The whole system rests on six master types:

| Tally master | Nests? | Purpose |
|---|---|---|
| **Group** | ✅ hierarchical | Classifies ledgers; decides which financial statement they land in |
| **Ledger** | ❌ always a leaf | The actual account money posts to |
| **Stock Group** | ✅ hierarchical | "What kind of thing is it" |
| **Stock Category** | ❌ flat, orthogonal | A second, independent way to slice items |
| **Cost Category / Cost Centre** | ✅ | Allocates a posting across business dimensions |
| **Voucher Type** | ✅ (can extend) | The shape of a transaction |

### 15.2 The parent–child rules — the part that matters

These are the rules that keep a chart of accounts coherent. Breaking any of them is how ERPs rot.

**1. Nature is inherited, never re-declared.**
A ledger's fundamental character — Asset, Liability, Income, Expense — comes from its **topmost primary ancestor**, not from itself. `Cash - Branch 2` is an asset because it sits under `Cash-in-Hand → Current Assets`. You cannot make a child of Current Assets behave as income. This is why the tree is worth getting right once: every report downstream derives from it.

**2. A ledger is always a leaf. Only groups nest.**
A ledger can never have a child ledger. If you find yourself wanting one, you actually want a **group** with two ledgers under it — or a **dimension** (§15.9). This is the single most common modelling mistake.

**3. A ledger belongs to exactly one group.**
No multi-parenting. When something genuinely needs two classifications at once, that's what Cost Categories and Stock Categories exist for — a parallel axis, not a second parent.

**4. Behaviour flags cascade down, and can be overridden at any sub-group.**
`Nett Debit/Credit Balances for Reporting`, `Used for Calculation`, `Bill-wise details` — set on a group, inherited by descendants, overridable lower down.

**5. Direct vs Indirect decides Gross vs Net Profit.**
`Direct Expenses` and `Direct Incomes` hit the Trading Account and produce **Gross Profit**. `Indirect` hit the P&L and produce **Net Profit**. For a gym this is a real decision, not a formality — see §15.4.

**6. Depth is allowed but punished.**
Tally permits deep nesting; reports become unreadable past three levels. **Cap it at three.**

**7. Primary groups cannot be deleted.** Only user-created ones can — and only if nothing has posted to them.

**8. `Bill-wise details` turns one ledger into thousands of sub-balances.**
This is how Tally holds 1,000 members' dues in a single `Sundry Debtors` ledger, keyed by bill reference, instead of creating 1,000 ledgers. Important — and it's also where we deliberately diverge (§15.9).

### 15.3 Complete master list for a gym ERP

**A · Accounting**

| Master | Nests | Notes |
|---|---|---|
| Ledger Group | ✅ | The 28-group skeleton + gym additions |
| Ledger | ❌ | Leaf accounts |
| Voucher Type | ✅ | Receipt, Payment, Journal, Sales, Contra… |
| Cost Category | ❌ | Parallel allocation axes |
| Cost Centre | ✅ | Branch, activity, campaign |
| Tax / GST rate | ❌ | Rate + HSN/SAC |
| Payment Mode | ❌ | Each maps to a ledger |
| Bank Account | ❌ | For reconciliation |
| Budget | ✅ | Per branch, per period |
| Financial Year / Period | ❌ | With period-close lock |

**B · Inventory**

| Master | Nests | Notes |
|---|---|---|
| Stock Group | ✅ | Hierarchical — what it is |
| Stock Category | ❌ | Orthogonal — how you slice it |
| Stock Item | ❌ | The SKU |
| Unit of Measure | ❌ | Simple + compound |
| Godown / Store | ✅ | Maps to branch + store room |
| Batch | ❌ | Mfg + **expiry** — mandatory for supplements |
| Price List | ✅ | Member rate vs walk-in rate |
| Vendor / Supplier | ❌ | GSTIN, terms, opening balance |

**C · Gym operations**

| Master | Nests | Notes |
|---|---|---|
| Branch | ✅ | The primary dimension everywhere |
| Member | ❌ | Not a ledger — see §15.9 |
| Member Category | ❌ | Student, corporate, couple, senior |
| Membership Plan | ✅ | Plan group → plan |
| Plan Add-on | ❌ | PT pack, locker, diet |
| Staff / Employee | ❌ | |
| Designation / Role | ❌ | Feeds §12 RBAC |
| Department | ✅ | Floor, reception, housekeeping, admin |
| Shift | ❌ | OAN's two shifts |
| Equipment | ❌ | |
| Equipment Category | ✅ | Cardio → treadmill → model |
| Class / Program | ✅ | Aerobics, CrossFit, HIIT |
| Locker + Locker Type | ❌ | |
| Lead Source | ❌ | Walk-in, Instagram, referral |
| Enquiry Stage | ❌ | Pipeline states |
| Workout / Exercise | ✅ | Template library |
| Diet / Food item | ✅ | With macros |
| Measurement Type | ❌ | Weight, BF%, chest, waist |
| Document Type | ❌ | ID proof, waiver, PAR-Q |
| Message Template | ❌ | WhatsApp/SMS |
| Holiday Calendar | ❌ | Closures, affects expiry extension |

**D · Payroll** *(Tally calls these Pay Heads)*

| Master | Notes |
|---|---|
| Employee Group | Coaches, reception, housekeeping |
| Pay Head | Earnings, deductions, statutory, bonus, reimbursement — **each maps to a ledger** |
| Salary Structure | Per employee or per group |
| Attendance / Leave Type | Present, absent, half-day, paid leave |
| Commission Scheme | % of PT sale, slab-based |

### 15.4 Ledger groups — the full gym tree

Nature shown as `[A]` asset `[L]` liability `[I]` income `[E]` expense. Gym-specific additions marked ★.

```
CAPITAL ACCOUNT                                   [L]
├── Owner's Capital
├── Drawings
└── Reserves & Surplus
    └── Retained Earnings

CURRENT ASSETS                                    [A]
├── Cash-in-Hand
│   ├── Cash — Vidhyadhar Nagar        ★ one per branch
│   ├── Cash — Branch 2
│   └── Petty Cash
├── Bank Accounts
│   └── HDFC Current A/c
├── ★ Payment Gateway Receivable       ★ collected, not yet settled
│   ├── Razorpay Settlement
│   └── UPI Settlement
├── Sundry Debtors                     [bill-wise ON]
│   ├── Member Dues                    ★ sub-ledger by member
│   └── Corporate Receivables
├── Stock-in-Hand
│   ├── Supplement Stock
│   └── Merchandise Stock
├── Loans & Advances (Asset)
│   ├── Staff Advances
│   └── Advance to Vendors
└── Deposits (Asset)
    ├── Rent Deposit — Branch A
    └── Electricity Deposit

FIXED ASSETS                                      [A]
├── Gym Equipment                      ★ ties to §13
├── Furniture & Fixtures
├── Air Conditioners
├── Computers & POS
├── Leasehold Improvements
└── Accumulated Depreciation           (contra)

CURRENT LIABILITIES                               [L]
├── Sundry Creditors                   [bill-wise ON]
│   ├── Supplement Vendors
│   └── Service Vendors
├── Duties & Taxes
│   ├── Output CGST / Output SGST / Output IGST
│   ├── Input CGST / Input SGST
│   └── TDS Payable
├── ★ DEFERRED REVENUE                 ★ the gym-critical group
│   ├── Deferred Membership Revenue
│   ├── Deferred PT Revenue
│   └── Advance from Members
├── Provisions
│   ├── Salary Payable
│   └── Coach Commission Payable
└── Statutory Payables
    └── PF / ESI / Professional Tax

LOANS (LIABILITY)                                 [L]
├── Secured Loans   → Equipment Loan
├── Unsecured Loans → Owner's Loan
└── Bank OD A/c

SALES ACCOUNTS                                    [I]
├── Membership Income
├── Personal Training Income
├── Registration / Admission Fee
├── Class & Event Income
├── Locker Rental Income
├── Day Pass Income
├── Supplement Sales
└── Merchandise Sales

PURCHASE ACCOUNTS                                 [E]
├── Supplement Purchase
└── Merchandise Purchase

DIRECT EXPENSES        ★ cost of delivering the service → Gross Profit
├── Coach Salaries
├── Coach Commission
├── Class Instructor Fees
├── Rent — Gym Premises
├── Electricity & Water — Floor
├── Equipment Maintenance & Repair
└── Gym Consumables (towels, sanitiser, chalk)

INDIRECT EXPENSES                                 [E]
├── Admin & Reception Salaries
├── Marketing & Advertising
├── Software Subscriptions
├── Bank & Gateway Charges
├── Telephone & Internet
├── Housekeeping
├── Professional Fees (CA, legal)
├── Insurance
├── Depreciation
├── Printing & Stationery
├── Bad Debts
└── Miscellaneous

INDIRECT INCOMES                                  [I]
├── Interest Income
├── Late Fee / Penalty
└── Scrap Sale of Equipment

SUSPENSE A/C          ★ unreconciled UPI lands here until matched
```

**The Direct/Indirect split is a deliberate call.** Putting rent, floor electricity, coach pay and equipment upkeep in **Direct** makes *Gross Profit* mean **"contribution per branch after the cost of running that floor"** — which is exactly the number an owner needs to compare two locations. Admin salaries, marketing and software stay Indirect because they're brand-level. Confirm with their CA, but this is the version that produces a useful report.

**`Branch / Divisions` is deliberately unused.** Tally offers it for branches kept as separate books. We use a `branch_id` dimension on every posting instead (§15.9), which gives consolidated *and* per-branch statements from one set of books rather than merged ones.

### 15.5 Item Groups vs Item Categories — the orthogonal axis

This is the Tally concept most people miss, and it's the one that keeps an item master from turning into a mess.

> **Stock Group = what the thing *is*. Hierarchical, one parent.**
> **Stock Category = how you want to *slice* it. Flat, cuts across the whole tree.**

**Stock Groups** — hierarchical:

```
Supplements
├── Protein
│   ├── Whey
│   ├── Casein
│   └── Mass Gainer
├── Performance
│   ├── Pre-Workout
│   ├── BCAA / EAA
│   └── Creatine
├── Vitamins & Minerals
└── Health Foods

Beverages
├── Energy Drinks
├── Ready-to-Drink Shakes
└── Water

Merchandise
├── Apparel
├── Accessories (shakers, belts, gloves, straps)
└── Bags

Consumables            ★ internal use, never sold
├── Cleaning & Sanitisation
├── Towels & Linen
└── First Aid

Equipment Spares
├── Cables & Belts
├── Bearings
└── Upholstery
```

**Stock Categories** — flat, parallel, independent of the tree:

- **Brand** — Optimum Nutrition, MuscleBlaze, Avvatar, Dymatize
- **Movement** — Fast / Slow / Dead
- **Origin** — Imported / Domestic
- **Margin band** — High / Medium / Low
- **Purpose** — For Sale / Internal Consumption

**Why both.** A tub of ON Whey sits in group `Supplements → Protein → Whey` **and** category `Optimum Nutrition`. That lets you ask *"how is Protein performing?"* (group axis) and *"how is ON performing?"* (category axis) from the same data — without duplicating the hierarchy or inventing a `Supplements → ON → Protein` branch that fights the first one.

**The rule of thumb:** if a classification would force you to duplicate a subtree, it's a **category**, not a group.

### 15.6 Items, godowns, batches, units

**Stock Item** carries: name, SKU/alias, barcode, **one stock group** (mandatory), **one stock category** (optional), base + alternate UoM, HSN/SAC and GST rate, opening qty and rate, reorder level, standard cost and selling price, batch-tracking flag, and per-godown balances. Negative stock: **disallowed**.

**Godowns are hierarchical, and they map to branches:**

```
All Stores
├── Vidhyadhar Nagar
│   ├── Retail Counter
│   └── Store Room
└── Branch 2
    ├── Retail Counter
    └── Store Room
```

Branch-to-branch stock movement is a **Stock Journal** voucher — it moves quantity without touching P&L, which is exactly right.

**Batches are non-optional for supplements.** Every batch carries manufacture and **expiry** date. Selling expired protein is a real liability, and expiry-based alerts are the whole reason to track batches at all. Enforce FEFO (first-expiry-first-out) on issue.

**Units** — simple (`Nos`, `Kg`, `gm`, `Ltr`, `ml`, `Box`) and compound (`Box of 12 Nos`, `Kg of 1000 gm`). Compound units are what let you buy by the box and sell by the piece without arithmetic errors.

### 15.7 Cost Categories & Cost Centres — the second dimension

Cost Centres allocate a posting across business units. **Cost Categories** allow *simultaneous, independent* allocations — the same ₹50,000 of rent can be allocated 100% to a branch **and** split across activities at the same time, without double-counting.

| Cost Category | Cost Centres |
|---|---|
| **Branch** *(mandatory)* | Vidhyadhar Nagar, Branch 2 |
| **Activity** *(optional)* | Gym Floor, Personal Training, Aerobics, Retail |
| **Campaign** *(optional)* | New Year Offer, Referral Drive |

That second axis is what answers **"is Personal Training actually profitable, or is the floor subsidising it?"** — a question no gym software in the Indian market answers today.

### 15.8 Voucher types

| Voucher | Used for | Posts |
|---|---|---|
| **Receipt** | Member pays | Dr Cash/Bank · Cr Deferred Revenue + GST |
| **Payment** | Expense paid | Dr Expense · Cr Cash/Bank |
| **Contra** | Cash → bank, branch → branch | Dr Bank · Cr Cash |
| **Sales** | Membership or supplement invoice | Dr Debtor · Cr Income + GST |
| **Purchase** | Vendor bill | Dr Inventory/Expense + Input GST · Cr Creditor |
| **Credit Note** | Refund / cancellation | Dr Income or Deferred · Cr Cash/Debtor |
| **Debit Note** | Purchase return | Dr Creditor · Cr Inventory |
| **Journal** | Revenue recognition, depreciation, adjustments | Varies |
| **Stock Journal** | Branch-to-branch transfer | Quantity only |
| **Physical Stock** | Stock count correction | Adjusts to counted qty |
| **Payroll** | Salary run | Dr Salary · Cr Payable/Bank |

Each voucher type owns a **numbering series scoped per branch** (§8), so invoice numbering stays clean and auditable across locations.

### 15.9 Where we deliberately differ from Tally

Tally is a *general* accounting package with no idea what a gym member is — so it models everything as ledgers, cost centres, or stock. We're building a *domain* system with real tables, so several things become **dimensions on a posting** instead of masters:

| Tally does | We do | Why |
|---|---|---|
| A ledger per member (or bill-wise sub-ledgers) | **`member_id` dimension** | 1,000+ ledgers is unusable, and we already have a members table |
| Godown for location | **`branch_id` dimension** (mandatory on every posting) | Branch is first-class here, not a stock nicety |
| Cost Centre for branch | **`branch_id`**, enforced | Never optional — a posting without a branch is a bug |
| Cost Centre for activity | **`cost_centre_id`** (optional) | Genuine second axis, keep it |
| Bill-wise details | **`invoice_id` on the posting** | Same outcome, queryable |
| Ledger per vendor | **Ledger per vendor** — kept | Vendors are few; per-ledger is fine and CAs expect it |

**The single most important divergence: members are not ledgers.** `Member Dues` is *one* ledger; each posting to it carries a `member_id`. A member's balance is a query, not an account. Tally does it the other way only because it has nowhere else to put the member.

**The core posting line, then, is:**

```
posting {
  voucher_id, ledger_id, dr_cr, amount_paise,
  branch_id        ← mandatory, always
  cost_centre_id?  ← activity axis
  member_id?  vendor_id?  staff_id?
  item_id?  batch_id?  godown_id?  qty?
  invoice_id?  narration
}
```

Every report in §14 — P&L, balance sheet, branch comparison, receivables ageing, item movement — is an aggregation over this one table. Get it right and the reports are almost free; get it wrong and every report is a workaround.

### 15.10 Build order

Not all of this belongs in the demo. Sequence:

| Phase | Build |
|---|---|
| **Demo** | Ledger groups + ledgers (seeded chart), postings table with `branch_id`, Receipt/Payment/Journal vouchers, branch P&L, day book |
| **Next** | Expenses UI, vendors, purchase, receivables ageing, GST reports |
| **Then** | Stock groups/categories/items, godowns, batches, POS, COGS |
| **Later** | Payroll & pay heads, budgets, cost centre activity axis, depreciation, period close |

**Seed the chart of accounts as versioned code**, not as data someone types in. It's the backbone of every financial report, and a typo in the tree is a wrong balance sheet.

---

## 16. What to steal from Tally and the ERP suites

§15 borrowed Tally's **data model**. This borrows its **behaviour** — and rejects its interface. The organising principle:

> **Steal the engine, not the dashboard.** Tally's speed, integrity and drill-down are worth copying exactly. Its F-key mnemonics and voucher-mode toggles are for career accountants, and our users are a receptionist at 6:30 AM.

### 16.1 Robust — what makes books trustworthy

**Audit trail is a legal requirement in India, not a feature.**

The MCA amended Rule 3(1) of the Companies (Accounts) Rules, 2014 — effective for financial years beginning **1 April 2023**, every company must use accounting software with an **edit log recording every transaction and every change**, with the date of change, and **the audit trail must not be disableable**. Tally shipped "TallyPrime Edit Log" specifically to comply.

This retroactively upgrades the §12 audit recommendation from good practice to compliance. Two consequences:

- **Build it always-on with no toggle.** A disable switch is itself non-compliant.
- Strictly this binds *companies* under the Companies Act — if OAN trades as a proprietorship it isn't yet bound. **Build it anyway.** They may incorporate, and retrofitting an edit log onto historical data is impossible by definition.

The rest of the robustness stack, in priority order:

| Practice | What it prevents |
|---|---|
| **Balanced by construction** — a voucher cannot save unless Dr = Cr | Silently unbalanced books |
| **Append-only postings** — reverse, never edit or delete | The single largest fraud vector in a cash business |
| **Idempotency keys on payment posting** | Double-charging when the front desk connection drops mid-save — a real risk given offline-first (§8) |
| **Period close lock** | Backdating into a filed month |
| **Unbroken numbering series, per branch** | GST non-compliance; gaps are audit findings |
| **Referential integrity on masters** — can't delete what's been transacted against | Orphaned history, broken reports |
| **Nightly integrity job** — trial balance must balance, control accounts must tie to sub-ledgers | Silent drift; Tally's "Verify Company Data" equivalent |
| **Versioned backup + restore** | Everything else |

### 16.2 Efficient — Tally's real lesson

The number that matters: **an experienced Tally user posts 100+ vouchers an hour, keyboard only.** No modern web accounting app comes close. That's not nostalgia — it's the result of specific, copyable decisions.

| Tally mechanism | What it does | Worth copying? |
|---|---|---|
| **Go To (Alt+G)** | Jump to any report, master, or transaction *from anywhere*, handle the interruption, return without losing your place | ✅ **Yes — as a command palette.** This is a command palette from before they were fashionable. |
| **Switch To (Ctrl+G)** | Move between reports keeping context | ✅ Yes |
| **F4–F9 = voucher types** | One keystroke to Contra/Payment/Receipt/Journal/Sales/Purchase | ⚠️ Principle yes, mnemonics no |
| **Create master inline (Alt+C)** | Create a ledger/item *without leaving* the entry screen | ✅ **Yes — the highest-value one.** Add a member mid-payment; add a vendor mid-expense. |
| **Drill-down everywhere** | Balance Sheet → group → ledger → voucher, any depth | ✅ **Yes, non-negotiable.** Every number clickable to source. |
| **Ctrl+F filter, Ctrl+H change view, Alt+F1 detail toggle** | Reshape a report without re-running it | ✅ Yes, as filter bar + saved views |
| **Ctrl+J exceptions** | Surfaces anomalies in a report | ✅ Yes — becomes our "needs attention" list |
| **Alt+R repeat last narration** | Avoid retyping | ✅ Yes, as smart defaults |
| **Inline calculator on amount fields** | Compute without leaving the field | ✅ Yes — cheap, disproportionately loved |
| **Harmonised shortcuts across masters/vouchers/reports** | Learn once, applies everywhere | ✅ **Yes — this is the real secret.** Consistency, not shortcut count. |
| **Offline-first, local data** | Works when the internet doesn't | ✅ Yes — already in §8 |

### 16.3 Easy — what the modern suites do better than Tally

Tally's weaknesses are exactly where Zoho, Odoo and ERPNext win, and they're worth taking:

| Capability | Who does it well | Take it? |
|---|---|---|
| **Bank feeds + rules engine** — auto-import and auto-categorise recurring transactions | Xero (21,000+ institutions), Zoho Books (2,500+) | ✅ **Adapted** — our version is UPI/gateway settlement webhooks auto-matched to member payments. Solves the reconciliation pain from §5 outright. |
| **Recurring invoices + auto-charge mandates** | Zoho, Xero | ✅ Yes — this *is* gym renewals |
| **Clean, low-learning-curve UI** | ERPNext, Zoho | ✅ Core requirement already |
| **Modular apps, install what you need** | Odoo, ERPNext | ✅ Matches our module structure (§13) |
| **Low-code customisation** (Odoo Studio) | Odoo | ❌ Over-scope for one gym |
| **User-level bank account access control** | Zoho Books | ✅ Fits §12 scoping |
| **Guided setup / onboarding wizard** | Zoho | ✅ Yes — "difficult onboarding" was a named market weakness (§11) |
| **Saved views + scheduled report delivery** | All three | ✅ Yes — but deliver on **WhatsApp**, not email (§4) |
| **Approval workflows** | Odoo, ERPNext | ✅ Yes — already needed for discounts and reversals (§12) |
| **Real mobile apps** | Zoho | ✅ Already core (§8) |

### 16.4 The translation table

Same capability, our interface. This is the whole section in one table:

| Tally / ERP does | We do | Why |
|---|---|---|
| `Alt+G` Go To | **Command palette (Ctrl/Cmd+K)** — "check in Rahul", "record expense", "branch P&L" | Same capability, no manual required |
| `F7` Journal, `F6` Receipt | **Named actions**: "Collect payment", "Record expense" | Nobody should learn that Receipt is F6 |
| "Voucher" | **"Payment", "Expense", "Invoice"** | Accountants' word; staff have their own |
| "Ledger" in operational UI | Never shown | Front desk collects money; the ledger is an implementation detail |
| `Alt+C` create master inline | **"+ Add new"** inside every picker | Same idea, discoverable |
| Report drill-down | Every number clickable to source | Straight copy |
| `Ctrl+J` exceptions | **"Needs attention"** on the dashboard | Same idea, plain language |
| 100+ vouchers/hour | **Check-in < 2s, payment < 20s** | Their metric, our workload |
| Edit log | Always-on, no toggle | Legal requirement |
| Bank feed + rules | **UPI/gateway webhook auto-match** | India's rail, not cheque-book banking |
| F11/F12 configuration | Settings inside the module they affect (§13) | No configuration maze |

### 16.5 What none of them do — where we can be genuinely better

Gaps common to Tally, Zoho, Odoo and ERPNext when pointed at a gym:

1. **Deferred revenue handled natively.** All can do it; none do it *automatically* for a subscription business. Our posting rules do it without anyone thinking about it (§14).
2. **Branch P&L as a first screen**, not a cost-centre report someone has to configure.
3. **Operational and financial in one system.** Check-in and the ledger sharing a database means "revenue per member per branch" and "who stopped coming" are the same query. Tally has no idea what a member is.
4. **WhatsApp as the notification bus**, not email.
5. **Offline-tolerant at the point of sale.** Tally is offline-first but desktop-only; the cloud suites are online-only. We need offline *and* multi-device.
6. **Zero accounting vocabulary for operational roles.** Everyone else makes the receptionist learn accounting. We don't.

### 16.6 The landscape, briefly

| Product | Strength | Weakness for us |
|---|---|---|
| **TallyPrime** | India standard, every CA knows it, unmatched keyboard speed, offline-first, edit-log compliant | Dated UI, no real web/mobile, no domain concept of a member |
| **Zoho Books** | Modern, easy, GST-native, bank feeds, automation, good mobile | Generic — no gym domain; another subscription |
| **Odoo** | Modular, huge scope, low-code Studio | Complexity and cost creep; overkill for one gym |
| **ERPNext** | Open source, zero licence, full data ownership, extensible doctype model | Needs technical skill to run; monolithic install |
| **Busy / Marg / Vyapar** | Cheap, Indian SMB, GST-ready | Dated; billing tools, not operations |
| **Xero** | Best-in-class bank feeds and reconciliation | Not India-first; no UPI/GST depth |

**The conclusion for OAN:** none of these is a gym system, and no gym system has real accounting. That intersection is the product — Tally-grade books underneath, gym-shaped software on top, and no accounting vocabulary anywhere a receptionist can see.

### 16.7 What this adds to the build

Additions to the earlier sections, in priority order:

1. **Always-on, non-disableable edit log** — compliance, and it upgrades the §12 audit trail from "on sensitive actions" to "on everything"
2. **Command palette (Ctrl+K)** — the single highest-leverage efficiency feature, and cheap
3. **Universal drill-down** — every figure traceable to its source document
4. **Inline "+ Add new"** in every picker
5. **Idempotency keys** on payment and check-in posting — required by offline-first
6. **Balanced-by-construction** enforcement at the posting layer
7. **Nightly integrity job** — trial balance and control-account reconciliation
8. **UPI/gateway settlement auto-match** — the modern equivalent of bank rules
9. **Period close lock**
10. **Saved views + scheduled WhatsApp report delivery**

Items 1, 5 and 6 are **architectural** — they belong in `packages/core` from the first commit. The rest can follow the demo.

---

## 17. Member 360 — profile, assessment, workout, diet, progress, reports

This is the half of the product that faces the **member**, and it's where OAN's own marketing already makes promises: *"progress tracking via body composition measurement"*, *"a diet that works with Indian food"*, *"form coaching"*, *"trainers who notice when you skip a day"* (§1). Everything below is that copy, implemented.

It is also the **retention engine**. Billing stops people leaving *quietly*; visible progress stops them wanting to.

### 17.1 What we store on a member

| Group | Fields |
|---|---|
| **Identity** | Name, photo, phone, DOB, gender, address, emergency contact, blood group, member ID + QR |
| **Membership** | Home branch, plan, start, expiry, status, assigned coach, history (§3) |
| **Health & intake** | PAR-Q answers, medical conditions, injuries, surgeries, medications, allergies, doctor clearance |
| **Lifestyle** | Occupation, sleep hours, stress level, activity level, smoking/alcohol, water intake, food preference (veg/non-veg/eggetarian/jain) |
| **Goals** | Primary goal, target weight/body fat, target date, motivation note |
| **Baseline assessment** | See 17.2 |
| **Measurements** | Time series — see 17.3 |
| **Photos** | Front/side/back, dated, consent-flagged |
| **Workout** | Assigned program, session logs, PRs — 17.4 |
| **Diet** | Assigned plan, adherence log — 17.5 |
| **Attendance** | Every check-in, streaks, gaps |
| **Financial** | Payments, dues, invoices (§14) |
| **Communication** | Every WhatsApp sent, notes from staff and coach |
| **Documents** | ID proof, signed waiver, medical clearance |

**Consent is a field, not an assumption.** Progress photos and health data are sensitive. Store an explicit consent flag and date for photos and for marketing use, and honour it — a before/after photo used in an Instagram ad without consent is a real problem, and India's DPDP Act makes it a legal one.

### 17.2 Fitness assessment

Run at joining and repeated every 4–12 weeks. It is the baseline everything else measures against, and the reassessment is a natural renewal conversation.

- **Anthropometry** — height, weight, BMI, body fat %, lean mass, visceral fat, BMR *(from an inbody/BIA machine or calipers)*
- **Circumference** — chest, waist, hip, arms L/R, thighs L/R, calves, neck. **Waist-to-hip ratio** is computed.
- **Cardio** — resting HR, BP, step test or 12-min run
- **Strength** — push-ups, plank hold, grip, estimated 1RM on bench/squat/deadlift
- **Mobility & posture** — sit-and-reach, shoulder mobility, squat screen, postural notes
- **Derived** — BMR and TDEE (Mifflin–St Jeor × activity factor), which feed the diet plan's calorie target directly

### 17.3 Measurements over time

One table, one row per measurement event: `member_id, date, type, value, unit, taken_by, branch_id`.

Keeping it as a **typed time series rather than columns** means adding a new measurement never means a schema migration, and every chart is the same query. The **Measurement Type master** (§15.3) defines name, unit, decimal places, and whether up or down is "good" — which is what lets the UI colour a change green or red without hardcoding.

### 17.4 Workout — structure and "efficiency"

**The hierarchy:**

```
Exercise (master)
   └── Program template  ("12-Week Hypertrophy", "Beginner Full Body")
         └── Day / Split  (Push · Pull · Legs)
               └── Prescribed set  (sets × reps × rest × tempo × target load or %1RM)

Assigned Program  (template snapshot on a member — never a live reference)
   └── Session log  (what actually happened)
         └── Set log  (reps, weight, RPE, per set)
```

**Exercise master** carries: name, primary and secondary muscle groups, equipment required, compound vs isolation, difficulty, instructions, image/video, common form errors.

> **Cross-module win:** the `equipment_required` field links to the Equipment master (§13). When a machine is flagged out of order, the system can flag every member whose program depends on it and suggest a substitute. Nobody else does this because nobody else has both modules in one database.

**Template snapshots matter.** An assigned program copies the template. Editing "12-Week Hypertrophy" later must not silently rewrite what 200 members were told to do — same principle as plan snapshots in §8.

**Workout efficiency — what to actually measure.** A single opaque score is useless to a coach. Track the components, and show a composite only as a headline:

| Metric | How | What it tells the coach |
|---|---|---|
| **Volume load** | Σ (sets × reps × weight), per session / week / muscle group | Is total work going up? |
| **Estimated 1RM** | Epley: `1RM ≈ w × (1 + reps/30)` | Real strength trend per lift |
| **Progressive overload** | Slope of volume or e1RM over 4 weeks | The core question of whether training is working |
| **Plan adherence** | Sessions completed ÷ prescribed | Is the member doing the program at all? |
| **Consistency** | Check-ins ÷ expected, plus longest gap | Ties to the §5 churn signal |
| **Goal progress** | Measurement delta ÷ target delta | Are they getting what they came for? |
| **Plateau flag** | No e1RM or measurement improvement in N weeks | **Triggers a coach alert** — the intervention moment |
| **Balance** | Volume by muscle group vs plan | Catches the skipped-leg-day problem |

The plateau flag is the one that earns its keep. It converts *"trainers who notice when you skip a day"* from a slogan into a queue the coach works through.

### 17.5 Diet & nutrition

```
Food master  (per 100 g / per serving: kcal, protein, carbs, fat, fibre)
   └── Meal  (a set of foods with quantities)
         └── Diet plan template  (a day's meals, by timing)
               └── Assigned diet plan  (snapshot on member, with targets)
                     └── Adherence log  (member ticks meals done)
```

- **Targets** come from the assessment — BMR → TDEE → goal-adjusted calories, then a protein/carb/fat split
- **Meal schedule** by time slot: early morning, breakfast, mid-morning, lunch, pre-workout, post-workout, evening, dinner
- **Substitutions** — each food carries alternates of similar macros, so "no paneer today" doesn't derail the plan
- **Supplement schedule** sits alongside meals — and links to the item master (§15.5), so a recommendation can become a sale
- **Adherence vs weight trend** side by side is the only honest way to have the "the diet isn't working" conversation

> **The Indian food database is the differentiator.** OAN's site literally promises *"a diet that works with Indian food."* Foreign apps offer quinoa and almond milk. Seed roti, dal, sabzi, paneer, curd, poha, idli, dosa, rajma, chole, rice varieties, ghee — with household measures (1 katori, 1 roti, 1 glass), because nobody weighs food in grams at home. This is a small dataset and a large amount of perceived quality.

### 17.6 The coach workflow

The coach app is a **queue, not a database** (§2):

1. **Today** — my clients checked in, sessions due
2. **Tap a member** → their program, last session's numbers, today's prescription pre-filled with last week's loads
3. **Log the session** — reps and weight per set, RPE, a note. Should take under 60 seconds.
4. **Flags** — my clients with plateaus, missed sessions, due reassessment, expiring memberships
5. **Update** — new measurements, adjust program, adjust diet

The prefill is the whole design. A coach who must retype last week's numbers won't log anything, and an empty log makes every metric in 17.4 worthless.

### 17.7 Printed & shareable reports

Physical, branded reports matter more in India than most software assumes — members want a diet chart on the fridge and a plan card on the gym floor. Every one of these should be **PDF, printable, and one-tap WhatsApp shareable**.

| Report | For | Contains |
|---|---|---|
| **Progress Report** ⭐ | Member, monthly/quarterly | Before/after measurements with deltas, charts, photos, attendance, strength gains, coach's note. **The flagship** — the artefact members photograph and post. |
| **Fitness Assessment Report** | Member, at join + reassessment | Full baseline, BMI/BF%, targets, coach recommendation |
| **Diet Chart** | Member, printed | Meals by timing, quantities in household measures, substitutions, water target |
| **Workout Plan Card** | Member, floor use | Day-wise exercises, sets/reps, space to write actual loads |
| **Body Composition Report** | Member | Weight, fat, lean mass trend with charts |
| **Coach Client Summary** | Coach/manager | All clients, adherence, plateaus, sessions this month |
| **PT Session Log** | Manager | Sessions delivered vs sold — feeds commission (§14) |
| **Renewal Progress Summary** | Sales | *"Here's what you achieved in 6 months"* — attached to the renewal ask |

That last one is the commercial insight: **a progress report is a renewal tool.** A member shown measured proof of progress renews at a materially higher rate than one asked cold. It connects this section directly to the §5 revenue argument.

Every report carries OAN branding, the branch, the coach's name, and a generation date.

### 17.8 Data model

```
member                     exercise                food
member_health              program_template        meal
member_goal                program_day             diet_template
assessment                 prescribed_set          diet_assignment  (snapshot)
measurement_type           program_assignment      diet_adherence_log
measurement (time series)     (snapshot)           supplement_schedule
member_photo (consented)   workout_session
                           set_log
```

Rules carried over: **snapshot on assignment** (§8), **append-only logs**, **`branch_id` on everything operational** (§8), **typed time series over wide tables** (17.3).

### 17.9 Where it lives, and who sees it

Consistent with §13 — **no new nav module.** Member training data lives on the member record as tabs: *Profile · Membership · Payments · Attendance · Progress · Workout · Diet*. The libraries (Exercise, Food, Program and Diet templates) are **master data, so they sit inside Members as Admin-only settings** — exactly like Plans. The coach app is the Members module at `assigned` scope, not a separate product.

Nav stays at **six** for an Admin, two for a coach, three for front desk.

New permissions for §12:

| Permission | Admin | Manager | Front Desk | Coach | Member |
|---|---|---|---|---|---|
| `health.view` | R all | R branch | — *(medical data)* | R assigned | R self |
| `assessment.record` | W | W | — | W assigned | — |
| `measurement.record` | W | W | — | W assigned | — |
| `workout.assign` | W | W | — | W assigned | — |
| `workout.log_session` | W | W | — | W assigned | W self |
| `diet.assign` | W | W | — | W assigned | — |
| `exercise_food.manage` (libraries) | W | — | — | — | — |
| `report.progress.generate` | W | W | R | W assigned | R self |
| `photo.view` | R ! | R branch ! | — | R assigned ! | R self |

**Front desk gets no health access at all.** Medical conditions, injuries and body-fat numbers are not counter-desk data, and treating them as ordinary member fields is the mistake to avoid.

### 17.10 Scope

This is a **large** module — comparable to the accounting layer. Sequencing:

| Phase | Build |
|---|---|
| **Demo** | Measurements + progress chart on the member profile, and one **printable Progress Report**. That alone demonstrates the whole idea. |
| **Next** | Assessment form, exercise library, program templates, assign + session logging, printable workout card |
| **Then** | Food master (Indian), diet templates, assign, adherence, printable diet chart |
| **Later** | Efficiency metrics and plateau alerts, photo comparison, member self-logging, supplement linkage |

**Not in the demo:** the exercise/food libraries. They're content, not code — and seeding a credible Indian food database is a data-entry project that shouldn't block a demo.

---

## 18. Reconciliation with Jai's GymOS ERP v2 spec

Jai pushed a 10-part enterprise specification (`GymOS_ERP_v2_Part1–10.html`, commit `c9811b8`). This section records what was taken from it, what was rejected, and why — so the decision isn't re-argued later.

### Status of that document

Roughly 440 of its numbered items are **template placeholders rather than requirements**, and it says so in its own text: FR-001–100 all read *"System shall support enterprise feature #N. (Replace with detailed requirement during later iterations.)"*; US-001–140 are *"As a user, I want capability #N…"*; BR-001–030 repeat one sentence thirty times; CL-001–040 are all *"Reusable enterprise UI component."*; and Part 7's ten screens have identical bodies.

That is scaffolding awaiting content, not a defect. The **structural** content around it is real and useful.

### Independently agreed — treat as settled

Neither document saw the other. Both landed on: **phone number as the primary search key**, **status colours reserved for membership state only**, one primary action per screen, offline attendance queue, **idempotency on payments**, immutable audit logs with no hard delete on financial data, role-based navigation, a sub-2-second interaction target, and Postgres + React + React Native.

### Adopted from Jai's spec

| Taken | Where it lands |
|---|---|
| Fuller table list — `crm_leads`, `lead_activities`, `campaigns`, `notifications`, `stock_movements`, `purchase_orders`, `progress_photos`, `equipment_issues`, `support_tickets` | Roadmap tables beyond the demo spine |
| Index strategy — `members(phone)`, `attendance(member_id,date)`, `memberships(expiry_date)`, `payments(branch_id,created_at)` | Schema, day one |
| DB standards — UUID PKs, `created_at`/`updated_at`, JSONB for flexible metadata, timezone-aware timestamps | Schema, day one |
| API standards — `/api/v1`, JWT + refresh, RFC 7807 errors, OpenAPI | API layer |
| Event names — `member.created`, `payment.success`, `attendance.checked_in` | Event bus when we add one |
| Error-code taxonomy — `RBAC_001`, `PLAN_001`, `PAYMENT_001` | API error contract |
| Design tokens — spacing and type scales | UI package |
| **Accessibility standards — WCAG AA, 44px targets, "no color-only status indicators"** | **A real gap in §13/wireframes: the green/amber/red verdict needs an icon and text label, not colour alone** |
| Security checklist — Argon2, TLS 1.3, per-org rate limiting | Deployment |
| Performance targets — check-in <1s, API <300ms p95 | Acceptance criteria |
| CI/CD stages | Repo setup |

### Rejected, with reasons

| Rejected | Why |
|---|---|
| **Multi-tenant SaaS with an `organizations` tenant root** | **DECIDED: multi-branch.** One OAN brand, many locations — see §8 and §11. This is the one place the two documents are mutually exclusive, and the multi-branch call stands. |
| **11 microservices** | One gym, two branches. A single API is the right size; microservices here is cost with no benefit. |
| **Kubernetes + Terraform** | Far beyond OAN's scale. Revisit only if this becomes a product for many gyms. |
| **AI-first as the core thesis** | AI is a strong differentiator and a weak *demo* — churn prediction on seeded data is a fabrication OAN will see through. Ship the reliable slice, earn the data, then the AI is defensible. See §11. |
| NestJS | Fastify. Less ceremony for an API this size. |
| 8 roles (adds Super Admin, Nutritionist) | 6 (§12). Super Admin is multi-tenant machinery we don't need; a nutritionist is a Coach with `diet.assign`. |

### The gap that runs the other way

Jai's spec has **no accounting layer**. Its "Finance" is flat `payments` / `invoices` / `expenses` tables — no chart of accounts, no double-entry, no deferred revenue, no branch P&L. That is the whole of §14 and §15, and the screen most likely to close the sale. It stays.

---

## Sources

**Feature sets & buying guides**
- [Essential Gym Management Software Features — WodGuru](https://wod.guru/blog/gym-management-software-features/)
- [Gym Management Software Features You Need — Glofox](https://www.glofox.com/blog/gym-management-software-features/)
- [Gym Membership Software System: Key Features — Gym Assistant](https://www.gymassistant.com/gym-membership-software-system-key-features-to-look-for/)
- [7 Essential Features in the Best Gym Management Software — ClubWise](https://www.clubwise.com/clubwise-blog/best-gym-management-software/)
- [What Is Gym Management Software? — Club Automation](https://www.clubautomation.com/resources/what-is-gym-management-software-everything-fitness-club-operators-need-to-know)
- [The 19 Best Gym Management Software for 2026 — Kisi](https://www.getkisi.com/blog/best-gym-management-systems-compared)

**India market**
- [10 Best Gym Management Software in India (2026) — Akton](https://www.akton.in/blog/10-best-gym-management-software-in-india-2026-edition/)
- [Best Gym Management Software with QR Code Check-In, India — Akton](https://www.akton.in/blog/best-gym-management-software-with-qr-code-check-in-top-10-picks-for-2026-in-india/)
- [15+ Best Gym Management Software in India — GymForce](https://gymforce.in/blog/best-gym-management-software-india-tested/)
- [Best Gym Management Software India — AdviceFit](https://advice.fit/best-gym-management-software)
- [Gym Management Software: Features, Benefits & Buying Guide — GymSathi](https://gymsathi.in/blog/gym-management-software)
- [Best Gym Management Software in 2026 — SalaryBox](https://salarybox.in/best-gym-management-software-in-2026/)
- [Why Most Gyms in India Struggle — India CSR](https://indiacsr.in/why-most-gyms-india-struggle-what-gymstart-doing-about-it/)

**Churn & retention**
- [The Guide to Reducing Churn at Your Gym — Glofox](https://www.glofox.com/blog/reducing-churn/)
- [How to Improve Gym Member Retention in 2026 — GymMaster](https://www.gymmaster.com/blog/strategies-to-improve-gym-member-retention-2026/)
- [Gym Member Retention Software to Prevent Churn — Zen Planner](https://zenplanner.com/blogs/how-to-use-gym-member-retention-software-to-prevent-churn/)
- [5 Gym Owner Struggles — Spacebring](https://www.spacebring.com/blog/productivity/gym-owner-pains)
- [Gym Membership Billing: Stop Revenue Leaks — Zenoti](https://www.zenoti.com/thecheckin/gym-membership-billing-software-guide)
- [3 Ways to Reduce Gym Churn in 2026 — PushPress](https://www.pushpress.com/blog/3-ways-to-reduce-gym-churn-in-2026)

**CRM, POS, lockers, PT**
- [Gym Lead Management & CRM — Gymdesk](https://gymdesk.com/features/lead-management)
- [Gym CRM Software — Club-OS](https://www.club-os.com/features/gym-marketing-software/)
- [CRM to Convert Prospects into Members — Wellyx](https://wellyx.com/features/lead-management/)
- [Fitness POS System — Club-OS](https://www.club-os.com/features/gym-pos-system)
- [Gym Management Locker System — Motionsoft](https://www.motionsoft.net/applications/member-management-software/locker-management-software)

**UI/UX**
- [The Gym Check-In Process Made Easy — Zen Planner](https://zenplanner.com/software-features/gym-check-ins-with-front-desk/)
- [Gym Check-In Software — Motionsoft](https://www.motionsoft.net/applications/check-in-software)
- [Fitness App UI Design: Key Principles — Stormotion](https://stormotion.io/blog/fitness-app-ux/)
- [Designing a Gym Administration App: UI/UX Case Study — Bootcamp](https://medium.com/design-bootcamp/fitness-pirates-designing-a-gym-administration-app-ui-ux-case-study-da0f7d237951)

**Tally, ERP & compliance (§15–16)**
- [TallyPrime Keyboard Shortcuts — TallyHelp](https://help.tallysolutions.com/keyboard-shortcuts-tally-prime/)
- [Audit Trail feature in accounting software from 1st April 2023 — TaxGuru](https://taxguru.in/company-law/audit-trail-feature-accounting-software-1st-april-2023.html)
- [India Audit Trail Compliance: Mandatory Since FY 2024 — India Briefing](https://www.india-briefing.com/news/india-mandates-audit-trail-compliance-for-all-companies-explainer-key-obligations-34837.html/)
- [Requirement of accounting software having audit trail — MMJC](https://www.mmjc.in/requirement-of-accounting-software-having-audit-trail-w-e-f-1-april-2023/)
- [ERPNext vs Odoo: Comprehensive Comparison](https://odoofan.substack.com/p/erpnext-vs-odoo-a-comprehensive-comparison)
- [Budget ERP Comparison: Odoo vs Zoho vs ERPNext](https://wp301redirects.com/budget-erp-comparison-odoo-vs-zoho-vs-erpnext/)
- [Bank Reconciliation — Zoho Books](https://www.zoho.com/us/books/accounting-software/bank-reconciliation/)
- [Accounting Automation — Zoho Books](https://www.zoho.com/us/books/accounting-software/accounting-automation/)
- [ERP UI/UX Best Practices — Aspirity](https://aspirity.com/blog/best-practices-erp-systems)

**Companion document**
- `Jai.Research.pdf` — independent Indian gym software market research (market sizing, competitor list, pricing bands, build cost estimates, AI-first positioning). Cross-checked in §11.

**Cross-platform stack**
- [Cross-Platform Development Tools Comparison 2026 — CodeNote](https://codenote.net/en/posts/cross-platform-dev-tools-comparison-2026/)
- [Flutter vs React Native 2026 — CatDoes](https://catdoes.com/blog/flutter-vs-react-native-2026)
- [Tauri vs Electron 2026 — Tech Insider](https://tech-insider.org/tauri-vs-electron-2026/)
- [Best Mobile Frameworks 2026 — AI Study Room](https://aidev.fit/en/compare/mobile-frameworks-comparison.html)
