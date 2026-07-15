// Phase 5 — EasyPost integration for NATIONAL_SHIP fulfillments (UPS 2nd
// Day Air preferred, FedEx 2Day fallback). EasyPost aggregator was chosen
// over direct UPS API for multi-carrier flexibility + lower per-label cost.
//
// Three operations exposed:
//   - easypostGetRate()     — used by getShippingQuote at cart/checkout time
//   - easypostBuyLabel()    — used by the Stripe webhook on payment success
//   - mapEasyPostTracker()  — webhook event → our OrderFulfillment.status enum
//
// Auth: HTTP Basic, username = EASYPOST_API_KEY, password empty.
// Base URL: https://api.easypost.com/v2 (same for test + production; the API
// key prefix determines environment — EZTK... is test, EZAK... is live).
//
// Falls back gracefully when EASYPOST_API_KEY is unset: returns null from
// the rate/buy calls so the caller can degrade to flat-fee or surface a
// clear error.

import { createHmac, timingSafeEqual } from 'crypto';

const API_BASE = process.env.EASYPOST_API_BASE || 'https://api.easypost.com/v2';
const API_KEY = process.env.EASYPOST_API_KEY;
const WEBHOOK_SECRET = process.env.EASYPOST_WEBHOOK_SECRET;

const QUOTE_TIMEOUT_MS = 5_000;
const BUY_TIMEOUT_MS   = 10_000;

/** Preferred carrier service hierarchy. We let EasyPost rate all services
 *  for the route, then pick the cheapest among these preferred services that
 *  can deliver the parcel. */
const PREFERRED_SERVICES = [
    { carrier: 'UPS',   service: 'NextDayAirSaver' },  // fastest cold-chain option
    { carrier: 'UPS',   service: 'Express' },          // UPS 2nd Day Air
    { carrier: 'FedEx', service: 'FEDEX_2_DAY' },      // FedEx 2Day fallback
    { carrier: 'UPS',   service: 'Expedited' },        // 3-day UPS as final fallback
] as const;

export function isEasyPostConfigured(): boolean {
    return !!API_KEY;
}

/* ─── HTTP helper ──────────────────────────────────────────────────────── */

async function epFetch<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T | null> {
    if (!API_KEY) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            ...init,
            signal: ctrl.signal,
            headers: {
                'Content-Type': 'application/json',
                // EasyPost Basic auth: API key + empty password
                Authorization: `Basic ${Buffer.from(`${API_KEY}:`).toString('base64')}`,
                ...(init.headers || {}),
            },
        });
        const text = await res.text();
        if (!res.ok) {
            console.warn(`[easypost] ${init.method ?? 'GET'} ${path} → ${res.status} ${text.slice(0, 300)}`);
            return null;
        }
        return text ? JSON.parse(text) as T : null;
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        console.warn(`[easypost] ${init.method ?? 'GET'} ${path} threw: ${msg}`);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/* ─── Types (subset of EasyPost responses we actually use) ─────────────── */

interface EpAddress {
    name?: string;
    company?: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
    email?: string;
}

interface EpParcel {
    /** Decimal inches */
    length: number;
    width: number;
    height: number;
    /** Decimal ounces. EasyPost accepts oz, lb, etc. — we standardize on oz. */
    weight: number;
}

interface EpRate {
    id: string;
    carrier: string;
    service: string;
    rate: string;        // dollars, decimal-string
    currency: string;
    delivery_days?: number | null;
    delivery_date?: string | null;
}

interface EpShipment {
    id: string;
    rates: EpRate[];
    selected_rate?: EpRate | null;
    tracking_code?: string | null;
    postage_label?: { label_url: string } | null;
}

interface EpTracker {
    id: string;
    tracking_code: string;
    status: EasyPostTrackerStatus;
    carrier: string;
    public_url?: string | null;
}

export type EasyPostTrackerStatus =
    | 'unknown'
    | 'pre_transit'
    | 'in_transit'
    | 'out_for_delivery'
    | 'delivered'
    | 'available_for_pickup'
    | 'return_to_sender'
    | 'failure'
    | 'cancelled'
    | 'error';

/* ─── Public API ───────────────────────────────────────────────────────── */

export interface RateQuote {
    rateId: string;
    carrier: string;
    service: string;
    feeCents: number;
    deliveryDays: number | null;
    deliveryDate: string | null;
}

/**
 * Get the cheapest preferred 2-day-ish rate between two addresses for a parcel.
 *
 * Strategy: create a shipment (rates are returned in the response), then pick
 * the cheapest rate matching our PREFERRED_SERVICES list, in priority order
 * within each tier (UPS 2Day cheapest > FedEx 2Day cheapest > UPS 3-day).
 *
 * Returns null when EasyPost isn't configured OR no preferred service can
 * serve the route — caller falls back to LocationChannel.flatFee.
 */
export async function easypostGetRate(opts: {
    from: EpAddress;
    to: EpAddress;
    parcel: EpParcel;
}): Promise<RateQuote | null> {
    const body = {
        shipment: {
            from_address: opts.from,
            to_address: opts.to,
            parcel: opts.parcel,
        },
    };
    const shipment = await epFetch<EpShipment>('/shipments', {
        method: 'POST',
        body: JSON.stringify(body),
    }, QUOTE_TIMEOUT_MS);
    if (!shipment || !shipment.rates || shipment.rates.length === 0) return null;

    return pickPreferredRate(shipment.rates);
}

