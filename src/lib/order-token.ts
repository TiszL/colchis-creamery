// Phase 7b.3 — Signed tokens for guest order lookup.
//
// Guests place an order without an account (or with a passwordless User row).
// The confirmation email includes a link like /orders/<token> that decodes back
// to a single orderId. The token is HS256-signed and expires (default 30 days),
// so the link is shareable only by whoever has the email and only for a bounded
// window.
//
// Separate secret from JWT_SECRET (the session secret) so a leak of one doesn't
// compromise the other. Falls back to JWT_SECRET in dev for one-secret simplicity.

import { SignJWT, jwtVerify } from 'jose';

// Phase 7b.4 hardening: in production, refuse to start without an explicit
// secret. A fallback to a hardcoded dev string would let anyone forge tokens
// for any orderId — a serious privacy leak. Fail loud (Rule 12) instead.
function resolveSecret(): string {
    const explicit = process.env.ORDER_LOOKUP_SECRET;
    if (explicit) return explicit;
    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            '[order-token] ORDER_LOOKUP_SECRET is required in production. ' +
            'Set it to a strong random string in your deployment environment.',
        );
    }
    // Dev/test: fall back to JWT_SECRET for one-secret simplicity, or a
    // well-known placeholder so local dev works out of the box.
    return process.env.JWT_SECRET || 'dev-secret-change-in-production';
}

const SECRET = new TextEncoder().encode(resolveSecret());

const DEFAULT_EXPIRY = '30d';

export async function signOrderToken(orderId: string, expiry: string = DEFAULT_EXPIRY): Promise<string> {
    return new SignJWT({ orderId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiry)
        .sign(SECRET);
}

export async function verifyOrderToken(token: string): Promise<{ orderId: string } | null> {
    try {
        const { payload } = await jwtVerify(token, SECRET);
        if (typeof payload.orderId !== 'string') return null;
        return { orderId: payload.orderId };
    } catch {
        return null;
    }
}
