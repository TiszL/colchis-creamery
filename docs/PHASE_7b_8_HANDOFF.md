# Colchis Food — Phase 7b → 8.2 Session Handoff

> **Date**: 2026-05-12
> **Purpose**: bootstrap a fresh Claude session to continue from where this one stopped. Builds on `PHASE_7a_HANDOFF.md`.
> **Where we are**: Phase 7a (full checkout pipeline) + Phase 7b (polish: cron, tracking, lookup, reorder, cancel, refund, email) + Phase 8.1 (DoorDash Drive) + Phase 8.2 (Uber Direct) all done. UPS deferred. Next up: bug verification + Phase 9.

---

## 1. How a new session should start

1. **Read this doc first**, then `docs/PHASE_7a_HANDOFF.md` for everything pre-7b.
2. **Verify the codebase + 12 rules**:
   - `/Users/Tornike/.claude/CLAUDE.md` (global)
   - `/Users/Tornike/Desktop/Cheese/1/website/CLAUDE.md` (project)
   - `CLAUDE.local.md` (gitignored, same 12 rules)
3. **Operate against the real project root** `/Users/Tornike/Desktop/Cheese/1/website/` — NOT any `.claude/worktrees/...` directory. Worktrees can have stale uncommitted file shadows.
4. **Sanity-check environment**:
   ```bash
   cd /Users/Tornike/Desktop/Cheese/1/website
   set -a && source ./.env.local && set +a
   npx prisma generate
   npx tsc --noEmit  # should be clean
   ```
5. **Announce readiness**: "Read both handoff docs. Schema verified. Ready to continue. Confirm scope before coding."

---

## 2. Status summary (master table)

| Phase | Scope | Status | Notes |
|---|---|---|---|
| 1–6 | Foundation (locations, products, addresses, PDPs, cart UX) | ✅ | See `PHASE_7a_HANDOFF.md` §4 |
| 7a.1 | Schema + stock reservation | ✅ | `src/lib/stock-reservation.ts` |
| 7a.2 | Shipping abstraction | ✅ | `src/lib/shipping.ts` |
| 7a.3 | Cart page rewrite | ✅ | `src/components/cart/CartClient.tsx` |
| 7a.4 | Checkout UI shell | ✅ | `src/components/checkout/CheckoutClient.tsx` (later refactored — see §5) |
| 7a.5 | createCheckoutSession server action | ✅ | `src/app/actions/checkout.ts`. Uses **Path B** Stripe Tax: `tax.calculations.create` before PI |
| 7a.6 | Stripe webhook | ✅ | `src/app/api/webhooks/stripe/route.ts` — also dispatches carrier deliveries (Phase 8) |
| 7a.7 | Confirmation email | ✅ | `src/lib/email.ts → sendOrderConfirmation` |
| 7a.8 | Admin order detail | ✅ | `src/app/[locale]/(protected)/admin/orders/[id]/page.tsx` |
| **7b.1** | Reservation cleanup cron | ✅ | `src/app/api/cron/release-reservations/route.ts` + `vercel.json` cron schedule |
| **7b.2** | Customer order tracking | ✅ | `/account/orders/[id]` + shared `OrderDetailView` component |
| **7b.3** | Guest order lookup | ✅ | `/orders/[token]` signed-token public route + `src/lib/order-token.ts` |
| **7b.4** | Reorder button | ✅ | `ReorderButton.tsx` + `productForCart` helper + "Replace cart" toggle + post-reorder toast |
| **7b.5** | Cancel-within-15-min | ✅ | `cancelOrder` action + `CancelOrderButton`. Stripe refund + tax reversal + stock restore + Refund audit row |
| **7b.6** | Admin refund flow | ✅ | `refundOrder` action (full/partial) + `AdminRefundForm` + `Refund` model |
| **7b.7** | Pretty email refresh | ✅ | Hero block + stats strip + card-style fulfillments + numbered "what's next" |
| **8.1** | DoorDash Drive | ✅ | `src/lib/doordash.ts` — JWT auth, live quote, delivery creation, status webhook |
| **8.2** | Uber Direct | ✅ | `src/lib/uber-direct.ts` — OAuth2 client_credentials, deferred Elements mode for checkout |
| 8.3 | UPS | ⏭ **Skipped per user — pick up later** |
| 9+ | See §10 below | ⏭ Pending |

