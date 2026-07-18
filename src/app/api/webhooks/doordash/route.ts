// Phase 8.1 — DoorDash Drive status webhook.
//
// DoorDash POSTs here on every delivery lifecycle event (created, dasher
// confirmed, picked up, dropped off, cancelled). We verify the Authorization
// header against the value we configured in DD's webhook dashboard, then
// map their event onto OrderFulfillment.courierStatus — NOT the kitchen
// `status` field, which staff own via the location portal (Accept/Preparing/
// Ready). Exception: a DELIVERED courier event also completes the kitchen
// flow (status='DELIVERED') and rolls up Order.orderStatus when every
// fulfillment on the order is delivered.
//
// Idempotency: a monotonic courierStatus rank ignores out-of-order/repeat
// deliveries. The fulfillment is matched via OrderFulfillment.externalOrderId
// (set when staff Accept books the delivery via '@/lib/carrier-dispatch').
//
// Webhook setup: in DoorDash developer dashboard → Webhooks → Add endpoint
// → URL = https://<your-public-host>/api/webhooks/doordash, Authentication
// type = Basic, Header key = Authorization, Header value = "Bearer <token>".
// That same value goes into DOORDASH_WEBHOOK_AUTH in our env.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapDoorDashEvent, verifyDoorDashAuth } from '@/lib/doordash';
import { recordCourierWebhookDebug } from '@/lib/courier-status';
import { sendCourierIssueOpsEmail, sendDeliveryIssueCustomerEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface DoorDashWebhookPayload {
    event_name?: string;
    event_id?: string;
    event_time?: string;
    delivery?: {
        external_delivery_id?: string;
        delivery_status?: string;
        tracking_url?: string;
        dasher_name?: string;
        dasher_phone_number_for_customer?: string;
        pickup_time_estimated?: string;
        dropoff_time_estimated?: string;
    };
}

/** Parse an ISO timestamp defensively — undefined when absent or unparseable. */
function parseWebhookDate(value: string | undefined): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
}

// Courier substate derived from the raw DD event (finer-grained than
// courierStatus): set on arrival confirmations, cleared once the dasher moves
// on (picked up / dropped off / completed) or the delivery dies.
const DD_SUBSTATE_SET: Record<string, string> = {
    dasher_confirmed_pickup_arrival: 'ARRIVED_AT_PICKUP',
    dasher_confirmed_dropoff_arrival: 'ARRIVED_AT_DROPOFF',
};
const DD_SUBSTATE_CLEAR = new Set([
    'dasher_picked_up',
    'dasher_dropped_off',
    'delivery_completed',
    'delivery_cancelled',
    'delivery_returned',
]);

