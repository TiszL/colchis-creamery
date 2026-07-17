'use server';

import { prisma } from '@/lib/db';
import { distanceMiles, channelMaxRadius } from '@/lib/distance';
import { DeliveryMethod, LocationType } from '@prisma/client';
import { sellableStockWhere } from '@/lib/stock-availability';

// Phase 9b: bakery products were split into hot vs frozen using ProductKind
// (BAKERY_HOT / BAKERY_FROZEN). That enum is gone; the split now comes from
// the Category slug. Anything tagged 'bakery' in Category.sections is in scope;
// categories beyond the two legacy slugs land in `otherProducts`.
const BAKERY_SECTION = 'bakery';
const BAKERY_HOT_CATEGORY_SLUG = 'hot-pastries';
const BAKERY_FROZEN_CATEGORY_SLUG = 'frozen-bake-off';

export type DeliverableProduct = {
    id: string;
    sku: string;
    name: string;
    nameKa: string | null;
    slug: string;
    description: string;
    weight: string | null;
    priceB2c: string;
    tag: string | null;
    imageUrl: string;
    // Phase 9b: was ProductKind; now category slug (drives hot vs frozen split).
    categorySlug: string;
    isMadeToOrder: boolean;
    /** Sum of `Stock.quantity` across reachable locations. null = made-to-order (unlimited). */
    stockAvailable: number | null;
    /** Channels this product can be delivered to the customer via, from any reachable location. */
    eligibleChannels: DeliveryMethod[];
    /** Locations stocking this product that can reach the customer (id, name, distance miles). */
    sources: Array<{ locationId: string; locationName: string; distanceMiles: number }>;
};

export type AvailabilityResult = {
    customerLat: number;
    customerLng: number;
    hotProducts: DeliverableProduct[];
    frozenProducts: DeliverableProduct[];
    /** Products in bakery-tagged categories other than hot-pastries / frozen-bake-off. */
    otherProducts: DeliverableProduct[];
    /** True when at least one bakery location is in delivery range, even if no products. */
    inServiceArea: boolean;
    /** Names of the locations covering this address. */
    coveringLocations: string[];
};

/**
 * Returns bakery-kind products deliverable to the customer's coordinates.
 *
 * Logic:
 *   1. Find every active BAKERY location with at least one active channel reaching the customer.
 *   2. For each (location, channel) pair, gather bakery-section products that
 *      are stocked at the location AND eligible for that channel AND visible on B2C.
 *   3. Group/dedupe by product so each product lists the union of reachable channels.
 *
 * UPS_2DAY is intentionally excluded — bakery products are never nationwide per business rules.
 */
export async function getAvailableBakeryProducts(
    customerLat: number,
    customerLng: number,
): Promise<AvailabilityResult> {
    // 1. Active bakeries with their channels + stocks
    const bakeries = await prisma.location.findMany({
        where: {
            isActive: true,
            type: LocationType.BAKERY,
            latitude: { not: null },
            longitude: { not: null },
        },
        include: {
            channels: { where: { isActive: true } },
            stocks: {
                where: {
                    // Phase 9c menu toggle + day-of 86s — not orderable now.
                    ...sellableStockWhere(),
                    product: {
                        isActive: true,
                        isB2cVisible: true,
                        status: 'ACTIVE',
                        // Phase 9b: filter by Category.sections instead of ProductKind enum —
                        // any bakery-tagged category is in scope, not just hot/frozen.
                        productCategory: { sections: { has: BAKERY_SECTION } },
                    },
                },
                include: {
                    product: { include: { productCategory: { select: { slug: true } } } },
                },
            },
        },
    });

    // 2. Walk each bakery → reachable channels → matching products. Aggregate per-product.
    const byProductId = new Map<string, DeliverableProduct>();
    const coveringLocations = new Set<string>();

    for (const loc of bakeries) {
        if (loc.latitude === null || loc.longitude === null) continue;

        const distance = distanceMiles(customerLat, customerLng, loc.latitude, loc.longitude);

        // Which channels at this location reach the customer?
        const reachableChannels: DeliveryMethod[] = [];
        for (const ch of loc.channels) {
            if (ch.deliveryMethod === DeliveryMethod.UPS_2DAY) continue; // bakery never ships nationwide
            const maxRadius = channelMaxRadius(ch.radiusMiles, ch.maxDriveHours);
            // In-store channels have no radius — customer drives to us, always "reachable" if active
            const inStore = ch.deliveryMethod === DeliveryMethod.IN_STORE_PICKUP || ch.deliveryMethod === DeliveryMethod.IN_STORE_DINE_IN;
            if (inStore || (maxRadius !== null && distance <= maxRadius)) {
                reachableChannels.push(ch.deliveryMethod);
            }
        }
        if (reachableChannels.length === 0) continue;
        coveringLocations.add(loc.name);

        // For each stocked product, intersect product.channels with reachable channels
        for (const stock of loc.stocks) {
            const product = stock.product;
            const matching = reachableChannels;
            if (matching.length === 0) continue;

            // NOTE: we no longer skip 0-stock or COMING_SOON products here. Letting them
            // through with stockAvailable=0 lets the UI distinguish "Sold out" / "Coming Soon"
            // from "Out of range" — much better UX than hiding them and falsely triggering
            // the "out of delivery range" banner when the customer IS in range.

            const existing = byProductId.get(product.id);
            if (existing) {
                // Merge channels + sources + sum stock across reachable locations
                for (const ch of matching) {
                    if (!existing.eligibleChannels.includes(ch)) existing.eligibleChannels.push(ch);
                }
                existing.sources.push({ locationId: loc.id, locationName: loc.name, distanceMiles: distance });
                if (!product.isMadeToOrder && stock.quantity !== null && existing.stockAvailable !== null) {
                    existing.stockAvailable += stock.quantity;
                }
            } else {
                byProductId.set(product.id, {
                    id: product.id,
                    sku: product.sku,
                    name: product.name,
                    nameKa: product.nameKa,
                    slug: product.slug,
                    description: product.description,
                    weight: product.weight,
                    priceB2c: product.priceB2c,
                    tag: product.tag,
                    imageUrl: product.imageUrl,
                    categorySlug: product.productCategory?.slug ?? '',
                    isMadeToOrder: product.isMadeToOrder,
                    // MTO products have null stock (unlimited while bakery is open). For tracked
                    // products, accumulate Stock.quantity across reachable locations.
                    stockAvailable: product.isMadeToOrder ? null : (stock.quantity ?? 0),
                    eligibleChannels: [...matching],
                    sources: [{ locationId: loc.id, locationName: loc.name, distanceMiles: distance }],
                });
            }
        }
    }

    const all = Array.from(byProductId.values());
    return {
        customerLat,
        customerLng,
        hotProducts: all.filter(p => p.categorySlug === BAKERY_HOT_CATEGORY_SLUG).sort((a, b) => a.name.localeCompare(b.name)),
        frozenProducts: all.filter(p => p.categorySlug === BAKERY_FROZEN_CATEGORY_SLUG).sort((a, b) => a.name.localeCompare(b.name)),
        otherProducts: all.filter(p => p.categorySlug !== BAKERY_HOT_CATEGORY_SLUG && p.categorySlug !== BAKERY_FROZEN_CATEGORY_SLUG).sort((a, b) => a.name.localeCompare(b.name)),
        inServiceArea: coveringLocations.size > 0,
        coveringLocations: Array.from(coveringLocations),
    };
}