---

## 3. Critical recent changes you need to know

### 3.1 CheckoutClient uses Stripe Elements **deferred-payment mode** (2026-05-12 fix)

Previously the card form only appeared AFTER clicking "Place Order" (2-step flow: reserve stock first, then mount Elements with the returned clientSecret).

**Now**: `<Elements>` always wraps the checkout with `mode: 'payment'`, `amount: estimatedTotal*100`, `currency: 'usd'`. PaymentElement is mounted upfront. Customer fills card details alongside contact/address.

Single Place Order click runs three steps:
1. `elements.submit()` — validates card form client-side
2. `createCheckoutSession` — reserves stock, creates PaymentIntent
3. `stripe.confirmPayment({ elements, clientSecret })` — finalizes (handles 3DS, redirects to success)

If any step fails, surface error inline. Old 2-step pattern (`PreCheckoutButton` + `ConfirmPaymentButton`) is gone — replaced with single `PlaceOrderButton`.

**Why this matters**: don't reintroduce the conditional clientSecret render. The deferred pattern is the contract.

### 3.2 Carrier integrations — DoorDash + Uber Direct

Both follow the same shape. Each lives in its own client module:
- `src/lib/doordash.ts` — DD-JWT-V1 auth (custom HMAC-SHA256 JWT)
- `src/lib/uber-direct.ts` — OAuth2 client_credentials with cached token

Three operations per carrier:
1. **Quote**: called at cart/checkout time via `getShippingQuote` for the carrier's channel. Returns null on failure → caller falls back to `LocationChannel.flatFee`.
2. **Create delivery**: called from `handlePaymentSucceeded` in the Stripe webhook (`src/app/api/webhooks/stripe/route.ts`). Persists carrier's `external_delivery_id` to `OrderFulfillment.externalOrderId` for webhook correlation.
3. **Status webhook**: separate route per carrier (`/api/webhooks/doordash`, `/api/webhooks/uber-direct`). Verifies signature, maps event → our `OrderFulfillment.status` enum, updates.

**Both have 3-5 second timeouts on fetch** to prevent slow carriers from stalling cart UX. **Quote results cached in-memory for 5 minutes** (in `src/lib/shipping.ts`).

**Placeholder phone numbers** at quote time use the NANP-reserved test range `+15555550123` (the `+15555555555` all-fives pattern is blocklisted by DoorDash validation — verified in this session).

### 3.3 Address components plumbed everywhere

`AddressManager` exports `getActiveAddressComponents(activeAddress, userAddresses)` — resolves parsed components for either logged-in (via UserAddressDto list) or guest (via localStorage). Both `CartClient` and `CheckoutClient` call it and pass to `planFulfillment`. Uber Direct's quote API requires structured JSON addresses (not free-text), so this plumbing is required for live Uber quotes.

### 3.4 Address-list cross-tab sync

`AddressManager` uses BroadcastChannel API (`ADDRESS_BROADCAST_NAME = 'colchis-address-sync'`) to sync address list changes (add/edit/delete/setDefault) across browser tabs in real time. Active-address sync (which address is currently selected) goes through localStorage `storage` event.

### 3.5 Prisma transaction timeouts bumped to 15s

`reserveStock`, `releaseStock`, `commitStock`, `restoreStock` (all in `src/lib/stock-reservation.ts`) — plus `cancelOrder` and the order-creation transaction in `createCheckoutSession` — now use `{ timeout: 15_000 }`. Default 5s was insufficient for cold Neon connections doing sequential `findUnique + update` per cart item.

