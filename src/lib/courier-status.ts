// Courier status sync — polling fallback + webhook diagnostics.
//
// Webhooks are the primary signal for courier state, but they depend on
// portal-side configuration we can't verify from code (URL + auth pasted into
// the DoorDash/Uber dashboards). Two safety nets live here:
//
//  1. recordCourierWebhookDebug() — every webhook ATTEMPT (accepted, auth-
//     failed, unmatched, unmapped) is recorded in a small SiteConfig ring
//     buffer per carrier, surfaced on /admin/locations. "Never received"
//     vs "auth failed" vs "unmatched id" is instantly visible.
//  2. pollCourierFulfillment() — asks the carrier's GET endpoint for live
//     state and applies it with the same monotonic guard as the webhooks.
//     Wired to a KDS refresh button and the reservation cron, so delivery
//     state stays correct even with zero webhook configuration.

import { prisma } from '@/lib/db';
import { doordashGetDelivery, mapDoorDashDeliveryStatus } from '@/lib/doordash';
import { uberGetDelivery, mapUberDirectStatus } from '@/lib/uber-direct';
import { sendCourierIssueOpsEmail, sendDeliveryIssueCustomerEmail } from '@/lib/email';

/* ─── Webhook debug ring buffer ────────────────────────────────────────── */

export type WebhookDebugEntry = {
    at: string;          // ISO timestamp
    ok: boolean;         // did we accept + apply it?
    note: string;        // human-readable outcome
    event?: string;
    externalId?: string;
};

const DEBUG_RING_SIZE = 8;

// Repeated identical outcomes (e.g. a scanner hammering the endpoint with bad
// auth) collapse into one entry per window: without this, 8 junk requests
// would flush the ring's genuine entries AND every unauthenticated POST would
// buy 2 DB round-trips — a free write-amplification lever on a public route.
const DEBUG_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

export async function recordCourierWebhookDebug(
    carrier: 'doordash' | 'uber',
    entry: Omit<WebhookDebugEntry, 'at'>,
): Promise<void> {
    try {
        const key = `courierWebhookDebug:${carrier}`;
        const row = await prisma.siteConfig.findFirst({ where: { key } });
        let events: WebhookDebugEntry[] = [];
        if (row) {
            try { events = (JSON.parse(row.value).events ?? []) as WebhookDebugEntry[]; } catch { /* reset */ }
        }
        const newest = events[0];
        if (
            newest &&
            newest.note === entry.note &&
            newest.event === entry.event &&
            Date.now() - new Date(newest.at).getTime() < DEBUG_DEDUPE_WINDOW_MS
        ) {
            return; // identical recent outcome — skip the write entirely
        }
        events.unshift({ at: new Date().toISOString(), ...entry });
        const value = JSON.stringify({ events: events.slice(0, DEBUG_RING_SIZE) });
        if (row) await prisma.siteConfig.update({ where: { id: row.id }, data: { value } });
        else await prisma.siteConfig.create({ data: { key, value } });
    } catch (e) {
        // Diagnostics must never break the webhook 200 ack.
        console.warn('[courier-debug] record failed:', e instanceof Error ? e.message : e);
    }
}

export async function getCourierWebhookDebug(): Promise<Record<'doordash' | 'uber', WebhookDebugEntry[]>> {
    const out: Record<'doordash' | 'uber', WebhookDebugEntry[]> = { doordash: [], uber: [] };
    for (const carrier of ['doordash', 'uber'] as const) {
        try {
            const row = await prisma.siteConfig.findFirst({ where: { key: `courierWebhookDebug:${carrier}` } });
            if (row) out[carrier] = ((JSON.parse(row.value).events ?? []) as WebhookDebugEntry[]).slice(0, DEBUG_RING_SIZE);
        } catch { /* leave empty */ }
    }
    return out;
}

/* ─── Polling fallback ─────────────────────────────────────────────────── */

const COURIER_RANK: Record<string, number> = {
    REQUESTED: 0, CONFIRMED: 1, OUT_FOR_DELIVERY: 2, DELIVERED: 3,
};

export type PollResult =
    | { ok: true; changed: boolean; courierStatus: string | null }
    | { ok: false; error: string };

/**
 * Fetch live courier state from the carrier and apply it (same monotonic
 * rules as the webhooks: never move backwards, DELIVERED is terminal and
 * completes the kitchen flow, first CANCELLED alerts ops).
 */
