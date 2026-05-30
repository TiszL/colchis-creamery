/**
 * Tier 2 — wholesale order constraints (MOQ + case multiples).
 *
 * One pure validator shared by the bulk-order form (advisory, inline) and
 * /api/b2b/order (authoritative). Keeping a single source prevents the two
 * from drifting. All fields optional — null means "no constraint".
 */
export interface B2bQtyConstraints {
    caseSize?: number | null;     // units per case; qty must be a whole-case multiple
    minOrderQty?: number | null;  // per-line floor in units
    unitLabel?: string | null;    // display name for one unit (e.g. "lb", "jar")
}

/** Human-readable name for one unit. Defaults to "unit". */
export function unitLabelOf(c: B2bQtyConstraints): string {
    return c.unitLabel?.trim() || "unit";
}

/**
 * Validate a single order-line quantity. Callers pass qty > 0 (zero-qty lines
 * are dropped before ordering). Returns null when valid, else a short reason.
 */
export function validateB2bQty(qty: number, c: B2bQtyConstraints): string | null {
    const min = c.minOrderQty && c.minOrderQty > 0 ? c.minOrderQty : null;
    const caseSize = c.caseSize && c.caseSize > 0 ? c.caseSize : null;
    if (min && qty < min) return `Minimum ${min} per order`;
    if (caseSize && qty % caseSize !== 0) return `Must be a multiple of ${caseSize} (case)`;
    return null;
}

/** Compact constraint summary for UI hints, e.g. "Case of 12 · min 24". Empty when unconstrained. */
export function constraintHint(c: B2bQtyConstraints): string {
    const parts: string[] = [];
    if (c.caseSize && c.caseSize > 0) parts.push(`Case of ${c.caseSize}`);
    if (c.minOrderQty && c.minOrderQty > 0) parts.push(`min ${c.minOrderQty}`);
    return parts.join(" · ");
}
