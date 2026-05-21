# Colchis Food — Project Context

Next.js 16 + Prisma + Neon Postgres + Stripe storefront for a Georgian cheese creamery and bakery business. Pre-launch test mode — sandbox keys, no real orders.

## Quick commands

```bash
# Dev server
npm run dev

# Type-check (run before committing schema/major changes)
npx tsc --noEmit

# Prisma — CLI does NOT auto-load .env.local. Always prefix:
set -a; source .env.local; set +a
npx prisma migrate status         # check state
npx prisma migrate dev --name X   # create + apply migration (interactive)
npx prisma migrate deploy         # apply pending migrations (non-interactive / CI)
npx prisma generate               # regen client after schema changes

# Production build
npm run build
```

**Never** run `prisma db push` against any environment — the `prisma/migrations/` folder is the source of truth from 2026-05-22 onward. See `prisma/migrations/README.md`.

## Architecture map

```
src/
├── app/[locale]/
│   ├── (public)/         # marketing + storefront (no auth needed)
│   │   ├── shop/         # unified catalog
│   │   ├── creamery/     # cheese-only landing
│   │   ├── bakery/       # bakery-only landing
│   │   ├── cart/, checkout/, orders/[token]/
│   │   └── layout.tsx    # wraps LocationProvider + AuthProvider + Header/Footer
│   ├── (protected)/      # auth-gated by middleware
│   │   ├── admin/        # MASTER_ADMIN only
│   │   ├── portal/       # staff (PRODUCT_MANAGER, CONTENT_MANAGER, SALES)
│   │   ├── b2b-portal/   # B2B_PARTNER
│   │   ├── account/      # B2C_CUSTOMER
│   │   └── analytics/    # staff + ANALYTICS_VIEWER
│   ├── (auth)/           # login / register / B2B onboarding
│   └── layout.tsx        # locale shell, wraps CartProvider
├── components/
│   ├── admin/            # admin panel UI (InventoryClient, LocationsClient, ...)
│   ├── bakery/, shop/, checkout/, cart/, account/
│   ├── location/         # LocationPicker (Phase 1)
│   ├── layout/           # Header, Footer
│   └── ui/               # ConfirmDialog, primitives
├── providers/            # CartProvider, AuthProvider, LocationProvider
├── lib/                  # shipping, doordash, uber-direct, stripe, customer-location, ...
├── actions/, app/actions/ # server actions (CRUD, checkout, addresses, ...)
├── middleware.ts         # JWT cookie `auth_token` + role-based route gating
└── i18n/                 # next-intl routing (en, ka)
```

External integrations: Stripe (single account, payment intents + Stripe Tax), DoorDash Drive (JWT auth), Uber Direct (OAuth2), Resend (transactional email), Vercel Blob (uploads), Google Places (address autocomplete), JWT/jose for sessions.

## Channel model (Phase 1)

Two orthogonal axes:

| Concept | Values | Meaning |
|---|---|---|
| `SalesChannel` | `LOCAL_HOT`, `LOCAL_COLD`, `NATIONAL_SHIP`, `B2B_WHOLESALE`, `B2B_FROZEN` | What business line / catalog tier a SKU belongs to |
| `DeliveryMethod` (was `FulfillmentChannel`) | `UPS_2DAY`, `OWN_DELIVERY`, `DOORDASH_DRIVE`, `UBER_DIRECT`, `IN_STORE_PICKUP`, `IN_STORE_DINE_IN`, `MANUAL_DISPATCH`, marketplace variants | How an order physically moves |

Each `Product` has exactly one `salesChannel`. Each `Location` has `allowsChannels: SalesChannel[]` (which catalog tiers it carries) and a set of enabled `LocationDeliveryMethod` rows (how it ships).

**Cart rule (enforced by `LocationPicker` confirm-clear, implied by 1f catalog filter):**
- 1 cart = 1 location = 1 delivery method.
- Customer can have LOCAL_HOT + LOCAL_COLD in the same cart **if** they come from the same location.
- Switching location with a non-empty cart prompts to clear.
- `NATIONAL_SHIP` is fallback: shown when no bakery serves the customer's address; selected via the "Ship to home" picker entry.

**Customer location** lives in cookie `colchis_loc_id` + localStorage `colchis-loc-id`. Server Components read it via `getSelectedLocation()` in `src/lib/customer-location.ts`. Client uses `useLocation()` from `src/providers/LocationProvider`.

## Sandbox / test mode

No real customers or orders. All carriers + Stripe on sandbox keys. Migrations are reasonably aggressive (destructive ops OK with manual SQL) **but** treat schema changes as if they could break things — the project is the user's livelihood.

## Legacy / deprecated — avoid

- `Product.stockQuantity` (cached total) — truth is in `Stock[]` per location. Reading is fine but writing is a smell.
- `ProductChannel` table — still read by catalog UI for "offered channels" chips; **don't add new readers**. Use `Product.salesChannel` + `Location.allowsChannels` for new code. Full removal blocked on a chip-rendering refactor (Phase 1 cleanup follow-up).
- `Product.house` — **dropped** in Phase 1. `Product.kind` (`ProductKind` enum) supersedes it.
- `prisma db push` — never run it; use `migrate dev` / `migrate deploy`.
- Legacy enum value strings `UPS_GROUND_2DAY`, `HOT_DELIVERY_OWN` exist only in the Postgres enum (via `@map`) for zero-data-migration compatibility. TS code uses `UPS_2DAY`, `OWN_DELIVERY`.

## Where we are

- **Phase 1 complete** (channel model + per-SKU sales channel + ProductFamily + sticky LocationPicker + catalog filter + single-location cart + DeliveryMethod rename + Product.house drop). 9 commits, 4 migrations on `main`. See git log for details.
- **Phase 2 next**: per-location RBAC (`UserLocation` join table, `LOCATION_MANAGER` / `LOCATION_FULFILLMENT` / `B2B_SALES_MANAGER` roles) and a location portal at `/location-portal/[locationId]/{orders,menu,inventory}` for bakery staff.
- Remaining phases (per plan): Stripe Connect, UPS shipping, B2B platform overhaul (Resolve + Stripe ACH + recurring schedules), reporting/P&L dashboards.

## Pre-existing uncommitted changes — leave alone

These files have been in the working tree from earlier sessions and aren't part of Phase 1: `JournalEditorClient.tsx`, `RecipeEditorClient.tsx`, `ReviewModerationClient.tsx`, `bakery/AddressManager.tsx`, `BingSiteAuth.xml`.

---

# Project Rules (12-rule template)

These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

## Rule 1 — Think Before Coding
State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists.
Stop when confused. Name what's unclear.

## Rule 2 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

## Rule 3 — Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

## Rule 4 — Goal-Driven Execution
Define success criteria. Loop until verified.
Don't follow steps. Define success and iterate.
Strong success criteria let you loop independently.

## Rule 5 — Use the model only for judgment calls
Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

## Rule 6 — Token budgets are not advisory
Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

## Rule 7 — Surface conflicts, don't average them
If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

## Rule 8 — Read before you write
Before adding code, read exports, immediate callers, shared utilities.
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

## Rule 9 — Tests verify intent, not just behavior
Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

## Rule 10 — Checkpoint after every significant step
Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

## Rule 11 — Match the codebase's conventions, even if you disagree
Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don't fork silently.

## Rule 12 — Fail loud
"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.
