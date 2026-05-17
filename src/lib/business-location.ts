/**
 * Single source of truth for the brand's primary business address.
 *
 * The `Location` table holds operational data (fulfillment routing, stocks,
 * channels) AND the display-layer fields backfilled in Phase α. Exactly one
 * row is `isPrimary=true`; this module hydrates that row into a fully-derived
 * DTO that every page renders from.
 *
 * Never inline-import the Prisma model into a public component — always go
 * through `getPrimaryLocation()` so caching, fallback, and formatting all live
 * in one place.
 *
 * Caching: wrapped in React `cache()` so multiple components in the same
 * server-render request hit the DB once.
 */
import { cache } from 'react';
import { prisma } from './db';

export type PrimaryLocation = {
    id: string;
    name: string;
    // address components
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    // geo
    latitude: number | null;
    longitude: number | null;
    // contact
    phone: string | null;
    // display
    contactCardName: string | null;
    contactCardDoorNote: string | null;
    displayDescription: string | null;
    displayBakeryHours: string | null;
    // computed
    /** "84 N High St, Dublin, OH 43017" — single line, comma-separated */
    formattedAddress: string;
    /** "84 N High St\nDublin, OH 43017" — newline-separated, suitable for white-space: pre-line */
    formattedAddressLines: string;
    /** "Dublin, OH 43017" */
    cityStateZip: string;
    /** Google Maps link for the "Get directions" button */
    mapUrl: string;
    /** Google Maps embeddable iframe URL */
    mapEmbedUrl: string;
};

// Last-ditch hardcoded fallback used only if the DB returns zero locations
// (e.g. seed not yet run on a fresh deploy). Mirrors the current Bakery row so
// preview / cold-start screenshots don't show "undefined".
const FALLBACK_FORMATTED = '84 N High St, Dublin, OH 43017';
const FALLBACK_FORMATTED_Q = encodeURIComponent(FALLBACK_FORMATTED);
const FALLBACK: PrimaryLocation = {
    id: '',
    name: 'Colchis Food',
    addressLine1: '84 N High St',
    addressLine2: null,
    city: 'Dublin',
    state: 'OH',
    postalCode: '43017',
    country: 'US',
    latitude: 40.0992,
    longitude: -83.1141,
    phone: '+1 (614) 377 6128',
    contactCardName: 'The Bakery',
    contactCardDoorNote: null,
    displayDescription: 'The bakery is open Wednesday through Sunday, 8 AM to 9 PM.',
    displayBakeryHours: 'Wed–Sun · 8a–9p',
    formattedAddress: FALLBACK_FORMATTED,
    formattedAddressLines: '84 N High St\nDublin, OH 43017',
    cityStateZip: 'Dublin, OH 43017',
    mapUrl: `https://maps.google.com/?q=${FALLBACK_FORMATTED_Q}`,
    mapEmbedUrl: `https://maps.google.com/maps?q=${FALLBACK_FORMATTED_Q}&z=13&output=embed`,
};

function hydrate(row: {
    id: string; name: string;
    addressLine1: string; addressLine2: string | null;
    city: string; state: string; postalCode: string; country: string;
    latitude: number | null; longitude: number | null; phone: string | null;
    contactCardName: string | null; contactCardDoorNote: string | null;
    displayDescription: string | null; displayBakeryHours: string | null;
}): PrimaryLocation {
    const cityStateZip = `${row.city}, ${row.state} ${row.postalCode}`.trim();
    const lineCombined = row.addressLine2
        ? `${row.addressLine1}, ${row.addressLine2}`
        : row.addressLine1;
    const formattedAddress = `${lineCombined}, ${cityStateZip}`;
    const formattedAddressLines = `${lineCombined}\n${cityStateZip}`;
    const q = encodeURIComponent(formattedAddress);
    return {
        id: row.id,
        name: row.name,
        addressLine1: row.addressLine1,
        addressLine2: row.addressLine2,
        city: row.city,
        state: row.state,
        postalCode: row.postalCode,
        country: row.country,
        latitude: row.latitude,
        longitude: row.longitude,
        phone: row.phone,
        contactCardName: row.contactCardName,
        contactCardDoorNote: row.contactCardDoorNote,
        displayDescription: row.displayDescription,
        displayBakeryHours: row.displayBakeryHours,
        formattedAddress,
        formattedAddressLines,
        cityStateZip,
        mapUrl: `https://maps.google.com/?q=${q}`,
        mapEmbedUrl: `https://maps.google.com/maps?q=${q}&z=13&output=embed`,
    };
}

/**
 * Returns the primary business location. Chooses, in order:
 *   1. The active row with `isPrimary=true`
 *   2. Any active BAKERY row
 *   3. Any active row
 *   4. A hardcoded fallback (only if DB has zero rows)
 *
 * Cached for the duration of a single server render via React `cache()`.
 */
export const getPrimaryLocation = cache(async (): Promise<PrimaryLocation> => {
    try {
        let row = await prisma.location.findFirst({
            where: { isPrimary: true, isActive: true },
            orderBy: { createdAt: 'asc' },
        });
        if (!row) {
            row = await prisma.location.findFirst({
                where: { type: 'BAKERY', isActive: true },
                orderBy: { createdAt: 'asc' },
            });
        }
        if (!row) {
            row = await prisma.location.findFirst({
                where: { isActive: true },
                orderBy: { createdAt: 'asc' },
            });
        }
        if (!row) return FALLBACK;
        return hydrate(row);
    } catch (e) {
        console.warn('[business-location] DB lookup failed, using fallback:', e);
        return FALLBACK;
    }
});

/**
 * Returns all locations flagged for public display, ordered by displayOrder
 * then createdAt. Primary is always first. Used by /contact for multi-location
 * sites; today returns one entry but will scale when you add more bakeries.
 */
export const getDisplayLocations = cache(async (): Promise<PrimaryLocation[]> => {
    try {
        const rows = await prisma.location.findMany({
            where: { showOnContactPage: true, isActive: true },
            orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
        });
        if (rows.length === 0) return [FALLBACK];
        return rows.map(hydrate);
    } catch (e) {
        console.warn('[business-location] DB lookup failed, using fallback:', e);
        return [FALLBACK];
    }
});
