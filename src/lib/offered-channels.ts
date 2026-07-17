import { prisma } from '@/lib/db';
import { isNationalShipEnabled } from '@/lib/feature-flags';
import { sellableStockWhere } from '@/lib/stock-availability';
import { DeliveryMethod, LocationType, type SalesChannel } from '@prisma/client';

/**
 * Server-side derivation of the delivery methods a product can be fulfilled
 * through, under the post-Phase-8a model where delivery methods are a property
 * of the LOCATION (LocationDeliveryMethod), not the product.
 *
 * "Offered" = the union of active delivery methods across active locations
 * that can serve the product: a location carries a product when the product's
 * salesChannel is in its allowsChannels AND it has an enabled Stock row for it.
 * Made-to-order products get quantity=null Stock rows (admin save creates them
 * per offered location), so a disabled or missing row means the item is 86'd
 * there — no MTO bypass.
 *
 * This is the address-agnostic superset the PDP renders as "How you can get
 * it"; the client then dims entries the customer's address can't reach using
 * the *-availability actions (which apply the same location semantics plus
 * radius checks).
 */

export type OfferedChannelsProductRef = {
    id: string;
    salesChannel: SalesChannel;
    isMadeToOrder: boolean;
};

export type OfferedChannelsOptions = {
    /** Restrict to one location type (bakery surfaces use BAKERY). Omit = all active locations. */
    locationType?: LocationType;
    /** Methods to exclude, mirroring the surface's availability action
     *  (bakery: UPS_2DAY — never ships nationwide; creamery: IN_STORE_DINE_IN). */
    exclude?: DeliveryMethod[];
};

/** Batched variant — one query for a whole catalog page. Returns productId → methods. */
export async function offeredChannelsByProduct(
    products: OfferedChannelsProductRef[],
    opts: OfferedChannelsOptions = {},
): Promise<Map<string, DeliveryMethod[]>> {
    const map = new Map<string, DeliveryMethod[]>();
    if (products.length === 0) return map;

    const locations = await prisma.location.findMany({
        where: { isActive: true, ...(opts.locationType ? { type: opts.locationType } : {}) },
        select: {
            allowsChannels: true,
            channels: { where: { isActive: true }, select: { deliveryMethod: true } },
            stocks: {
                where: { ...sellableStockWhere(), productId: { in: products.map(p => p.id) } },
                select: { productId: true },
            },
        },
    });

    const excluded = new Set(opts.exclude ?? []);
    for (const p of products) {
        const set = new Set<DeliveryMethod>();
        for (const loc of locations) {
            const carries =
                loc.allowsChannels.includes(p.salesChannel) &&
                loc.stocks.some(s => s.productId === p.id);
            if (!carries) continue;
            for (const ch of loc.channels) {
                // Launch gate: NATIONAL_SHIP withheld until hardened (feature-flags.ts).
                if (ch.deliveryMethod === 'UPS_2DAY' && !isNationalShipEnabled()) continue;
                if (!excluded.has(ch.deliveryMethod)) set.add(ch.deliveryMethod);
            }
        }
        map.set(p.id, Array.from(set));
    }
    return map;
}

/** Single-product convenience for PDPs. */
export async function offeredChannelsForProduct(
    product: OfferedChannelsProductRef,
    opts: OfferedChannelsOptions = {},
): Promise<DeliveryMethod[]> {
    const map = await offeredChannelsByProduct([product], opts);
    return map.get(product.id) ?? [];
}