**Important**: array-form `$transaction([...])` doesn't accept `timeout` in Prisma 5.x — only the interactive form does. If you add a new multi-write transaction with risk, use `$transaction(async tx => ...)` form.

### 3.6 Order-policy constants

`src/lib/order-policy.ts` has `CANCEL_WINDOW_MS = 15 * 60 * 1000` and `PAST_CONFIRMED_FULFILLMENT_STATUSES`. Both shared between the customer order detail page (for eligibility hint) and `cancelOrder` action (for re-validation). **Don't put constants in `'use server'` files** — Next.js only allows async function exports there.

### 3.7 Hero carousel admin restored

`/admin/website/homepage` page now mounts BOTH `HomepageEditor` (text content via `home.*` SiteConfig JSON) AND `HeroMediaEditor` (carousel images, video, overlay/gradient via `hero.*` SiteConfig keys). The latter was orphan after a migration — restored in this session.

---

## 4. Open issues / known limitations

### 4.1 No real-time order updates on customer page
Customer order detail page (`/account/orders/[id]` and `/orders/[token]`) shows current status at render time. If a carrier webhook fires while the customer is on the page, they need to refresh to see the new status. **Fix candidate**: SSE or polling. Defer to Phase 9 polish.

### 4.2 spawn EBADF in dev
Long-running SSE chat streams (`/api/chat/staff/stream`) leak file descriptors under heavy hot-reload activity, eventually causing `spawn EBADF` errors that crash the dev server. **Workaround**: full restart (`pkill -f "next dev" && rm -rf .next && npm run dev`). **Fix**: add proper SSE cleanup on disconnect in the chat endpoint. Not a Phase 7/8 deliverable.

### 4.3 Carrier quote caching is per-process
In-memory `quoteCache` in `src/lib/shipping.ts` doesn't survive serverless cold starts on Vercel. Each lambda gets a fresh cache. Not a correctness issue, just an efficiency one. **Fix candidate**: Redis-backed cache.

### 4.4 No retry queue for failed carrier dispatch
If `doordashCreateDelivery` or `uberCreateDelivery` fails after payment, the order is PAID but no delivery is arranged. Admin sees the warning in logs and has to manually intervene. **Fix candidate**: admin retry button per fulfillment + cron-based auto-retry. Phase 9 admin polish.

### 4.5 Tax reversal only on full-first-refund
`refundOrder` (admin) and `cancelOrder` (customer) only call `stripe.tax.transactions.createReversal` for full first refunds. Partial refunds skip tax reversal — admin must reconcile manually in Stripe Dashboard. **Fix candidate**: implement proportional tax reversal via `flat_amount` param. Phase 9.

### 4.6 Address parsing in webhook is regex-based
`parseShippingAddress` in `src/app/api/webhooks/stripe/route.ts` parses `Order.shippingAddress` (free-text) back into components for Uber Direct delivery creation. Only handles US-formatted `"line1, city, ST zip"` from Google Places. International formats break — dispatch silently skipped with warning. **Fix candidate**: store parsed components directly on Order at create time. Phase 9 schema cleanup.

### 4.7 Marketplace `priceMultiplier` applies to live carrier prices
`LocationChannel.priceMultiplier` was designed for marketplace markup but currently multiplies live DoorDash/Uber quotes too. For your own platform (Direct/Drive), `priceMultiplier` should be `1.0`. Verify via `/admin/locations`.

### 4.8 Pre-existing lint warnings
- `src/app/[locale]/(protected)/admin/orders/page.tsx:80` — `{orders.map((order: any)` — pre-existing `any` type, not touched per Rule 3.
- Various other admin files have pre-existing `any` / unused-var warnings inherited from earlier phases. Sweep when time permits.

### 4.9 Email tax line may diverge slightly from Stripe charge
`sendOrderConfirmation` uses `Order.taxAmount` set at PaymentIntent creation. If Stripe's actual computed tax differs (rare — same address used), email shows pre-computation value. Phase 9 polish: re-fetch tax from Stripe in webhook before email.

