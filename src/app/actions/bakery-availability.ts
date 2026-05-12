'use server';

import { prisma } from '@/lib/db';
import { distanceMiles, channelMaxRadius } from '@/lib/distance';
import { FulfillmentChannel, LocationType, ProductKind } from '@prisma/client';

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
    kind: ProductKind;
    isMadeToOrder: boolean;
    /** Sum of `Stock.quantity` across reachable locations. null = made-to-order (unlimited). */
    stockAvailable: number | null;
    /** Channels this product can be delivered to the customer via, from any reachable location. */
    eligibleChannels: FulfillmentChannel[];
    /** Locations stocking this product that can reach the customer (id, name, distance miles). */
    sources: Array<{ locationId: string; locationName: string; distanceMiles: number }>;
};

export type AvailabilityResult = {
    customerLat: number;
    customerLng: number;
    hotProducts: DeliverableProduct[];
    frozenProducts: DeliverableProduct[];
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
 *   2. For each (location, channel) pair, gather BAKERY_HOT / BAKERY_FROZEN products that
 *      are stocked at the location AND eligible for that channel AND visible on B2C.
 *   3. Group/dedupe by product so each product lists the union of reachable channels.
 *
 * UPS_GROUND_2DAY is intentionally excluded — bakery products are never nationwide per business rules.
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
                    product: {
                        isActive: true,
                        isB2cVisible: true,
                        status: 'ACTIVE',
                        kind: { in: [ProductKind.BAKERY_HOT, ProductKind.BAKERY_FROZEN] },
                    },
                },
                include: {
                    product: { include: { channels: true } },
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
        const reachableChannels: FulfillmentChannel[] = [];
        for (const ch of loc.channels) {
            if (ch.channel === FulfillmentChannel.UPS_GROUND_2DAY) continue; // bakery never ships nationwide
            const maxRadius = channelMaxRadius(ch.radiusMiles, ch.maxDriveHours);
            // In-store channels have no radius — customer drives to us, always "reachable" if active
            const inStore = ch.channel === FulfillmentChannel.IN_STORE_PICKUP || ch.channel === FulfillmentChannel.IN_STORE_DINE_IN;
            if (inStore || (maxRadius !== null && distance <= maxRadius)) {
                reachableChannels.push(ch.channel);
            }
        }
        if (reachableChannels.length === 0) continue;
        coveringLocations.add(loc.name);

        // For each stocked product, intersect product.channels with reachable channels
        for (const stock of loc.stocks) {
            const product = stock.product;
            const productChannels = new Set(product.channels.map(c => c.channel));
            const matching = reachableChannels.filter(c => productChannels.has(c));
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
                    kind: product.kind,
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
        hotProducts: all.filter(p => p.kind === ProductKind.BAKERY_HOT).sort((a, b) => a.name.localeCompare(b.name)),
        frozenProducts: all.filter(p => p.kind === ProductKind.BAKERY_FROZEN).sort((a, b) => a.name.localeCompare(b.name)),
        inServiceArea: coveringLocations.size > 0,
        coveringLocations: Array.from(coveringLocations),
    };
}
