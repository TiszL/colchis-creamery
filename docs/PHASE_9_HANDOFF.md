# Colchis Food — Phase 9 + Production-Launch Handoff

> **Date**: 2026-05-17
> **Purpose**: bootstrap a fresh Claude session after the long Phase 9 + production-launch session. Builds on `PHASE_7a_HANDOFF.md` and `PHASE_7b_8_HANDOFF.md`.
> **Where we are**: Phases 1-9 complete (UPS 8.3 still deferred). Site is **live in production at https://colchisfood.com** in testing-mode (Stripe TEST keys + sandbox carriers + pre-launch banner).

---

## 1. How a new session should start

1. **Read this doc first**, then `docs/PHASE_7b_8_HANDOFF.md` and `docs/PHASE_7a_HANDOFF.md` for everything pre-Phase 9.
2. **Verify the 12 CLAUDE.md rules**:
   - `/Users/Tornike/.claude/CLAUDE.md` (global)
   - `/Users/Tornike/Desktop/Cheese/1/website/CLAUDE.md` (project, checked in)
   - `CLAUDE.local.md` (gitignored, same 12 rules)
3. **Operate against the real project root** `/Users/Tornike/Desktop/Cheese/1/website/` — NOT any `.claude/worktrees/...` directory. Worktrees can shadow files.
4. **Sanity-check environment**:
   ```bash
   cd /Users/Tornike/Desktop/Cheese/1/website
   set -a && source ./.env.local && set +a
   npx prisma generate
   npx tsc --noEmit  # should be clean
   git status        # should match expected state per §5 below
   ```
5. **Announce readiness**: "Read all 3 handoff docs. Schema verified. Production at colchisfood.com. Ready to continue. Confirm scope before coding."

---

## 2. Status summary (master table)

| Phase | Scope | Status | Notes |
|---|---|---|---|
| 1-6 | Foundation (locations, products, addresses, PDPs, cart UX) | ✅ | See `PHASE_7a_HANDOFF.md` |
| 7a | Checkout pipeline (UI, server action, Stripe webhook, email, admin) | ✅ | See `PHASE_7a_HANDOFF.md` |
| 7b | Polish (cron, tracking, lookup, reorder, cancel, refund, email) | ✅ | See `PHASE_7b_8_HANDOFF.md` |
| 8.1 | DoorDash Drive | ✅ | See `PHASE_7b_8_HANDOFF.md` |
| 8.2 | Uber Direct | ✅ | See `PHASE_7b_8_HANDOFF.md` |
| 8.3 | UPS | ⏭ **Still deferred** |
| **9** | **Operational polish + carrier hardening** | ✅ | See §6 of this doc |
| **E1-E4** | **Production launch (banner, SEO, deploy, DNS)** | ✅ code; some operational items pending | See §7 |
| 10+ | Marketing/CRM, B2B, mobile UX, i18n, subscriptions | ⏭ Pending | See §13 |

---

## 3. Critical recent changes (read before touching adjacent code)

### 3.1 Cancel window is 3 minutes, not 15

`CANCEL_WINDOW_MS = 3 * 60 * 1000` in `src/lib/order-policy.ts`. Reason: delivery is 25-45 min total, so after 3 min the kitchen has often started + driver may be dispatching. Customer cancel doc UI auto-renders the current value via `minutesRemaining` prop.

### 3.2 Carrier cancellation IS wired in

