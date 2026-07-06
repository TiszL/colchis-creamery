/**
 * Phase 1 (1f) — Server-side reader for the customer's selected location.
 *
 * The sticky LocationPicker writes to a cookie that Server Components read
 * here to scope the catalog. Mirror of LocationProvider on the client.
 */
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { LOCATION_COOKIE_NAME } from "@/providers/LocationProvider";
import type { SalesChannel } from "@prisma/client";

export interface SelectedLocation {
    id: string;
    name: string;
    allowsChannels: SalesChannel[];
}

/**
 * Returns the customer's selected serving location, or null if no cookie
 * is set or the cookie references a no-longer-active location.
 *
 * Catalog pages call this and then filter products to those (a) stocked
 * at this location AND (b) whose salesChannel is in the location's
 * allowsChannels list. See `productCatalogWhereForLocation()`.
 */
export async function getSelectedLocation(): Promise<SelectedLocation | null> {
    const cookieStore = await cookies();
    const id = cookieStore.get(LOCATION_COOKIE_NAME)?.value;
    if (!id) return null;

    const loc = await prisma.location.findUnique({
        where: { id },
        select: { id: true, name: true, allowsChannels: true, isActive: true },
    });
    if (!loc || !loc.isActive) return null;
    return { id: loc.id, name: loc.name, allowsChannels: loc.allowsChannels };
}

/**
 * Prisma where-clause partial that, given a selected location, restricts
 * Product results to SKUs that (a) have a Stock row at that location and
 * (b) belong to a SalesChannel the location allows.
 *
 * Pass `null` to opt out of location filtering (used when the customer has
 * not yet picked a location — typically not the case post-Phase-1e since
 * we auto-pick the primary bakery).
 */
export function productCatalogWhereForLocation(loc: SelectedLocation | null) {
    if (!loc) return {};
    return {
        // Phase 9c: respect the per-location menu toggle — a stock row the
        // location manager disabled must not surface the product publicly
        // (matches the *-availability actions, which filter isEnabled too).
        stocks: { some: { locationId: loc.id, isEnabled: true } },
        salesChannel: { in: loc.allowsChannels },
    };
}
