# Gap Fulfillment Plan — Order Modification · MTO 86 · Cafe & Bakery

Source: 23-agent verified audit (2026-07-16, 7 subsystem readers + 16 adversarial
verifiers; 15/16 gap claims CONFIRMED with file:line evidence). This document is
the tracking artifact: every verified gap maps to a phase and a PR. Update the
Status column as work lands.

## Owner decisions (recorded 2026-07-16)

| Decision | Choice |
|---|---|
| Scope of kitchen order changes | **Full swaps + upcharges** — removals, swaps (refund difference), additions/pricier swaps collected via Stripe payment link during the call |
| Who moves money | **Kitchen requests → manager approves** (mirrors cancel-request flow; "fulfillment staff cannot move money" holds) |
| MTO capacity | **86 on/off only** for now (daily caps / cutoffs deferred to Phase 4) |
| Cafe service model | **Counter ordering** (no QR/table flow; dine-in stays display-only) |

Defaults applied where no answer was given (change any of these by saying so):
edit window extends to READY-before-courier-pickup; customer sees 86'd items as
"Sold out today" (not hidden); menu page becomes stacked category sections;
`/bakery` URL kept — labels renamed to "Cafe & Bakery"; separate Hot Drinks
(HOT) / Cold Drinks (COLD) categories; drinks as flat SKUs grouped by
ProductFamily (no modifier system); mixed hot+cold orders ride one courier with
per-line packing cues; courier dropoff stays leave-at-door; shipping is never
auto-refunded on modification (admin partial refund remains the goodwill tool).

**Still need from owner (reply anytime):** Georgian brand wording (კაფე-საცხობი?),
whether dietary/allergen badges are wanted for the healthy menu, and whether
hand-to-customer dropoff should replace leave-at-door for drink orders.

---

## Phase 0 — Correctness fixes (no product decisions; 4 PRs)

**Status: ✅ LANDED 2026-07-17** — PR-A #34, PR-B #35, PR-C #36, PR-D #37 (all
adversarially reviewed pre-merge; 1 major review finding — customer self-cancel
double-restore — fixed before merge). 86-toggle behavior verified live on the
dev server against the real DB. Review follow-ups deferred to later phases:
allowsChannels gate in buildFulfillmentPlan (Phase 1 centralized predicate),
exact per-line Stripe Tax amounts (Phase 2), extra-section accent color
(Phase 3 menu redesign).

### PR-A `fix/refund-dispatch-correctness` — money + inventory correctness
| # | Gap (verified) | Fix |
|---|---|---|
| A1 | Double stock restore: full refund after a partial item-removal restores the FULL original quantities again (order-refund.ts:222-235; stripe-payment-sync.ts:467-470; admin partial restore orders.ts:302-324) | All full/partial restore paths compute **effective** quantities (`quantity - refundedQuantity`) |
| A2 | Tax pro-rate over-refund: numerator `Order.taxAmount` includes shipping tax, denominator is items-only subtotal (order-refund.ts:349-361; shipping taxed at checkout.ts:462-468) | Denominator becomes `subtotal + shipping` (the taxed base) |
| A3 | `restoredStock: true` written before restoreStock actually runs (order-refund.ts:418 vs 443) | Write `false` in the tx; flip to `true` only after restore succeeds |
| A4 | Courier manifest + declared order_value ignore `refundedQuantity` (carrier-dispatch.ts:73,104-108) — pre-Accept edits dispatch the original manifest | Manifest built from effective quantities; zero lines dropped |

### PR-B `fix/mto-86-visibility` — 86'd MTO items must be truly unavailable
| # | Gap | Fix |
|---|---|---|
| B1 | `offeredChannelsByProduct` MTO OR-branch ignores Stock/isEnabled (offered-channels.ts:59-61) → 86'd MTO still shows delivery methods + active Add-to-cart on PDPs | Require an enabled Stock row for MTO too (include `quantity: null` rows in the stocks fetch; drop the bypass) |
| B2 | Bakery PDP can never disable cart for MTO (BakeryPdpClient.tsx:116-141) | Empty offered-channels ⇒ cart disabled with honest "unavailable" state; same for the creamery PDP client |
| B3 | B2B catalog shows MTO orderable that the order API rejects (b2b-portal/order/page.tsx:76 vs api/b2b/order/route.ts:181-198) | Catalog applies the API's enabled-stock rule |

### PR-C `fix/category-section-driven` — unblock new categories (cafe prerequisite)
| # | Gap | Fix |
|---|---|---|
| C1 | Bakery PDP 404s any product outside hot-pastries/frozen-bake-off (bakery/[slug]/page.tsx:17-19,30,68) while /shop + sitemap link there — **blocker** | Gate by `Category.sections has 'bakery'` |
| C2 | Availability action hardcodes the same 2 slugs → "Not available at your address" for everything else (bakery-availability.ts:10-11,81,163-164) — **blocker** | Section-driven predicate |
| C3 | Default /bakery view silently drops other bakery categories (bakery/page.tsx:160-170) | Extra bakery categories render as titled sections below the hot/frozen tabs (full menu redesign comes in Phase 3) |
| C4 | `Category.packagingMode` has no admin UI; new categories get NULL→AMBIENT (CategoryManager.tsx; actions/categories.ts:78-87) | packagingMode select in CategoryManager + persisted in save action |