### 4.10 Legacy `AccountAddressForm` + `updateAddressAction` are orphan
The old single-address account form was replaced with `AddressManager` in 7b. The file `src/components/account/AccountAddressForm.tsx` was deleted; `updateAddressAction` in `src/app/actions/auth.ts` was removed. Mentioning here in case anything still imports them (should be nothing).

### 4.11 Token in URL is logged
Guest order lookup URLs (`/orders/<token>`) include the signed token in the path → logged by analytics + browser history. Standard magic-link tradeoff. Mitigations: shorten expiry, scrub URLs in analytics. Phase 9+ security polish.

---

## 5. Files index — what was added/changed since 7a

### Server-only libraries (`src/lib/`)
- `cart-product.ts` — Prisma Product → cart Product serializer (used by reorder)
- `doordash.ts` — DoorDash Drive client (JWT, quote, delivery, webhook helpers)
- `uber-direct.ts` — Uber Direct client (OAuth2, quote, delivery, webhook helpers)
- `order-policy.ts` — `CANCEL_WINDOW_MS` + `PAST_CONFIRMED_FULFILLMENT_STATUSES`
- `order-token.ts` — HS256 JWT for guest order lookup (separate `ORDER_LOOKUP_SECRET`)
- `shipping.ts` — extended with carrier branches + `CustomerAddressInfo` + quote cache + parallelized planFulfillment
- `stock-reservation.ts` — added `restoreStock` + bumped all txn timeouts to 15s
- `email.ts` — added `sendOrderConfirmation` + `OrderForEmail` type + extended for lookup link

### Server actions (`src/app/actions/`)
- `checkout.ts` — `createCheckoutSession` (refactored for deferred mode)
- `orders.ts` — `cancelOrder` (customer) + `refundOrder` (admin)
- `shipping-plan.ts` — wrapper for `planFulfillment` with `customerAddressInfo` arg

### Customer routes
- `/account/orders/[id]/page.tsx` — customer order detail
- `/orders/[token]/page.tsx` — guest order lookup
- `/checkout/success/page.tsx` — Stripe `return_url` landing

### Admin routes
- `/admin/orders/[id]/page.tsx` — order detail with fulfillment status advance + refund section

### API routes
- `/api/cron/release-reservations/route.ts` — reservation cleanup cron (5-min schedule via `vercel.json`)
- `/api/webhooks/stripe/route.ts` — extended with DD + Uber dispatch
- `/api/webhooks/doordash/route.ts` — DD status updates
- `/api/webhooks/uber-direct/route.ts` — Uber status updates

### Components
- `src/components/account/AccountClient.tsx` — uses `AddressManager` (legacy `AccountAddressForm` removed)
- `src/components/account/CancelOrderButton.tsx`
- `src/components/account/OrderDetailView.tsx` — shared between customer + guest paths
- `src/components/account/ReorderButton.tsx`
- `src/components/account/SuccessClient.tsx`
- `src/components/admin/AdminRefundForm.tsx`
- `src/components/bakery/AddressManager.tsx` — extended with components helper + BroadcastChannel sync + cross-page localStorage sync
- `src/components/cart/CartClient.tsx` — toast on reorder + components passed to planFulfillment
- `src/components/checkout/CheckoutClient.tsx` — Stripe deferred Elements (see §3.1)
- `src/components/layout/ProtectedShell.tsx` — splits server/client to avoid async-Footer-in-client-component error

### Schema additions (Prisma)
- `Order.stripeTaxCalculationId`, `Order.stripeTaxTransactionId`
- `Refund` model (orderId, initiatedByUserId, amountCents, reason, notes, stripeRefundId, restoredStock, reversedTax)
- `User.refundsInitiated Refund[]`, `Order.refunds Refund[]`

