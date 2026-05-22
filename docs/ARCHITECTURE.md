# Colchis Food — Architecture

This is a slimmer companion to [`/CLAUDE.md`](../CLAUDE.md). Use this when you want the "what + why" of each subsystem; use `CLAUDE.md` for "what's the magic env-loader command" and concrete legacy lists.

## High-level

Multi-location commerce platform for a Georgian cheese creamery + bakery + B2B wholesale business. Next.js 16 (App Router) + Prisma 5 + Neon Postgres + Stripe.

Three storefronts on one codebase:
- **D2C public** — `/shop`, `/creamery`, `/bakery` — single-location cart, sticky `LocationPicker`, address-resolved fulfillment.
- **B2B partner** — `/b2b-portal/{order,schedules}` — wholesale catalog, payment-method choice (Stripe pay-now / Resolve net terms), recurring auto-orders.
- **Admin / staff** — `/admin/*`, `/portal/*`, `/location-portal/[id]/*` — MASTER_ADMIN sees everything; per-location operator roles see their location only.

## Core data model

### Channels and locations (Phase 1)

Two orthogonal axes you need to internalize:

| `SalesChannel` (what) | `DeliveryMethod` (how) |
|---|---|
| `LOCAL_HOT` | `DOORDASH_DRIVE` |
| `LOCAL_COLD` | `UBER_DIRECT` |
| `NATIONAL_SHIP` | `OWN_DELIVERY` |
| `B2B_WHOLESALE` | `UPS_2DAY` (via EasyPost) |
| `B2B_FROZEN` | `IN_STORE_PICKUP` |
| | `IN_STORE_DINE_IN` |
| | `MANUAL_DISPATCH` (B2B 3PL/freight) |
| | + 2 marketplace variants |

A `Product` has exactly one `salesChannel`. A `Location` has `allowsChannels: SalesChannel[]` plus enabled `LocationDeliveryMethod` rows. Customer sees product X at location Y when: `Product.salesChannel ∈ Location.allowsChannels` AND `Stock` exists for `(product, location)` AND customer address reaches one of the location's enabled delivery methods. **No per-product DeliveryMethod gating** (the old `ProductChannel` table was dropped in Phase 8a).

### Cart rule (Phase 1g)

One cart = one location = one delivery method. Switching location with items prompts confirm-clear. `LOCAL_HOT` + `LOCAL_COLD` may coexist in one cart **from the same location**. `NATIONAL_SHIP` is fallback — shown when no bakery serves the customer's address.

### Inventory (Phase 3)

Three tables work together:

- `Stock(locationId, productId, quantity, lowStockThreshold)` — cached aggregate per location, read by the catalog. `quantity = null` means made-to-order (no tracking).
- `ProductBatch(productId, locationId, lotNumber, mfgDate, expiresAt, quantity, initialQuantity)` — individual lots. Created via `receiveStockAction` (admin "Receive shipment" form on `/location-portal/[id]/inventory`).
- `StockMovement(type, quantityDelta, batchId?, orderId?, initiatedByUserId?, reason)` — append-only audit. Types: RECEIVE, TRANSFER_OUT, TRANSFER_IN, SALE, RESERVE, RELEASE, ADJUSTMENT, WASTE.

D2C sales auto-consume batches FIFO (oldest expiry first) via `fifoConsumeStock` in `src/app/actions/inventory.ts`, invoked from `commitStock` on the `payment_intent.succeeded` Stripe webhook. **B2B sales currently bypass this** — `/api/b2b/order` still writes `Product.stockQuantity` directly without audit. Inline TODO at the decrement site; fix lands when B2B fulfillment moves per-location.

### RBAC (Phases 2 + 6)

`User.role` is the global role (`MASTER_ADMIN | PRODUCT_MANAGER | CONTENT_MANAGER | SALES | B2B_PARTNER | B2C_CUSTOMER | ANALYTICS_VIEWER`). `UserLocation(userId, locationId, role)` adds per-location operator roles (`LOCATION_MANAGER`, `LOCATION_FULFILLMENT`, `B2B_SALES_MANAGER`). MASTER_ADMIN bypasses per-location checks entirely.

Page-guard pattern: `await requireLocationAccess(locationId, ["LOCATION_MANAGER"])` in `src/lib/location-rbac.ts` — redirects unauthorized callers to `/staff`. Server-action equivalent: `assertLocationRole(locationId, roles)` (throws instead of redirecting).

### Payments (Phase 4)

