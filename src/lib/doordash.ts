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

/**
 * Get a live shipping quote. Returns null on failure (missing config, bad
 * address, DoorDash outage, etc.) — caller should fall back to flat-fee.
 */
export async function doordashCreateQuote(
    req: DoorDashQuoteRequest,
): Promise<DoorDashQuoteResponse | null> {
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

/* ─── Webhook ──────────────────────────────────────────────────────────── */

/** Map a DoorDash webhook event name to our OrderFulfillment.status enum.
 *  Returns null for unmapped events (we acknowledge but don't act on them). */
export function mapDoorDashEvent(eventName: string):
    | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'
    | null {
    switch (eventName) {
        case 'delivery_created':
        case 'dasher_confirmed':
        case 'dasher_confirmed_pickup_arrival':
            return 'CONFIRMED';
        case 'dasher_picked_up':
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

/** Verify a DoorDash webhook signature header.
 *  DoorDash signs the raw request body with HMAC-SHA256 + signing secret. */
export function verifyDoorDashSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader || !SIGNING_SECRET) return false;
    try {
        const secretBuf = Buffer.from(SIGNING_SECRET, 'base64');
        const expected = createHmac('sha256', secretBuf).update(rawBody).digest('hex');
        const actual = signatureHeader.replace(/^sha256=/, '').trim();
        if (expected.length !== actual.length) return false;
        return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
    } catch {
        return false;
    }
}