### Misc
- `vercel.json` — cron schedule `*/5 * * * *` for `/api/cron/release-reservations`
- `.env.example` — documented every new env var (see §11)
- `.gitignore` — added `.claude/worktrees/`

---

## 6. Database state (live)

Run this on a new session to sanity-check:

```bash
cd /Users/Tornike/Desktop/Cheese/1/website
set -a && source ./.env.local && set +a
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  console.log({
    locations: await p.location.count(),
    products: await p.product.count(),
    users: await p.user.count(),
    addresses: await p.userAddress.count(),
    orders: await p.order.count(),
    refunds: await p.refund.count(),
    analyticsPins: await p.analyticsPin.count(),
  });
  await p.\$disconnect();
})();
"
```

Expected: ~2 locations, ~15 products, ≥1 user, 0+ orders (depends on testing), 0+ refunds, **355 analyticsPins** (B2B prospects, DO NOT TOUCH).

---

## 7. Conventions to follow (Rule 11)

Carryover from 7a + new ones:

- **'use server' files only export async functions.** Constants go in a separate lib file (see `src/lib/order-policy.ts`).
- **Money is stored as String** (Prisma convention). Parse with `parseFloat`. For cart/UI, the `Product` type has `priceB2c: number` — see `productForCart` for the coercion.
- **Carrier client modules**: always return null on failure rather than throwing. Caller decides whether to fall back. Wrap timeouts via AbortController.
- **Server pages**: use `Promise<{ ... }>` for `params`/`searchParams` (Next 16 async).
- **Deferred Stripe Elements**: always wrap CheckoutClient in `<Elements>` with `mode/amount/currency`. Don't reintroduce conditional clientSecret-based wrapping.
- **Status sources of truth**: `OrderFulfillment.status` for per-leg progress (set by carrier webhooks + admin advance buttons), `Order.orderStatus` for overall order, `Order.paymentStatus` for payment (set by Stripe webhook + cancel/refund flows).
- **Address components**: use `getActiveAddressComponents(activeAddress, userAddresses)` from AddressManager — single source of truth for parsed components.
- **Carrier external ids**: stored in `OrderFulfillment.externalOrderId`. Tracking URLs in `OrderFulfillment.trackingNumber` (slight type repurpose since carriers give URLs not numbers).
- **Refund audit rows**: every Stripe refund creates a `Refund` row. Customer-initiated cancels write `initiatedByUserId = customer's user id` with `reason: 'customer_cancellation'`. Admin refunds write `reason: 'admin_full' | 'admin_partial' | 'admin_other'`.

### Common reasoning patterns

- **Best-effort, log-on-fail**: carrier dispatch, tax reversal, email send. Each wrapped in try/catch with `console.warn`. **Never** fail the parent operation if a downstream thing breaks — the payment already succeeded.
- **Idempotency**: state-machine checks in every webhook handler (skip if already at target status, never regress DELIVERED/CANCELLED). Stripe Tax dedup via `reference` param. DoorDash dedup via `external_delivery_id`. Uber dedup via Uber's delivery id + `manifest_reference` (our order id).
- **15-min reservation TTL**: orders stuck in UNPAID/PROCESSING past the TTL get auto-cancelled by the cron. Tested with manual `reservationExpiresAt` mutation.

---

## 8. Test plans (end-to-end)

### 8.1 Happy path
1. `npm run dev` + `stripe listen --forward-to localhost:3000/api/webhooks/stripe` in two terminals
2. Add item to cart, set address, go to `/checkout`
3. Fill contact + card (test card `4242 4242 4242 4242`)
4. Click Place Order → server log shows: `[stripe-webhook] Order paid + stock committed`, `[doordash] Delivery created` or `[uber-direct] Delivery created`, `[Resend] Order confirmation sent`
5. Email arrives with "View your order" link
6. Visit link → guest order page renders. Cancel button visible if within 15 min

