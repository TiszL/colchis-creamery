// Launch hardening — DB-backed fixed-window rate limiter.
//
// Why not Redis/Upstash: not in the stack, and at this store's traffic a
// single indexed upsert per guarded request is cheap. Card testing on
// checkout is the #1 launch-week attack on new stores; credential stuffing
// and 6-digit-code brute force are the others. All three only need "slow the
// caller to human speed", not perfect distributed accounting.
//
// Fail-open BY DESIGN: if the limiter's own DB call fails we allow the
// request — a database hiccup must degrade to "no rate limiting", never to
// "nobody can log in or pay".

import { headers } from 'next/headers';
import { prisma } from '@/lib/db';

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Count a hit against `key` in the current fixed window. Returns ok:false
 * once the window's count exceeds `max`.
 */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<RateLimitResult> {
    const windowMs = windowSec * 1000;
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    try {
        const row = await prisma.rateLimit.upsert({
            where: { key_windowStart: { key, windowStart } },
            create: { key, windowStart, count: 1 },
            update: { count: { increment: 1 } },
        });

        // Opportunistic cleanup (~1% of calls): drop windows older than a day.
        if (Math.random() < 0.01) {
            prisma.rateLimit
                .deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
                .catch(() => undefined);
        }

        if (row.count > max) {
            const retryAfterSec = Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000);
            console.warn(`[rate-limit] BLOCKED key=${key} count=${row.count}/${max} window=${windowSec}s`);
            return { ok: false, retryAfterSec: Math.max(retryAfterSec, 1) };
        }
        return { ok: true };
    } catch (e) {
        console.error('[rate-limit] limiter unavailable — failing open:', e instanceof Error ? e.message : e);
        return { ok: true };
    }
}

/**
 * Best-effort caller IP for rate-limit keys. On Vercel, x-forwarded-for's
 * first hop is the client. 'unknown' still buckets anonymous abuse together
 * rather than disabling the limit.
 */
export async function callerIp(): Promise<string> {
    try {
        const h = await headers();
        const xff = h.get('x-forwarded-for');
        if (xff) return xff.split(',')[0].trim();
        return h.get('x-real-ip')?.trim() || 'unknown';
    } catch {
        return 'unknown';
    }
}

/** Standard message for blocked callers (shown verbatim in form errors). */
export function rateLimitMessage(r: { retryAfterSec: number }): string {
    const min = Math.ceil(r.retryAfterSec / 60);
    return min <= 1
        ? 'Too many attempts — please wait a minute and try again.'
        : `Too many attempts — please wait ${min} minutes and try again.`;
}
