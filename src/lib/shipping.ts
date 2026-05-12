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
//   - UPS_GROUND_2DAY:       cold-chain cheese ONLY (creamery products with insulated packaging).
//                            Never hot food, never frozen bakery. Served from Cold Warehouse only.
//   - HOT_DELIVERY_OWN:      hot food only, served from Bakery via the bakery's own driver fleet.
//   - DOORDASH_DRIVE / UBER_DIRECT: hot food, frozen bakery, and local creamery (when stocked at
//                            the bakery). Each item carries packaging metadata for the driver.
//   - IN_STORE_PICKUP:       any product stocked at the bakery; customer collects.
//   - IN_STORE_DINE_IN:      NOT cart-orderable — see `cartEligibleChannels` filter.
//
// Free-shipping rule (your Q8 answer):
//   ONLY when ALL fulfillments in the plan use UPS_GROUND_2DAY AND
//   the cart subtotal >= $100, UPS shipping costs become $0.

import { prisma } from './db';
import { distanceMiles, channelMaxRadius } from './distance';
import { cartEligibleChannels } from './fulfillment';
import { FulfillmentChannel, ProductKind } from '@prisma/client';

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
    channel: FulfillmentChannel;
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
    items: Array<CartItemForShipping & { productName: string; productKind: ProductKind; isMadeToOrder: boolean }>;
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
function carrierFor(channel: FulfillmentChannel): Carrier {
    switch (channel) {
        case 'UPS_GROUND_2DAY':       return 'UPS';
        case 'HOT_DELIVERY_OWN':      return 'OWN_DRIVER';
        case 'DOORDASH_DRIVE':
        case 'DOORDASH_MARKETPLACE':  return 'DOORDASH';
        case 'UBER_DIRECT':
        case 'UBER_EATS_MARKETPLACE': return 'UBER';
        case 'IN_STORE_PICKUP':
        case 'IN_STORE_DINE_IN':      return 'PICKUP';
    }
}

function packagingFor(channel: FulfillmentChannel, productKind: ProductKind): PackagingType {
    // UPS = cold-chain cheese ONLY (per business rules). The DB constraints ensure UPS
    // is never paired with hot/frozen, so this branch only fires for CREAMERY_*.
    if (channel === 'UPS_GROUND_2DAY') return 'INSULATED_COLD_CHAIN';
    // Bakery's own driver = hot food only.
    if (channel === 'HOT_DELIVERY_OWN') return 'HOT_INSULATED';
    if (channel === 'IN_STORE_PICKUP' || channel === 'IN_STORE_DINE_IN') return 'AMBIENT';
    // DoorDash / Uber: packaging depends on product kind, since these channels carry both
    // hot food (HOT_INSULATED thermal bag) and frozen/creamery (INSULATED_COLD_CHAIN).
    if (productKind === 'BAKERY_HOT') return 'HOT_INSULATED';
    if (productKind === 'BAKERY_FROZEN' || productKind.startsWith('CREAMERY')) return 'INSULATED_COLD_CHAIN';
    return 'AMBIENT';
}

function etaMinutesFor(channel: FulfillmentChannel, distanceMi: number): number | null {
    switch (channel) {
        case 'UPS_GROUND_2DAY':       return null; // 1-2 days, shown as a date elsewhere
        case 'HOT_DELIVERY_OWN':      return Math.max(20, Math.round(15 + distanceMi * 2.5));   // ~2.5 min/mi + 15 prep
        case 'DOORDASH_DRIVE':
        case 'UBER_DIRECT':           return Math.max(25, Math.round(20 + distanceMi * 2.5));  // ~2.5 min/mi + 20 prep
        case 'DOORDASH_MARKETPLACE':
        case 'UBER_EATS_MARKETPLACE': return Math.max(30, Math.round(25 + distanceMi * 2.5));
        case 'IN_STORE_PICKUP':       return 15;
        case 'IN_STORE_DINE_IN':      return 0;
    }
}

/* ─── Single quote ──────────────────────────────────────────────────────── */

/**
 * Compute a single (location, channel) quote for a customer.
 *
 * Phase 7a: returns the LocationChannel.flatFee (plus perMileFee × distance if flatFee is null).
 * Phase 8: this is where the carrier API call goes. Function signature unchanged.
 */