### 8.2 Cancel flow
1. Place an order as above
2. Within 15 min: `/account/orders/<id>` → click Cancel order → confirm → Stripe refunds, stock restored, status flips to CANCELLED
3. Verify `Refund` row created with `reason: 'customer_cancellation'`
4. `/admin/orders/<id>` → see the refund in the Refunds section

### 8.3 Admin partial refund
1. As admin, visit `/admin/orders/<id>` of a paid order
2. Refund form → pick "Partial" → enter $5.00 → check "Restore stock too" if applicable → submit
3. Verify: `Refund` row created, Order.paymentStatus stays PAID until cumulative refunds = total
4. Issue another partial → eventually order flips to REFUNDED

### 8.4 Reorder
1. Past order → click "Reorder these items →" → items added to cart at today's prices
2. Toast on `/cart`: "✓ N items added from your past order"
3. Try "Replace cart first" toggle — existing cart cleared before add
4. COMING_SOON / INACTIVE products skipped with a count hint

### 8.5 Cron cleanup
1. Start a checkout but don't complete payment (close tab after `Place order` click)
2. Order sits at PROCESSING/UNPAID with `reservationExpiresAt` set
3. Wait 15 min OR manually update `reservationExpiresAt` to past
4. `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/release-reservations`
5. Response: `{ released: 1, releasedIds: ['ord_xxx'] }`. Order now CANCELLED, stock restored.

### 8.6 Carrier webhooks (needs ngrok)
1. `ngrok http 3000` → use the URL when configuring DD + Uber webhook endpoints in their dashboards
2. Trigger a status event from carrier's sandbox (DD: "Simulate" panel; Uber: dashboard's "Advance status" button)
3. Server log: `[doordash-webhook] Fulfillment <id> CONFIRMED → OUT_FOR_DELIVERY`
4. Customer/guest order detail page reflects new status on refresh

---

## 9. Carrier setup notes (for production)

### DoorDash Drive
- Developer portal: developer.doordash.com (self-serve, instant)
- Webhook endpoint: `https://yourdomain.com/api/webhooks/doordash`
- Signing secret: same as the JWT signing_secret
- Production keys vs sandbox keys: same env vars, different values. No URL override needed (`openapi.doordash.com` serves both).

### Uber Direct
- Apply at businesses.uber.com/direct (gated approval, hours-to-days)
- API base: `https://api.uber.com` (production) or `https://sandbox-api.uber.com` (sandbox) via `UBER_DIRECT_API_BASE`
- OAuth scope: `eats.deliveries`
- Webhook endpoint: `https://yourdomain.com/api/webhooks/uber-direct`
- Webhook signing secret: separate from OAuth client_secret. Set via `UBER_DIRECT_WEBHOOK_SECRET`.

### UPS (Phase 8.3 — deferred)
- developer.ups.com (instant signup)
- 2 keys (client_id, client_secret), OAuth2 client_credentials flow
- Sandbox: `https://wwwcie.ups.com/api/`
- Rate API for quotes, Shipping API for label creation, Tracking API webhook

---

## 10. Phase 9+ plan (speculative — get user confirmation before starting)

Below is a proposed sequence based on what's deferred + obvious next steps. **Don't assume order or scope without checking with the user first.**

### Phase 9 — UPS + operational polish

- **9.1 UPS integration** — match the DoorDash/Uber shape:
  - `src/lib/ups.ts` — OAuth2 client, Rate API quote, Shipping API label creation, Tracking API webhook helpers
  - Wire `UPS_GROUND_2DAY` channel into `getShippingQuote`
  - Dispatch from Stripe webhook
  - Status webhook handler at `/api/webhooks/ups/route.ts`
  - Env vars: `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET`, `UPS_ACCOUNT_NUMBER`
  - **Key difference from DD/Uber**: UPS doesn't generate the courier — they print a label. So delivery "creation" returns a tracking number + a PDF label URL. We persist the tracking number; admin/customer can use it to track.
