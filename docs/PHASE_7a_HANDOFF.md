# Colchis Food — Phase 7a Session Handoff

> **Purpose**: bootstrap a fresh Claude session to continue development from **Phase 7a.4** without losing context.
>
> **Where we are right now**: Phase 7a.1, 7a.2, 7a.3 + an admin UX fix are complete. Ready to start **7a.4 (checkout flow + Stripe Elements)**.

---

## 1. How a new session should start

1. **Read this whole doc first.**
2. **Read these files in order** (they encode current state + conventions):
   - `/Users/Tornike/.claude/CLAUDE.md` and `/Users/Tornike/Desktop/Cheese/1/website/CLAUDE.md` — **12 rules. Follow them strictly.**
   - `CLAUDE.local.md` — personal project rules (gitignored, same 12 rules in this project)
   - `prisma/schema.prisma` — current DB schema
   - `package.json` — stack + Prisma seed config
3. **Verify environment**:
   ```bash
   cd /Users/Tornike/Desktop/Cheese/1/website
   set -a && source ./.env.local && set +a
   npx prisma generate
   npx tsc --noEmit  # should be clean
   ```
4. **Announce readiness** to the user: "Read the handoff doc. Schema verified. Ready to plan Phase 7a.4 (checkout flow). Confirm scope before coding."

---

## 2. About the project

- **Brand**: Colchis Food (also referred to as Colchis Creamery in some places). Georgian artisanal cheese + bakery e-commerce.
- **Location**: Dublin, Ohio. Pre-incorporation, owner = Tornike.
- **Repo**: `/Users/Tornike/Desktop/Cheese/1/website` (git origin `https://github.com/TiszL/colchis-creamery.git`)
- **Stack**: Next.js 16 (App Router + Turbopack), Prisma 5.22, PostgreSQL on Neon, TypeScript, Tailwind v4, next-intl, Stripe, Resend (email), `@vis.gl/react-google-maps`, Vercel Blob (image storage), JOSE (auth).
- **Auth**: custom JWT-based session in `src/lib/session.ts`, accessed via `getSession()`. Role-based: `MASTER_ADMIN`, `B2C_CUSTOMER`, `B2B_PARTNER`, etc.
- **Dev workflow**: `npm run dev` (uses Turbopack). DB synced via `prisma db push` (no migration history — schema-first).

### Worktree note
The user sometimes opens Claude inside a git worktree under `.claude/worktrees/...`. **Always operate against the real project root** `/Users/Tornike/Desktop/Cheese/1/website/` for file edits — worktrees can have stale uncommitted file shadows.

---

## 3. Business model (user-provided, critical)

### Locations (data in `Location` table, seeded)

| Location | Type | Address | Coords (approx) | Purpose |
|---|---|---|---|---|
| Bakery — Dublin OH | `BAKERY` | 84 N High St, Dublin OH 43017 | 40.0992, -83.1141 | Hot food (made-to-order) + frozen storage + customer-facing pickup |
| Cold Warehouse — Dublin OH | `D2C_COLD_WAREHOUSE` | 5300 Frantz Rd, Dublin OH 43017 (fake testing address) | 40.0856, -83.1311 | Creamery cheese cold-chain shipping via UPS |

### Channels (FulfillmentChannel enum)

| Channel | Configured at | Use case |
|---|---|---|
| `UPS_GROUND_2DAY` | Cold Warehouse | **Cold-chain cheese ONLY** (creamery). Never hot food. Never frozen bakery. ~20-hour drive radius from Columbus OH (≈1200mi). Insulated cold packaging. |
| `HOT_DELIVERY_OWN` | Bakery | Bakery's own driver fleet, **hot food only**. 12-mile radius (~40 min delivery window in suburban traffic). |
| `DOORDASH_DRIVE` | Bakery | DoorDash Drive API (your platform). Hot food + frozen bakery + local creamery. 20mi radius. |
| `UBER_DIRECT` | Bakery | Uber Direct API (your platform). Same coverage as DoorDash. 20mi radius. |
| `IN_STORE_PICKUP` | Bakery | Customer collects from the bakery. Any product stocked there. |
| `IN_STORE_DINE_IN` | Bakery | Eat at bakery (Hot Adjaruli Khachapuri). **NOT cart-orderable** — filtered by `cartEligibleChannels` helper. |
| `DOORDASH_MARKETPLACE`, `UBER_EATS_MARKETPLACE` | Reserved for future (when listed on their consumer apps with 25-30% commission). Not used in 7a. |

### Product kinds (`ProductKind` enum)
`CREAMERY_CHEESE`, `CREAMERY_BUTTER`, `CREAMERY_SPREAD`, `CREAMERY_OTHER` — all stocked at Cold Warehouse, ship UPS.
`BAKERY_HOT`, `BAKERY_FROZEN`, `BAKERY_PASTRY`, `BAKERY_BREAD` — all stocked at Bakery.

