// Shipping quote + fulfillment-planning primitives for checkout.
//
// PHASE 7a IMPLEMENTATION: quotes come from LocationChannel.flatFee / perMileFee.
// PHASE 8 SWAP TARGET:    `getShippingQuote` will delegate to DoorDash Drive /
//                          Uber Direct / UPS APIs for live quotes when those
//                          credentials are present in env. The signature and
//                          callers don't change.
//
// Channel × product-kind business rules (encoded in ProductChannel rows + LocationChannel rows,
// NOT here — this file just respects what the DB has wired):
//   - UPS_2DAY:       cold-chain cheese ONLY (creamery products with insulated packaging).
//                            Never hot food, never frozen bakery. Served from Cold Warehouse only.
//   - OWN_DELIVERY:      hot food only, served from Bakery via the bakery's own driver fleet.
//   - DOORDASH_DRIVE / UBER_DIRECT: hot food, frozen bakery, and local creamery (when stocked at
//                            the bakery). Each item carries packaging metadata for the driver.
//   - IN_STORE_PICKUP:       any product stocked at the bakery; customer collects.
//   - IN_STORE_DINE_IN:      NOT cart-orderable — see `cartEligibleChannels` filter.
//
// Free-shipping rule (your Q8 answer):
//   ONLY when ALL fulfillments in the plan use UPS_2DAY AND
//   the cart subtotal >= $100, UPS shipping costs become $0.

import { prisma } from './db';
import { distanceMiles, channelMaxRadius } from './distance';
import { cartEligibleChannels } from './fulfillment';
import { doordashCreateQuote, isDoorDashConfigured, UNDELIVERABLE as DD_UNDELIVERABLE } from './doordash';
import { uberCreateQuote, isUberDirectConfigured, UNDELIVERABLE as UBER_UNDELIVERABLE } from './uber-direct';
import { easypostGetRate, isEasyPostConfigured } from './easypost';
import { DeliveryMethod } from '@prisma/client';

/** Phase 8.2: customer address bundle passed into planFulfillment. All fields
 *  optional so callers can pass partial info — carrier branches that need
 *  specific fields fall back to flat-fee if their required fields are missing.
 *  `formatted` works for DoorDash (free-text); structured fields work for Uber
 *  Direct (JSON-encoded). */
export type CustomerAddressInfo = {
    formatted?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
};

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type Carrier = 'OWN_DRIVER' | 'DOORDASH' | 'UBER' | 'UPS' | 'PICKUP';

export type PackagingType =
    | 'INSULATED_COLD_CHAIN'   // UPS creamery — gel-pack, insulated liner
    | 'HOT_INSULATED'          // own driver hot food — thermal bag
    | 'AMBIENT'                // pickup, dine-in, standard
    | null;

export type CartItemForShipping = {
    productId: string;
    quantity: number;
};

export type ChannelQuote = {
    locationId: string;
    locationName: string;
    deliveryMethod: DeliveryMethod;
    /** Final shipping cost in dollars (free-shipping rule already applied if applicable). */
    shippingCost: number;
    /** Pre-rule cost (before free-shipping discount). Kept for transparent line-item display. */
    baseShippingCost: number;
    /** True when free-shipping rule was applied to zero this out. */
    isFreeShipping: boolean;
    etaMinutes: number | null;
    distanceMiles: number;
    carrier: Carrier;
    packagingType: PackagingType;
};

export type FulfillmentGroup = {
    locationId: string;
    locationName: string;
    /** Items in the cart that this location can fulfill. */
    // Phase 9b: productKind dropped — packaging is now driven by
    // Category.packagingMode ("HOT" | "COLD" | "AMBIENT" | null).
    items: Array<CartItemForShipping & { productName: string; packagingMode: string | null; isMadeToOrder: boolean }>;
    /** Channels reachable for the customer that can ship these items. Customer picks one at checkout. */
    availableChannels: ChannelQuote[];
};