export async function getShippingQuote(opts: {
    locationId: string;
    channel: FulfillmentChannel;
    customerLat: number;
    customerLng: number;
    productKind: ProductKind;       // used for packaging choice (and Phase 8 carrier item details)
}): Promise<ChannelQuote | null> {
    const loc = await prisma.location.findUnique({
        where: { id: opts.locationId },
        include: { channels: { where: { channel: opts.channel, isActive: true } } },
    });
    if (!loc || loc.latitude === null || loc.longitude === null) return null;
    const lc = loc.channels[0];
    if (!lc) return null;

    const distance = distanceMiles(opts.customerLat, opts.customerLng, loc.latitude, loc.longitude);

    // In-store channels are zero-cost regardless of LocationChannel.flatFee config
    const isInStore = opts.channel === 'IN_STORE_PICKUP' || opts.channel === 'IN_STORE_DINE_IN';
    if (isInStore) {
        return {
            locationId: loc.id,
            locationName: loc.name,
            channel: opts.channel,
            shippingCost: 0,
            baseShippingCost: 0,
            isFreeShipping: false, // not "free shipping" — there's no shipping
            etaMinutes: etaMinutesFor(opts.channel, distance),
            distanceMiles: distance,
            carrier: carrierFor(opts.channel),
            packagingType: packagingFor(opts.channel, opts.productKind),
        };
    }

    // Verify reachability — UPS uses maxDriveHours, others use radiusMiles
    const maxReach = channelMaxRadius(lc.radiusMiles, lc.maxDriveHours);
    if (maxReach !== null && distance > maxReach) return null;

    // Calculate cost: prefer flatFee, fall back to perMileFee × distance
    const flat = parseDollars(lc.flatFee);
    const perMile = parseDollars(lc.perMileFee);
    let cost = flat > 0 ? flat : perMile * distance;
    cost = cost * (lc.priceMultiplier || 1.0);  // marketplace markup
    cost = Math.round(cost * 100) / 100;        // 2dp

    return {
        locationId: loc.id,
        locationName: loc.name,
        channel: opts.channel,
        shippingCost: cost,
        baseShippingCost: cost,
        isFreeShipping: false,
        etaMinutes: etaMinutesFor(opts.channel, distance),
        distanceMiles: distance,
        carrier: carrierFor(opts.channel),
        packagingType: packagingFor(opts.channel, opts.productKind),
    };
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
): Promise<FulfillmentPlan> {
    if (items.length === 0) {
        return { groups: [], undeliverableItems: [], hasUndeliverable: false };
    }

    // Load each cart product + its allowed channels + its stocks (with locations)
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: {
            channels: true,
            stocks: { include: { location: { include: { channels: { where: { isActive: true } } } } } },
        },
    });

    // Map per location → { itemsHere, candidate channels }
    type GroupAccumulator = {
        locationId: string;
        locationName: string;
        items: FulfillmentGroup['items'];
        // Channels eligible for ALL items in this group + customer reachability
        candidateChannels: Set<FulfillmentChannel>;
    };
    const groups = new Map<string, GroupAccumulator>();
    const undeliverable: FulfillmentPlan['undeliverableItems'] = [];

    for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
            undeliverable.push({ productId: item.productId, productName: 'Unknown product', reason: 'Product no longer available' });
            continue;
        }
        // Channels this product CAN ship via, excluding dine-in (not cart-orderable)
        const productCartChannels = cartEligibleChannels(product.channels.map(c => c.channel));
        if (productCartChannels.length === 0) {
            undeliverable.push({ productId: product.id, productName: product.name, reason: 'Dine-in only (not orderable online)' });
            continue;
        }

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

            // Compute reachable channels at this location for this customer
            const reachableHere: FulfillmentChannel[] = [];
            for (const lc of loc.channels) {
                if (lc.channel === FulfillmentChannel.IN_STORE_DINE_IN) continue;
                const isPickup = lc.channel === FulfillmentChannel.IN_STORE_PICKUP;
                const maxReach = channelMaxRadius(lc.radiusMiles, lc.maxDriveHours);
                if (isPickup || (maxReach !== null && distance <= maxReach)) {
                    if (productCartChannels.includes(lc.channel)) reachableHere.push(lc.channel);
                }
            }

            if (reachableHere.length === 0) {
                // Track what kind of "no" this is for the final reason message
                const anyChannelMatchAtAll = loc.channels.some(lc => productCartChannels.includes(lc.channel) && lc.channel !== FulfillmentChannel.IN_STORE_DINE_IN);
                if (anyChannelMatchAtAll) sawNoReach = true; else sawNoChannelMatch = true;
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
                const next = new Set<FulfillmentChannel>();
                for (const c of acc.candidateChannels) if (reachableHere.includes(c)) next.add(c);
                acc.candidateChannels = next;
            }
            acc.items.push({
                productId: product.id,
                productName: product.name,
                productKind: product.kind,
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
        const quotes: ChannelQuote[] = [];
        // Pick representative kind for packaging (use first item; if multiple kinds, packagingFor still works per channel)
        const representativeKind = acc.items[0].productKind;
        for (const channel of acc.candidateChannels) {
            const quote = await getShippingQuote({
                locationId: acc.locationId,
                channel,
                customerLat,
                customerLng,
                productKind: representativeKind,
            });
            if (quote) quotes.push(quote);
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
 * Rule: ALL selected fulfillments use UPS_GROUND_2DAY AND cart subtotal >= $100
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
    const allUps = selectedQuotes.every(q => q.channel === 'UPS_GROUND_2DAY');
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
        && plan.groups.every(g => g.availableChannels.some(c => c.channel === 'UPS_GROUND_2DAY'));
    if (!upsOnlyPossible) return null;
    return {
        eligible: true,
        thresholdMet: cartSubtotal >= 100,
        remaining: Math.max(0, 100 - cartSubtotal),
    };
}