function pickPreferredRate(rates: EpRate[]): RateQuote | null {
    for (const pref of PREFERRED_SERVICES) {
        const matching = rates.filter(r =>
            r.carrier.toUpperCase() === pref.carrier.toUpperCase() &&
            r.service.replace(/[_\s]/g, '').toUpperCase() === pref.service.replace(/[_\s]/g, '').toUpperCase()
        );
        if (matching.length === 0) continue;
        const cheapest = matching.reduce((a, b) => parseFloat(a.rate) < parseFloat(b.rate) ? a : b);
        return {
            rateId: cheapest.id,
            carrier: cheapest.carrier,
            service: cheapest.service,
            feeCents: Math.round(parseFloat(cheapest.rate) * 100),
            deliveryDays: cheapest.delivery_days ?? null,
            deliveryDate: cheapest.delivery_date ?? null,
        };
    }
    return null;
}

export interface BoughtLabel {
    shipmentId: string;
    trackingCode: string;
    labelUrl: string;
    carrier: string;
    service: string;
    feeCents: number;
}

/**
 * Create a shipment AND purchase the cheapest preferred 2-day rate in one
 * call. Used by the Stripe webhook on payment success for NATIONAL_SHIP
 * fulfillments. Returns null if rates couldn't be obtained or the buy
 * failed — caller logs + leaves OrderFulfillment in CONFIRMED for ops to
 * manually book.
 */
export async function easypostBuyLabel(opts: {
    from: EpAddress;
    to: EpAddress;
    parcel: EpParcel;
    /** Echoed back in tracker events — useful for filtering. */
    referenceOrderId: string;
}): Promise<BoughtLabel | null> {
    const created = await epFetch<EpShipment>('/shipments', {
        method: 'POST',
        body: JSON.stringify({
            shipment: {
                from_address: opts.from,
                to_address: opts.to,
                parcel: opts.parcel,
                reference: opts.referenceOrderId,
                options: { label_format: 'PDF' },
            },
        }),
    }, BUY_TIMEOUT_MS);
    if (!created) return null;

    const pick = pickPreferredRate(created.rates);
    if (!pick) {
        console.warn(`[easypost] no preferred rate available for shipment ${created.id} (order=${opts.referenceOrderId})`);
        return null;
    }

    const bought = await epFetch<EpShipment>(`/shipments/${created.id}/buy`, {
        method: 'POST',
        body: JSON.stringify({ rate: { id: pick.rateId } }),
    }, BUY_TIMEOUT_MS);
    if (!bought || !bought.tracking_code || !bought.postage_label?.label_url) {
        console.warn(`[easypost] buy returned no label for shipment ${created.id}`);
        return null;
    }
    return {
        shipmentId: bought.id,
        trackingCode: bought.tracking_code,
        labelUrl: bought.postage_label.label_url,
        carrier: pick.carrier,
        service: pick.service,
        feeCents: pick.feeCents,
    };
}

/** Fetch latest tracker for a tracking code. Webhook is the primary signal
 *  for status changes; this helper is for ad-hoc admin "refresh" buttons. */
export async function easypostFetchTracker(trackingCode: string): Promise<EpTracker | null> {
    const list = await epFetch<{ trackers: EpTracker[] }>(`/trackers?tracking_code=${encodeURIComponent(trackingCode)}`, {
        method: 'GET',
    }, QUOTE_TIMEOUT_MS);
    return list?.trackers?.[0] ?? null;
}

/* ─── Webhook handling ─────────────────────────────────────────────────── */

/**
 * Verify EasyPost's webhook signature (HMAC-SHA256 hex over raw body using
 * EASYPOST_WEBHOOK_SECRET as the key). Returns true when verified or when
 * no secret is configured (dev mode permits unsigned requests).
 *
 * Header: X-Hmac-Signature  (per EasyPost docs)
 */
export function verifyEasyPostSignature(rawBody: string, headerValue: string | null): boolean {
    if (!WEBHOOK_SECRET) {
        // Fail closed in production — never accept unsigned carrier webhooks live.
        if (process.env.NODE_ENV === 'production') return false;
        return true; // dev: accept unsigned
    }
    if (!headerValue) return false;
    const digest = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest();
    // EasyPost's X-Hmac-Signature may be hex- or base64-encoded depending on the
    // account/era — accept either (decoding hex-only would reject a valid
    // base64 signature). LAUNCH FIX: production events arrive PREFIXED
    // ("hmac-sha256-hex=<hex>" per EasyPost's docs) — without stripping it,
    // every genuine event failed verification. Compare timing-safe per candidate.
    const header = headerValue.trim().replace(/^hmac-sha256-(hex|base64)=/i, '');
    return [digest.toString('hex'), digest.toString('base64')].some(expected => {
        if (expected.length !== header.length) return false;
        try {
            return timingSafeEqual(Buffer.from(expected), Buffer.from(header));
        } catch {
            return false;
        }
    });
}

/**
 * Map EasyPost tracker status → our OrderFulfillment.status enum.
 * Unknown statuses return null so the webhook handler ignores them rather
 * than regressing a known-good state.
 */
export function mapEasyPostTracker(status: EasyPostTrackerStatus): 'CONFIRMED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | null {
    switch (status) {
        case 'pre_transit':
        case 'in_transit':           return 'CONFIRMED';
        case 'out_for_delivery':     return 'OUT_FOR_DELIVERY';
        case 'delivered':
        case 'available_for_pickup': return 'DELIVERED';
        case 'cancelled':
        case 'return_to_sender':
        case 'failure':              return 'CANCELLED';
        case 'unknown':
        case 'error':
        default:                     return null;
    }
}