- **9.2 Webhook idempotency hardening**:
  - Add a small `WebhookDedupe` model (or use `WebhookEvent` table) keyed on `(provider, eventId)` for explicit deduplication. Currently relies on state-machine checks.
- **9.3 Carrier retry queue**:
  - Schema: `CarrierDispatchRetry` model with `fulfillmentId`, `nextAttemptAt`, `attempts`, `lastError`
  - Cron: `/api/cron/retry-carrier-dispatch` (every 5 min) tries failed deliveries
  - Admin UI: button per fulfillment to retry manually + see attempt history
- **9.4 Admin daily prep report**:
  - `/admin/reports/daily-prep` — shows MTO products by hour (e.g., "8-9 AM: 12 Adjaruli khachapuris to bake")
  - Powered by `OrderFulfillment.scheduledFor` + Product.kind filter
- **9.5 Partial-refund tax reversal**:
  - Update `refundOrder` and `cancelOrder` to do proportional tax reversal via `stripe.tax.transactions.createReversal({ mode: 'partial', flat_amount: ... })`
- **9.6 Store parsed address on Order**:
  - Add `shippingAddressLine1`, `shippingCity`, `shippingState`, `shippingPostalCode`, `shippingCountry` to Order schema
  - Stop regex-parsing `Order.shippingAddress` in the Uber webhook dispatch path
  - Migrate existing rows with a one-time backfill script

### Phase 10 — Marketing / CRM

- **10.1 Abandoned cart recovery**:
  - Cron at 1h / 24h / 72h checks `Cart`-like sessions (or just rely on UNPAID Orders past TTL) and sends nudge email
  - "Your basket is waiting" + items + checkout link
- **10.2 Post-purchase upsell**:
  - 7 days after DELIVERED status, send "How was it? Reorder + try X" email
  - Hooks into existing customer-order-tracking system
- **10.3 Review request**:
  - 14 days after DELIVERED, send "Leave a review" email with one-click rate links
  - Pre-existing `ProductReview` model in schema — wire to actual products
- **10.4 SEO sweep**:
  - JSON-LD already partially done (`JsonLdProduct`, `JsonLdLocalBusiness`)
  - Add `JsonLdOrder` for confirmation page? (probably not — non-indexed)
  - Sitemap regeneration for new bakery/cart/checkout routes
  - Open Graph images for shop/bakery/PDPs

### Phase 11 — B2B platform

Per the user's 7a handoff: this is a **separate closed platform** built later. Out of scope for the main B2C codebase. Don't add B2B features inline.

When/if they revisit: keep B2B contracts/leads separate from B2C orders. B2B flow is account-managed (no self-serve checkout); pricing is per-contract; payment is PO/NET-terms not credit cards.

### Phase 12 — Future expansion (speculative)

Possible items if business priorities point this way:
- **12.1 Mobile UX pass** — phone-viewport sweep of cart/checkout/order pages
- **12.2 i18n sweep** — many strings still inline English; needs systematic extraction to `messages/<locale>.json`
- **12.3 Subscription orders** — recurring delivery via Stripe Subscriptions (requires Customer + recurring PaymentMethod)
- **12.4 Loyalty program** — points per order, redeem at checkout
- **12.5 Gift cards** — issue + redeem via Stripe Issuing or homemade ledger
- **12.6 Multi-currency / multi-region** — Stripe Tax supports it; needs region detection + price-list duplication
- **12.7 Admin notes per order** — internal-only freeform field for support context

---

## 11. Env vars checklist (production)

Set ALL of these in Vercel (or your deployment env) before going live. `.env.example` documents them inline too.

### Always required
- `DATABASE_URL`, `DIRECT_URL` — Neon Postgres
- `JWT_SECRET` — session signing
- `NEXT_PUBLIC_SITE_URL` — used in emails for absolute URLs

