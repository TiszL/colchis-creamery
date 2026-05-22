# Colchis Food — Project Context

Next.js 16 + Prisma + Neon Postgres + Stripe storefront for a Georgian cheese creamery + bakery + B2B wholesale business. Pre-launch test mode — sandbox keys, no real orders. Phases 1–7 of the major overhaul are landed; Phase 8 cleanup is the most recent pass.

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

**Never** run `prisma db push` against any environment — `prisma/migrations/` is the source of truth from 2026-05-22 onward. See `prisma/migrations/README.md`.

**Prisma migration gotcha:** `prisma migrate dev` is non-interactive in this environment and will refuse destructive changes. `prisma migrate diff --from-url ... --to-schema-datamodel` doesn't honor `@@map`. Workaround: hand-write the SQL into `prisma/migrations/<ts>_<name>/migration.sql` and run `prisma migrate deploy`. Phase 1h / 2a / 3a / 4a / 5a / 6a / 8a all use this pattern — examples in the migrations folder.

## Architecture map

```
src/
├── app/[locale]/
│   ├── (public)/                    # marketing + storefront (no auth)
│   │   ├── shop/, creamery/, bakery/, cart/, checkout/, orders/[token]/
│   │   ├── wholesale/apply/         # B2B partner application (Phase 6g)
│   │   └── layout.tsx               # LocationProvider + AuthProvider + Header/Footer
│   ├── (protected)/                 # auth-gated by middleware
│   │   ├── admin/                   # MASTER_ADMIN
│   │   │   ├── locations/           # Connect onboarding panel (Phase 4e) + Location CRUD
│   │   │   ├── inventory/           # Product CRUD (channel + family + packaging + COGS)
│   │   │   ├── location-staff/      # UserLocation assignments (Phase 2e)
│   │   │   ├── b2b/, b2b/dispatch/  # B2B sales overview + manual freight queue (Phase 6e/6f)
│   │   │   ├── sales-reports/       # Revenue/AR/inventory-turn dashboard (Phase 7b)
│   │   │   └── analytics-control/   # **PROSPECT MAP — DO NOT TOUCH (B2B lead-gen tool)**
│   │   ├── portal/                  # staff (PRODUCT_MANAGER, CONTENT_MANAGER, SALES)
│   │   ├── b2b-portal/              # B2B_PARTNER
│   │   │   └── schedules/           # Recurring-order schedules (Phase 6d)
│   │   ├── location-portal/[id]/    # per-bakery staff portal (Phase 2d, 3c, 7d)
│   │   │   ├── orders/              # live fulfillment queue
│   │   │   ├── menu/                # SKUs carried at this location
│   │   │   └── inventory/           # receive shipments + batch/expiry view
│   │   ├── account/                 # B2C_CUSTOMER
│   │   └── analytics/               # legacy staff analytics
│   ├── (auth)/                      # login / register / B2B onboarding
│   └── layout.tsx                   # locale shell, wraps CartProvider
├── api/
│   ├── webhooks/{stripe,doordash,uber-direct,easypost}/  # carrier + payment events
│   ├── cron/{release-reservations,recurring-orders}/      # Vercel cron
│   ├── b2b/order/                                         # B2B order placement (Phase 6c)
│   └── admin/exports/{orders,invoices,stock-movements}.csv/  # Phase 7c
├── components/
│   ├── admin/                       # InventoryClient, LocationsClient, LocationConnectPanel,
│   │                                # AnalyticsCharts (new — Phase 7), and the existing
│   │                                # AnalyticsMap/AnalyticsPinForm (prospect tool — leave alone)
│   ├── location/LocationPicker      # sticky header picker (Phase 1e)
│   ├── b2b/, bakery/, shop/, checkout/, cart/, account/, layout/, ui/
├── providers/                       # CartProvider, AuthProvider, LocationProvider
├── lib/                             # analytics, customer-location, doordash, easypost,
│                                    # location-rbac, resolve, shipping, stripe, stripe-connect,
│                                    # csv, fulfillment, stock-reservation, ...
├── actions/, app/actions/           # server actions (CRUD, checkout, inventory, b2b-leads,
│                                    # b2b-schedules, stripe-connect, ...)
├── middleware.ts                    # JWT cookie + role-based route gating (incl. location-portal)
└── i18n/                            # next-intl routing (en, ka)
```