### PR-D `fix/kds-comms-polish` — ops visibility
| # | Gap | Fix |
|---|---|---|
| D1 | Cancel requests are silent — no manager notification (location-orders.ts:581-590) | Email location managers (fallback BAKERY_NOTIFICATION_EMAIL) on new request, best-effort |
| D2 | Confirmation email promises status emails that don't exist (email.ts:1007-1012) | Remove the promise (real status emails come with Phase 2 comms) |
| D3 | Kitchen never sees packagingType (location-orders.ts:42-90) | Packaging chip on KDS cards |
| D4 | KDS headline total shows pre-modification amount; other tablets get no modification signal | Effective total + "MODIFIED" badge when refunds exist |

## Phase 1 — 86 workflow (decided: on/off only)

**Status: ✅ LANDED 2026-07-17** — PR #39 (two migrations pre-applied;
3-lens adversarial review: 1 major + 10 minors fixed; verified live
end-to-end via a real LOCATION_FULFILLMENT account). Deferred to Phase 3's
menu redesign: "Sold out today" wording on listing CARDS (PDPs have it;
cards show generic Unavailable), per-card accent colors, batched
soldOutToday flags for listings. MenuAvailabilityEvent.reason is reserved
for Phase 2 (order-modification linkage writes the why).
1. Schema: `Stock.disabledUntil DateTime?` — self-expiring "86 today" (predicates check the timestamp; no cron needed). Hand-written migration.
2. Centralize the availability predicate (isEnabled + disabledUntil) so /shop, /bakery, /creamery, PDPs, checkout, B2B all share it.
3. "86 for today" quick action on the location-portal menu page — available to **LOCATION_FULFILLMENT** (kitchen self-serve; the permanent toggle stays manager-only). Audit log (who/when/which/why) — new small model.
4. Customer display: "Sold out today" badge + disabled button instead of hiding (keeps menu visible to browsers/Google).
5. 86 action lists already-paid scheduled orders containing the item so the kitchen can call each customer (feeds Phase 2 flow).

## Phase 2 — Order modification workflow (decided: request→approve; full swaps + upcharges)

**Status: 2a ✅ LANDED 2026-07-17 (PR #41)** — per-line tax capture
(OrderItem.taxCents) + exact telescoped refund math; **fixed the systemic
\$0-tax bug** (Stripe rejected the shipping tax_code on a line item; every
historical order had taxAmount 0.00 — shipping now rides shipping_cost);
edit window extended to READY-before-pickup; customer order pages show
modifications (badge, strikethrough, refund ledger, adjusted total);
pickup-READY email; forged-cart dedupe. **2b (next): OrderEditRequest
schema + kitchen request UI + manager approval executing removals/swaps,
upcharge Stripe Checkout payment links + webhook activation of added
lines, courier re-dispatch on edit, modification emails.** Deferred
minors tracked: KDS refund-estimate preview w/ exact taxCents,
listing-card display conventions (Phase 3).
1. Schema: `OrderEditRequest` + `OrderEditRequestLine` (removals, swaps, additions; requester/resolver denormalized like OrderCancelRequest; required reason + `customerContactedAt`). Per-line tax capture at checkout (`OrderItem.taxCents` from the Stripe Tax calculation lines) so refunds and upcharges are exact.
2. Kitchen UI: propose changes with reason + "customer contacted" confirmation; live request-status tracking on the kitchen tablet.
3. Manager approval executes: removals/downgrades via the existing partial-refund core (now with exact per-line tax); **upcharges via Stripe payment link** — amendment record, link emailed to the customer during the call, new OrderItem lines activate on payment webhook, auto-expire unpaid amendments.
4. Customer transparency: order page shows strikethrough removed lines, added lines, refund ledger, adjusted total, "Order updated" stage.
5. Courier sync: edits before pickup cancel + re-dispatch with corrected manifest; later edits warn.
6. Comms: modification emails per type; build the order-READY email (restores the Phase-0-removed promise, done properly); edit window extends to READY-before-pickup.

## Phase 3 — Cafe & Bakery (decided: counter ordering)
1. /bakery becomes a stacked-section premium cafe menu (one titled section per category, sortOrder-driven; chips become jump links). Hot/frozen tab code retired.
2. Catalog: Hot Drinks (HOT) / Cold Drinks (COLD) / dish categories with correct packagingMode + salesChannel guidance; flat SKUs per size grouped by ProductFamily.
3. Rename to "Cafe & Bakery": labels in 4 locales (**needs owner's Georgian wording**), home-page copy pass, JSON-LD, llms.txt, opengraph — `/bakery` URL kept.
4. Dispatch polish: per-line HOT/COLD packing cues on KDS; per-item description sent to DoorDash/Uber manifests.
5. Optional (owner call): structured dietary/allergen badges.

## Phase 4 — Deferred (revisit post-launch)
Daily caps / lead times / order cutoffs · QR-at-table ordering · SMS notices ·
localized transactional emails · exact partial Stripe Tax reversals ·
prep-time-driven ETAs · modifier/options system.
