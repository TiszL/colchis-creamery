'use server';

import { prisma } from '@/lib/db';
import { distanceMiles, channelMaxRadius } from '@/lib/distance';
import { DeliveryMethod, ProductKind } from '@prisma/client';

const CREAMERY_KINDS = Object.values(ProductKind).filter(k => k.startsWith('CREAMERY')) as ProductKind[];

export type DeliverableCreameryProduct = {
    id: string;
    sku: string;
    name: string;
    slug: string;
    description: string;
    weight: string | null;
    priceB2c: string;
    imageUrl: string;
    kind: ProductKind;
    status: string;
    stockAvailable: number | null;
    /** Channels deliverable to the customer (union across reachable locations stocking this product). */
    eligibleChannels: DeliveryMethod[];
    sources: Array<{ locationId: string; locationName: string; distanceMiles: number }>;
    productLine: { name: string; badgeColor: string | null } | null;
};

export type CreameryAvailabilityResult = {
    customerLat: number;
    customerLng: number;
    products: DeliverableCreameryProduct[];
    inServiceArea: boolean;
    coveringLocations: string[];
};

/**
 * Returns creamery-kind products deliverable to the customer's coordinates from any
 * location (Cold Warehouse for UPS, Bakery for DoorDash/Uber/pickup).
 *
 * IN_STORE_DINE_IN is excluded — creamery is taken home, not eaten on premise.
 */
export async function getAvailableCreameryProducts(
    customerLat: number,
    customerLng: number,
): Promise<CreameryAvailabilityResult> {
    // Fetch ANY active location with coords. Both warehouses and bakeries may stock creamery.
    const locations = await prisma.location.findMany({
        where: {
            isActive: true,
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
                        status: { in: ['ACTIVE', 'COMING_SOON'] },
                        kind: { in: CREAMERY_KINDS },
                    },
                },
                include: {
                    product: {
                        include: {
                            productLine: { select: { name: true, badgeColor: true } },
                        },
                    },
                },
            },
        },
    });

    const byProductId = new Map<string, DeliverableCreameryProduct>();
    const coveringLocations = new Set<string>();

    for (const loc of locations) {
        if (loc.latitude === null || loc.longitude === null) continue;
        const distance = distanceMiles(customerLat, customerLng, loc.latitude, loc.longitude);

        const reachableChannels: DeliveryMethod[] = [];
        for (const ch of loc.channels) {
            if (ch.deliveryMethod === DeliveryMethod.IN_STORE_DINE_IN) continue; // creamery isn't dine-in
            const maxRadius = channelMaxRadius(ch.radiusMiles, ch.maxDriveHours);
            const inStorePickup = ch.deliveryMethod === DeliveryMethod.IN_STORE_PICKUP;
            if (inStorePickup || (maxRadius !== null && distance <= maxRadius)) {
                reachableChannels.push(ch.deliveryMethod);
            }
        }
        if (reachableChannels.length === 0) continue;
        coveringLocations.add(loc.name);

        for (const stock of loc.stocks) {
            const product = stock.product;
            const matching = reachableChannels;
            if (matching.length === 0) continue;
            // NOTE: don't skip 0-stock / COMING_SOON products — let the UI mark them as
            // Sold out / Coming Soon. Hiding them here would mean an in-range customer
            // gets a false "Out of range" banner when products simply lack stock.

            const existing = byProductId.get(product.id);
            if (existing) {
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
                    slug: product.slug,
                    description: product.description,
                    weight: product.weight,
                    priceB2c: product.priceB2c,
                    imageUrl: product.imageUrl,
                    kind: product.kind,
                    status: product.status,
                    stockAvailable: product.isMadeToOrder ? null : (stock.quantity ?? 0),
                    eligibleChannels: [...matching],
                    sources: [{ locationId: loc.id, locationName: loc.name, distanceMiles: distance }],
                    productLine: product.productLine
                        ? { name: product.productLine.name, badgeColor: product.productLine.badgeColor }
                        : null,
                });
            }
        }
    }

    const products = Array.from(byProductId.values()).sort((a, b) => a.name.localeCompare(b.name));
    return {
        customerLat,
        customerLng,
        products,
        inServiceArea: coveringLocations.size > 0,
        coveringLocations: Array.from(coveringLocations),
    };
}
