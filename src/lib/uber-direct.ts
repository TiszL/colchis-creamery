// Phase 8.2 — Uber Direct integration.
//
// Same shape as DoorDash Drive (Phase 8.1):
//   - quote API → wired into getShippingQuote for UBER_DIRECT channel
//   - delivery API → called from Stripe webhook on payment_intent.succeeded
//   - status webhook → /api/webhooks/uber-direct updates OrderFulfillment.status
//
// Differences from DoorDash:
//   - Auth: OAuth2 client_credentials (vs DD's custom DD-JWT-V1). Token cached
//     in-memory module-level with TTL.
//   - Addresses: Uber requires structured JSON-encoded address objects (not
//     free-text). That's why planFulfillment now plumbs parsed address
//     components through to getShippingQuote.
//   - Customer ID is in the URL path (per-merchant scoping).
//
// Falls back gracefully when credentials are missing — quote/delivery calls
// return null so callers degrade to flat-fee + log a warning.

import { createHmac, timingSafeEqual } from 'crypto';

const API_BASE = process.env.UBER_DIRECT_API_BASE || 'https://api.uber.com';
const TOKEN_URL = process.env.UBER_DIRECT_TOKEN_URL || 'https://login.uber.com/oauth/v2/token';
const CLIENT_ID = process.env.UBER_DIRECT_CLIENT_ID;
const CLIENT_SECRET = process.env.UBER_DIRECT_CLIENT_SECRET;
const CUSTOMER_ID = process.env.UBER_DIRECT_CUSTOMER_ID;
const WEBHOOK_SECRET = process.env.UBER_DIRECT_WEBHOOK_SECRET;

export function isUberDirectConfigured(): boolean {
    return !!(CLIENT_ID && CLIENT_SECRET && CUSTOMER_ID);
}

/* ─── OAuth2 token cache ───────────────────────────────────────────────── */

let cachedToken: { token: string; expiresAt: number } | null = null;

// Phase 8.x perf fix: 3-second timeout for the OAuth fetch + 5-second for the
// API requests. Tokens are cached, so the OAuth call only runs on cold start.
const OAUTH_TIMEOUT_MS = 3000;
const API_TIMEOUT_MS = 5000;

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...init, signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
}

async function getAccessToken(): Promise<string | null> {
    if (!CLIENT_ID || !CLIENT_SECRET) return null;
    // Refresh 60s before expiry to avoid race conditions on the boundary
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
        return cachedToken.token;
    }
    try {
        const res = await fetchWithTimeout(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                scope: 'eats.deliveries',
            }).toString(),
        }, OAUTH_TIMEOUT_MS);
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            console.warn(`[uber-direct] OAuth ${res.status}: ${text.slice(0, 200)}`);
            return null;
        }
        const data = await res.json() as { access_token?: string; expires_in?: number };
        if (!data.access_token) return null;
        cachedToken = {
            token: data.access_token,
            // expires_in is seconds; default 30-day window if missing
            expiresAt: Date.now() + ((data.expires_in ?? 60 * 60 * 24 * 30) * 1000),
        };
        return cachedToken.token;
    } catch (err) {
        console.error('[uber-direct] OAuth error:', err instanceof Error ? err.message : err);
        return null;
    }
}