`cancelOrder` (customer) and `refundOrder` (admin, full-first-refund only) both call `cancelActiveCarrierDeliveries(fulfillments, logPrefix)` — a private helper in `src/app/actions/orders.ts` that:
- Skips fulfillments without `externalOrderId` or with terminal status (DELIVERED/CANCELLED)
- Calls `doordashCancelDelivery` or `uberCancelDelivery` per channel
- Logs success/failure but never throws (customer's Stripe refund has already completed)

### 3.3 DoorDash webhook auth is Bearer-token, NOT HMAC

The original handoff doc described HMAC signature verification (`X-DoorDash-Signature`). That was speculative — in 2026 DD's dashboard uses "Basic" auth-type mode where you set a custom `Authorization` header value. New env var: `DOORDASH_WEBHOOK_AUTH` holds the FULL expected header value (e.g. `Bearer <random>`). Verification uses `verifyDoorDashAuth(authHeader)` with `timingSafeEqual`.

### 3.4 UNDELIVERABLE sentinel — carriers can explicitly refuse

`doordashCreateQuote` and `uberCreateQuote` can return `UNDELIVERABLE` (string sentinel) when the carrier explicitly says "we don't serve this address" (vs returning null for generic outage). When `getShippingQuote` receives `UNDELIVERABLE`, it returns `null` immediately — **does NOT fall back to flatFee** (since presenting a flatFee for a delivery that won't dispatch would let the customer pay for nothing).

Detection patterns:
- DD: HTTP 400 with `unable_to_quote` / `outside.*(radius|range)` / `undeliverable` / `cannot_deliver` in body
- Uber: HTTP 400 with `address_undeliverable` / `not.*deliverable.*area` / `outside.*delivery.*radius`

### 3.5 Customer phone is required for live carrier quotes

`getShippingQuote` now takes `customerPhone?: string`. When present (logged-in user with `User.phone` set), the carrier live-quote path runs with the real phone → real quote returned. When absent (guest, pre-phone-entry), DD/Uber paths skip (no placeholder fallback for phone — that triggered DD's validator). Caller falls back to `LocationChannel.flatFee`.

Plumbing: `shipping-plan.ts` action looks up session user's phone via `getSession()` + Prisma query, passes to `_planFulfillment` → `getShippingQuote`. Same plumbing from CheckoutClient calling `createCheckoutSession`.

### 3.6 User.phone is `@unique` (Phase C)

`User.phone String? @unique` enforced at schema level. Both `createCheckoutSession` and `updateProfileAction` (in `auth.ts`) pre-check for conflicts and return friendly errors instead of raw Prisma constraint violations. Three cases handled:
- Logged-in user setting phone that belongs to another user → reject
- Guest with email match + conflicting phone → reject (don't auto-attach)
- Guest with new email but conflicting phone → reject (security: phone alone can't claim an order)

### 3.7 US E.164 phone normalization (`src/lib/phone.ts`)

`normalizeUSPhone(input)` → `+1XXXXXXXXXX` or `null`. NANP rules: 10 digits, area-code first digit 2-9, exchange first digit 2-9. Used both client-side (CheckoutClient validation hint) and server-side (always-normalize before persist).

### 3.8 Address detail collection — Phase B

Three new optional fields plumbed end-to-end:
- `accessCode` — gate / buzzer / lockbox code
- `buildingName` — "The Wexley", "Tower B"
- `deliveryNotes` — free-text driver instructions

Schema additions:
- `UserAddress`: 3 new columns (`accessCode`, `buildingName`, `deliveryNotes`)
- `Order`: 4 new snapshot columns (`shippingAddressLine2`, `shippingAccessCode`, `shippingBuildingName`, `shippingDeliveryNotes`)

Flow: AddressManager UI collects → `saveMyAddress` persists on UserAddress → `createCheckoutSession` snapshots on Order → `combineDropoffInstructions(order)` in stripe webhook composes a single string ("Apt/Suite: 4B · Building: Wexley · Access code: 1234 · Leave at door") → passed as DD `dropoff_instructions` / Uber `dropoff_notes` at carrier dispatch.

### 3.9 Cart cross-tab sync via BroadcastChannel (Phase D)

`CartProvider.tsx` uses `BroadcastChannel('colchis-cart-sync')`. Pattern: any mutation triggers items-effect → broadcasts to other tabs. Receiving tab sets a one-shot `skipBroadcastRef` flag, applies items, doesn't re-broadcast (ping-pong-safe). Equality check via JSON.stringify avoids spurious re-renders.

### 3.10 Cart UX overhaul

- **Reorder button**: 3-button modal (Replace / Add / Cancel) with side-by-side previews of current cart vs incoming reorder items. Replaces the old "Replace cart first" toggle.
- **Cart dropdown** (`src/components/cart/CartDropdown.tsx`): mini-cart panel anchored to header cart icon. Click outside / ESC / × to close. Items with thumbnail, qty stepper, remove. Footer: "Checkout →" primary + "View full cart" secondary. Mobile-optimized (`min(380px, calc(100vw - 16px))`).
- **Header restructure**: cart icon now OUTSIDE `.ch-header-cta` (which is `display: none` on mobile) so it stays visible on mobile. Right cluster wrap: CTA group + Cart + Burger in a flex container with `gap: 10`, tight visual grouping.

### 3.11 Pre-launch testing banner (Phase E1)

`SiteConfig` key `site.testingMode` stores JSON: `{ enabled, modalTitle, modalBody, stripText, showModalOnFirstVisit, version }`. Defaults in `src/lib/site-config.ts`.

`TestingBanner` (client component, `src/components/site/TestingBanner.tsx`):
- SSR-renders a copper top strip with dismiss × (sessionStorage per-tab)
- On first visit (no localStorage `colchis-testing-ack-v{version}`), shows full-screen modal with markdown body
- Admin bumps `version` → modal re-shows for everyone who already acknowledged

Admin editor: `src/components/admin/SiteSettingsClient.tsx` has a "Pre-launch testing notice" section with toggle, textarea (markdown), version-bump button.

### 3.12 SEO + AI search foundation

| Component | What |
|---|---|
| `src/app/sitemap.ts` | Dynamic — covers static pages, products, recipes, articles across 4 locales |
| `src/app/robots.ts` | Production-aware (blocks all in non-prod), allows GPTBot/ClaudeBot/Google-Extended/Bingbot |
| `src/app/llms.txt/route.ts` | **New** — dynamic plain-text guide for AI crawlers (ChatGPT/Claude/Perplexity look for it). Includes products, recipes, articles. 1-hour cache. |
| `src/app/feed.xml/route.ts` | **New** — RSS 2.0 for journal articles. 30-min cache. |
| `src/app/[locale]/opengraph-image.tsx` | **New** — 1200×630 brand-aligned OG image via `@vercel/og`. Edge runtime. |
| `src/components/seo/JsonLdLocalBusiness.tsx` | Existing |
| `src/components/seo/JsonLdProduct.tsx` | Existing |
| `src/components/seo/JsonLdRecipe.tsx` | Existing |
| `src/components/seo/JsonLdOrganization.tsx` | **New** — entity-level with `sameAs` from SiteConfig socials |
| `src/components/seo/JsonLdBreadcrumbList.tsx` | **New** — for nested pages (unmounted as of this session — ready when needed) |

Mounted at `src/app/[locale]/(public)/layout.tsx`: `<JsonLdLocalBusiness />` + `<JsonLdOrganization socials={socials} />`.

### 3.13 DeliverySelector mobile fix (last commit)

`.ch-zip-row` className on the ZIP+button row. Media query in globals.css stacks vertically on `≤640px`: both input + button become full-width, button gets text-align: center + proper vertical padding.

### 3.14 Build engine: Webpack (not Turbopack)

`package.json` build script: `"build": "prisma generate && next build --webpack"`. Next 16's Turbopack hit `TurbopackInternalError: Dependency tracking is disabled so invalidation is not allowed` on Vercel. Webpack is mature + reliable. Local `next dev` still uses Turbopack (default in Next 16 for dev).

### 3.15 Stripe Tax — line item reference is `shipping-fee`, not `shipping`

Stripe Tax reserves `'shipping'` as a line-item `reference` keyword. We use `'shipping-fee'`. Without this rename, every `tax.calculations.create` call throws and we fall back to `taxAmount: 0`.

Note: full Stripe Tax functionality also requires:
- Tax enabled in Stripe dashboard
- Origin address set (Dublin OH)
- Product tax categories assigned

User has deferred these until EIN is finalized — currently every order saves `taxAmount: '0.00'`.

---

## 4. Schema additions (live in DB)

```prisma
model User {
  // ...
  phone String? @unique  // Phase 9 — uniqueness enforced
  // ...
}

model UserAddress {
  // ...
  addressLine2  String?  // pre-existing
  accessCode    String?  // Phase B (new)
  buildingName  String?  // Phase B (new)
  deliveryNotes String?  // Phase B (new)
  // ...
}

model Order {
  // ...
  shippingAddress       String?  // pre-existing (formatted text)
  shippingLat           Float?   // pre-existing
  shippingLng           Float?   // pre-existing
  shippingAddressLine2  String?  // Phase B snapshot
  shippingAccessCode    String?  // Phase B snapshot
  shippingBuildingName  String?  // Phase B snapshot
  shippingDeliveryNotes String?  // Phase B snapshot
  // ...
}
```

All pushed via `prisma db push` (no `prisma/migrations/` folder used in this repo). Zero `User.phone` duplicates pre-migration so no data-loss risk.

---

## 5. Files index — what was added/changed in this session

### New files (10)

| File | Purpose |
|---|---|
| `src/lib/site-config.ts` | `getTestingMode()` + `getSocialUrls()` + types/defaults |
| `src/lib/phone.ts` | `normalizeUSPhone()` + `isValidUSPhone()` (NANP rules) |
| `src/components/site/TestingBanner.tsx` | Client component for pre-launch banner + modal |
| `src/components/cart/CartDropdown.tsx` | Header mini-cart panel |
| `src/components/seo/JsonLdOrganization.tsx` | Schema.org Organization JSON-LD |
| `src/components/seo/JsonLdBreadcrumbList.tsx` | Reusable breadcrumb JSON-LD |
| `src/app/llms.txt/route.ts` | Dynamic llms.txt for AI tools |
| `src/app/feed.xml/route.ts` | RSS 2.0 for /journal |
| `src/app/[locale]/opengraph-image.tsx` | 1200×630 brand OG image |
| `docs/PHASE_9_HANDOFF.md` | This file |

### Modified files (significant)

| File | Change |
|---|---|
| `prisma/schema.prisma` | User.phone @unique + UserAddress Phase B fields + Order snapshot fields |
| `.env.example` | Documented `DOORDASH_WEBHOOK_AUTH` |
| `package.json` | `build` script: `next build --webpack` (was just `next build`) |
| `src/app/globals.css` | Mobile media queries: hero h1 sizing, CTA stacking, photo overflow safety, `.ch-zip-row` stacking, `body { max-width: 100vw }` |
| `src/app/[locale]/layout.tsx` | `<TestingBanner config={await getTestingMode()} />` mounted |
| `src/app/[locale]/(public)/layout.tsx` | `<JsonLdOrganization socials={await getSocialUrls()} />` mounted; layout became async |
| `src/lib/order-policy.ts` | `CANCEL_WINDOW_MS = 3 * 60 * 1000` |
| `src/lib/shipping.ts` | `customerPhone` arg through `getShippingQuote` + `planFulfillment`; `UNDELIVERABLE` sentinel handling; quote cache key includes phone-presence flag |
| `src/lib/doordash.ts` | `doordashCancelDelivery()`, `UNDELIVERABLE` sentinel in quote, `verifyDoorDashAuth()` (replaced HMAC verifier) |
| `src/lib/uber-direct.ts` | `uberCancelDelivery()`, `UNDELIVERABLE` sentinel in quote |
| `src/app/actions/checkout.ts` | Phone normalization + uniqueness checks; `guestPhone` always stored; Phase B fields snapshot to Order; Stripe Tax `shipping` → `shipping-fee`; live carrier quotes via real customer phone |
| `src/app/actions/orders.ts` | `cancelActiveCarrierDeliveries()` helper + wired into `cancelOrder` + `refundOrder` |
| `src/app/actions/shipping-plan.ts` | Session lookup → pass `customerPhone` through |
| `src/app/actions/addresses.ts` | Phase B fields in DTO + save flow |
| `src/app/actions/auth.ts` | `updateProfileAction` normalizes + checks phone uniqueness |
| `src/app/api/webhooks/doordash/route.ts` | Bearer-token verification instead of HMAC |
| `src/app/api/webhooks/stripe/route.ts` | `combineDropoffInstructions(order)` feeds DD + Uber instructions |
| `src/components/layout/Header.tsx` | Cart icon moved OUTSIDE `.ch-header-cta` (mobile visibility); right-cluster flex wrap; `<CartDropdown />` mounted |
| `src/components/bakery/AddressManager.tsx` | Phase B fields: types + UI + persistence (all 3 add-new branches) |
| `src/components/checkout/CheckoutClient.tsx` | US phone validator import; loading UX (show stale options during re-plan); Phase B fields in `getAddressComponents` |
| `src/components/cart/CartClient.tsx` | (mostly unchanged but verified compatible with BroadcastChannel) |
| `src/components/account/CancelOrderButton.tsx` | Doc comment 15→3 min |
| `src/components/account/OrderDetailView.tsx` | Branded tracking button (was raw URL text) |
| `src/components/account/ReorderButton.tsx` | 3-button modal (Replace / Add / Cancel) with side-by-side previews |
| `src/components/admin/SiteSettingsClient.tsx` | Testing-mode editor section + 4 new social URL fields (Twitter/TikTok/LinkedIn/YouTube) |
| `src/components/home/DeliverySelector.tsx` | `.ch-zip-row` class added; bad `flexShrink: 0` removed; proper vertical padding on button |
| `src/providers/CartProvider.tsx` | `BroadcastChannel('colchis-cart-sync')` cross-tab sync |

---

## 6. Phase 9 sub-phases (detailed)

| # | What | Files |
|---|---|---|
| 9.1 | Cancel window 15 → 3 min | `order-policy.ts`, `CancelOrderButton.tsx` comment, `orders.ts` comment |
| 9.2 | `doordashCancelDelivery()` + `uberCancelDelivery()` (best-effort, return bool) | `doordash.ts`, `uber-direct.ts` |
| 9.3 | Wire carrier cancels into `cancelOrder` (always) + `refundOrder` (full-first-refund only) | `orders.ts` |
| 9.4 | Customer phone plumbed end-to-end into live carrier quotes | `shipping.ts`, `shipping-plan.ts`, `checkout.ts` |
| 9.5 | `UNDELIVERABLE` sentinel — distinguish carrier refusal from outage | `doordash.ts`, `uber-direct.ts`, `shipping.ts` |
| 9.6 | DoorDash webhook auth: HMAC → Bearer-token | `doordash.ts`, `route.ts`, `.env.example` |
| 9.7 | Stripe Tax `'shipping'` → `'shipping-fee'` (reserved keyword fix) | `checkout.ts` |
| 9.8 | US E.164 phone normalization | `lib/phone.ts`, `CheckoutClient.tsx`, `checkout.ts`, `auth.ts` |
| 9.9 | `User.phone @unique` + conflict checks at checkout + profile-edit | schema, `checkout.ts`, `auth.ts` |
| 9.10 | Address detail collection (Phase B) — schema → DTO → AddressManager UI → checkout snapshot → carrier dispatch | schema, `addresses.ts`, `AddressManager.tsx`, `checkout.ts`, stripe webhook |
| 9.11 | BroadcastChannel cart cross-tab sync | `CartProvider.tsx` |
| 9.12 | Reorder smart 3-button confirmation modal | `ReorderButton.tsx` |
| 9.13 | Cart dropdown mini-cart in header (mobile-optimized) | `CartDropdown.tsx`, `Header.tsx` |
| 9.14 | Mobile cart visibility (right-cluster flex wrap) | `Header.tsx` |
| 9.15 | Loading UX: show stale options during re-plan + copper "updating" indicator | `CheckoutClient.tsx` |
| 9.16 | Branded tracking URL button | `OrderDetailView.tsx` |
| 9.17 | One-shot stuck-orders cleanup script (3 UNPAID-but-Stripe-paid orders cancelled+refunded) | one-off tsx (removed post-run) |
| 9.18 | Mobile hero h1 overflow fix (44px @ ≤480, 36px @ ≤380) | `globals.css` |
| 9.19 | Mobile hero CTAs stack vertically on mobile + photo column overflow safety | `globals.css` |
| 9.20 | Mobile DeliverySelector ZIP + USE LOCATION button stack vertically | `DeliverySelector.tsx`, `globals.css` |

---

## 7. Production launch — Phase E1-E4 (detailed)

### E1 — Code (✅ all done)

| # | What | Files |
|---|---|---|
| E1.1-E1.3 | TestingBanner ecosystem (lib helper + component + admin editor + server-action save) | `site-config.ts`, `TestingBanner.tsx`, `[locale]/layout.tsx`, `SiteSettingsClient.tsx` |
| E1.4 | `/llms.txt` dynamic route — products/recipes/articles from Prisma | `app/llms.txt/route.ts` |
| E1.5 | `/feed.xml` RSS for journal | `app/feed.xml/route.ts` |
| E1.6 | Metadata audit — all dynamic pages covered (wholesale has layout-level metadata) | verified existing |
| E1.7 | `JsonLdOrganization` + `JsonLdBreadcrumbList` components; Organization mounted in public layout | `seo/JsonLdOrganization.tsx`, `seo/JsonLdBreadcrumbList.tsx`, `(public)/layout.tsx` |
| E1.8 | OG image generator (1200×630, brand-aligned, edge runtime) | `[locale]/opengraph-image.tsx` |
| E1.9 | Admin SEO editor extended with 4 social URL fields | `SiteSettingsClient.tsx` |

### E2 — Dashboards (✅ done by user)

- E2.1: Stripe production webhook endpoint → `https://colchisfood.com/api/webhooks/stripe` → `whsec_REDACTED_ROTATE_THIS_KEY_IN_STRIPE_DASHBOARD` (in Vercel env)
- E2.2: DoorDash production webhook → bearer token (in Vercel as `DOORDASH_WEBHOOK_AUTH`)
- E2.3: Uber Direct production webhook (sandbox-side)
- E2.4: Resend DNS verified for `noreply.colchisfood.com` (provider: Cloudflare, region: us-east-1, verified May 03)
- E2.5: Google OAuth callback added: `https://colchisfood.com/api/auth/callback/google`; Google Maps HTTP referrer allowlist: `https://colchisfood.com/*`, `https://*.colchisfood.com/*`, `https://*.vercel.app/*`, `http://localhost:3000/*`

### E3 — Vercel (✅ done by user)

- ~25 env vars set (see §8)
- Custom domain attached: `colchisfood.com` (canonical), `www.colchisfood.com` + both `colchiscreamery` variants → 308
- **Pro plan** (required for `*/5` cron — Hobby caps at daily)
- Build engine: **Webpack** (`--webpack` flag added to package.json — Turbopack hits internal error on this project)
- Cron `*/5 * * * *` for `/api/cron/release-reservations`

### E4 — DNS + Search (✅ done by user; some operational items pending)

- E4.1: All 4 domain variants `308 → https://colchisfood.com/` (naked canonical)
- E4.3: Google Search Console verified via Cloudflare auto-integration; sitemap submitted; URL inspection requested for top 8 pages
- E4.4: Bing Webmaster — imported from Google (one-click)
- E4.5: IndexNow — **deferred** (user-decided, do later when actively publishing journal content)
- Cloudflare optimizations — **pending** (Always Use HTTPS, Auto HTTPS Rewrites, Bot Fight Mode, Always Online — 4 toggles, ~5 min)

---

## 8. Production env vars (in Vercel, ~25 keys)

### Core (16)

- `DATABASE_URL` (Neon pooled)
- `DIRECT_URL` (Neon direct — Prisma needs this for migrations)
- `NEXT_PUBLIC_SITE_URL=https://colchisfood.com` (naked, no www)
- `JWT_SECRET` (fresh `openssl rand -base64 48` — not the dev placeholder)
- `ORDER_LOOKUP_SECRET` (fresh)
- `CRON_SECRET` (fresh)
- `STRIPE_SECRET_KEY` (`sk_test_` / `rk_test_` — TEST mode for now)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_`)
- `STRIPE_WEBHOOK_SECRET` (`whsec_REDACTED_ROTATE_THIS_KEY_IN_STRIPE_DASHBOARD` — from production endpoint, not the dev `whsec_f560...`)
- `RESEND_API_KEY`
- `EMAIL_FROM=hello@noreply.colchisfood.com`
- `BAKERY_NOTIFICATION_EMAIL=tornikeshergelashvili@gmail.com`
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (HTTP referrer allowlist updated for colchisfood.com)
- `BLOB_READ_WRITE_TOKEN` (Vercel Blob, auto-detected by `@vercel/blob` SDK)
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (OAuth callback URL added)

### DoorDash (4 + 1 optional)

- `DOORDASH_DEVELOPER_ID` (sandbox)
- `DOORDASH_KEY_ID` (sandbox)
- `DOORDASH_SIGNING_SECRET` (sandbox; used for outbound JWT auth)
- `DOORDASH_WEBHOOK_AUTH=Bearer <random>` (production webhook auth — full header value)
- `DOORDASH_API_BASE` — omit (defaults to `openapi.doordash.com`)

### Uber Direct (5 + 1 optional)

- `UBER_DIRECT_CLIENT_ID` (sandbox)
- `UBER_DIRECT_CLIENT_SECRET` (sandbox)
- `UBER_DIRECT_CUSTOMER_ID` (sandbox)
- `UBER_DIRECT_WEBHOOK_SECRET` (sandbox)
- **`UBER_DIRECT_API_BASE=https://sandbox-api.uber.com`** (critical — default is production, would 404 with sandbox creds)
- `UBER_DIRECT_TOKEN_URL` — omit (defaults to login.uber.com/oauth/v2/token)

### Twitter (2 — for Twitter OAuth if enabled)

- `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`

### Adobe (2 — placeholders, B2B future)

- `ADOBE_ACCESS_TOKEN=placeholder`
- `ADOBE_B2B_TEMPLATE_ID=placeholder`

### Facebook (2 — empty, not used)

- `FACEBOOK_APP_ID=""` and `FACEBOOK_APP_SECRET=""` (code reads these but falls through if empty)

### Things NOT needed in production env

- `STRIPE_PUBLISHABLE_KEY` (without `NEXT_PUBLIC_` prefix — legacy in `.env.local`, no code reads it)
- `NODE_ENV` (Vercel auto-sets)
- Anything ngrok-related (was dev-only)

---

## 9. User wants captured and shipped (checklist)

| Want | Status | Notes |
|---|---|---|
| Cancel within 3 min (not 15) — kitchen race | ✅ Shipped |
| Cancel should also cancel carrier delivery | ✅ Shipped (best-effort + log) |
| Cart not cleared after successful order | ✅ Already worked in-tab; cross-tab sync added via BroadcastChannel |
| Reorder shouldn't ambush user with items in cart | ✅ 3-button modal (Replace / Add / Cancel) with previews |
| Cart icon should open dropdown (stay on page), not navigate | ✅ CartDropdown component |
| Cart visible on mobile | ✅ Moved out of `.ch-header-cta` hidden group |
| Cart padding/positioning ugly on header | ✅ Right-cluster wrap with `gap: 10` |
| Account uniqueness — no dupes by email or phone | ✅ `User.phone @unique` + checkout + profile-edit conflict checks |
| Address detail collection (apt/access/notes) | ✅ Full pipeline to carrier instructions |
| Map pin drop already exists? | ✅ Verified — MapPinPicker in AddressManager |
| Consistent address UX everywhere | ✅ Single AddressManager component, propagates automatically |
| Pre-launch banner with modal + strip + admin toggle | ✅ Full system with markdown body editor |
| SEO + AI search ≥ colchiscreamery, ideally better | ✅ Sitemap + robots + llms.txt + feed.xml + JsonLd Org/LocalBusiness/Product/Recipe + OG image + Bing+Google verified + 308 redirects |
| Domain redirect colchiscreamery → colchisfood | ✅ 308 permanent, all 4 variants |
| Fix Stripe Tax error | ✅ Code fix (`shipping` → `shipping-fee`); full Tax requires user's EIN |
| Fix Uber falsely showing for undeliverable addresses | ✅ UNDELIVERABLE sentinel |
| Real shipping prices, not always $7/$9.99 | ✅ DD now live for logged-in users; Uber price varies by distance in sandbox |
| Loading skeleton during re-plan | ✅ Copper "● Updating live prices…" indicator |
| Branded tracking button instead of raw URL | ✅ |
| Production deploy wired end-to-end | ✅ Live at colchisfood.com |
| Mobile UI looks professional | ✅ Hero h1 sizing, CTA stacking, photo overflow safety, ZIP+button stack |
| Keep Stripe in test mode for now | ✅ |
| Keep carriers in sandbox for now | ✅ |
| Banner stays on (continuing to test in prod) | ✅ Admin can toggle off when ready |
| IndexNow integration | ⏭ Deferred (do later when publishing journal actively) |

---

## 10. What's still pending (in priority order)

### Pre-launch operational (do soon)

1. **Push the latest DeliverySelector + globals.css fix** (commit ready locally; user needs to run `git add … && git commit && git push origin main`)
2. **Verify mobile UI clean after push** (Safari hard-refresh on iPhone 17 Pro Max + screenshot)
3. **Cloudflare 4 toggles** (~5 min):
   - Always Use HTTPS (SSL/TLS → Edge Certificates)
   - Automatic HTTPS Rewrites (same page)
   - Bot Fight Mode (Security → Bots)
   - Always Online (Caching → Configuration)

### Pre-real-launch (when ready to take real orders)

4. **Get EIN** → enable Stripe Tax in dashboard + set origin address (Dublin OH)
5. **Stripe LIVE keys flip** — replace 3 Vercel env vars (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`); create LIVE webhook endpoint in Stripe dashboard
6. **DoorDash + Uber production credentials** — apply when ready
7. **Flip testing banner OFF** — admin → `/admin/website/settings` → toggle Enabled = off
8. **Social media accounts** — when accounts exist, add URLs in admin (Twitter / TikTok / LinkedIn / YouTube) → JsonLdOrganization picks them up via `sameAs`

### Phase 9+ polish (do when needed, defer otherwise)

9. **IndexNow integration** — instant Bing + Yandex + DuckDuckGo indexing on article publish (~30 min wiring)
10. **Carrier retry queue** — admin button + cron for failed dispatches (handoff §4.4 known limitation)
11. **Partial-refund proportional tax reversal** (handoff §4.5)
12. **Admin daily prep report** — MTO products by hour
13. **Webhook idempotency hardening** — `WebhookDedupe` table keyed on `(provider, eventId)`
14. **Order schema cleanup** — store parsed `shippingAddressLine1/City/State/PostalCode/Country` directly on Order; eliminate regex parse in stripe webhook (handoff §4.6)
15. **JWT_SECRET rotation** in production — currently set to a random value (good), but ensure it never matches the dev `dev-secret-change-in-production` fallback

### Phase 10+ (marketing/CRM — speculative)

- Abandoned cart recovery emails
- Post-purchase upsell (7 days after delivered)
- Review request emails (14 days after delivered)
- More journal/recipe content

### Phase 11+ (B2B — separate platform per handoff doc)

- Out of scope for this codebase

### Phase 12+ (speculative future)

- Mobile UX deep pass (more screens, more devices)
- i18n string extraction (many inline English strings remain)
- Subscriptions (Stripe Subscriptions)
- Loyalty program
- Gift cards
- Multi-currency / multi-region

---

## 11. Known limitations / open issues

### Inherited from PHASE_7b_8_HANDOFF (still applicable)

- §4.1 No real-time order updates on customer page (refresh required for status changes)
- §4.2 spawn EBADF in dev (long SSE chat streams)
- §4.3 Carrier quote cache is per-process (doesn't survive serverless cold starts)
- §4.4 No retry queue for failed carrier dispatch (Phase 9+ polish — todo above)
- §4.5 Tax reversal only on full-first-refund
- §4.6 Address parsing in webhook is regex-based — Phase B partially addresses this (snapshot fields now exist; regex still in webhook for back-compat)
- §4.7 `LocationChannel.priceMultiplier` applies to live carrier prices
- §4.8 Pre-existing lint warnings
- §4.9 Email tax line may diverge slightly from Stripe charge
- §4.10 Legacy `AccountAddressForm` + `updateAddressAction` are orphan
- §4.11 Token in URL is logged (guest order lookup `/orders/<token>`)

### New from Phase 9 / production launch

- **DoorDash quote at cart time still fails for guests** (no phone yet) → falls back to `LocationChannel.flatFee` ($7). Not blocking, but the "live price" only appears for logged-in users with `user.phone` set. Mitigation in Phase 9+ polish: defer DD quote until checkout when phone is entered, OR use a different placeholder DD accepts.
- **Uber sandbox returns canned `$9.99`** for many test routes regardless of distance. Real distance variation visible only for clearly different routes. Production Uber will return real per-trip pricing.
- **Pre-existing `@media (max-width: 640px)` duplicate in globals.css** at lines 213 and 441 (and 1100px at 209 and 437). Phase 9 fix added rules at END of file to win cascade. Cleanup is Phase 10+.
- **TestingBanner CSS variable `--testing-strip-height`** is set but no code reads it for layout offset — was intended for header offset compensation. Not wired in; the strip's sticky positioning works without it for now.
- **`NEXT_PUBLIC_TESTING_MODE_DEFAULT`** env var was mentioned in early planning but never used in code (uses SiteConfig instead). Don't set it.

---

## 12. Conventions + gotchas learned this session

### Build / deploy

- **Next 16 + Vercel + Turbopack build** = `TurbopackInternalError`. Use `next build --webpack` in package.json. Local `next dev` keeps using Turbopack (default in Next 16).
- **Vercel Hobby plan** caps cron at once-daily. `*/5 * * * *` requires Pro ($20/mo). Already upgraded.
- **Vercel auto-deploy** triggers on push to `main`. No manual step needed.
- **Vercel deployments use env vars set in Vercel UI**, not `.env.local` (which is gitignored).

### Mobile / CSS

- Tailwind v4 `@import "tailwindcss"` includes preflight (`box-sizing: border-box` global).
- iOS Safari can ignore container width for `<Image fill sizes="100vw">` chained through `position: relative` + `overflow: hidden` parents. Mitigation: explicit `width: 100% !important` on img + `max-width: calc(100vw - {padding}px)` on aspect-ratio containers.
- `html, body { overflow-x: hidden }` is set globally — content visually clips but doesn't scroll.
- Pre-existing duplicate media queries in globals.css — be aware when adding new mobile rules; put them at file END to ensure they win cascade.
- For flex rows with input + button on mobile: use `min-width: 0` on the flex-1 input AND avoid `flex-shrink: 0` on the button. Stack vertically via media query when content can't fit gracefully.

### Bash tool issues encountered

- Some grep / find commands intermittently failed with `"Claude Code cannot be launched inside another Claude Code session"` error. Workaround: use `awk` with explicit paths, or `ls`, or `cat | head`. The error is transient.
- `find ... -exec awk` chains sometimes returned no output even when files matched. Workaround: explicit paths.

### Architecture conventions reinforced

- `'use server'` files only export async functions. Constants → separate lib file (e.g., `order-policy.ts`).
- Money stored as String (`priceB2c: String`, `flatFee: String?`). Parse with `parseFloat`.
- Pure helpers in `src/lib/` (no DB access) are safe to import from client components. DB-touching async functions only via `src/app/actions/`.
- BroadcastChannel pattern for cross-tab sync (matches existing AddressManager pattern at `colchis-address-sync`).
- SiteConfig generic key/value table — composite settings store JSON-stringified objects (e.g., `site.testingMode`).

### Database

- Schema changes via `prisma db push --accept-data-loss` (no migrations folder).
- `@unique` constraints will reject the push if duplicates exist. Always pre-check first.

### DNS / domain

- Cloudflare DNS-only mode (gray cloud) for email records — proxy mode (orange cloud) breaks SPF/DKIM/MX.
- 308 permanent redirects in Vercel UI (Settings → Domains → Edit → Redirect to). 307 (temporary) is default for some flows — must explicitly switch to 308 for SEO.
- Resend records live on subdomains of the sending domain (e.g., `send.noreply.colchisfood.com`), not directly on the sending domain.

### OAuth

- Google OAuth requires callback URL added to Cloud Console after domain change.
- Google Maps requires HTTP referrer added to API key restrictions.

---

## 13. Database state (live snapshot at end of session)

Run this to sanity-check:

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
    siteConfigKeys: await p.siteConfig.count(),
    analyticsPins: await p.analyticsPin.count(),
  });
  const bakery = await p.location.findFirst({ where: { type: 'BAKERY' } });
  console.log('Bakery phone:', bakery?.phone);
  const tm = await p.siteConfig.findUnique({ where: { key: 'site.testingMode' } });
  console.log('Testing mode:', tm?.value);
  await p.\$disconnect();
})();
"
```

Expected:
- 2 locations
- ~15 products (5 creamery + 10 bakery)
- Users ≥ 12
- Bakery phone: `+16143776128`
- `site.testingMode` may be unset (defaults to enabled via `DEFAULT_TESTING_MODE` in code) or set if admin edited
- **355 analyticsPins** (B2B prospects, DO NOT TOUCH)

---

## 14. Test plans

### 14.1 Mobile UI verification (after pushing DeliverySelector fix)

1. Hard-refresh https://colchisfood.com on mobile (close tab + reopen, or pull-down)
2. Verify:
   - Top: copper testing strip (or hidden if you dismissed it last session)
   - Hero: text fits viewport, no period clipping
   - Hero buttons: stacked vertically, full-width
   - Hero photo: respects right padding (doesn't bleed to viewport edge)
   - DeliverySelector: ZIP input full width, USE LOCATION button full width below it
   - 2-column "HOT/UPS" cards: balanced layout
   - Bottom ticker: wraps cleanly

### 14.2 End-to-end test order in production

1. Visit https://colchisfood.com in incognito
2. Acknowledge testing banner modal
3. Add a bakery item to cart
4. Click cart icon → mini-cart dropdown opens
5. Click "Checkout →"
6. Fill contact (name, email, US phone)
7. Pick a Dublin OH address (e.g., `4480 Desantis Court, Columbus, OH 43214`)
8. Optionally expand "Apt / access / notes" → fill them in
9. Pick a delivery channel (Uber or DD if available)
10. Stripe test card `4242 4242 4242 4242` / any future expiry / any CVC / any ZIP
11. Place Order
12. Expected:
    - Redirect to /checkout/success
    - Cart clears
    - Email arrives in inbox
    - Vercel function logs: `[stripe-webhook] Order paid + stock committed`, `[doordash|uber-direct] Delivery created`, `[Resend] Order confirmation sent`
    - Carrier sandbox dashboard shows new delivery with instructions populated from Phase B fields

### 14.3 Cancel within 3 min

1. Place order as above
2. Within 3 min, go to `/account/orders/<id>`
3. Click Cancel order → confirm
4. Expected:
    - `[cancelOrder] Cancelled carrier delivery del_... ( UBER_DIRECT )` in logs
    - Stripe shows refund
    - Carrier sandbox shows delivery cancelled
    - DB: Order CANCELLED/REFUNDED, fulfillment CANCELLED, Refund row with `reason: 'customer_cancellation'`

### 14.4 Reorder smart modal

1. Past order → Reorder these items button
2. If cart empty: directly adds + redirects
3. If cart has items: modal appears with Replace / Add / Cancel
4. Each path → toast on /cart arrival

### 14.5 Phone uniqueness

1. Sign up new account with email A + phone X
2. Try to checkout as guest with email B + phone X
3. Expected: friendly error "This phone number is already registered..."

---

## 15. Important URLs

- **Production**: https://colchisfood.com
- **Vercel project**: https://vercel.com/dashboard → `website` (org: `Tornike's projects`)
- **Stripe dashboard**: https://dashboard.stripe.com (TEST mode toggle ON)
- **DoorDash dev**: https://developer.doordash.com (sandbox)
- **Uber Direct dev**: dashboard URL — user has access
- **Resend**: https://resend.com/domains → `noreply.colchisfood.com`
- **Google Search Console**: https://search.google.com/search-console → `colchisfood.com` property
- **Bing Webmaster**: https://www.bing.com/webmasters → `colchisfood.com`
- **Cloudflare DNS**: https://dash.cloudflare.com → `colchisfood.com` (nameservers: `newt.ns.cloudflare.com`, `sydney.ns.cloudflare.com`)
- **Google Cloud Console** (OAuth + Maps API): https://console.cloud.google.com/apis/credentials → project `ColchisCreamery`
- **GitHub repo**: https://github.com/TiszL/colchis-creamery

---

## 16. Phase 10+ plan (speculative — confirm with user before starting)

### Phase 10 — Marketing / CRM

- 10.1 Abandoned cart recovery (cron at 1h / 24h / 72h)
- 10.2 Post-purchase upsell email (7 days after DELIVERED)
- 10.3 Review request email (14 days after DELIVERED)
- 10.4 More SEO content + sitemap regeneration

### Phase 11 — B2B platform

- Per existing handoff: separate closed platform. **Out of scope for this codebase.**

### Phase 12 — Future expansion (speculative)

- 12.1 Mobile UX deep pass (more screens beyond homepage)
- 12.2 i18n string extraction (many inline English strings remain)
- 12.3 Stripe Subscriptions (recurring orders)
- 12.4 Loyalty program (points + redemption)
- 12.5 Gift cards (issue + redeem)
- 12.6 Multi-currency / multi-region
- 12.7 Admin notes per order

---

## 17. Working style the user expects (carryover from earlier docs)

- **Plan before coding** on non-trivial work. Confirm scope. The user gets frustrated with shortcuts.
- **Ultrathink when prompted**: dig deep into root causes, brainstorm multiple hypotheses, fact-based output.
- **Sub-phase checkpoints** with: what was done, what was verified, files changed, things to flag, test plan.
- **Multiple Q-formatted questions** when decisions are needed. Default to a recommendation for each.
- **Honest "Things to flag"** sections — don't hide tech debt.
- **No fluff** — concise, scannable, file paths + line numbers when relevant.
- **12 rules from CLAUDE.md** — read at session start, follow strictly.
- User frequently shares screenshots — analyze them carefully (pixel-by-pixel when needed), don't just hand-wave.
- User pushes code themselves; you make changes locally, then provide the git commit/push commands.

---

## 18. Starter prompt for next session

Copy/paste this when opening the new session:

> Read `docs/PHASE_9_HANDOFF.md` first (then `docs/PHASE_7b_8_HANDOFF.md` and `docs/PHASE_7a_HANDOFF.md` for full background). We're continuing Colchis Food. Phase 9 + production launch are complete; site is live at https://colchisfood.com in testing-mode (Stripe TEST + sandbox carriers + pre-launch banner enabled).
>
> Pending immediate items:
> 1. I may still need to push the latest DeliverySelector + globals.css mobile fix (check `git status`)
> 2. Cloudflare 4 toggles (Always Use HTTPS, Auto HTTPS Rewrites, Bot Fight Mode, Always Online)
> 3. Verify mobile UI is clean (iPhone hard-refresh)
>
> Confirm you've read all 3 handoff docs + `tsc --noEmit` is clean, then ask what scope I want before any code.

---

## 19. Quick-reference cheatsheet

### Restart dev server (Turbopack cache wipe)

```bash
cd /Users/Tornike/Desktop/Cheese/1/website
pkill -f "next dev" 2>/dev/null
rm -rf .next
npm run dev
```

### Force Vercel redeploy without code change

Vercel dashboard → Deployments → ⋯ menu on any deployment → Redeploy. Or push an empty commit:

```bash
git commit --allow-empty -m "chore: trigger redeploy"
git push origin main
```

### Manually trigger cron locally

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/release-reservations
```

### Check DB state quickly

```bash
set -a && source ./.env.local && set +a
npx prisma studio  # opens GUI at http://localhost:5555
```

### Bash awk for greps (workaround for tool issues)

```bash
awk 'match($0, /process\.env\.[A-Z_][A-Z0-9_]*/) { print substr($0, RSTART, RLENGTH) }' file.ts | sort -u
```

### Verify production webhook hits Vercel

```bash
# After placing a test order on https://colchisfood.com:
# Vercel dashboard → Logs → filter for production deployment
# Look for: [stripe-webhook], [doordash], [uber-direct], [Resend]
```

---

## END OF HANDOFF

If you find anything missing in this doc, surface it to the user rather than guessing. The codebase is rich — when in doubt, grep first, then read the file. The CLAUDE.md 12 rules are not optional.

**Last verified state**: 2026-05-17, end of Phase 9 + production-launch session. Site live, tsc clean across all changes. One commit pending push (mobile DeliverySelector fix).