Single Stripe platform account on top, Stripe Connect Standard accounts under each location (`Location.stripeConnectAccountId`). When a location's `stripeOnboardingStatus === 'complete'`, checkout creates the `PaymentIntent` with `transfer_data.destination = accountId` so charges settle to that location's connected (sub-LLC) account. Otherwise platform-charged.

Currently no `application_fee_amount` (parent LLC + sub-LLCs are the same business entity for now).

### B2B (Phase 6)

`B2bPartner` is 1:1 with the `B2B_PARTNER` `User`. Holds the operational profile + `resolveCustomerId` (just-in-time-created on first net-terms order) + assigned sales manager + default warehouse.

Payment choice at order time:
- `STRIPE_CARD` / `STRIPE_ACH` — pay-now via Stripe. **Currently stubbed** in client — Elements integration in the B2B portal is the next focused follow-up.
- `RESOLVE_NET_{7|15|30|45}` — wraps the Resolve API. Creates a `B2bInvoice` row + a Resolve charge with hosted invoice URL. Spec verification TODOs inline in `src/lib/resolve.ts`.

`RecurringOrderSchedule` lets partners set up "every Tuesday: cart" patterns. Hourly cron at `/api/cron/recurring-orders` (configured in `vercel.json`) fires due schedules.

Manual freight dispatch at `/admin/b2b/dispatch` — ops adds tracking# + carrier and marks shipped. Sales overview at `/admin/b2b` shows pipeline + AR aging.

### Analytics (Phase 7)

Two unrelated dashboards — don't confuse them:

| Path | Sidebar label | What it is |
|---|---|---|
| `/admin/sales-reports` | "Sales & Inventory" | Revenue / AR / inventory-turn / top SKUs. Driven by `src/lib/analytics.ts`. |
| `/admin/analytics-control` | "Prospect Map" | **Pre-existing** B2B lead-gen tool — `AnalyticsPin` map for approaching potential wholesale customers. Owned by the user; do not modify. |

CSV exports under `/api/admin/exports/{orders,invoices,stock-movements}.csv` — master-admin only, period-stamped filenames.

## Integrations

| Service | Purpose | Required env |
|---|---|---|
| **Stripe** | payments + Stripe Tax + Connect | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| **DoorDash Drive** | local hot/cold delivery (JWT auth) | `DOORDASH_DEVELOPER_ID`, `DOORDASH_KEY_ID`, `DOORDASH_SIGNING_SECRET`, `DOORDASH_WEBHOOK_AUTH` |
| **Uber Direct** | local delivery (OAuth2) | `UBER_DIRECT_CLIENT_ID`, `UBER_DIRECT_CLIENT_SECRET`, `UBER_DIRECT_CUSTOMER_ID`, `UBER_DIRECT_WEBHOOK_SECRET` |
| **EasyPost** | UPS/FedEx 2-day cold-chain shipping for `NATIONAL_SHIP` | `EASYPOST_API_KEY`, `EASYPOST_WEBHOOK_SECRET` |
| **Resolve** | B2B net-terms invoicing | `RESOLVE_API_KEY`, `RESOLVE_WEBHOOK_SECRET` |
| **Resend** | transactional email | `RESEND_API_KEY`, `EMAIL_FROM` |
| **Vercel Blob** | uploads | `BLOB_READ_WRITE_TOKEN` |
| **Google Places** | address autocomplete + geocoding | `NEXT_PUBLIC_GOOGLE_MAPS_KEY` |
| **Neon Postgres** | database | `DATABASE_URL`, `DIRECT_URL` |

Webhook endpoints all live under `/api/webhooks/` (`stripe`, `doordash`, `uber-direct`, `easypost`). Each verifies signature with its service's signing secret. Same `/api/webhooks/stripe` endpoint handles both platform `payment_intent.*` and Connect `account.updated` / `payout.*` events.

## What's pending before production

These are documented in `CLAUDE.md` (and inline TODOs) under "Known follow-ups":

1. B2B fulfillment per-location (audit gap)
2. Stripe Elements in B2B portal (pay-now currently stubbed)
3. Resolve API spec verification (endpoint paths + auth)
4. Structured shipping address columns on `Order`
5. Cart-aware UPS parcel dimensions
6. `restoreStock` audit row on refunds
7. Menu enable/disable toggles on location portal
8. Pre-existing lint debt (562 issues, none from the overhaul)

None of these block first customer dollars in sandbox mode. All block production traffic to some degree depending on the path.