async function uberRequest(path: string, init?: RequestInit): Promise<Response | null> {
    if (!CUSTOMER_ID) return null;
    const token = await getAccessToken();
    if (!token) return null;
    return fetchWithTimeout(`${API_BASE}/v1/customers/${CUSTOMER_ID}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    }, API_TIMEOUT_MS);
}

/* ─── Address helper ───────────────────────────────────────────────────── */

export type UberAddressInput = {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string; // ISO-2: 'US', 'CA', etc.
};

/** Uber wants a JSON-encoded address STRING inside the outer request JSON. */
function encodeAddress(a: UberAddressInput): string {
    return JSON.stringify({
        street_address: [a.line1, a.line2].filter(Boolean),
        city: a.city,
        state: a.state,
        zip_code: a.postalCode,
        country: a.country || 'US',
    });
}

/* ─── Quote ────────────────────────────────────────────────────────────── */

export type UberQuoteRequest = {
    pickup: { address: UberAddressInput; phone: string };
    dropoff: { address: UberAddressInput; phone: string };
    orderValueCents: number;
};

export type UberQuoteResponse = {
    quoteId: string;
    feeCents: number;
    durationMinutes: number | null;
    expiresAt: Date | null;
};

/** Same sentinel + outcome type as doordash.ts — re-exported for symmetry. */
export const UNDELIVERABLE = 'undeliverable' as const;
export type QuoteOutcome<T> = T | null | typeof UNDELIVERABLE;

/**
 * Get a live shipping quote. Returns:
 *   - UberQuoteResponse  → quote succeeded, use real price
 *   - 'undeliverable'    → Uber explicitly refuses (outside delivery radius) — caller should EXCLUDE this channel
 *   - null               → unknown / outage / misconfig — caller MAY fall back to flat-fee
 */
export async function uberCreateQuote(req: UberQuoteRequest): Promise<QuoteOutcome<UberQuoteResponse>> {
    if (!isUberDirectConfigured()) return null;
    try {
        const body = {
            pickup_address: encodeAddress(req.pickup.address),
            pickup_phone_number: req.pickup.phone,
            dropoff_address: encodeAddress(req.dropoff.address),
            dropoff_phone_number: req.dropoff.phone,
            manifest_total_value: req.orderValueCents,
        };
        const res = await uberRequest('/delivery_quotes', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        if (!res || !res.ok) {
            const text = res ? await res.text().catch(() => '') : '';
            // Detect Uber's explicit "we don't serve this address" so the caller
            // can drop the channel entirely instead of presenting a flatFee that
            // would fail at dispatch time. Uber's error code is "address_undeliverable".
            if (res?.status === 400 && /address_undeliverable|not.*deliverable.*area|outside.*delivery.*radius/i.test(text)) {
                console.warn('[uber-direct] address not deliverable — excluding channel');
                return UNDELIVERABLE;
            }
            console.warn(`[uber-direct] quote ${res?.status ?? 'no-response'}: ${text.slice(0, 200)}`);
            return null;
        }
        const data = await res.json() as {
            id?: string;
            fee?: number;
            duration?: number; // seconds
            expires?: string;
        };
        if (!data.id) return null;
        return {
            quoteId: data.id,
            feeCents: data.fee ?? 0,
            durationMinutes: data.duration ? Math.ceil(data.duration / 60) : null,
            expiresAt: data.expires ? new Date(data.expires) : null,
        };
    } catch (err) {
        console.error('[uber-direct] quote error:', err instanceof Error ? err.message : err);
        return null;
    }
}

/* ─── Create delivery ──────────────────────────────────────────────────── */

export type UberCreateDeliveryRequest = {
    externalOrderId: string;
    pickup: {
        name: string;
        address: UberAddressInput;
        phone: string;
        businessName?: string;
        instructions?: string;
    };
    dropoff: {
        firstName: string;
        lastName?: string;
        address: UberAddressInput;
        phone: string;
        email?: string;
        instructions?: string;
    };
    orderValueCents: number;
    items: { name: string; quantity: number; description?: string }[];
    /** Optional quote_id from a prior uberCreateQuote() — locks in the price. */
    quoteId?: string;
};

export type UberCreateDeliveryResponse = {
    deliveryId: string;
    trackingUrl?: string;
    feeCents?: number;
};

export async function uberCreateDelivery(
    req: UberCreateDeliveryRequest,
): Promise<UberCreateDeliveryResponse | null> {
    if (!isUberDirectConfigured()) return null;
    try {
        const dropoffName = [req.dropoff.firstName, req.dropoff.lastName].filter(Boolean).join(' ').trim();
        const body = {
            pickup_name: req.pickup.businessName || req.pickup.name,
            pickup_address: encodeAddress(req.pickup.address),
            pickup_phone_number: req.pickup.phone,
            pickup_notes: req.pickup.instructions,
            dropoff_name: dropoffName || 'Customer',
            dropoff_address: encodeAddress(req.dropoff.address),
            dropoff_phone_number: req.dropoff.phone,
            dropoff_email: req.dropoff.email,
            dropoff_notes: req.dropoff.instructions,
            manifest_items: req.items.map(i => ({
                name: i.name,
                quantity: i.quantity,
                description: i.description,
            })),
            manifest_reference: req.externalOrderId,
            manifest_total_value: req.orderValueCents,
            quote_id: req.quoteId,
        };
        const res = await uberRequest('/deliveries', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        if (!res || !res.ok) {
            const text = res ? await res.text().catch(() => '') : '';
            console.error(`[uber-direct] create-delivery ${res?.status ?? 'no-response'}: ${text.slice(0, 300)}`);
            return null;
        }
        const data = await res.json() as {
            id?: string;
            tracking_url?: string;
            fee?: number;
        };
        if (!data.id) return null;
        return {
            deliveryId: data.id,
            trackingUrl: data.tracking_url,
            feeCents: data.fee,
        };
    } catch (err) {
        console.error('[uber-direct] create-delivery error:', err instanceof Error ? err.message : err);
        return null;
    }
}

/* ─── Cancel delivery ──────────────────────────────────────────────────── */

/**
 * Cancel an in-flight delivery. Called from cancelOrder / refundOrder when
 * the customer or an admin cancels within the policy window. Best-effort:
 * Uber may reject the cancel if a courier is too close to pickup — we log
 * and the caller continues (the customer's Stripe refund has already
 * succeeded; carrier reconciliation is an admin concern).
 */
export async function uberCancelDelivery(deliveryId: string): Promise<boolean> {
    if (!isUberDirectConfigured()) return false;
    if (!deliveryId) return false;
    try {
        const res = await uberRequest(
            `/deliveries/${encodeURIComponent(deliveryId)}/cancel`,
            { method: 'POST' },
        );
        if (!res || !res.ok) {
            const text = res ? await res.text().catch(() => '') : '';
            console.warn(`[uber-direct] cancel-delivery ${res?.status ?? 'no-response'}: ${text.slice(0, 200)}`);
            return false;
        }
        return true;
    } catch (err) {
        console.error('[uber-direct] cancel-delivery error:', err instanceof Error ? err.message : err);
        return false;
    }
}

/* ─── Webhook ──────────────────────────────────────────────────────────── */

/** Map an Uber Direct webhook status string → our OrderFulfillment.status enum.
 *  Returns null for unmapped statuses (we acknowledge but don't act on them). */
export function mapUberDirectStatus(status: string):
    | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'
    | null {
    switch (status) {
        case 'pending':
        case 'pickup':
            return 'CONFIRMED';
        case 'pickup_complete':
            return 'OUT_FOR_DELIVERY';
        case 'dropoff':
        case 'dropoff_arrived':
            return 'OUT_FOR_DELIVERY';
        case 'delivered':
            return 'DELIVERED';
        case 'canceled':
        case 'cancelled':
        case 'returned':
            return 'CANCELLED';
        default:
            return null;
    }
}

/** Verify an Uber Direct webhook signature.
 *  Header: X-Uber-Signature (hex-encoded HMAC-SHA256 of the raw body using
 *  UBER_DIRECT_WEBHOOK_SECRET as the key). */
export function verifyUberDirectSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader || !WEBHOOK_SECRET) return false;
    try {
        const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
        const actual = signatureHeader.replace(/^sha256=/, '').trim();
        if (expected.length !== actual.length) return false;
        return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
    } catch {
        return false;
    }
}