External integrations:
- **Stripe** (single platform account + Connect Standard accounts per location since Phase 4) + Stripe Tax. Connect routing kicks in when a location's `stripeOnboardingStatus === 'complete'`.
- **DoorDash Drive** (JWT) + **Uber Direct** (OAuth2) — local hot/cold delivery
- **EasyPost** — UPS/FedEx 2-day cold-chain for `NATIONAL_SHIP` SKUs (Phase 5)
- **Resolve** (`@resolve.com`) — B2B net-terms invoicing (Phase 6). API spec verification TODOs inline in `src/lib/resolve.ts` — verify against merchant docs before going live.
- **Resend** — transactional email
- **Vercel Blob** — uploads
- **Google Places** — address autocomplete + geocoding
- **JWT/jose** — sessions (cookie `auth_token`, HS256, 7-day)

## Channel + delivery model

Two orthogonal axes — internalize this before touching cart, checkout, catalog, or admin-product code:

| Concept | Values | Meaning |
|---|---|---|
| `SalesChannel` | `LOCAL_HOT`, `LOCAL_COLD`, `NATIONAL_SHIP`, `B2B_WHOLESALE`, `B2B_FROZEN` | Catalog tier — every `Product` belongs to exactly one |
| `DeliveryMethod` (was `FulfillmentChannel`, renamed in Phase 1h via `@@map`) | `UPS_2DAY`, `OWN_DELIVERY`, `DOORDASH_DRIVE`, `UBER_DIRECT`, `IN_STORE_PICKUP`, `IN_STORE_DINE_IN`, `MANUAL_DISPATCH`, marketplace variants | How an order physically moves |

A product is available at a location when:
1. `Product.salesChannel ∈ Location.allowsChannels`
2. AND there's a `Stock` row for `(product, location)` (or `Product.isMadeToOrder = true`)
3. AND the customer's address reaches at least one of the location's enabled `LocationDeliveryMethod` rows

There is **no per-product DeliveryMethod gating** (Phase 8a dropped `ProductChannel`). Delivery methods are a property of the location, not the product.

**Cart rule (Phase 1g + 1f):**
- 1 cart = 1 location = 1 delivery method.
- `LOCAL_HOT` + `LOCAL_COLD` can coexist in one cart **if from the same location**.
- Switching location with a non-empty cart prompts confirm-clear.
- `NATIONAL_SHIP` is a fallback — only shown when no bakery serves the customer's address.

**Customer location** lives in cookie `colchis_loc_id` + localStorage `colchis-loc-id`. Server reads via `getSelectedLocation()` in `src/lib/customer-location.ts`. Client uses `useLocation()` from `src/providers/LocationProvider`.

## Inventory model (Phase 3)

- `Stock(locationId, productId, quantity, lowStockThreshold)` — cached aggregate per location. `quantity = null` means made-to-order.
- `ProductBatch(productId, locationId, lotNumber, mfgDate, expiresAt, quantity, initialQuantity)` — individual lots. Created on `receiveStockAction` (admin "Receive shipment" form).
- `StockMovement(type, quantityDelta, batchId, orderId, initiatedByUserId, reason)` — append-only audit log. Types: RECEIVE, TRANSFER_OUT, TRANSFER_IN, SALE, RESERVE, RELEASE, ADJUSTMENT, WASTE.
- D2C sales auto-consume batches FIFO (oldest expiry first) via `fifoConsumeStock` in `src/app/actions/inventory.ts`, invoked from `commitStock` on Stripe `payment_intent.succeeded`.
- **B2B sales currently bypass this** — `/api/b2b/order` still decrements `Product.stockQuantity` directly without writing `StockMovement`. Inline TODO at the decrement site. Future fix: B2B fulfillment moves per-location.

