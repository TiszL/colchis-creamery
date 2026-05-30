// Phase 6 — Resolve (resolvepay.com) integration for B2B net-terms invoicing.
//
// IMPORTANT — SPEC VERIFICATION TODO:
// This wrapper is structured from typical B2B-BNPL API patterns. Before
// going to production, verify the actual endpoint paths + payload shapes
// against the live Resolve API documentation that ships with the merchant's
// account. Likely adjustments:
//   - Auth header (Bearer token vs HTTP Basic with API key)
//   - Resource paths (e.g. `/api/v1/charges` vs `/v2/invoices`)
//   - Field names (e.g. `amount_cents` vs `amount` (dollars))
//   - Webhook event names + signature header
// All wrapper functions return null on any failure so the caller can
// gracefully degrade (B2B order falls back to "Net-30 manual invoicing
// outside Resolve" with a logged warning) — this means the integration
// can be wired up incrementally and the spec corrected without breaking
// the rest of the platform.

const API_BASE = process.env.RESOLVE_API_BASE || 'https://app.resolvepay.com/api/v1';
const API_KEY  = process.env.RESOLVE_API_KEY;

const REQUEST_TIMEOUT_MS = 8_000;

export function isResolveConfigured(): boolean {
    return !!API_KEY;
}

async function resolveFetch<T>(path: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T | null> {
    if (!API_KEY) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            ...init,
            signal: ctrl.signal,
            headers: {
                'Content-Type': 'application/json',
                // TODO: confirm with Resolve docs — likely Bearer; some versions
                // use Basic with API key + empty password (mirror Stripe pattern).
                Authorization: `Bearer ${API_KEY}`,
                ...(init.headers || {}),
            },
        });
        const text = await res.text();
        if (!res.ok) {
            console.warn(`[resolve] ${init.method ?? 'GET'} ${path} → ${res.status} ${text.slice(0, 300)}`);
            return null;
        }
        return text ? JSON.parse(text) as T : null;
    } catch (e) {
        console.warn(`[resolve] ${init.method ?? 'GET'} ${path} threw: ${e instanceof Error ? e.message : 'unknown'}`);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/* ─── Customer creation + credit lookup ────────────────────────────────── */

export interface ResolveCustomerInput {
    partnerId: string;             // our B2bPartner.id — passed as external_ref
    companyName: string;
    contactName?: string;
    contactEmail: string;
    contactPhone?: string;
    businessAddress?: string;
    ein?: string;
}

/**
 * Create a Resolve customer. Called just-in-time on the partner's FIRST
 * net-terms order attempt (not on partner signup). Returns the Resolve
 * customer ID to persist on B2bPartner.resolveCustomerId.
 *
 * TODO (spec): confirm endpoint + payload. Typical BNPL pattern:
 *   POST /customers { external_ref, business_name, contact: {...}, ... }
 *   → { id, status }
 */
export async function createResolveCustomer(input: ResolveCustomerInput): Promise<{ customerId: string } | null> {
    const res = await resolveFetch<{ id: string }>('/customers', {
        method: 'POST',
        body: JSON.stringify({
            external_ref: input.partnerId,
            business_name: input.companyName,
            contact_name: input.contactName,
            contact_email: input.contactEmail,
            contact_phone: input.contactPhone,
            business_address: input.businessAddress,
            tax_id: input.ein,
        }),
    });
    if (!res?.id) return null;
    return { customerId: res.id };
}

export interface ResolveCreditStatus {
    approved: boolean;
    creditLimitCents: number | null;
    rawStatus: string | null;        // for storing on B2bPartner.resolveCreditStatus
}

/**
 * Pull current credit status for a Resolve customer. Cached on
 * B2bPartner.resolveCreditApproved + resolveCreditLimitCents.
 *
 * TODO (spec): confirm endpoint shape. Typical:
 *   GET /customers/{id} → { status, credit_limit, ... }
 */
export async function getResolveCreditStatus(customerId: string): Promise<ResolveCreditStatus | null> {
    const res = await resolveFetch<{
        status?: string;
        approved?: boolean;
        credit_limit?: number;        // dollars (TODO confirm — might be cents)
        credit_limit_cents?: number;
    }>(`/customers/${encodeURIComponent(customerId)}`, { method: 'GET' });
    if (!res) return null;

    // Defensive parsing — both shapes are plausible until spec confirmed.
    const approved = res.approved === true || res.status === 'approved' || res.status === 'active';
    const creditLimitCents =
        typeof res.credit_limit_cents === 'number' ? res.credit_limit_cents :
        typeof res.credit_limit === 'number' ? Math.round(res.credit_limit * 100) :
        null;

    return { approved, creditLimitCents, rawStatus: res.status ?? null };
}

/* ─── Charge creation (= net-terms invoice) ────────────────────────────── */

export interface CreateResolveChargeInput {
    customerId: string;
    amountCents: number;
    /** Net term in days — 7 / 15 / 30 / 45. */
    dueDays: number;
    /** Order ID (passed as external_ref for cross-system reconciliation). */
    orderRef: string;
    /** Short human-readable description (shows on Resolve dashboard + invoice). */
    description: string;
}

export interface ResolveCharge {
    chargeId: string;
    /** Hosted URL where the partner can pay (or view) this invoice. */
    invoicePayUrl: string | null;
    /** Resolve's status string for the charge (e.g. 'authorized', 'paid'). */
    status: string | null;
}

/**
 * Create a charge in Resolve. This is the net-terms equivalent of a Stripe
 * PaymentIntent. Caller persists chargeId on B2bInvoice.resolveInvoiceId.
 *
 * TODO (spec): confirm endpoint + due-date format. Typical:
 *   POST /charges {
 *     customer_id, amount_cents, due_days|due_date, description, external_ref
 *   } → { id, hosted_url, status }
 */
export async function createResolveCharge(input: CreateResolveChargeInput): Promise<ResolveCharge | null> {
    const res = await resolveFetch<{
        id?: string;
        hosted_url?: string;
        invoice_url?: string;
        status?: string;
    }>('/charges', {
        method: 'POST',
        body: JSON.stringify({
            customer_id: input.customerId,
            amount_cents: input.amountCents,
            due_days: input.dueDays,                    // TODO: some APIs use due_date (ISO string) instead
            description: input.description,
            external_ref: input.orderRef,
        }),
    });
    if (!res?.id) return null;
    return {
        chargeId: res.id,
        invoicePayUrl: res.hosted_url ?? res.invoice_url ?? null,
        status: res.status ?? null,
    };
}

/* ─── Webhook signature ────────────────────────────────────────────────── */

/**
 * Resolve webhook signature verification.
 *
 * TODO (spec): confirm header name + signing scheme. Typical pattern is
 * HMAC-SHA256 hex over raw body with RESOLVE_WEBHOOK_SECRET. Stripe-style
 * X-Signature header is most common. Permits unsigned in dev (no secret
 * set) so test webhooks fired from the Resolve dashboard work.
 */
import { createHmac, timingSafeEqual } from 'crypto';
const WEBHOOK_SECRET = process.env.RESOLVE_WEBHOOK_SECRET;

export function verifyResolveSignature(rawBody: string, headerValue: string | null): boolean {
    if (!WEBHOOK_SECRET) {
        // Fail closed in production — never accept unsigned webhooks live.
        if (process.env.NODE_ENV === 'production') return false;
        return true;
    }
    if (!headerValue) return false;
    const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
    try {
        return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(headerValue, 'hex'));
    } catch {
        return false;
    }
}

/**
 * Map Resolve charge status → our B2bInvoiceStatus.
 *
 * TODO (spec): replace with actual Resolve status enum once docs verified.
 */
export function mapResolveStatus(status: string | null): 'PENDING' | 'PAID' | 'OVERDUE' | 'WRITTEN_OFF' | null {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s === 'paid' || s === 'completed' || s === 'settled') return 'PAID';
    if (s === 'overdue' || s === 'past_due') return 'OVERDUE';
    if (s === 'written_off' || s === 'voided') return 'WRITTEN_OFF';
    if (s === 'pending' || s === 'authorized' || s === 'open') return 'PENDING';
    return null;
}