export async function pollCourierFulfillment(fulfillmentId: string): Promise<PollResult> {
    const f = await prisma.orderFulfillment.findUnique({
        where: { id: fulfillmentId },
        select: {
            id: true, orderId: true, locationId: true, deliveryMethod: true, status: true,
            courierStatus: true, externalOrderId: true,
            location: { select: { name: true, notificationEmail: true } },
            order: { select: { guestEmail: true, user: { select: { name: true, email: true } } } },
        },
    });
    if (!f) return { ok: false, error: 'Not found' };
    if (!f.externalOrderId) return { ok: false, error: 'No courier delivery booked yet' };
    if (f.courierStatus === 'DELIVERED' || f.courierStatus === 'CANCELLED') {
        return { ok: true, changed: false, courierStatus: f.courierStatus };
    }

    let mapped: 'CONFIRMED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'PENDING' | 'PREPARING' | null = null;
    let rawStatus: string | null = null;
    const info: {
        courierName?: string; courierPhone?: string;
        courierPickupEtaAt?: Date; courierDropoffEtaAt?: Date;
        trackingNumber?: string;
    } = {};

    if (f.deliveryMethod === 'DOORDASH_DRIVE') {
        const d = await doordashGetDelivery(f.externalOrderId);
        if (!d) return { ok: false, error: 'DoorDash did not return delivery state' };
        rawStatus = d.deliveryStatus;
        mapped = d.deliveryStatus ? mapDoorDashDeliveryStatus(d.deliveryStatus) : null;
        if (d.dasherName) info.courierName = d.dasherName;
        if (d.dasherPhone) info.courierPhone = d.dasherPhone;
        if (d.pickupTimeEstimated) { const t = new Date(d.pickupTimeEstimated); if (!isNaN(t.getTime())) info.courierPickupEtaAt = t; }
        if (d.dropoffTimeEstimated) { const t = new Date(d.dropoffTimeEstimated); if (!isNaN(t.getTime())) info.courierDropoffEtaAt = t; }
        if (d.trackingUrl) info.trackingNumber = d.trackingUrl;
    } else if (f.deliveryMethod === 'UBER_DIRECT') {
        const d = await uberGetDelivery(f.externalOrderId);
        if (!d) return { ok: false, error: 'Uber did not return delivery state' };
        rawStatus = d.status;
        mapped = d.status ? mapUberDirectStatus(d.status) : null;
        if (d.courierName) info.courierName = d.courierName;
        if (d.courierPhone) info.courierPhone = d.courierPhone;
        if (d.pickupEta) { const t = new Date(d.pickupEta); if (!isNaN(t.getTime())) info.courierPickupEtaAt = t; }
        if (d.dropoffEta) { const t = new Date(d.dropoffEta); if (!isNaN(t.getTime())) info.courierDropoffEtaAt = t; }
        if (d.trackingUrl) info.trackingNumber = d.trackingUrl;
    } else {
        return { ok: false, error: 'Not a courier delivery' };
    }

    // Info fields (courier identity, ETAs, tracking): latest-wins, unguarded —
    // same contract as the webhooks' info capture.
    if (Object.keys(info).length > 0) {
        await prisma.orderFulfillment.update({ where: { id: f.id }, data: info });
    }

    // Monotonic advance (mirrors the webhook guard).
    const current = f.courierStatus;
    let advance = false;
    if (mapped === 'CANCELLED') {
        advance = current !== 'CANCELLED';
    } else if (mapped && COURIER_RANK[mapped] !== undefined) {
        advance = current === null || COURIER_RANK[mapped] > (COURIER_RANK[current] ?? -1);
    }
    if (!advance || !mapped) {
        return { ok: true, changed: false, courierStatus: current };
    }

    // COMPARE-AND-SET, not read-then-write: the carrier GET sits between our
    // snapshot and this write, and a webhook can land inside that window. Only
    // the caller whose snapshot still holds may advance — the loser becomes a
    // silent no-op (no status write, NO side effects: no duplicate ops or
    // customer emails, no resurrecting a CANCELLED/DELIVERED written by the
    // webhook). Same flipped.count pattern as stripe-payment-sync.
    const won = await prisma.orderFulfillment.updateMany({
        where: { id: f.id, courierStatus: current },
        data: {
            courierStatus: mapped,
            // Terminal states complete the kitchen flow / clear stale
            // arrival substates — parity with the webhook writes.
            ...(mapped === 'DELIVERED' ? { status: 'DELIVERED' as const, courierSubstate: null } : {}),
            ...(mapped === 'CANCELLED' ? { courierSubstate: null } : {}),
        },
    });
    if (won.count === 0) {
        return { ok: true, changed: false, courierStatus: current };
    }

    if (mapped === 'DELIVERED') {
        // Roll up: if every fulfillment on the order is now DELIVERED, the
        // order itself is delivered (parity with the webhook routes — without
        // this, orders completed via poll sat CONFIRMED in the admin forever).
        const remaining = await prisma.orderFulfillment.count({
            where: { orderId: f.orderId, status: { not: 'DELIVERED' } },
        });
        if (remaining === 0) {
            await prisma.order.update({
                where: { id: f.orderId },
                data: { orderStatus: 'DELIVERED' },
            });
        }
    }

    if (mapped === 'CANCELLED') {
        const returned = (rawStatus ?? '').toLowerCase().includes('return');
        const opsTo = f.location.notificationEmail ?? process.env.BAKERY_NOTIFICATION_EMAIL;
        if (opsTo) {
            sendCourierIssueOpsEmail({
                to: opsTo,
                orderId: f.orderId,
                locationId: f.locationId,
                locationName: f.location.name,
                carrier: f.deliveryMethod === 'DOORDASH_DRIVE' ? 'DoorDash Drive' : 'Uber Direct',
                issue: `Carrier reports "${rawStatus}" (found by status poll) — this delivery will not be completed.`,
                kind: returned ? 'RETURNED' : 'CANCELLED',
            }).catch(e => console.warn('[courier-poll] ops email failed:', e instanceof Error ? e.message : e));
        }
        // The customer must hear about a dead delivery even when webhooks are
        // down — parity with the webhook routes.
        const customerTo = f.order.guestEmail ?? f.order.user?.email;
        if (customerTo) {
            sendDeliveryIssueCustomerEmail({
                to: customerTo,
                name: f.order.user?.name ?? null,
                orderId: f.orderId,
            }).catch(e => console.warn('[courier-poll] customer email failed:', e instanceof Error ? e.message : e));
        }
    }

    console.log('[courier-poll] Fulfillment', f.id, `courierStatus ${current ?? '(none)'} → ${mapped} (raw: ${rawStatus})`);
    return { ok: true, changed: true, courierStatus: mapped };
}