## RBAC (Phases 2 + 6)

| Role / row | Granted by | What it sees |
|---|---|---|
| `User.role = MASTER_ADMIN` (global) | direct DB | `/admin/*` + everything else (bypasses per-location checks) |
| `User.role = PRODUCT_MANAGER` / `CONTENT_MANAGER` / `SALES` | direct DB | `/portal/*` |
| `User.role = B2B_PARTNER` | self-register with AccessCode | `/b2b-portal/*` |
| `User.role = B2C_CUSTOMER` (default) | self-register | `/account/*` |
| `User.role = ANALYTICS_VIEWER` | direct DB | `/analytics` only (legacy read-only) |
| `UserLocation(role = LOCATION_MANAGER)` | `/admin/location-staff` | `/location-portal/[locationId]/*` — full edit |
| `UserLocation(role = LOCATION_FULFILLMENT)` | `/admin/location-staff` | `/location-portal/[locationId]/orders` only (status advance) |
| `UserLocation(role = B2B_SALES_MANAGER)` | `/admin/location-staff` | `/admin/b2b/*` org-wide |

Per-location row access via `requireLocationAccess(locationId, requiredRoles?)` in `src/lib/location-rbac.ts` (page-guard, redirects) or `assertLocationRole(locationId, requiredRoles)` (server actions, throws).

## B2B (Phase 6)

- Public application: `/wholesale/apply` → `B2bLead` row → admin reviews in `/admin/requests` or `/admin/b2b` → `inviteB2bPartnerAction` issues an `AccessCode` + emails partner via `sendB2bApprovalEmail`.
- Partner places order: payment method choice (`STRIPE_CARD`/`STRIPE_ACH` *not yet wired client-side* — placeholder note returned; `RESOLVE_NET_7/15/30/45` work end-to-end via the Resolve wrapper).
- `B2bPartner` row (1:1 with the User) holds operational profile + `resolveCustomerId` (just-in-time created on first net-terms order).
- `B2bInvoice` written for every net-terms order. AR aging visible at `/admin/b2b`.
- `RecurringOrderSchedule` (partner-owned, set up at `/b2b-portal/schedules`) auto-fires via hourly cron at `/api/cron/recurring-orders`.
- Manual dispatch queue at `/admin/b2b/dispatch` (MASTER_ADMIN or B2B_SALES_MANAGER): tracking# + carrier inputs, mark shipped/delivered.

## Analytics (Phase 7)

**TWO DIFFERENT THINGS — don't confuse them:**

| Path | Label in sidebar | What it is |
|---|---|---|
| `/admin/sales-reports` | "Sales & Inventory" | Phase 7 revenue/AR/inventory-turn dashboard. Driven by `src/lib/analytics.ts`. |
| `/admin/analytics-control` | "Prospect Map" | **Pre-existing** sales-pipeline tool — `AnalyticsPin` map for approaching potential B2B customers. Owned by user; **DO NOT MODIFY.** |

Analytics lib queries in `src/lib/analytics.ts`: `getRevenueSummary`, `getRevenueByLocation`, `getRevenueByDeliveryMethod`, `getTopSkus`, `getInventoryDaysOnHand`, `getArAging`. All accept window + optional locationId. Money in cents through aggregations.

CSV exports under `/api/admin/exports/{orders,invoices,stock-movements}.csv` — master-admin only, period-stamped filenames.

## Sandbox / test mode

No real customers or orders. All carriers + Stripe + Resolve on sandbox keys. Migrations are reasonably aggressive (destructive ops OK with hand-written SQL) **but** treat schema changes as if reversibility matters — the project is the user's livelihood.

## Required env vars (full list)

