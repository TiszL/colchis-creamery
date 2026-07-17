// 86 workflow — the shared orderability predicate for Stock rows.
//
// Two independent axes control per-location availability:
//  * Stock.isEnabled      — the permanent menu toggle (manager-only). When
//                           false the SKU is hidden from listings entirely.
//  * Stock.disabledUntil  — a day-of "86" (kitchen can set it). The SKU stays
//                           LISTED but is not orderable until the instant
//                           passes; it self-expires — no cron re-enables it.
//
// Every query that decides "can this be ordered right now" (offered
// channels, availability actions, checkout planning, B2B order + cron) must
// use this fragment. Listing VISIBILITY intentionally checks only isEnabled
// (see productCatalogWhereForLocation) so an 86'd item still shows with an
// unavailable state instead of vanishing mid-day.

/** Prisma where-fragment: this Stock row is currently sellable. */
export function sellableStockWhere(now: Date = new Date()) {
    return {
        isEnabled: true,
        OR: [{ disabledUntil: null }, { disabledUntil: { lte: now } }],
    };
}

/** True when a Stock row (already isEnabled) is under an active day-of 86. */
export function isEightySixed(
    stock: { isEnabled: boolean; disabledUntil: Date | null },
    now: Date = new Date(),
): boolean {
    return stock.isEnabled && stock.disabledUntil !== null && stock.disabledUntil > now;
}