export async function POST(req: Request) {
    const rawBody = await req.text();
    const authHeader = req.headers.get('authorization');

    // In production, refuse unauthenticated requests. In dev (no auth configured),
    // accept everything so test webhooks fired from the DD dashboard work.
    if (process.env.DOORDASH_WEBHOOK_AUTH) {
        if (!verifyDoorDashAuth(authHeader)) {
            console.warn('[doordash-webhook] Invalid Authorization header');
            await recordCourierWebhookDebug('doordash', { ok: false, note: 'AUTH FAILED — the auth value configured in the DD portal does not match DOORDASH_WEBHOOK_AUTH' });
            return new NextResponse('Invalid auth', { status: 401 });
        }
    } else if (process.env.NODE_ENV === 'production') {
        console.error('[doordash-webhook] DOORDASH_WEBHOOK_AUTH unset in production — refusing.');
        return new NextResponse('Webhook auth not configured', { status: 503 });
    } else {
        console.warn('[doordash-webhook] DOORDASH_WEBHOOK_AUTH unset — accepting unauthenticated request (dev)');
    }

    let payload: DoorDashWebhookPayload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return new NextResponse('Invalid JSON', { status: 400 });
    }

    const externalDeliveryId = payload.delivery?.external_delivery_id;
    // DD Drive v2 sends UPPER_SNAKE event names — normalize once; every
    // lookup below (mapping + substate tables) is lowercase.
    const eventName = payload.event_name?.toLowerCase();
    if (!externalDeliveryId || !eventName) {
        console.warn('[doordash-webhook] Missing external_delivery_id or event_name in payload');
        await recordCourierWebhookDebug('doordash', { ok: false, note: 'Payload missing external_delivery_id or event_name', event: payload.event_name });
        return new NextResponse('OK', { status: 200 });
    }

    const targetStatus = mapDoorDashEvent(eventName);
    if (!targetStatus) {
        // Unmapped event (e.g. dasher_started_shopping) — just acknowledge.
        console.log('[doordash-webhook] Unmapped event:', eventName);
        await recordCourierWebhookDebug('doordash', { ok: true, note: 'Received but unmapped event (ignored)', event: eventName, externalId: externalDeliveryId });
        return new NextResponse('OK', { status: 200 });
    }

    const fulfillment = await prisma.orderFulfillment.findFirst({
        where: { externalOrderId: externalDeliveryId },
        include: {
            location: { select: { name: true, notificationEmail: true } },
            order: { select: { guestEmail: true, user: { select: { name: true, email: true } } } },
        },
    });
    if (!fulfillment) {
        console.warn('[doordash-webhook] No fulfillment found for', externalDeliveryId);
        await recordCourierWebhookDebug('doordash', { ok: false, note: 'No order matches this delivery id — if simulating, advance the delivery OUR system created (do not create a new one in the simulator)', event: eventName, externalId: externalDeliveryId });
        return new NextResponse('OK', { status: 200 });
    }
    await recordCourierWebhookDebug('doordash', { ok: true, note: `Applied to order fulfillment ${fulfillment.id.slice(0, 8)}`, event: eventName, externalId: externalDeliveryId });

    // (b) Latest-wins live-info capture — dasher identity, ETAs, arrival
    // substate. Runs on EVERY mapped event for this fulfillment, even when the
    // monotonic rank guard below skips the courierStatus write (repeat/late
    // webhooks still carry the freshest ETA/dasher info).
    const infoData: {
        courierName?: string;
        courierPhone?: string;
        courierPickupEtaAt?: Date;
        courierDropoffEtaAt?: Date;
        courierSubstate?: string | null;
    } = {};
    if (payload.delivery?.dasher_name) infoData.courierName = payload.delivery.dasher_name;
    if (payload.delivery?.dasher_phone_number_for_customer) {
        infoData.courierPhone = payload.delivery.dasher_phone_number_for_customer;
    }
    const pickupEta = parseWebhookDate(payload.delivery?.pickup_time_estimated);
    if (pickupEta) infoData.courierPickupEtaAt = pickupEta;
    const dropoffEta = parseWebhookDate(payload.delivery?.dropoff_time_estimated);
    if (dropoffEta) infoData.courierDropoffEtaAt = dropoffEta;
    if (DD_SUBSTATE_SET[eventName]) {
        infoData.courierSubstate = DD_SUBSTATE_SET[eventName];
    } else if (DD_SUBSTATE_CLEAR.has(eventName)) {
        infoData.courierSubstate = null;
    }

    // (a) Monotonic courier-status rank: never move backwards. CANCELLED is
    // allowed from any non-DELIVERED state; DELIVERED is terminal. When the
    // guard trips we skip ONLY the status write — info capture above still
    // lands.
    const COURIER_RANK: Record<string, number> = {
        REQUESTED: 0, CONFIRMED: 1, OUT_FOR_DELIVERY: 2, DELIVERED: 3,
    };
    const current = fulfillment.courierStatus;
    let advanceStatus = true;
    if (current === 'DELIVERED') {
        advanceStatus = false;
    } else if (targetStatus === 'CANCELLED') {
        if (current === 'CANCELLED') advanceStatus = false;
    } else {
        if (current === 'CANCELLED') {
            console.warn(
                '[doordash-webhook] Late event for cancelled delivery on fulfillment',
                fulfillment.id, 'event:', eventName, '— ignoring',
            );
            advanceStatus = false;
        } else {
            const targetRank = COURIER_RANK[targetStatus];
            if (targetRank === undefined) {
                // PENDING/PREPARING have no courier meaning — ignore.
                advanceStatus = false;
            } else if (current !== null && targetRank <= (COURIER_RANK[current] ?? -1)) {
                advanceStatus = false; // stale / out-of-order event
            }
        }
    }

    try {
        const data = {
            ...(advanceStatus ? {
                courierStatus: targetStatus,
                // Courier DELIVERED completes the kitchen flow too.
                ...(targetStatus === 'DELIVERED' ? { status: 'DELIVERED' as const } : {}),
                ...(payload.delivery?.tracking_url ? { trackingNumber: payload.delivery.tracking_url } : {}),
            } : {}),
            ...infoData,
        };
        if (Object.keys(data).length === 0) {
            return new NextResponse('OK', { status: 200 }); // nothing to write
        }
        await prisma.orderFulfillment.update({
            where: { id: fulfillment.id },
            data,
        });
        if (!advanceStatus) {
            return new NextResponse('OK', { status: 200 }); // info-only write
        }
        console.log(
            '[doordash-webhook] Fulfillment', fulfillment.id,
            `courierStatus ${current ?? '(none)'} → ${targetStatus}`,
            `(event: ${eventName})`,
        );

        // First transition into CANCELLED (guaranteed by the guard above):
        // alert ops + the customer. Fire-and-forget — email failures must
        // never affect the 200 ack.
        if (targetStatus === 'CANCELLED') {
            const opsTo = fulfillment.location.notificationEmail ?? process.env.BAKERY_NOTIFICATION_EMAIL;
            if (opsTo) {
                sendCourierIssueOpsEmail({
                    to: opsTo,
                    orderId: fulfillment.orderId,
                    locationId: fulfillment.locationId,
                    locationName: fulfillment.location.name,
                    carrier: 'DoorDash',
                    issue: `DoorDash reported "${eventName}" — this delivery will not be completed.`,
                    kind: eventName === 'delivery_returned' ? 'RETURNED' : 'CANCELLED',
                }).catch(e => console.warn('[doordash-webhook] Ops email failed:', e instanceof Error ? e.message : e));
            }
            const customerTo = fulfillment.order.guestEmail ?? fulfillment.order.user.email;
            if (customerTo) {
                sendDeliveryIssueCustomerEmail({
                    to: customerTo,
                    name: fulfillment.order.user.name,
                    orderId: fulfillment.orderId,
                }).catch(e => console.warn('[doordash-webhook] Customer email failed:', e instanceof Error ? e.message : e));
            }
        }

        // Roll up: if every fulfillment on the order is now DELIVERED, the
        // order itself is delivered.
        if (targetStatus === 'DELIVERED') {
            const remaining = await prisma.orderFulfillment.count({
                where: { orderId: fulfillment.orderId, status: { not: 'DELIVERED' } },
            });
            if (remaining === 0) {
                await prisma.order.update({
                    where: { id: fulfillment.orderId },
                    data: { orderStatus: 'DELIVERED' },
                });
                console.log('[doordash-webhook] All fulfillments delivered — Order', fulfillment.orderId, '→ DELIVERED');
            }
        }
    } catch (e) {
        console.error('[doordash-webhook] Update failed:', e instanceof Error ? e.message : e);
        return new NextResponse('Internal error', { status: 500 });
    }

    return new NextResponse('OK', { status: 200 });
}