```
# Database (Neon Postgres)
DATABASE_URL=
DIRECT_URL=

# Auth
JWT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Carriers
DOORDASH_DEVELOPER_ID=
DOORDASH_KEY_ID=
DOORDASH_SIGNING_SECRET=
DOORDASH_WEBHOOK_AUTH=
UBER_DIRECT_CLIENT_ID=
UBER_DIRECT_CLIENT_SECRET=
UBER_DIRECT_CUSTOMER_ID=
UBER_DIRECT_API_BASE=
UBER_DIRECT_WEBHOOK_SECRET=

# Phase 5 — UPS via EasyPost
EASYPOST_API_KEY=               # EZTK… = test, EZAK… = live
EASYPOST_WEBHOOK_SECRET=
EASYPOST_API_BASE=              # optional override

# Phase 6 — Resolve B2B net-terms (VERIFY SPEC FIRST)
RESOLVE_API_KEY=
RESOLVE_WEBHOOK_SECRET=
RESOLVE_API_BASE=               # optional override

# Email + Blob + Maps
RESEND_API_KEY=
EMAIL_FROM=
BLOB_READ_WRITE_TOKEN=
NEXT_PUBLIC_GOOGLE_MAPS_KEY=

# Misc
NEXT_PUBLIC_SITE_URL=
ORDER_LOOKUP_SECRET=
CRON_SECRET=
BAKERY_NOTIFICATION_EMAIL=
```

## Legacy / deprecated — avoid

- `Product.stockQuantity` — cached total. Truth is in `Stock[]` per location. Reading is fine but writing is a smell (only `/api/b2b/order` still writes here — flagged with TODO).
- `Product.house` — **dropped** in 1i. Use `Product.kind` (`ProductKind` enum).
- `ProductChannel` — **dropped** in 8a. Use `Product.salesChannel` + `Location.allowsChannels`.
- `prisma db push` — never. Use `migrate dev` / `migrate deploy`. When `migrate dev` refuses (destructive change in non-interactive mode), hand-write the SQL.
- Legacy enum value strings `UPS_GROUND_2DAY`, `HOT_DELIVERY_OWN` exist only in the Postgres enum (via `@map`) for zero-data-migration compatibility. TS code uses `UPS_2DAY`, `OWN_DELIVERY`.
- `FulfillmentChannel` / `LocationChannel` (the type names) — renamed to `DeliveryMethod` / `LocationDeliveryMethod` in 1h via `@@map`. Postgres column / table names stayed the same; TS code uses the new names.

## Known follow-ups (not blockers)

1. **B2B fulfillment per-location**: `/api/b2b/order` decrements `Product.stockQuantity` directly. Needs to route to a target location + call `commitStock`/`fifoConsumeStock` so audit + batches work. Marked with TODO at the decrement site.
2. **Stripe Elements in B2B portal**: `STRIPE_CARD` / `STRIPE_ACH` paths return a "coming soon" note. Wire `<Elements>` in `BulkOrderClient`.
3. **Resolve API spec verification**: confirm endpoint paths, auth header, field names against the merchant's live Resolve docs. TODOs inline in `src/lib/resolve.ts`.
4. **Structured shipping address on `Order`**: 5c uses a free-text parser. Add `shippingLine1/City/State/Zip` columns + skip the parser.
5. **Cart-aware UPS parcel sizing**: 5b uses a fixed `10×8×6, 64oz` parcel for the rate quote. Sum from per-product weights once `Product.weightOz` is added.
6. **`restoreStock` audit row**: refund path adds back to `Stock.quantity` without writing an `ADJUSTMENT` movement or restoring batches.
7. **Menu enable/disable toggles** on `/location-portal/[id]/menu`: currently the presence of a Stock row = "carries this SKU"; an explicit on/off toggle would let location managers hide SKUs without losing stock counts.
8. **InventoryClient dead form fields**: `channels[]` form field still posted but server ignores it (Phase 8a). Remove the unused state in a focused lint pass.
9. **BingSiteAuth.xml** sneaked into a commit during the Phase 7 rename — harmless verification file, but trim it from history if you prefer.

## Pre-existing uncommitted changes — leave alone

These files were in the working tree from earlier sessions and aren't part of any phase here: `JournalEditorClient.tsx`, `RecipeEditorClient.tsx`, `ReviewModerationClient.tsx`, `bakery/AddressManager.tsx`.

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