export type FulfillmentPlan = {
    groups: FulfillmentGroup[];
    /** Cart items that have NO reachable location/channel for this customer. */
    undeliverableItems: Array<{ productId: string; productName: string; reason: string }>;
    /** True if any item in the cart can't be delivered to the customer. */
    hasUndeliverable: boolean;
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function parseDollars(s: string | null): number {
    if (!s) return 0;
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

/** Channel → friendly carrier classification (used in UI + email + admin). */
function carrierFor(deliveryMethod: DeliveryMethod): Carrier {
    switch (deliveryMethod) {
        case 'UPS_2DAY':       return 'UPS';
        case 'OWN_DELIVERY':      return 'OWN_DRIVER';
        case 'DOORDASH_DRIVE':
        case 'DOORDASH_MARKETPLACE':  return 'DOORDASH';
        case 'UBER_DIRECT':
        case 'UBER_EATS_MARKETPLACE': return 'UBER';
        case 'IN_STORE_PICKUP':
        case 'IN_STORE_DINE_IN':      return 'PICKUP';
        // Phase 1 (1h) — MANUAL_DISPATCH is for B2B 3PL freight (Phase 6);
        // treated as PICKUP for the D2C path since cart never picks it.
        case 'MANUAL_DISPATCH':       return 'PICKUP';
    }
}

function packagingFor(deliveryMethod: DeliveryMethod, packagingMode: string | null): PackagingType {
    // UPS = cold-chain cheese ONLY (per business rules). The DB constraints ensure UPS
    // is never paired with hot/frozen, so this branch only fires for cold-chain items.
    if (deliveryMethod === 'UPS_2DAY') return 'INSULATED_COLD_CHAIN';
    // Bakery's own driver = hot food only.
    if (deliveryMethod === 'OWN_DELIVERY') return 'HOT_INSULATED';
    if (deliveryMethod === 'IN_STORE_PICKUP' || deliveryMethod === 'IN_STORE_DINE_IN') return 'AMBIENT';
    // Phase 9b: DoorDash / Uber packaging comes from Category.packagingMode
    // (was ProductKind enum). Admin sets the mode per category in CategoryManager.
    if (packagingMode === 'HOT') return 'HOT_INSULATED';
    if (packagingMode === 'COLD') return 'INSULATED_COLD_CHAIN';
    return 'AMBIENT';
}

function etaMinutesFor(deliveryMethod: DeliveryMethod, distanceMi: number): number | null {
    switch (deliveryMethod) {
        case 'UPS_2DAY':       return null; // 1-2 days, shown as a date elsewhere
        case 'OWN_DELIVERY':      return Math.max(20, Math.round(15 + distanceMi * 2.5));   // ~2.5 min/mi + 15 prep
        case 'DOORDASH_DRIVE':
        case 'UBER_DIRECT':           return Math.max(25, Math.round(20 + distanceMi * 2.5));  // ~2.5 min/mi + 20 prep
        case 'DOORDASH_MARKETPLACE':
        case 'UBER_EATS_MARKETPLACE': return Math.max(30, Math.round(25 + distanceMi * 2.5));
        case 'IN_STORE_PICKUP':       return 15;
        case 'IN_STORE_DINE_IN':      return 0;
        case 'MANUAL_DISPATCH':       return null; // ops-booked freight; ETA tracked manually
    }
}

/* ─── In-memory quote cache (Phase 8.x perf fix) ──────────────────────── */
//
// Carrier API calls dominate cart/checkout latency in dev. With 2 carriers
// (DoorDash + Uber) and 2 fulfillment groups, an uncached planFulfillment
// can do 4 network round-trips. Cache hits avoid the network entirely.
//
// Keyed on (location, channel, lat-coarse, lng-coarse, orderValueCents).
// Lat/lng coarsened to ~110m to dedupe near-identical addresses. Per-process
// only (Vercel cold starts get a fresh cache; that's fine).

const QUOTE_CACHE_TTL_MS = 5 * 60 * 1000;
const quoteCache = new Map<string, { quote: ChannelQuote | null; expiresAt: number }>();

function quoteCacheKey(opts: {
    locationId: string;
    deliveryMethod: DeliveryMethod;
    customerLat: number;
    customerLng: number;
    orderValueCents?: number;
    customerPhone?: string;
}): string {
    // Coarsen lat/lng to 3 decimals (~110m) so trivially-near addresses share.
    const lat = opts.customerLat.toFixed(3);
    const lng = opts.customerLng.toFixed(3);
    // Include phone-PRESENCE (not value) — quote success path differs whether
    // we have a real phone for the carrier; we don't want a no-phone null
    // cached against a future with-phone request, or vice versa.
    const phoneFlag = opts.customerPhone ? 'p1' : 'p0';
    return `${opts.locationId}|${opts.deliveryMethod}|${lat},${lng}|${opts.orderValueCents ?? 0}|${phoneFlag}`;
}

function cacheAndReturn(key: string, quote: ChannelQuote | null): ChannelQuote | null {
    quoteCache.set(key, { quote, expiresAt: Date.now() + QUOTE_CACHE_TTL_MS });
    return quote;
}

/* ─── Single quote ──────────────────────────────────────────────────────── */

/**
 * Compute a single (location, channel) quote for a customer.
 *
 * Phase 7a: flat-fee from LocationChannel.flatFee (or perMileFee × distance).
 * Phase 8.1: DOORDASH_DRIVE channel now calls DoorDash Drive's live quote API
 * when credentials are configured AND we have the cart-side context (order
 * value + addresses). Falls back to flat-fee on any DD failure so checkout
 * stays unblocked. Other channels stay on the flat-fee path until their own
 * carrier integrations land (Uber Direct = 8.2, UPS = 8.3).
 */
export async function getShippingQuote(opts: {
    locationId: string;
    deliveryMethod: DeliveryMethod;
    customerLat: number;
    customerLng: number;
    /** Phase 9b: packaging mode from Category.packagingMode. "HOT" | "COLD" |
        "AMBIENT" | null. Drives DoorDash/Uber packaging choice. */
    packagingMode: string | null;
    /** Phase 8.1: order value in cents — needed for live DoorDash/Uber quotes.
        Omit and we fall back to flat fee even if credentials are present. */
    orderValueCents?: number;
    /** Phase 8.1: customer dropoff address (free-text, full street line). */
    customerAddress?: string;
    /** Phase 8.2: parsed customer address components — required for Uber Direct
        live quotes (their API takes structured JSON, not free-text). */
    customerAddressInfo?: CustomerAddressInfo;
    /** Phase 9: customer's real US-E.164 phone. Required for DD/Uber live quotes
        (their validators reject any placeholder we'd substitute). Omit and we
        fall back to LocationChannel.flatFee. Logged-in users' phone is plumbed
        through from the shipping-plan action via session. */
    customerPhone?: string;
}): Promise<ChannelQuote | null> {
    // Phase 8.x perf fix: check the in-memory cache before doing any DB or
    // carrier work. Cached null IS a valid result (means "no quote possible").
    const cacheKey = quoteCacheKey(opts);
    const cached = quoteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.quote;
    }

    const loc = await prisma.location.findUnique({
        where: { id: opts.locationId },
        include: { channels: { where: { deliveryMethod: opts.deliveryMethod, isActive: true } } },
    });
    if (!loc || loc.latitude === null || loc.longitude === null) {
        quoteCache.set(cacheKey, { quote: null, expiresAt: Date.now() + QUOTE_CACHE_TTL_MS });
        return null;
    }
    const lc = loc.channels[0];
    if (!lc) {
        quoteCache.set(cacheKey, { quote: null, expiresAt: Date.now() + QUOTE_CACHE_TTL_MS });
        return null;
    }

    const distance = distanceMiles(opts.customerLat, opts.customerLng, loc.latitude, loc.longitude);

    // In-store channels are zero-cost regardless of LocationChannel.flatFee config
    const isInStore = opts.deliveryMethod === 'IN_STORE_PICKUP' || opts.deliveryMethod === 'IN_STORE_DINE_IN';
    if (isInStore) {
        // Phase 7b fix: pickup respects radiusMiles (with 100mi default).
        const PICKUP_DEFAULT_RADIUS_MILES = 100;
        if (opts.deliveryMethod === 'IN_STORE_PICKUP') {
            const maxReach = channelMaxRadius(lc.radiusMiles, lc.maxDriveHours) ?? PICKUP_DEFAULT_RADIUS_MILES;
            if (distance > maxReach) return cacheAndReturn(cacheKey, null);
        }
        return cacheAndReturn(cacheKey, {
            locationId: loc.id,
            locationName: loc.name,
            deliveryMethod: opts.deliveryMethod,
            shippingCost: 0,
            baseShippingCost: 0,
            isFreeShipping: false,
            etaMinutes: etaMinutesFor(opts.deliveryMethod, distance),
            distanceMiles: distance,
            carrier: carrierFor(opts.deliveryMethod),
            packagingType: packagingFor(opts.deliveryMethod, opts.packagingMode),
        });
    }

    // Verify reachability — UPS uses maxDriveHours, others use radiusMiles
    const maxReach = channelMaxRadius(lc.radiusMiles, lc.maxDriveHours);
    if (maxReach !== null && distance > maxReach) return cacheAndReturn(cacheKey, null);

    // Phase 8.1: live DoorDash Drive quote when applicable. Quote uses a
    // throwaway external_delivery_id; the real delivery is created from the
    // Stripe webhook after payment. If DD fails (no creds, bad address, rate-
    // limited, etc.) we fall back to the flat-fee path so checkout stays
    // unblocked — UX wording in cart already calls the shipping "estimate".
    if (
        opts.deliveryMethod === 'DOORDASH_DRIVE'
        && isDoorDashConfigured()
        && opts.orderValueCents !== undefined && opts.orderValueCents > 0
        && opts.customerAddress
        && loc.phone           // require real pickup phone (DD rejects placeholders)
        && opts.customerPhone  // require real dropoff phone (same — guests fall through to flatFee)
    ) {
        const pickupAddress = [loc.addressLine1, loc.city, loc.state, loc.postalCode]
            .filter(Boolean).join(', ');
        const quote = await doordashCreateQuote({
            pickup: {
                address: pickupAddress,
                phone: loc.phone,
                businessName: loc.name,
            },
            dropoff: {
                address: opts.customerAddress,
                phone: opts.customerPhone,
            },
            orderValueCents: opts.orderValueCents,
        });
        // Carrier explicitly refused (out of radius / unable_to_quote) → drop
        // the channel entirely. Showing flatFee here would let the customer pay
        // for a delivery that fails to dispatch post-payment.
        if (quote === DD_UNDELIVERABLE) {
            return cacheAndReturn(cacheKey, null);
        }
        if (quote) {
            const liveCost = Math.round(quote.feeCents) / 100;
            const withMarkup = Math.round(liveCost * (lc.priceMultiplier || 1.0) * 100) / 100;
            return cacheAndReturn(cacheKey, {
                locationId: loc.id,
                locationName: loc.name,
                deliveryMethod: opts.deliveryMethod,
                shippingCost: withMarkup,
                baseShippingCost: withMarkup,
                isFreeShipping: false,
                etaMinutes: quote.etaMinutes ?? etaMinutesFor(opts.deliveryMethod, distance),
                distanceMiles: distance,
                carrier: carrierFor(opts.deliveryMethod),
                packagingType: packagingFor(opts.deliveryMethod, opts.packagingMode),
            });
        }
        // quote === null (generic outage / misconfig) → fall through to flat-fee
    }

    // Phase 8.2: live Uber Direct quote. Requires parsed address components
    // (Uber's API takes structured JSON, not free-text). Falls back to flat-fee
    // if components are missing or the call fails.
    if (
        opts.deliveryMethod === 'UBER_DIRECT'
        && isUberDirectConfigured()
        && opts.orderValueCents !== undefined && opts.orderValueCents > 0
        && opts.customerAddressInfo?.line1
        && opts.customerAddressInfo.city
        && opts.customerAddressInfo.state
        && opts.customerAddressInfo.postalCode
        && opts.customerAddressInfo.country
        && loc.addressLine1 && loc.city && loc.state && loc.postalCode
        && loc.phone           // require real pickup phone
        && opts.customerPhone  // require real dropoff phone
    ) {
        const quote = await uberCreateQuote({
            pickup: {
                address: {
                    line1: loc.addressLine1,
                    line2: loc.addressLine2 || undefined,
                    city: loc.city,
                    state: loc.state,
                    postalCode: loc.postalCode,
                    country: loc.country || 'US',
                },
                phone: loc.phone,
            },
            dropoff: {
                address: {
                    line1: opts.customerAddressInfo.line1,
                    line2: opts.customerAddressInfo.line2,
                    city: opts.customerAddressInfo.city,
                    state: opts.customerAddressInfo.state,
                    postalCode: opts.customerAddressInfo.postalCode,
                    country: opts.customerAddressInfo.country,
                },
                phone: opts.customerPhone,
            },
            orderValueCents: opts.orderValueCents,
        });
        // Same explicit-refusal handling as DD above — exclude channel rather
        // than presenting a flatFee for a delivery that won't dispatch.
        if (quote === UBER_UNDELIVERABLE) {
            return cacheAndReturn(cacheKey, null);
        }
        if (quote) {
            const liveCost = Math.round(quote.feeCents) / 100;
            const withMarkup = Math.round(liveCost * (lc.priceMultiplier || 1.0) * 100) / 100;
            return cacheAndReturn(cacheKey, {
                locationId: loc.id,
                locationName: loc.name,
                deliveryMethod: opts.deliveryMethod,
                shippingCost: withMarkup,
                baseShippingCost: withMarkup,
                isFreeShipping: false,
                etaMinutes: quote.durationMinutes ?? etaMinutesFor(opts.deliveryMethod, distance),
                distanceMiles: distance,
                carrier: carrierFor(opts.deliveryMethod),
                packagingType: packagingFor(opts.deliveryMethod, opts.packagingMode),
            });
        }
    }

    // Phase 5 (5b): live UPS / FedEx 2-day rate via EasyPost for NATIONAL_SHIP.
    // Same graceful-fallback contract as DD/Uber: when EasyPost isn't configured
    // or the address is incomplete, fall through to LocationChannel.flatFee.
    const ai = opts.customerAddressInfo;
    if (
        opts.deliveryMethod === 'UPS_2DAY'
        && isEasyPostConfigured()
        && ai && ai.line1 && ai.city && ai.state && ai.postalCode
        && loc.postalCode
    ) {
        const rate = await easypostGetRate({
            from: {
                name: loc.name,
                street1: loc.addressLine1,
                street2: loc.addressLine2 || undefined,
                city: loc.city,
                state: loc.state,
                zip: loc.postalCode,
                country: loc.country || 'US',
                phone: loc.phone || undefined,
            },
            to: {
                street1: ai.line1,
                street2: ai.line2,
                city: ai.city,
                state: ai.state,
                zip: ai.postalCode,
                country: ai.country || 'US',
                phone: opts.customerPhone || undefined,
            },
            // MVP parcel: typical 4-cheese cold-pack box. Replace with cart-
            // aware dimensions when we add Product.weightOz/dimensions in a
            // follow-up. Rate is for estimate only; real label is bought at
            // payment time and may differ if actual weight differs significantly.
            parcel: { length: 10, width: 8, height: 6, weight: 64 },
        });
        if (rate) {
            const withMarkup = Math.round((rate.feeCents / 100) * (lc.priceMultiplier || 1.0) * 100) / 100;
            return cacheAndReturn(cacheKey, {
                locationId: loc.id,
                locationName: loc.name,
                deliveryMethod: opts.deliveryMethod,
                shippingCost: withMarkup,
                baseShippingCost: withMarkup,
                isFreeShipping: false,
                etaMinutes: null, // shown as a delivery date in UI, not minutes
                distanceMiles: distance,
                carrier: carrierFor(opts.deliveryMethod),
                packagingType: packagingFor(opts.deliveryMethod, opts.packagingMode),
            });
        }
        // EasyPost returned null → fall through to flatFee below.
    }

    // Calculate cost: prefer flatFee, fall back to perMileFee × distance
    const flat = parseDollars(lc.flatFee);
    const perMile = parseDollars(lc.perMileFee);
    let cost = flat > 0 ? flat : perMile * distance;
    cost = cost * (lc.priceMultiplier || 1.0);  // marketplace markup
    cost = Math.round(cost * 100) / 100;        // 2dp

    return cacheAndReturn(cacheKey, {
        locationId: loc.id,
        locationName: loc.name,
        deliveryMethod: opts.deliveryMethod,
        shippingCost: cost,
        baseShippingCost: cost,
        isFreeShipping: false,
        etaMinutes: etaMinutesFor(opts.deliveryMethod, distance),
        distanceMiles: distance,
        carrier: carrierFor(opts.deliveryMethod),
        packagingType: packagingFor(opts.deliveryMethod, opts.packagingMode),
    });
}

/* ─── Full fulfillment plan ─────────────────────────────────────────────── */

/**
 * Build a per-location fulfillment plan for a cart and customer.
 *
 * For each cart item, finds all (location, channel) combos that can deliver it.
 * Groups by location. Filters out IN_STORE_DINE_IN (sit-down only — not cart-eligible).
 * Returns the customer-choice surface for checkout.
 */
export async function planFulfillment(
    items: CartItemForShipping[],
    customerLat: number,
    customerLng: number,
    /** Phase 8.1: customer's formatted dropoff address. Required for live DoorDash
        quotes (free-text). If omitted (e.g. older callsites), DD falls back to flat-fee. */
    customerAddress?: string,
    /** Phase 8.2: parsed customer address components for Uber Direct's structured
        address payload. Falls back to flat-fee for Uber when omitted. */
    customerAddressInfo?: CustomerAddressInfo,
    /** Phase 9: customer's E.164 phone. When present (logged-in users) lets DD/Uber
        live quotes succeed at cart time instead of falling through to flat-fee. */
    customerPhone?: string,
): Promise<FulfillmentPlan> {
    if (items.length === 0) {
        return { groups: [], undeliverableItems: [], hasUndeliverable: false };
    }

    // Load each cart product + its allowed channels + its stocks (with locations)
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: {
            // Phase 8: ProductChannel relation removed. Per-product delivery-
            // method gating is gone — location.channels (LocationDeliveryMethod)
            // is the source of truth for what can ship from a location.
            // Phase 9c: skip stocks the location manager has disabled — same
            // visibility gate as the public availability queries.
            stocks: {
                where: { isEnabled: true },
                include: { location: { include: { channels: { where: { isActive: true } } } } },
            },
            // Phase 9b: packagingMode drives DoorDash/Uber packaging selection
            // (was on the dropped ProductKind enum). Pulled per-product via Category.
            productCategory: { select: { packagingMode: true } },
        },
    });

    // Map per location → { itemsHere, candidate channels }
    type GroupAccumulator = {
        locationId: string;
        locationName: string;
        items: FulfillmentGroup['items'];
        // Channels eligible for ALL items in this group + customer reachability
        candidateChannels: Set<DeliveryMethod>;
    };
    const groups = new Map<string, GroupAccumulator>();
    const undeliverable: FulfillmentPlan['undeliverableItems'] = [];

    for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
            undeliverable.push({ productId: item.productId, productName: 'Unknown product', reason: 'Product no longer available' });
            continue;
        }
        // Phase 8: ProductChannel removed — products no longer constrain
        // delivery methods. The cart-eligibility filter still applies to the
        // location's LocationDeliveryMethod rows further down.

        // Find locations that stock this product AND have at least one channel matching
        // both the product's allowed channels AND reachable from the customer.
        // Track WHY a candidate location failed so we can give a precise reason if nothing works.
        let foundAnyLocation = false;
        let sawLowStock = false;          // some location stocks this but quantity < requested
        let sawNoReach = false;           // some location stocks this with quantity OK, but customer out of reach
        let sawNoChannelMatch = false;    // some location reachable but its channels don't match product's channels

        for (const stock of product.stocks) {
            const loc = stock.location;
            if (loc.latitude === null || loc.longitude === null || !loc.isActive) continue;
            const stockOk = product.isMadeToOrder || (stock.quantity ?? 0) >= item.quantity;
            const distance = distanceMiles(customerLat, customerLng, loc.latitude, loc.longitude);

            // Compute reachable channels at this location for this customer.
            // Phase 7b fix: IN_STORE_PICKUP now respects radiusMiles too (with a
            // 100mi default if admin hasn't configured one). Previously pickup was
            // unconditionally reachable, which let far-away customers (e.g. Hawaii)
            // "place orders" for pickup-only items they couldn't realistically pick
            // up at a Dublin OH bakery. Admin can override per-location via
            // LocationChannel.radiusMiles.
            const PICKUP_DEFAULT_RADIUS_MILES = 100;
            const reachableHere: DeliveryMethod[] = [];
            for (const lc of loc.channels) {
                // Phase 8: ProductChannel gone. Only filter on cart-eligibility
                // (drop dine-in) + customer reachability — products no longer
                // gate which delivery methods they support.
                if (lc.deliveryMethod === DeliveryMethod.IN_STORE_DINE_IN) continue;
                const isPickup = lc.deliveryMethod === DeliveryMethod.IN_STORE_PICKUP;
                const maxReach = channelMaxRadius(lc.radiusMiles, lc.maxDriveHours);
                const effectiveMaxReach = isPickup ? (maxReach ?? PICKUP_DEFAULT_RADIUS_MILES) : maxReach;
                if (effectiveMaxReach !== null && distance <= effectiveMaxReach) {
                    reachableHere.push(lc.deliveryMethod);
                }
            }

            if (reachableHere.length === 0) {
                // Track what kind of "no" this is for the final reason message
                const anyChannelAtAll = loc.channels.some(lc => lc.deliveryMethod !== DeliveryMethod.IN_STORE_DINE_IN);
                if (anyChannelAtAll) sawNoReach = true; else sawNoChannelMatch = true;
                continue;
            }
            if (!stockOk) {
                sawLowStock = true;
                continue;
            }

            foundAnyLocation = true;
            const groupKey = loc.id;
            let acc = groups.get(groupKey);
            if (!acc) {
                acc = {
                    locationId: loc.id,
                    locationName: loc.name,
                    items: [],
                    candidateChannels: new Set(reachableHere),
                };
                groups.set(groupKey, acc);
            } else {
                // Intersect — channels must work for EVERY item in the group
                const next = new Set<DeliveryMethod>();
                for (const c of acc.candidateChannels) if (reachableHere.includes(c)) next.add(c);
                acc.candidateChannels = next;
            }
            acc.items.push({
                productId: product.id,
                productName: product.name,
                packagingMode: product.productCategory?.packagingMode ?? null,
                isMadeToOrder: product.isMadeToOrder,
                quantity: item.quantity,
            });
            break; // pick first location that works
        }

        if (!foundAnyLocation) {
            // Most specific reason wins. Stock issue is more actionable than range.
            const reason =
                sawLowStock ? 'Out of stock' :
                sawNoReach ? 'Not deliverable to your address' :
                sawNoChannelMatch ? 'No supported delivery method at the reachable location' :
                'Not stocked at any location yet';
            undeliverable.push({ productId: product.id, productName: product.name, reason });
        }
    }

    // Build quotes for each (group, channel) pair
    const result: FulfillmentGroup[] = [];
    for (const acc of groups.values()) {
        if (acc.candidateChannels.size === 0) {
            // No channel works for all items in this group — break it up by moving items to undeliverable
            // (rare case — usually intersection survives; keeping it as a safety net)
            for (const i of acc.items) {
                undeliverable.push({ productId: i.productId, productName: i.productName, reason: 'No common delivery method for items at ' + acc.locationName });
            }
            continue;
        }
        // Pick representative packaging mode (use first item; mixed-mode groups
        // are rare since cart locks to one location, but packagingFor still
        // returns a sensible value per channel either way).
        const representativePackagingMode = acc.items[0].packagingMode;

        // Phase 8.1: order value for this group, in cents. DB prices are
        // strings; coerce here. Passed to live carrier quotes (DoorDash etc.).
        // If parseFloat returns NaN for some reason, fall back to 0 — carrier
        // calls will then skip and we'll use flat-fee.
        const orderValueCents = acc.items.reduce((sum, it) => {
            const p = products.find(prod => prod.id === it.productId);
            if (!p) return sum;
            const unit = parseFloat(p.priceB2c);
            if (isNaN(unit)) return sum;
            return sum + Math.round(unit * 100) * it.quantity;
        }, 0);

        // Phase 8.x perf fix: previously this loop awaited each carrier call
        // sequentially. With DoorDash (~2-4s) + Uber Direct OAuth+quote (~3-7s
        // cold) the total stacked to 10+ seconds per group. Promise.allSettled
        // runs them concurrently and ignores failures.
        const settled = await Promise.allSettled(
            Array.from(acc.candidateChannels).map(deliveryMethod => getShippingQuote({
                locationId: acc.locationId,
                deliveryMethod,
                customerLat,
                customerLng,
                packagingMode: representativePackagingMode,
                orderValueCents,
                customerAddress,
                customerAddressInfo,
                customerPhone,
            })),
        );
        const quotes: ChannelQuote[] = [];
        for (const r of settled) {
            if (r.status === 'fulfilled' && r.value) quotes.push(r.value);
        }
        // Sort: cheapest first, then fastest ETA
        quotes.sort((a, b) => a.shippingCost - b.shippingCost || (a.etaMinutes ?? 9999) - (b.etaMinutes ?? 9999));
        result.push({
            locationId: acc.locationId,
            locationName: acc.locationName,
            items: acc.items,
            availableChannels: quotes,
        });
    }

    return {
        groups: result,
        undeliverableItems: undeliverable,
        hasUndeliverable: undeliverable.length > 0,
    };
}

