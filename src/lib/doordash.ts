// Phase 8.1 — DoorDash Drive integration.
//
// Replaces the LocationChannel.flatFee shipping quote for the DOORDASH_DRIVE
// channel with a live API call. Authentication is a custom JWT signed with
// HS256 using the DoorDash signing secret (base64-decoded raw bytes).
//
// Three operations exposed:
//   - doordashCreateQuote()   — used by getShippingQuote at cart/checkout time
//   - doordashCreateDelivery() — used by the Stripe webhook on payment success
//   - mapDoorDashEvent()      — webhook event → our OrderFulfillment.status enum
//
// Sandbox vs production is selected via DOORDASH_API_BASE env var (defaults to
// openapi.doordash.com which serves both — keys determine the environment).
//
// JWT spec (per DoorDash Drive API v2):
//   header  { alg: HS256, typ: JWT, 'dd-ver': 'DD-JWT-V1', kid: <KEY_ID> }
//   payload { aud: 'doordash', iss: <DEVELOPER_ID>, kid: <KEY_ID>, exp, iat }
//   sig     HMAC-SHA256 over `${header}.${payload}` with base64-decoded secret
//
// Falls back gracefully when credentials are unset: returns null from quote /
// delivery calls so the caller can degrade to flat-fee or surface a clear error.

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const API_BASE = process.env.DOORDASH_API_BASE || 'https://openapi.doordash.com';
const DEVELOPER_ID = process.env.DOORDASH_DEVELOPER_ID;
const KEY_ID = process.env.DOORDASH_KEY_ID;
const SIGNING_SECRET = process.env.DOORDASH_SIGNING_SECRET;

/** True when all three required credentials are present. */
export function isDoorDashConfigured(): boolean {
    return !!(DEVELOPER_ID && KEY_ID && SIGNING_SECRET);
}

/* ─── JWT signing (DD-JWT-V1) ──────────────────────────────────────────── */

function signJWT(): string {
    if (!SIGNING_SECRET || !KEY_ID || !DEVELOPER_ID) {
        throw new Error('[doordash] credentials not configured');
    }
    const now = Math.floor(Date.now() / 1000);
    const header = {
        alg: 'HS256',
        typ: 'JWT',
        'dd-ver': 'DD-JWT-V1',
        kid: KEY_ID,
    };
    const payload = {
        aud: 'doordash',
        iss: DEVELOPER_ID,
        kid: KEY_ID,
        exp: now + 30 * 60, // 30-minute window — DoorDash recommends short-lived tokens
        iat: now,
    };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const data = `${encodedHeader}.${encodedPayload}`;
    const secretBuf = Buffer.from(SIGNING_SECRET, 'base64');
    const sig = createHmac('sha256', secretBuf).update(data).digest('base64url');
    return `${data}.${sig}`;
}

// Phase 8.x perf fix: 3-second timeout so a slow carrier doesn't stall the
// whole planFulfillment / cart render. Aborted calls bubble up as null from
// quote/delivery functions → callers fall back to flat-fee.
const DEFAULT_TIMEOUT_MS = 3000;

