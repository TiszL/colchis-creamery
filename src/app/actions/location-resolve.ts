'use server';

import { prisma } from '@/lib/db';
import { distanceMiles, channelMaxRadius } from '@/lib/distance';
import { DeliveryMethod, SalesChannel } from '@prisma/client';

/**
 * Homepage "Deliver to" box (issue 4).
 *
 * Given a customer's geocoded coordinates, find the location that should serve
 * them and report HONEST derived facts (no invented ETAs / prices). Deterministic
 * — pure distance math against the location's configured delivery radii. The
 * client persists the returned id via LocationProvider so the header picker +
 * catalog scope update, and reflects the copy in the hero box.
 *
 * Pick order:
 *   1. The nearest active BAKERY-capable location (allows LOCAL_HOT/LOCAL_COLD)
 *      whose own-delivery / courier radius actually reaches the point.
 *   2. If no bakery reaches, the NATIONAL_SHIP location (cold warehouse) with
 *      inServiceArea=false — they can still ship-to-home nationwide.
 *
 * In-store-only channels (pickup / dine-in) are NOT treated as "reaches you":
 * those require the customer to drive to us, which doesn't describe a delivery
 * to their address. Mirrors the reach logic in bakery/creamery-availability.
 */

const BAKERY_CHANNELS: SalesChannel[] = [SalesChannel.LOCAL_HOT, SalesChannel.LOCAL_COLD];

export type ResolvedLocation = {
    id: string;
    name: string;
    /** Great-circle miles from the customer to the matched location. */
    distanceMiles: number;
    /** True when a bakery's delivery radius covers the point; false = ship-only. */
    inServiceArea: boolean;
    /**
     * Delivery methods whose radius actually reaches the customer from the
     * matched location. For the ship-only fallback this is [UPS_2DAY]. Empty
     * only in the degenerate "no locations configured" case. Used to render
     * honest "how it reaches you" copy instead of hardcoded carriers.
     */
    reachableMethods: DeliveryMethod[];
    /**
     * Distance to the nearest bakery even when it's out of range, so the
     * ship-only state can honestly say "nearest bakery is N mi away". null when
     * there are no bakery-capable locations at all.
     */
    nearestBakeryMiles: number | null;
};

/** Max delivery reach (miles) of a location's non-pickup local-delivery channels. */
function localDeliveryReach(
    channels: { deliveryMethod: DeliveryMethod; radiusMiles: number | null; maxDriveHours: number | null }[],
    distance: number,
): { reaches: boolean; methods: DeliveryMethod[] } {
    const methods: DeliveryMethod[] = [];
    for (const ch of channels) {
        // Nationwide UPS isn't a "local delivery" signal; in-store channels need
        // the customer to come to us, not a delivery to their address.
        if (
            ch.deliveryMethod === DeliveryMethod.UPS_2DAY ||
            ch.deliveryMethod === DeliveryMethod.IN_STORE_PICKUP ||
            ch.deliveryMethod === DeliveryMethod.IN_STORE_DINE_IN
        ) {
            continue;
        }
        const maxRadius = channelMaxRadius(ch.radiusMiles, ch.maxDriveHours);
        if (maxRadius !== null && distance <= maxRadius) methods.push(ch.deliveryMethod);
    }
    return { reaches: methods.length > 0, methods };
}

export async function resolveNearestLocation(
    lat: number,
    lng: number,
): Promise<ResolvedLocation | null> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const locations = await prisma.location.findMany({
        where: {
            isActive: true,
            latitude: { not: null },
            longitude: { not: null },
        },
        select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            allowsChannels: true,
            channels: {
                where: { isActive: true },
                select: { deliveryMethod: true, radiusMiles: true, maxDriveHours: true },
            },
        },
    });

    let bestReaching: { loc: typeof locations[number]; distance: number; methods: DeliveryMethod[] } | null = null;
    let nearestBakeryMiles: number | null = null;
    let shipLoc: { loc: typeof locations[number]; distance: number } | null = null;

    for (const loc of locations) {
        if (loc.latitude === null || loc.longitude === null) continue;
        const distance = distanceMiles(lat, lng, loc.latitude, loc.longitude);

        const isBakeryCapable = loc.allowsChannels.some(c => BAKERY_CHANNELS.includes(c));
        if (isBakeryCapable) {
            if (nearestBakeryMiles === null || distance < nearestBakeryMiles) nearestBakeryMiles = distance;
            const { reaches, methods } = localDeliveryReach(loc.channels, distance);
            if (reaches && (bestReaching === null || distance < bestReaching.distance)) {
                bestReaching = { loc, distance, methods };
            }
        }

        if (loc.allowsChannels.includes(SalesChannel.NATIONAL_SHIP)) {
            if (shipLoc === null || distance < shipLoc.distance) shipLoc = { loc, distance };
        }
    }

    if (bestReaching) {
        return {
            id: bestReaching.loc.id,
            name: bestReaching.loc.name,
            distanceMiles: bestReaching.distance,
            inServiceArea: true,
            reachableMethods: bestReaching.methods,
            nearestBakeryMiles,
        };
    }

    if (shipLoc) {
        return {
            id: shipLoc.loc.id,
            name: shipLoc.loc.name,
            distanceMiles: shipLoc.distance,
            inServiceArea: false,
            reachableMethods: [DeliveryMethod.UPS_2DAY],
            nearestBakeryMiles,
        };
    }

    return null;
}
