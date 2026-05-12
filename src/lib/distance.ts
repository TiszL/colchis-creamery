// Geo-distance helpers used by delivery-radius logic.
//
// PRODUCTION NOTE: static great-circle distance is an approximation. For real ETAs
// and accurate road-network coverage, swap to Google Distance Matrix API at quote
// time. Static math is fine for MVP / radius gating.

const EARTH_RADIUS_MILES = 3958.8;

/** Distance between two lat/lng points in miles (Haversine). */
export function distanceMiles(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(toLat - fromLat);
    const dLng = toRad(toLng - fromLng);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_MILES * c;
}

/**
 * Convert a channel's reach (radiusMiles OR maxDriveHours) into a single max-radius value.
 * Uses ~50 mph average road speed when only drive-hours is configured (UPS-style channels).
 * Returns null when the channel has neither constraint (e.g., in-store channels).
 */
export function channelMaxRadius(
    radiusMiles: number | null,
    maxDriveHours: number | null,
): number | null {
    if (radiusMiles !== null) return radiusMiles;
    if (maxDriveHours !== null) return maxDriveHours * 50; // rough avg highway speed
    return null;
}