### Stripe
- `STRIPE_SECRET_KEY` (production `sk_live_...`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (production `pk_live_...`)
- `STRIPE_WEBHOOK_SECRET` (from dashboard → webhooks → endpoint signing secret)

### Email (Resend)
- `RESEND_API_KEY`
- `EMAIL_FROM` (verified domain)
- `BAKERY_NOTIFICATION_EMAIL` (optional BCC for order confirmations)

### Order lookup (Phase 7b.3)
- `ORDER_LOOKUP_SECRET` — required in production (`order-token.ts` throws if unset). Separate from `JWT_SECRET` for blast-radius isolation.

### Cron (Phase 7b.1+)
- `CRON_SECRET` — Vercel cron sends as `Authorization: Bearer <CRON_SECRET>`

### DoorDash Drive (Phase 8.1)
- `DOORDASH_DEVELOPER_ID`
- `DOORDASH_KEY_ID`
- `DOORDASH_SIGNING_SECRET`
- `DOORDASH_API_BASE` (optional override; default `https://openapi.doordash.com`)

### Uber Direct (Phase 8.2)
- `UBER_DIRECT_CLIENT_ID`
- `UBER_DIRECT_CLIENT_SECRET`
- `UBER_DIRECT_CUSTOMER_ID`
- `UBER_DIRECT_WEBHOOK_SECRET` — separate from client_secret
- `UBER_DIRECT_API_BASE` (optional override; `https://sandbox-api.uber.com` for sandbox)
- `UBER_DIRECT_TOKEN_URL` (optional; default `https://login.uber.com/oauth/v2/token`)

### UPS (Phase 8.3 — when ready)
- `UPS_CLIENT_ID`
- `UPS_CLIENT_SECRET`
- `UPS_ACCOUNT_NUMBER`

### Other
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` — Places autocomplete + geocoding
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob for image uploads

---

## 12. Quick-fix recipes for common issues

### "Place Order button not active"
Check: contact valid? address set? plan loaded? plan has groups? all groups have a channel selected? No undeliverable items? Phase 8.1+ live quotes might be slow on first load — cache warms after 5 min.

### "spawn EBADF" in dev
```bash
pkill -f "next dev" 2>/dev/null
rm -rf .next
npm run dev
```

### "Transaction already closed" Prisma error
Check that the new code is loaded — restart dev server. If still happening, the operation may need more than 15s; bump the timeout for the specific transaction or convert to interactive form if it's array-style.

### "Cannot find name 'X'" after editing actions
`'use server'` files only export async functions. If you exported a constant, move it to a sibling lib file.

### Hot-reload doesn't pick up changes to server actions / lib files
Hard restart: `pkill -f "next dev" && rm -rf .next && npm run dev`. Turbopack cache can hold stale compiled output.

### DoorDash quote 400: "Unknown phone number format"
Use `+15555550123` (NANP-reserved test range). `+15555555555` (all fives) is blocklisted.

---

## 13. Working style the user expects (carryover from 7a doc)

- **Plan before coding** on non-trivial work. Confirm scope.
- **Sub-phase checkpoints** with: what was done, what was verified, files changed, things to flag, test plan.
- **Multiple Q-formatted questions** when decisions are needed. Default to a recommendation for each.
- **Honest "Things to flag"** sections at every checkpoint — don't hide tech debt or partial work.
- **No fluff** — concise, scannable, file paths + line numbers when relevant.
- **12 rules from CLAUDE.md** — read them at session start.

---

## 14. Starter prompt for new session

> Read `docs/PHASE_7b_8_HANDOFF.md` first (then `docs/PHASE_7a_HANDOFF.md` for full background). We're continuing Colchis Food development. Phase 7a, 7b, 8.1, 8.2 are all done. UPS (8.3) is deferred. Next probable work is Phase 9 (UPS + operational polish) but ask before assuming. Confirm you've read both docs, then propose detailed plan before any code (Rule 1).

---

## END OF HANDOFF

If anything is missing or unclear, ask the user to clarify rather than guessing. The codebase is rich — when in doubt, grep first, then read the file. The CLAUDE.md 12 rules are not optional.
