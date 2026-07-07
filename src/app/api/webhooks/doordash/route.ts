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
    };
}

export async function POST(req: Request) {
    const rawBody = await req.text();
    const authHeader = req.headers.get('authorization');

    // In production, refuse unauthenticated requests. In dev (no auth configured),
    // accept everything so test webhooks fired from the DD dashboard work.
    if (process.env.DOORDASH_WEBHOOK_AUTH) {
        if (!verifyDoorDashAuth(authHeader)) {
            console.warn('[doordash-webhook] Invalid Authorization header');
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
    const eventName = payload.event_name;
    if (!externalDeliveryId || !eventName) {
        console.warn('[doordash-webhook] Missing external_delivery_id or event_name in payload');
        return new NextResponse('OK', { status: 200 });
    }

    const targetStatus = mapDoorDashEvent(eventName);
    if (!targetStatus) {
        // Unmapped event (e.g. dasher_started_shopping) — just acknowledge.
        console.log('[doordash-webhook] Unmapped event:', eventName);
        return new NextResponse('OK', { status: 200 });
    }

    const fulfillment = await prisma.orderFulfillment.findFirst({
        where: { externalOrderId: externalDeliveryId },
    });
    if (!fulfillment) {
        console.warn('[doordash-webhook] No fulfillment found for', externalDeliveryId);
        return new NextResponse('OK', { status: 200 });
    }

    // Monotonic courier-status rank: never move backwards. CANCELLED is
    // allowed from any non-DELIVERED state; DELIVERED is terminal.
    const COURIER_RANK: Record<string, number> = {
        REQUESTED: 0, CONFIRMED: 1, OUT_FOR_DELIVERY: 2, DELIVERED: 3,
    };
    const current = fulfillment.courierStatus;
    if (current === 'DELIVERED') {
        return new NextResponse('OK', { status: 200 });
    }
    if (targetStatus === 'CANCELLED') {
        if (current === 'CANCELLED') return new NextResponse('OK', { status: 200 });
    } else {
        if (current === 'CANCELLED') {
            console.warn(
                '[doordash-webhook] Late event for cancelled delivery on fulfillment',
                fulfillment.id, 'event:', eventName, '— ignoring',
            );
            return new NextResponse('OK', { status: 200 });
        }
        const targetRank = COURIER_RANK[targetStatus];
        if (targetRank === undefined) {
            // PENDING/PREPARING have no courier meaning — ignore.
            return new NextResponse('OK', { status: 200 });
        }
        if (current !== null && targetRank <= (COURIER_RANK[current] ?? -1)) {
            return new NextResponse('OK', { status: 200 }); // stale / out-of-order event
        }
    }

    try {
        await prisma.orderFulfillment.update({
            where: { id: fulfillment.id },
            data: {
                courierStatus: targetStatus,
                // Courier DELIVERED completes the kitchen flow too.
                ...(targetStatus === 'DELIVERED' ? { status: 'DELIVERED' } : {}),
                ...(payload.delivery?.tracking_url ? { trackingNumber: payload.delivery.tracking_url } : {}),
            },
        });
        console.log(
            '[doordash-webhook] Fulfillment', fulfillment.id,
            `courierStatus ${current ?? '(none)'} → ${targetStatus}`,
            `(event: ${eventName})`,
        );

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