### Channel × product-kind rules (encoded in DB via `ProductChannel` rows + `LocationChannel` rows)
- **UPS**: ONLY for creamery cheese. Cold Warehouse is the only location that offers UPS. So even if admin checks UPS for a hot bakery product (now warned in admin UI), the algorithm can never route via UPS because the Bakery doesn't have a UPS pickup configured.
- **Hot Adjaruli Khachapuri** is a special case: configured with ONLY `[IN_STORE_PICKUP, IN_STORE_DINE_IN]` — signature dine-in dish, not delivered.
- **Other hot bakery items**: `[HOT_DELIVERY_OWN, DOORDASH_DRIVE, UBER_DIRECT, IN_STORE_PICKUP, IN_STORE_DINE_IN]`.
- **Frozen bakery 2-packs**: `[DOORDASH_DRIVE, UBER_DIRECT, IN_STORE_PICKUP]` (no UPS — they're local-only).
- **Creamery**: `[UPS_GROUND_2DAY]` by default; admin can add DD/Uber/Pickup if also stocked at Bakery.

### User's Phase 7 design decisions (Q1–Q8 verbatim summary)

1. **Q1 Multi-fulfillment carts** → Split. One Order, multiple `OrderFulfillment` rows (one per group). Customer sees breakdown.
2. **Q2 Guest checkout** → Allowed. Collect email + phone. Create `User` row with `passwordHash: null`. On later signup with same email, merge history.
3. **Q3 Tax** → Stripe Tax (automatic).
4. **Q4 Shipping cost** → Live carrier API quotes for production-ready. For Phase 7a (no carrier keys yet), fall back to `LocationChannel.flatFee` via the existing abstraction. Phase 8 swaps internals.
5. **Q5 Stock reservation timeout** → 15 minutes.
6. **Q6 MTO outside hours** → Allow ordering with explicit "scheduled" UX. Collect preferred pickup/delivery time. (`OrderFulfillment.scheduledFor` field).
7. **Q7 Address required at checkout** → Yes. Items undeliverable to chosen address are blocked and excluded from totals.
8. **Q8 Free shipping** → Only on **UPS-only carts ≥ $100**. Mixed carts pay full shipping. (Implemented in `applyFreeShippingRule`.)

### Other user preferences (from conversation history)
- **Conversion-first product visibility**: products always visible to guests and pre-address users. No hard gate. Soft chip: "Browse freely · Add your address to confirm delivery." Cart shows all items + flags undeliverable per address. Checkout enforces address.
- **Multi-address management for logged-in users**: implemented via `UserAddress` model + `AddressManager` component. Auto-pick default on load; "Switch" reveals picker; "+ Add new" with Places autocomplete + map-pin fallback.
- **Map pin picker fallback**: reverse-geocode on click when Places autocomplete fails. In `AddressManager.tsx`.
- **Card-level quantity stepper + Add button** on both `/bakery` and `/shop` for mobile-friendly shopping without leaving the page.
- **Per-card states** (mutually exclusive): `Normal` / `dineInOnly` / `outOfRange` / `soldOut` / `comingSoon` — each gets distinct UI.
- **Don't auto-switch active address** when adding a new one (except first). Logged-in users can save multiple addresses without each hijacking the active selection.

### Things the user explicitly does NOT want
- B2B is **out of scope for 7a–8**. The user is building a separate closed B2B platform (Phase 11+). Don't conflate.
- Don't filter products by stock in availability action (separate "out of stock" from "out of range" — both shown, both clear).
- Don't auto-fix or refactor pre-existing lint errors/warnings (Rule 3 — surgical changes only).

---

## 4. Phases completed (1–6 + 7a.1–7a.3)

### Phase 1 — Multi-location foundation
**Schema additions**: `Location`, `LocationChannel`, `Stock`, `ProductChannel`, `OrderFulfillment`, `OrderFulfillmentItem`. Enums: `LocationType`, `FulfillmentChannel`, `ProductKind`. New `Product` fields: `kind`, `isMadeToOrder`. New `Order` fields: `shippingLat`, `shippingLng`.
**Seeds**: `prisma/seed-locations.ts` creates Bakery + Cold Warehouse with channels. Backfills `Stock` rows for existing creamery products at Cold Warehouse. Backfills `ProductChannel(UPS_GROUND_2DAY)` for them.

### Phase 2 — Admin `/admin/locations`
Files: `src/app/[locale]/(protected)/admin/locations/page.tsx`, `src/components/admin/LocationsClient.tsx`. CRUD with Google Places autocomplete address entry. Per-channel editor (radius, drive-hours, fees, price multiplier, on/off). Added "Locations" link to `AdminSidebar.tsx`.

### Phase 3 — Admin product editor extension
Extended `src/components/admin/InventoryClient.tsx` with: `kind` selector, `isMadeToOrder` toggle, fulfillment channels checkboxes, per-location stock editor. Filter tabs (All / Creamery / Bakery). Server actions in `src/app/[locale]/(protected)/admin/inventory/page.tsx`. Also consolidated to shared `src/app/actions/products.ts` (also used by `/portal/products` and `/portal/products-b2b`).

### Phase 4 — Bakery products migrated to DB
`prisma/seed-bakery-products.ts` creates 10 bakery products tied to the Bakery location:
- 6 hot khachapuris (`BAKERY_HOT`, `isMadeToOrder=true`, stock=null/MTO). Adjaruli has `IN_STORE_*` only; others have hot delivery + DD + Uber + in-store.
- 4 frozen 2-packs (`BAKERY_FROZEN`, `isMadeToOrder=false`, initial stock 15–20). Channels: DD + Uber + in-store.

`/bakery` route updated: `page.tsx` queries Product table, passes to `BakeryClient.tsx`. Card images now actually render (was a `[ name photo ]` placeholder bug). Marketing copy updated to remove "50 states · UPS Ground" (frozen is local-only).

### Phase 5 + 5.5 — Customer address gate + multi-address
- `src/app/actions/bakery-availability.ts`: `getAvailableBakeryProducts(lat, lng)` returns deliverable products grouped by reachability.
- `src/app/actions/creamery-availability.ts`: same for creamery.
- `src/components/bakery/AddressManager.tsx`: unified address UX. Guest (localStorage) + logged-in (DB-backed `UserAddress`). Includes `MapPinPicker` for fallback. Used on `/bakery`, `/shop`, `/cart`, `/bakery/[slug]`, `/shop/[productId]`.
- `src/app/actions/addresses.ts`: `getMyAddresses`, `saveMyAddress` (returns `{ ok, address } | { ok, error }`), `deleteMyAddress`, `setDefaultAddress`. Backfills legacy `UserProfile.shipping*` on first read.
- Schema: `UserAddress` model (multi-address per user with lat/lng + googlePlaceId + isDefault flag).
- `src/lib/distance.ts`: Haversine helper.

### Phase 6 — PDPs + card-level cart UX
- `src/app/[locale]/(public)/bakery/[slug]/page.tsx` + `src/components/bakery/BakeryPdpClient.tsx`: bakery PDP with address-aware channel filter, cart-aware Add button, reviews, related products.
- `src/components/shop/CreameryDeliveryOptions.tsx`: address-aware delivery options section for creamery PDP, dropped into existing `/shop/[productId]/page.tsx`.
- `src/components/shop/ProductCard.tsx`: rewrote as client component with card-level stepper + Add.
- `src/components/shop/CreameryClient.tsx`: full refactor — AddressManager + planFulfillment + per-product state (normal/dineInOnly/outOfRange/soldOut) + retail tab gating + multi-bakery source attribution.
- `src/components/bakery/BakeryClient.tsx`: same conversion-first refactor (merge availability into static list, don't filter; show all products with per-card state badges).
- `src/lib/fulfillment.ts`: `cartEligibleChannels()` helper (filters IN_STORE_DINE_IN).
- Schema: `Product.nameKa`, `Product.tag` added. Bakery menu migrated from SiteConfig JSON to real Product rows (admin banner now redirects).

### Phase 7a.1 — Schema + stock reservation core
**Schema additions** (live in DB):
```
Order:
  subtotalAmount    String?
  shippingAmount    String?
  taxAmount         String?
  guestEmail        String?
  guestPhone        String?
  scheduledFor      DateTime?
  reservationExpiresAt DateTime?
  stripePaymentIntentId String? @unique  (idempotency)

OrderFulfillment:
  scheduledFor   DateTime?
  packagingType  String?    ("INSULATED_COLD_CHAIN" | "HOT_INSULATED" | "AMBIENT")
```

**New file**: `src/lib/stock-reservation.ts` — three operations, all atomic via `prisma.$transaction`:
- `reserveStock(items)` — verifies and increments `reservedQuantity`. Returns `{ ok }` or `{ ok: false, error, failingItem }`. MTO products bypass quantity gate.
- `releaseStock(items)` — decrements `reservedQuantity`. Clamps to 0 with `console.warn` if over-released.
- `commitStock(items)` — decrements both `quantity` and `reservedQuantity` (payment-success path).

**Verified**: sanity-tested against live DB. Reserve+release+commit cycle works. Over-reserve fails cleanly with friendly message.

### Phase 7a.2 — Shipping abstraction
**New file**: `src/lib/shipping.ts` (server-only module, do NOT import from client components):
- `getShippingQuote({ locationId, channel, customerLat, customerLng, productKind })` → `ChannelQuote | null`. Today reads `LocationChannel.flatFee` (or `perMileFee × distance`). Phase 8 swaps internals to real carrier APIs without touching callers.
- `planFulfillment(items, customerLat, customerLng)` → `{ groups, undeliverableItems, hasUndeliverable }`. Groups cart items by source location. Each group has `availableChannels: ChannelQuote[]` sorted cheapest-first. Reason classification on undeliverable: `"Out of stock"` | `"Not deliverable to your address"` | `"No supported delivery method..."` | `"Dine-in only"` | `"Not stocked at any location yet"`.
- `applyFreeShippingRule(selectedQuotes, cartSubtotal)` — implements Q8 (UPS-only AND ≥$100 → zero UPS shipping).
- `freeShippingProgress(plan, cartSubtotal)` — returns hint data, only when UPS-only plan is achievable.

**Wrappers in** `src/app/actions/shipping-plan.ts` (`'use server'`) — these are what client components import.

**Verified**: sanity-tested with 3 carts (mixed bakery+creamery from Dublin OH; low-stock; Hawaii) — all three reasons surface correctly. Typecheck + lint clean.

### Admin UX fix (intermediate)
Added per-channel "Offered by: X" hints in the `/admin/inventory` drawer + an amber "⚠ Configured but not actionable" warning when a checked channel has no stocked location offering it. Auto-suggests where to stock the product. Touched: `src/components/admin/InventoryClient.tsx` + 3 page.tsx files that load locations (admin/inventory, portal/products, portal/products-b2b).

### Phase 7a.3 — Cart page rewrite
- `src/app/[locale]/(public)/cart/page.tsx` is now a **server component** that loads session + addresses
- `src/components/cart/CartClient.tsx` (new): preserves existing visual (banner + items list + sticky summary + Promise card) and adds:
  - `AddressManager` at top of items column
  - Live `planFulfillment` call when items or address change
  - Per-item deliverability state (red bg + ⚠ inline reason for undeliverable items)
  - Fulfillment plan preview ("Your order will ship as 2 fulfillments — Bakery · DOORDASH DRIVE · $7.00")
  - Free-shipping progress (uses Q8 rule, $100/UPS-only)
  - Shipping math via `applyFreeShippingRule(cheapestQuotes, subtotal)`
  - "Proceed to checkout" button disabled when `hasUndeliverable` (greys to "Remove undeliverable items")

**Verified**: Typecheck + lint clean.

---

## 5. Current Phase 7a status

| Sub-phase | Status | Notes |
|---|---|---|
| 7a.1 Schema + reservation | ✅ Done | Live in DB |
| 7a.2 Shipping abstraction | ✅ Done | flatFee-based; Phase 8 swaps to live APIs |
| Admin UX channel↔location hints | ✅ Done | Intermediate, between 7a.2 and 7a.3 |
| 7a.3 Cart page rewrite | ✅ Done | Uses AddressManager + planFulfillment |
| **7a.4 Checkout flow + Stripe Elements** | **⏭ NEXT** | This handoff doc is the trigger |
| 7a.5 createCheckoutSession server action | Pending | Reserves stock, creates Order rows, returns Stripe clientSecret |
| 7a.6 Stripe webhook handler | Pending | Commits/releases stock based on payment events |
| 7a.7 Basic order confirmation email | Pending | Resend already wired |
| 7a.8 Admin orders detail enhancement | Pending | Show fulfillments + manual status updates |

---

## 6. Phase 7a.4 — Detailed scope (START HERE)

### Goal
Build the customer-facing checkout flow. Customer reaches `/checkout` from `/cart` → completes a multi-step form (address + delivery method per group + payment via Stripe Elements) → on "Place Order", calls `createCheckoutSession` (built in 7a.5) → Stripe Elements confirms payment → redirect to order confirmation.

### Files to create

1. **`src/app/[locale]/(public)/checkout/page.tsx`** (server component)
   - Loads session + addresses (mirror `/cart/page.tsx`)
   - Reads `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` from env
   - Passes `apiKey`, `stripePublishableKey`, `isLoggedIn`, `userAddresses`, `locale` to client component
   - Redirect to `/cart` if cart is empty (cart is client-side, so this might need to be a soft client-side redirect — see implementation note below)

2. **`src/components/checkout/CheckoutClient.tsx`** (client component, main UX)
   - Uses `useCart()` for items
   - State machine with 3 steps OR single-page progressive form (user preference — start with single-page progressive):
     - **§1 Contact + address**: name (if not logged in), email, phone, `AddressManager` for shipping address
     - **§2 Per-fulfillment-group delivery method**: for each group from `planFulfillment`, radio of `availableChannels` with quoted cost. For MTO items outside bakery `Location.hours`, time picker prefilled with next-open-slot.
     - **§3 Review + Payment**: order summary, Stripe `PaymentElement` (handles card + 3DS), "Place Order" button
   - Calls `createCheckoutSession` server action (built in 7a.5) when user submits
   - Handles `clientSecret` response: confirms payment with Stripe Elements
   - On success: redirect to `/account/orders/[id]` (or similar — confirmation page is part of 7a.8)

3. **`src/lib/stripe.ts`** — already exists (Stripe SDK init). Verify it exports a `stripe` client. If not, create it as `new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-...' })`.

4. **Optional helper**: `src/lib/bakery-hours.ts` — `isBakeryOpenNow(location, now)` + `nextOpenSlot(location, from)` reading `Location.hours` JSON.

### What this sub-phase does NOT include (deferred to 7a.5)
- The actual `createCheckoutSession` server action (creates Order rows, reserves stock, creates Stripe PaymentIntent)
- Stock validation against the chosen address (server-side)
- Stripe Tax integration on the PaymentIntent

7a.4 builds the **UI shell + form state machine + client-side validation + Stripe Elements mounting**. 7a.5 wires the server action that 7a.4's "Place Order" button calls.

### Implementation notes

- **Stripe Elements pattern**: `loadStripe(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)` once, wrap with `<Elements stripe={stripePromise} options={{ clientSecret, appearance }}>`, mount `<PaymentElement />`. Confirm with `stripe.confirmPayment({ elements, confirmParams: { return_url: '...' } })`. The clientSecret comes from 7a.5's server action — for 7a.4 use a placeholder OR mock the call to test the UI shell.
- **Single-page vs multi-step**: start with single-page progressive (all 3 sections visible, only next-enabled when prior is valid). Easier to test. Multi-step is polish.
- **Reuse `AddressManager`** — same component, no duplication. It already handles guest + logged-in flows.
- **Reuse `planFulfillment`** via `@/app/actions/shipping-plan`. The cart already shows the plan; checkout shows the same plan + lets user pick a channel per group.
- **Default channel selection**: cheapest first (already sorted in `planFulfillment` output).
- **MTO scheduled-time UI**: when product is `isMadeToOrder=true` AND current time is outside `Location.hours`, show a date+time picker. Pre-fill with next-open-slot. Persist per-fulfillment scheduledFor.
- **Guest email validation**: must be valid email + phone (some delivery APIs in Phase 8 require phone). Store in form state and pass to 7a.5.
- **Cart server-side re-validation in 7a.5**: client sends cart items + selected channels + address; server re-validates with `planFulfillment` to prevent tampering. 7a.4 just submits the form data.

### Visual style guide
Match cart page conventions:
- Background: `#F5F0E6` (cream)
- Section eyebrows: mono caps `#B96A3D` (copper), letter-spacing 0.32em
- Headings: serif italic `#1F3026` (dark green)
- Buttons (primary): bg `#1F3026`, text `#F5F0E6`, mono caps
- Cards: white bg with `#1F302622` borders
- Per-fulfillment-group cards: cream `#EAE2D2` background

### Success criteria for 7a.4
- Customer can navigate `/cart` → "Proceed to checkout" → land on `/checkout`
- Form renders with cart items in review section
- Address manager works (logged-in + guest)
- Per-group delivery method radios render with channel name + price + ETA
- MTO + outside-hours triggers the scheduled-time picker
- Stripe Elements `<PaymentElement>` mounts (visible card input)
- "Place Order" button is disabled until: address chosen + every group has a channel selected + Stripe Elements reports complete
- On click, button shows "Processing…" and (for 7a.4) optionally calls a placeholder server action that returns a mocked clientSecret OR an error string

### Open question for the user before 7a.4 coding
- **Should `/checkout` redirect to `/cart` if cart is empty, or render a "your cart is empty" state inline?** Default: server can't read localStorage cart, so this needs a client-side `useEffect` that redirects. Inline empty state is simpler. Ask the user which they prefer.

---

## 7. Phase 7a.5–7a.8 (remaining sub-phases)

### 7a.5 — `createCheckoutSession` server action
**File**: `src/app/actions/checkout.ts`
**Steps in order**:
1. Re-validate cart server-side — load products by id from DB, use real prices (never trust client-submitted prices)
2. Verify address (validate lat/lng provided OR pull from `UserAddress` by id)
3. Re-run `planFulfillment` to confirm chosen channels are still valid for the address
4. Find or create User by email (guest = `passwordHash: null`); store `guestEmail`/`guestPhone` on Order
5. **Atomically reserve stock** via `reserveStock` (already built). On failure, return `{ error, failingItem }` for the UI to surface.
6. Compute totals:
   - `subtotalAmount` = Σ (item.priceB2c × qty) (DB prices)
   - `shippingAmount` = Σ chosen channel costs (already computed in cart, but recompute server-side)
   - Apply free-shipping rule (UPS-only ≥$100 → UPS legs $0)
7. Create `Order` row with: userId, status PROCESSING, paymentStatus UNPAID, all monetary fields, `scheduledFor` (earliest across fulfillments), `reservationExpiresAt = now + 15min`
8. Create N `OrderFulfillment` rows (one per group): locationId, channel, scheduledFor, packagingType, shippingCost. Plus their `OrderFulfillmentItem` rows.
9. Create Stripe PaymentIntent with:
   ```js
   stripe.paymentIntents.create({
     amount: Math.round((subtotal + shipping) * 100), // cents — tax added by automatic_tax
     currency: 'usd',
     automatic_tax: { enabled: true },
     shipping: { name, address: { line1, city, state, postal_code, country } },
     metadata: { orderId },
     receipt_email: customerEmail,
   })
   ```
10. Update Order with `stripePaymentIntentId` (the `@unique` constraint already provides idempotency)
11. Return `{ ok: true, clientSecret, orderId }` to the client

**Error handling**: on Prisma transaction failure or Stripe error, release any partially-reserved stock and return clear error.

**Stripe Tax requires**: customer's shipping address (already collected), product tax category (skip for 7a — default category is OK), origin address (your business address — Dublin OH for now, configured in Stripe dashboard).

### 7a.6 — Stripe webhook handler
**File**: `src/app/api/webhooks/stripe/route.ts`
- POST handler
- Verifies `Stripe-Signature` header with `STRIPE_WEBHOOK_SECRET`
- Switches on event type:
  - `payment_intent.succeeded` → find Order by `stripePaymentIntentId`, set `paymentStatus=PAID`, call `commitStock(items)`, set OrderFulfillment statuses to `CONFIRMED`, trigger confirmation email
  - `payment_intent.payment_failed` / `payment_intent.canceled` → find Order, set `paymentStatus=REFUNDED` (if previously paid) or `orderStatus=CANCELLED`, call `releaseStock(items)`
  - Returns 200 on success/handled. Logs but returns 200 for unknown events.
- Idempotency: the `@unique stripePaymentIntentId` constraint on Order means duplicate webhook deliveries find the same Order. Add a check: if already PAID, skip commit; if already CANCELLED, skip release.

**Local dev setup for user**:
```bash
# Install Stripe CLI (once)
brew install stripe/stripe-cli/stripe
stripe login

# Forward webhooks to local dev
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copies printed whsec_... into .env.local as STRIPE_WEBHOOK_SECRET
```

### 7a.7 — Basic confirmation email
**File**: `src/lib/email.ts` — extend with `sendOrderConfirmation(order)`
- HTML email via Resend (already wired — see existing wholesale.ts emails for pattern)
- Plain-but-readable: order ID, items per fulfillment, totals, "We'll be in touch about delivery" placeholder. Pretty template = 7b.
- Triggered from the webhook handler on `payment_intent.succeeded`.
- Send to customer email + a BCC to bakery email (env var `BAKERY_NOTIFICATION_EMAIL`, fallback to `admin@colchiscreamery.com`).

### 7a.8 — Admin orders detail enhancement
**Files**: `src/app/[locale]/(protected)/admin/orders/page.tsx` + admin order detail page
- Per-Order: show all `OrderFulfillment` rows separately with their channel, scheduled time, status
- Manual status advance buttons per fulfillment: `PENDING → CONFIRMED → PREPARING → OUT_FOR_DELIVERY → DELIVERED`
- (Phase 8 auto-dispatches; for now admin advances manually.)

---

## 8. Phase 7b plan (after 7a complete)

Post-purchase polish:
- Customer order tracking at `/account/orders` (list) and `/account/orders/[id]` (detail)
- Guest order lookup by email + signed token (link in confirmation email)
- Reorder button
- Cancel-within-X-minutes button
- Webhook idempotency hardening (idempotency keys, dedupe table)
- Reservation cleanup cron: `/api/cron/release-reservations` — releases stock for orders past `reservationExpiresAt` still UNPAID
- Admin refund flow (Stripe partial/full refund + stock restore)
- Admin daily prep report (MTO products by hour)
- Pretty HTML email template for confirmation

## 9. Phase 8 plan (carrier integrations)

Each carrier is its own sub-phase. **Phase 7a.2's shipping abstraction is designed so this swap is internal-only** — `getShippingQuote` signature doesn't change.

### 8.1 DoorDash Drive
- Env: `DOORDASH_DEVELOPER_ID`, `DOORDASH_KEY_ID`, `DOORDASH_SIGNING_SECRET`
- Quote: POST to `/drive/v2/quotes`
- Create delivery: POST to `/drive/v2/deliveries` (called from 7a.5's order creation or via a new step)
- JWT signed with their secret
- Webhook for status updates → updates `OrderFulfillment.status`

### 8.2 Uber Direct
- Env: `UBER_DIRECT_CLIENT_ID`, `UBER_DIRECT_CLIENT_SECRET`, `UBER_DIRECT_CUSTOMER_ID`
- OAuth2 client_credentials flow → bearer token
- Quote: POST `/customers/{customer_id}/delivery_quotes`
- Create: POST `/customers/{customer_id}/deliveries`
- Webhook for status

### 8.3 UPS
- Env: `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET`, `UPS_ACCOUNT_NUMBER`
- OAuth2 client_credentials
- Rate API for quotes
- Shipping API for label creation
- Tracking API webhook for status

---

## 10. Key files index (everything new since Phase 1)

### Server-only libraries (`src/lib/`)
- `db.ts` (pre-existing — Prisma client)
- `session.ts` (pre-existing — JWT session)
- `email.ts` (pre-existing — Resend wrapper, extend in 7a.7)
- `distance.ts` — Haversine + channel-radius helpers
- `fulfillment.ts` — `cartEligibleChannels()` (filters dine-in)
- `shipping.ts` — types + pure helpers (`applyFreeShippingRule`, `freeShippingProgress`) + server-only `getShippingQuote`/`planFulfillment`. **Do NOT import from client components — use the actions wrapper instead.**
- `stock-reservation.ts` — `reserveStock` / `releaseStock` / `commitStock`
- `stripe.ts` (verify exists; init Stripe SDK)

### Server actions (`src/app/actions/`)
- `addresses.ts` — `getMyAddresses`, `saveMyAddress` (returns `{ ok, address } | { ok, error }`), `deleteMyAddress`, `setDefaultAddress`
- `bakery-availability.ts` — `getAvailableBakeryProducts(lat, lng)`
- `creamery-availability.ts` — `getAvailableCreameryProducts(lat, lng)`
- `shipping-plan.ts` — `getShippingQuote`, `planFulfillment` (server-action wrappers)
- `products.ts` — shared save/delete/quickStock product actions (used by admin + portal)
- `categories.ts`, `cms.ts`, `contact.ts`, `content.ts`, `reviews.ts`, `settings.ts`, `analytics.ts`, `auth.ts` (pre-existing)
- **`checkout.ts` → CREATE IN 7a.5**

### Customer-facing pages
- `src/app/[locale]/(public)/bakery/page.tsx` — server page loading bakery products + session + addresses
- `src/app/[locale]/(public)/bakery/[slug]/page.tsx` — bakery PDP
- `src/app/[locale]/(public)/shop/page.tsx` — creamery shop
- `src/app/[locale]/(public)/shop/[productId]/page.tsx` — creamery PDP
- `src/app/[locale]/(public)/cart/page.tsx` — cart (Phase 7a.3, server component)
- **`src/app/[locale]/(public)/checkout/page.tsx` → CREATE IN 7a.4**

### Customer-facing components
- `src/components/bakery/BakeryClient.tsx` — bakery listing client
- `src/components/bakery/BakeryPdpClient.tsx` — bakery PDP client
- `src/components/bakery/AddressManager.tsx` — **unified multi-address picker, reused everywhere**
- `src/components/shop/CreameryClient.tsx` — creamery shop client
- `src/components/shop/ProductCard.tsx` — creamery card with stepper + Add
- `src/components/shop/CreameryDeliveryOptions.tsx` — PDP address-aware delivery panel
- `src/components/shop/ProductDetailClient.tsx` (pre-existing) — `ProductGalleryNew`, `InfoPanel` for creamery PDP
- `src/components/cart/CartClient.tsx` — cart with address + plan + deliverability (Phase 7a.3)
- **`src/components/checkout/CheckoutClient.tsx` → CREATE IN 7a.4**

### Admin
- `src/app/[locale]/(protected)/admin/inventory/page.tsx` — products CRUD
- `src/app/[locale]/(protected)/admin/locations/page.tsx` — locations CRUD
- `src/app/[locale]/(protected)/admin/orders/page.tsx` — orders list (basic; enhance in 7a.8)
- `src/components/admin/InventoryClient.tsx` — product editor (with channel↔location hints + misconfig warning)
- `src/components/admin/LocationsClient.tsx` — location editor
- `src/components/admin/AdminSidebar.tsx` — nav

### Seeds (`prisma/`)
- `seed.ts` — initial data
- `seed-locations.ts` — Bakery + Cold Warehouse with channels + backfill stocks
- `seed-bakery-products.ts` — 10 bakery products with channels + stocks at Bakery

### CartProvider
- `src/providers/CartProvider.tsx` — localStorage-based cart. Mounted in `src/app/[locale]/layout.tsx`. Access via `useCart()`. Stock not enforced in cart; checkout enforces.

---

## 11. Database state (live data right now)

### Locations: 2
- Bakery — Dublin OH (active, lat 40.0992, lng -83.1141). Channels: HOT_DELIVERY_OWN (12mi, $0 flatFee — needs setting), DOORDASH_DRIVE (20mi, null fee), UBER_DIRECT (20mi, null fee), IN_STORE_PICKUP, IN_STORE_DINE_IN.
- Cold Warehouse — Dublin OH (active, lat 40.0856, lng -83.1311). Channels: UPS_GROUND_2DAY (20 drive-hours, null fee).

### Products
- 5 creamery products (`CREAMERY_CHEESE` kind, status mix of `ACTIVE`/`COMING_SOON`), stocked at Cold Warehouse, all with channel `[UPS_GROUND_2DAY]`. **Most have stockQuantity=0** (admin needs to restock or use sample stock).
- 10 bakery products (6 hot MTO + 4 frozen with stock 13-20). Hot Adjaruli has only `[IN_STORE_PICKUP, IN_STORE_DINE_IN]`; other hot items have 5 channels; frozen has 3 channels.
- Sulguni stock was decremented to 13 (was 15) during 7a.1 sanity test of `commitStock`. Document but not blocking.

### Users
- 1 MASTER_ADMIN user (email `admin@colchiscreamery.com`)
- Test/seed users from earlier development

### Schema gotcha
- `LocationChannel.flatFee` is `String?` — stringly-typed money to match `Product.priceB2c` convention. Convert with `parseFloat`. Today most are null → quotes return $0. Admin should set fees via `/admin/locations` for realistic test (suggested: Hot $5, DD $7, Uber $7, UPS $12).
- `Stock.quantity` is `Int?` — null means made-to-order at this location.
- `Stock.reservedQuantity` is `Int` (not null) — 0 default.
- `Order.userId` is required. Guests get a User row with `passwordHash: null`.

---

## 12. Conventions to follow (Rule 11)

### Server vs client split
- **`'use client'`** at top of files in `src/components/**` that need state/hooks
- **`'use server'`** at top of files in `src/app/actions/**`
- **`src/lib/`** is server-only (db access OK). NEVER import `src/lib/shipping.ts` or `stock-reservation.ts` from a client component — use the `src/app/actions/` wrappers.
- Client components import types + pure helpers from `src/lib/` (those don't trigger Prisma bundling), but async DB-touching functions only via `src/app/actions/*`.

### Server action shape
```ts
'use server';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function doSomething(formData: FormData) {
  const session = await getSession();
  if (!session?.userId) return { error: '...' };
  // ...validate, mutate, revalidate
  revalidatePath('/some/path');
  return { ok: true };
}
```

### Server page → client component split (when both server data + client state needed)
```ts
// page.tsx (server)
import { getSession } from '@/lib/session';
import SomeClient from '@/components/.../SomeClient';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  // ...load server data
  return <SomeClient locale={locale} isLoggedIn={!!session?.userId} ... />;
}
```

### Styling
- Mix of inline `style={{ ... }}` and Tailwind. Inline style dominates customer-facing pages (cream/copper palette). Admin uses Tailwind more.
- **Brand palette**:
  - Cream backgrounds: `#F5F0E6`
  - Cream-2 / sand: `#EAE2D2`
  - Dark green ink: `#1F3026`
  - Secondary green: `#2C3D33`
  - Copper accent: `#B96A3D`
  - Gold accent: `#D9A876`
  - Gray text: `#7A8278`
  - Error red: `#A8312C`
- Fonts: `var(--font-serif)` (Fraunces), `var(--font-mono)` (JetBrains Mono), `var(--font-sans)` (Inter), `var(--font-serif-ka)` (Noto Serif Georgian)
- Mono caps for labels (`fontSize: 9-11, letterSpacing: 0.22-0.32em, textTransform: 'uppercase'`)
- Serif italic for headings/product names

### Form pattern
- Server actions receive `FormData`. Manual extraction (no zod in this codebase yet).
- Client uses `useTransition` + manual `await action(fd)` (not the `<form action={}>` pattern in most places).

### Error handling pattern
- Server actions return discriminated union: `{ ok: true, ... } | { ok: false, error: string, ... }`
- UI surfaces `result.error` near the action button
- Never throw silently or return null on validation failure

---

## 13. Lessons learned / gotchas (Rule 12 — fail loud)

### Bugs encountered in this session — DO NOT REPEAT
1. **Orphan references after deletion**: when removing a variable, **grep the file first** for all references. We hit this twice: `DEFAULT_HOT` left referenced in `menu` fallback object after removing the constants; `isHot` left in breadcrumb after moving to client component.
2. **Client component importing prisma**: silently typechecks but explodes at runtime. Use `src/app/actions/*` wrappers for DB-touching async functions.
3. **Cascade backfill regression**: re-running `seed-locations.ts` after `seed-bakery-products.ts` was overwriting bakery products' `kind` field back to default. Fixed with "default-only" guard: only update kind if existing kind is `CREAMERY_CHEESE` (the schema default).
4. **0-stock products triggered "out of range" banner**: availability action used to skip 0-stock products → empty result → false "out of delivery range" message. Fixed: don't skip 0-stock products; let UI distinguish "Sold out" / "Coming Soon" from "Out of range". `noCoverage` now uses `inServiceArea` flag, not product count.
5. **Address validation silent failure**: `saveMyAddress` used to return null when ZIP was missing from Places result. UI showed nothing. Fixed: changed return shape to `{ ok, error }` + relaxed validation (lat/lng required; ZIP optional).
6. **Auto-switching active address after save**: confused users who wanted to save additional addresses for later use. Fixed: only auto-select on first-address save; otherwise keep current active.

### Pre-existing issues NOT to touch (Rule 3)
- `src/components/admin/BakeryPageEditor.tsx` has 13 `react-hooks/static-components` errors from `SaveBtn` and `Section` helper components declared inside the parent. Pre-existing; not in this development scope.
- Several `any` types in untouched render code in `/shop/page.tsx` and similar — left alone per Rule 11.

### Schema gotchas
- Money is stored as `String` everywhere (`Product.priceB2c`, `LocationChannel.flatFee`, `Order.totalAmount`, etc.). Parse with `parseFloat()`. Display with `formatCurrency()` from `src/lib/utils.ts`.
- `Product.house` and `Product.stockQuantity` are LEGACY fields kept during migration. `house` is superseded by `kind`. `stockQuantity` is denormalized cache (sum of Stock rows). Don't reintroduce dependencies on them; the new code reads from `kind` and `Stock[]`.
- `Order.userId` is required, so guests need a User row (we create with `passwordHash: null`).

---

## 14. Environment status

### Configured in `.env.local`
- `DATABASE_URL` + `DIRECT_URL` — Neon Postgres
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` — Places + Geocoding APIs enabled
- `STRIPE_SECRET_KEY` (`sk_test_...`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_...`)
- `STRIPE_WEBHOOK_SECRET` — **set when 7a.6 begins**, user runs `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and pastes the printed `whsec_...`
- Resend env vars for email (pre-existing)

### Coming for Phase 8 (user signing up)
- `DOORDASH_DEVELOPER_ID`, `DOORDASH_KEY_ID`, `DOORDASH_SIGNING_SECRET` — DoorDash sandbox in progress
- `UBER_DIRECT_CLIENT_ID`, `UBER_DIRECT_CLIENT_SECRET`, `UBER_DIRECT_CUSTOMER_ID` — Uber Direct sandbox, user picking "3PL Consumer APIs" suite
- `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET` — deferred per user

### Dev server
- `npm run dev` (Turbopack). Restart after Prisma schema changes.
- Loading env: many commands need `set -a && source ./.env.local && set +a` prefix because the Prisma CLI doesn't auto-load `.env.local`.

---

## 15. CLAUDE.md rules (12-rule template — user enforces strictly)

The user has the 12 rules in their global `~/.claude/CLAUDE.md`, the project `CLAUDE.md`, and `CLAUDE.local.md`. Re-read all three on session start. Highlights:

- **Rule 1 — Think before coding**: state assumptions; ask if uncertain; present multiple interpretations; push back on overcomplicated approaches
- **Rule 2 — Simplicity first**: minimum code; no speculative abstractions
- **Rule 3 — Surgical changes**: touch only what's necessary; don't refactor adjacent code; match existing style
- **Rule 4 — Goal-driven execution**: define success criteria, loop until verified
- **Rule 5 — Use the model only for judgment calls**: not for deterministic transforms
- **Rule 6 — Token budgets**: 4k per task, 30k per session. Surface breaches.
- **Rule 7 — Surface conflicts, don't average**: pick the more recent/tested pattern
- **Rule 8 — Read before write**: read exports, callers, shared utilities
- **Rule 9 — Tests verify intent, not just behavior**
- **Rule 10 — Checkpoint after every significant step**: summarize what's done, verified, left
- **Rule 11 — Match codebase conventions** even when you disagree
- **Rule 12 — Fail loud**: surface uncertainty; never silently skip

### Working style the user expects
- **Plan before coding** on non-trivial work. Confirm scope.
- **Sub-phase checkpoints** with: what was done, what was verified, files changed, things to flag, test plan.
- **Multiple Q-formatted questions** when decisions are needed. Default to a recommendation for each.
- **Honest "Things to flag"** sections at every checkpoint — don't hide tech debt or partial work.
- **No fluff** — concise, scannable, file paths + line numbers when relevant.

---

## 16. Carrier API walkthrough notes (when Phase 8 starts)

Already explained to user (don't repeat unless asked):

### DoorDash Drive
- Sandbox at developer.doordash.com, self-serve
- 3 keys (developer_id, key_id, signing_secret)
- JWT-signed auth
- Sandbox base URL `https://openapi.doordash.com/drive/v2/`

### Uber Direct
- Apply at businesses.uber.com/direct (gated form, hours-to-days approval)
- 3 keys (client_id, client_secret, customer_id)
- OAuth2 client_credentials flow
- Sandbox `sandbox.api.uber.com`
- User uncertainty: which API suite on developer dashboard. Recommended "3PL Consumer APIs" — user investigating.

### UPS
- developer.ups.com, instant signup, no LLC needed for sandbox
- 2 keys (client_id, client_secret)
- OAuth2 client_credentials
- Sandbox base `https://wwwcie.ups.com/api/`
- User deferred this until later

### Stripe webhook secret
- **NOT the same as the secret key**. Webhook signing secret (`whsec_...`) is separate, used to verify webhook signatures.
- Dev: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` prints a `whsec_...`. Paste into `.env.local`.
- Prod: Dashboard → Developers → Webhooks → Add endpoint → click endpoint → reveal signing secret.

---

## 17. Things to verify on new session start

Run these to confirm state:

```bash
cd /Users/Tornike/Desktop/Cheese/1/website

# 1. Schema in sync
set -a && source ./.env.local && set +a
npx prisma generate

# 2. Typecheck clean
npx tsc --noEmit

# 3. Quick DB sanity check (optional)
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const stats = {
    locations: await p.location.count(),
    products: await p.product.count(),
    creamery: await p.product.count({ where: { kind: { startsWith: 'CREAMERY' } } }),
    bakery: await p.product.count({ where: { kind: { startsWith: 'BAKERY' } } }),
    users: await p.user.count(),
    addresses: await p.userAddress.count(),
    orders: await p.order.count(),
    analyticsPins: await p.analyticsPin.count(),
  };
  console.log(stats);
  await p.\$disconnect();
})();
"
```

Expected output: 2 locations, 15 products (5 creamery + 10 bakery), users ≥1, **355 analyticsPins** (these are B2B prospects, DO NOT TOUCH), 0 orders (before 7a.5).

---

## 18. Starter prompt for new session

When the user opens a new session, they should paste a short bootstrap message like:

> Read `docs/PHASE_7a_HANDOFF.md` first. We're continuing Colchis Food development from Phase 7a.4 (checkout flow + Stripe Elements). Sub-phases 7a.1, 7a.2, 7a.3 are complete. Confirm you've read the doc, then propose a detailed plan for 7a.4 before any code (Rule 1).

That's enough. The handoff doc has everything.

---

## END OF HANDOFF

If you (new Claude) find anything missing in this doc, surface it (Rule 12) rather than guessing. Ask the user to clarify if any business rule is ambiguous.