/**
 * Sweep: poll ACTIVE courier legs that haven't heard from their carrier
 * recently. Bounded so callers stay fast. Runs from three places so delivery
 * state self-updates regardless of webhook config or cron frequency (Vercel
 * Hobby crons fire only daily):
 *   - the cron (org-wide),
 *   - fetchLocationQueue via after() — every open KDS tablet keeps its own
 *     location's board fresh,
 *   - customer order pages via after() — each view refreshes that order.
 */
export async function pollActiveCourierDeliveries(opts?: {
    locationId?: string;
    orderId?: string;
    /** Skip rows the carrier answered about within this window. */
    staleMs?: number;
    limit?: number;
}): Promise<{ polled: number; advanced: number }> {
    const limit = opts?.limit ?? 15;
    const staleMs = opts?.staleMs ?? 2 * 60 * 1000;
    const candidates = await prisma.orderFulfillment.findMany({
        where: {
            ...(opts?.locationId ? { locationId: opts.locationId } : {}),
            ...(opts?.orderId ? { orderId: opts.orderId } : {}),
            deliveryMethod: { in: ['DOORDASH_DRIVE', 'UBER_DIRECT'] },
            externalOrderId: { not: null },
            status: { notIn: ['DELIVERED', 'CANCELLED'] },
            OR: [{ courierStatus: null }, { courierStatus: { notIn: ['DELIVERED', 'CANCELLED'] } }],
            // Stop polling stale test/abandoned deliveries after 48h.
            createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
            // Don't hammer the carrier: skip recently-touched rows
            // (a webhook or another poll just handled them).
            updatedAt: { lt: new Date(Date.now() - staleMs) },
        },
        select: { id: true },
        // Least-recently-touched FIRST: any poll that writes bumps updatedAt,
        // so the sweep round-robins through the active set instead of pinning
        // the newest 15 and starving older deliveries during a rush.
        orderBy: { updatedAt: 'asc' },
        take: limit,
    });
    let advanced = 0;
    for (const c of candidates) {
        const r = await pollCourierFulfillment(c.id).catch(() => null);
        if (r && r.ok && r.changed) advanced++;
        if (!r || !r.ok || !r.changed) {
            // Touch updatedAt even when nothing changed (or the carrier call
            // failed) — without this a quiet or dead row would stay at the
            // head of the updatedAt-asc queue and hog the sweep forever.
            // (Prisma skips empty-data updates entirely, so set it explicitly.)
            await prisma.orderFulfillment.update({ where: { id: c.id }, data: { updatedAt: new Date() } }).catch(() => undefined);
        }
    }
    return { polled: candidates.length, advanced };
}