async function ddRequest(path: string, init?: RequestInit): Promise<Response> {
    const jwt = signJWT();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
        return await fetch(`${API_BASE}${path}`, {
            ...init,
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${jwt}`,
                'Content-Type': 'application/json',
                ...init?.headers,
            },
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

/* ─── Quote ────────────────────────────────────────────────────────────── */

export type DoorDashQuoteRequest = {
    pickup: { address: string; phone: string; businessName?: string };
    dropoff: { address: string; phone: string; businessName?: string };
    orderValueCents: number;
};

export type DoorDashQuoteResponse = {
    externalDeliveryId: string;
    feeCents: number;
    etaMinutes: number | null;
    expiresAt: Date | null;
};

/** Sentinel returned when DoorDash explicitly says the address can't be served
 *  (vs a generic outage/null where we don't know and might fall back to flatFee). */
export const UNDELIVERABLE = 'undeliverable' as const;
export type QuoteOutcome<T> = T | null | typeof UNDELIVERABLE;

/**
 * Get a live shipping quote. Returns:
 *   - DoorDashQuoteResponse  → quote succeeded, use real price
 *   - 'undeliverable'        → DD explicitly refuses (out of radius, etc.) — caller should EXCLUDE this channel
 *   - null                   → unknown / outage / misconfig — caller MAY fall back to flat-fee
 */
export async function doordashCreateQuote(
    req: DoorDashQuoteRequest,
): Promise<QuoteOutcome<DoorDashQuoteResponse>> {
    if (!isDoorDashConfigured()) return null;
    const externalDeliveryId = `quote-${randomBytes(12).toString('hex')}`;
    const body = {
        external_delivery_id: externalDeliveryId,
        pickup_address: req.pickup.address,
        pickup_phone_number: req.pickup.phone,
        pickup_business_name: req.pickup.businessName,
        dropoff_address: req.dropoff.address,
        dropoff_phone_number: req.dropoff.phone,
        dropoff_business_name: req.dropoff.businessName,
        order_value: req.orderValueCents,
        currency: 'USD',
    };
    try {
        const res = await ddRequest('/drive/v2/quotes', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            // Detect "explicit refusal" patterns so the caller can drop the channel
            // entirely instead of presenting a flatFee that won't actually dispatch.
            if (res.status === 400 && /unable_to_quote|outside.*(radius|range)|undeliverable|cannot_deliver/i.test(text)) {
                console.warn('[doordash] address not deliverable — excluding channel');
                return UNDELIVERABLE;
            }
            console.warn(`[doordash] quote ${res.status}: ${text.slice(0, 200)}`);
            return null;
        }
        const data = await res.json() as {
            fee?: number;
            delivery_time_estimate?: number; // seconds
            expires_at?: string;
        };
        return {
            externalDeliveryId,
            feeCents: data.fee ?? 0,
            etaMinutes: data.delivery_time_estimate ? Math.ceil(data.delivery_time_estimate / 60) : null,
            expiresAt: data.expires_at ? new Date(data.expires_at) : null,
        };
    } catch (err) {
        console.error('[doordash] quote error:', err instanceof Error ? err.message : err);
        return null;
    }
}

/* ─── Create delivery ──────────────────────────────────────────────────── */

export type DoorDashCreateDeliveryRequest = {
    /** Our internal order id — used to build a deterministic external_delivery_id. */
    externalOrderId: string;
    pickup: { address: string; phone: string; businessName: string; instructions?: string };
    dropoff: {
        address: string;
        phone: string;
        firstName: string;
        lastName?: string;
        email?: string;
        businessName?: string;
        instructions?: string;
    };
    orderValueCents: number;
    items?: { name: string; quantity: number; description?: string }[];
    /** KDS — when the kitchen will have the order handoff-ready. DoorDash
     *  schedules dasher assignment so arrival converges with this time
     *  (`pickup_time`, RFC3339). Omit = ASAP dispatch. */
    pickupReadyAt?: Date;
    /** Leave-at-door dropoff (platform decision — sealed/insulated packaging). */
    contactlessDropoff?: boolean;
};

export type DoorDashCreateDeliveryResponse = {
    externalDeliveryId: string;
    trackingUrl?: string;
    feeCents?: number;
};

/**
 * Create the actual delivery — called from the Stripe webhook on
 * payment_intent.succeeded for each OrderFulfillment with channel=DOORDASH_DRIVE.
 * The returned external_delivery_id should be persisted to
 * OrderFulfillment.externalOrderId for webhook correlation.
 */
export async function doordashCreateDelivery(
    req: DoorDashCreateDeliveryRequest,
): Promise<DoorDashCreateDeliveryResponse | null> {
    if (!isDoorDashConfigured()) return null;
    // Suffix with timestamp + random to keep external_delivery_id unique even if
    // a single order ever has multiple DD legs (rare but possible).
    const externalDeliveryId = `${req.externalOrderId}-dd-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const body = {
        external_delivery_id: externalDeliveryId,
        pickup_address: req.pickup.address,
        pickup_phone_number: req.pickup.phone,
        pickup_business_name: req.pickup.businessName,
        pickup_instructions: req.pickup.instructions,
        dropoff_address: req.dropoff.address,
        dropoff_phone_number: req.dropoff.phone,
        dropoff_first_name: req.dropoff.firstName,
        dropoff_last_name: req.dropoff.lastName,
        dropoff_email: req.dropoff.email,
        dropoff_business_name: req.dropoff.businessName,
        dropoff_instructions: req.dropoff.instructions,
        order_value: req.orderValueCents,
        currency: 'USD',
        items: req.items?.map(i => ({
            name: i.name,
            quantity: i.quantity,
            description: i.description,
        })),
        // KDS: kitchen-readiness time — dasher arrival converges with this
        // instead of racing to a kitchen that hasn't started cooking.
        ...(req.pickupReadyAt ? { pickup_time: req.pickupReadyAt.toISOString() } : {}),
        ...(req.contactlessDropoff ? { contactless_dropoff: true } : {}),
    };
    try {
        const res = await ddRequest('/drive/v2/deliveries', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            console.error(`[doordash] create-delivery ${res.status}: ${text.slice(0, 300)}`);
            return null;
        }
        const data = await res.json() as { tracking_url?: string; fee?: number };
        return {
            externalDeliveryId,
            trackingUrl: data.tracking_url,
            feeCents: data.fee,
        };
    } catch (err) {
        console.error('[doordash] create-delivery error:', err instanceof Error ? err.message : err);
        return null;
    }
}

/* ─── Cancel delivery ──────────────────────────────────────────────────── */

/**
 * Cancel an in-flight delivery. Called from cancelOrder / refundOrder when
 * the customer or an admin cancels within the policy window. Best-effort:
 * if the driver has already picked up the order DoorDash will reject the
 * cancel with 4xx — we log and let the caller continue (the customer's
 * Stripe refund has already gone through).
 */
export async function doordashCancelDelivery(externalDeliveryId: string): Promise<boolean> {
    if (!isDoorDashConfigured()) return false;
    if (!externalDeliveryId) return false;
    try {
        const res = await ddRequest(
            `/drive/v2/deliveries/${encodeURIComponent(externalDeliveryId)}/cancel`,
            { method: 'PUT' },
        );
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            console.warn(`[doordash] cancel-delivery ${res.status}: ${text.slice(0, 200)}`);
            return false;
        }
        return true;
    } catch (err) {
        console.error('[doordash] cancel-delivery error:', err instanceof Error ? err.message : err);
        return false;
    }
}

/* ─── Webhook ──────────────────────────────────────────────────────────── */

/** Map a DoorDash webhook event name to our OrderFulfillment.status enum.
 *  Returns null for unmapped events (we acknowledge but don't act on them). */
/** Poll the live state of a delivery we created. Null on any failure —
 *  polling is a best-effort fallback for missing webhooks, never a blocker. */
export async function doordashGetDelivery(externalDeliveryId: string): Promise<{
    deliveryStatus: string | null;
    dasherName: string | null;
    dasherPhone: string | null;
    pickupTimeEstimated: string | null;
    dropoffTimeEstimated: string | null;
    trackingUrl: string | null;
} | null> {
    if (!isDoorDashConfigured()) return null;
    try {
        const res = await ddRequest(`/drive/v2/deliveries/${encodeURIComponent(externalDeliveryId)}`);
        if (!res.ok) {
            console.warn('[doordash] getDelivery failed:', res.status, externalDeliveryId);
            return null;
        }
        const data = await res.json() as Record<string, unknown>;
        return {
            deliveryStatus: typeof data.delivery_status === 'string' ? data.delivery_status : null,
            dasherName: typeof data.dasher_name === 'string' ? data.dasher_name : null,
            dasherPhone: typeof data.dasher_phone_number_for_customer === 'string' ? data.dasher_phone_number_for_customer : null,
            pickupTimeEstimated: typeof data.pickup_time_estimated === 'string' ? data.pickup_time_estimated : null,
            dropoffTimeEstimated: typeof data.dropoff_time_estimated === 'string' ? data.dropoff_time_estimated : null,
            trackingUrl: typeof data.tracking_url === 'string' ? data.tracking_url : null,
        };
    } catch (e) {
        console.warn('[doordash] getDelivery error:', e instanceof Error ? e.message : e);
        return null;
    }
}

export function mapDoorDashEvent(eventName: string):
    | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'
    | null {
    // DD Drive v2 sends UPPER_SNAKE event names (DASHER_CONFIRMED, …). We
    // normalize so either casing maps — the original lowercase table silently
    // dropped every real webhook as "unmapped".
    switch (eventName.toLowerCase()) {
        case 'delivery_created':
        case 'dasher_confirmed':
        case 'dasher_enroute_to_pickup':
        case 'dasher_confirmed_pickup_arrival':
            return 'CONFIRMED';
        case 'dasher_picked_up':
        case 'dasher_enroute_to_dropoff':
        case 'dasher_confirmed_dropoff_arrival':
            return 'OUT_FOR_DELIVERY';
        case 'dasher_dropped_off':
        case 'delivery_completed':
            return 'DELIVERED';
        case 'delivery_cancelled':
        case 'delivery_returned':
            return 'CANCELLED';
        default:
            return null;
    }
}

/** Map a GET /drive/v2/deliveries/{id} `delivery_status` value (different
 *  vocabulary than webhook event names) onto our courierStatus enum. Used by
 *  the polling fallback so delivery state stays fresh even when portal
 *  webhooks are missing or misconfigured. */
export function mapDoorDashDeliveryStatus(status: string):
    | 'CONFIRMED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'
    | null {
    switch (status.toLowerCase()) {
        case 'created':
        case 'confirmed':
        case 'dasher_confirmed':
        case 'enroute_to_pickup':
        case 'arrived_at_pickup':
            return 'CONFIRMED';
        case 'picked_up':
        case 'enroute_to_dropoff':
        case 'arrived_at_dropoff':
            return 'OUT_FOR_DELIVERY';
        case 'delivered':
            return 'DELIVERED';
        case 'cancelled':
        case 'canceled':
        case 'returned':
            return 'CANCELLED';
        default:
            return null;
    }
}

/** Verify an incoming DoorDash webhook by comparing the Authorization header
 *  against the expected value configured in DD's webhook dashboard.
 *
 *  DD's webhook UI uses what they call "Basic" authentication-type — but it's
 *  not HTTP Basic Auth; it's "send this custom header with this exact value
 *  on every webhook call". By convention we use header `Authorization` with a
 *  Bearer-style token, so the value DD sends is e.g. "Bearer <token>". We
 *  store the entire expected header value in DOORDASH_WEBHOOK_AUTH and
 *  constant-time-compare to prevent timing leaks. */
export function verifyDoorDashAuth(authHeader: string | null): boolean {
    const expected = process.env.DOORDASH_WEBHOOK_AUTH;
    if (!expected || !authHeader) return false;
    if (expected.length !== authHeader.length) return false;
    try {
        return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(authHeader, 'utf8'));
    } catch {
        return false;
    }
}