/* ─── Free-shipping rule ────────────────────────────────────────────────── */

/**
 * Apply the free-shipping rule to a selected fulfillment plan + selected channels.
 *
 * Rule: ALL selected fulfillments use UPS_2DAY AND cart subtotal >= $100
 *       → UPS shipping costs become $0.
 *
 * Returns a NEW array of selected quotes (originals unchanged). `isFreeShipping`
 * is set on the relevant ones and `shippingCost` zeroed.
 */
export function applyFreeShippingRule(
    selectedQuotes: ChannelQuote[],
    cartSubtotal: number,
): ChannelQuote[] {
    if (cartSubtotal < 100) return selectedQuotes;
    const allUps = selectedQuotes.every(q => q.deliveryMethod === 'UPS_2DAY');
    if (!allUps) return selectedQuotes;
    return selectedQuotes.map(q => ({
        ...q,
        shippingCost: 0,
        isFreeShipping: true,
    }));
}

/**
 * Compute progress toward free shipping (for the cart-page "Add $X more for free shipping" hint).
 * Only meaningful when the cart's plan would be UPS-only.
 */
export function freeShippingProgress(
    plan: FulfillmentPlan,
    cartSubtotal: number,
): { eligible: boolean; thresholdMet: boolean; remaining: number } | null {
    // Determine if a UPS-only plan is achievable (every group has UPS as an option)
    const upsOnlyPossible = plan.groups.length > 0
        && plan.groups.every(g => g.availableChannels.some(c => c.deliveryMethod === 'UPS_2DAY'));
    if (!upsOnlyPossible) return null;
    return {
        eligible: true,
        thresholdMet: cartSubtotal >= 100,
        remaining: Math.max(0, 100 - cartSubtotal),
    };
}
