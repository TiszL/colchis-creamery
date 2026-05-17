// Phase 9 — US phone validation + normalization.
//
// Required-US: customer + bakery phones get sent to DoorDash / Uber Direct
// dispatch APIs, both of which validate against NANP rules and reject the
// reserved 555 area-code fictional ranges. We enforce real-looking US E.164
// at the checkout form so bad data never reaches dispatch.
//
// Used by: CheckoutClient form validation + the createCheckoutSession action's
// server-side normalization (before storing on Order.guestPhone / User.phone).
//
// NANP rules enforced here:
//   - 10 significant digits (plus optional leading 1 / +1 country code)
//   - Area code first digit: 2-9 (rejects 0/1-prefixed area codes)
//   - Exchange first digit: 2-9 (same)
// Stricter checks (carrier-validity, real area-code lookup) are out of scope —
// the dispatch step will fail-loud if a carrier rejects.

/** Normalize free-form US phone input to E.164 ("+1XXXXXXXXXX") or null if invalid. */
export function normalizeUSPhone(input: string | null | undefined): string | null {
    if (!input) return null;
    let digits = input.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1); // drop the leading country code
    }
    if (digits.length !== 10) return null;
    // NANP: area code + exchange first digit must be 2-9
    if (digits[0] < '2' || digits[0] > '9') return null;
    if (digits[3] < '2' || digits[3] > '9') return null;
    return `+1${digits}`;
}

/** True if input parses to a valid US E.164 phone number. */
export function isValidUSPhone(input: string | null | undefined): boolean {
    return normalizeUSPhone(input) !== null;
}
