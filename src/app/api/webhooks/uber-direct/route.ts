// Phase 8.2 — Uber Direct status webhook.
//
// Uber POSTs delivery lifecycle events here. Verifies the signature, maps the
// status onto OrderFulfillment.courierStatus — NOT the kitchen `status` field,
// which staff own via the location portal. Exception: a DELIVERED courier
// event also completes the kitchen flow (status='DELIVERED') and rolls up
// Order.orderStatus when every fulfillment on the order is delivered. Matches
// the row by externalOrderId (= Uber's delivery id, set when staff Accept
// books the delivery via '@/lib/carrier-dispatch').
//
// Idempotency: a monotonic courierStatus rank ignores out-of-order/repeat
// deliveries.
//
// Webhook setup: configure in Uber Direct dashboard to POST to
// https://yourdomain.com/api/webhooks/uber-direct with the X-Uber-Signature
// header. Use UBER_DIRECT_WEBHOOK_SECRET as the signing key (separate from
// the OAuth client_secret).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapUberDirectStatus, verifyUberDirectSignature } from '@/lib/uber-direct';
import { sendCourierIssueOpsEmail, sendDeliveryIssueCustomerEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface UberWebhookPayload {
    // Uber's webhook shape has varied across API versions. Accept both common shapes:
    //   { kind: "event.delivery_status", delivery_id, status, ... }
    //   { event_type: "delivery.status", delivery: { id, status, ... } }
    kind?: string;
    event_type?: string;
    delivery_id?: string;
    status?: string;
    delivery?: {
        id?: string;
        status?: string;
        tracking_url?: string;
    };
}

export async function POST(req: Request) {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('x-uber-signature');

    if (process.env.UBER_DIRECT_WEBHOOK_SECRET) {
        if (!verifyUberDirectSignature(rawBody, signatureHeader)) {
            console.warn('[uber-direct-webhook] Invalid signature');
            return new NextResponse('Invalid signature', { status: 401 });
        }
    } else if (process.env.NODE_ENV === 'production') {
        console.error('[uber-direct-webhook] UBER_DIRECT_WEBHOOK_SECRET unset in production — refusing.');
        return new NextResponse('Webhook secret not configured', { status: 503 });
    } else {
        console.warn('[uber-direct-webhook] UBER_DIRECT_WEBHOOK_SECRET unset — accepting unsigned request (dev)');
    }

    let payload: UberWebhookPayload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return new NextResponse('Invalid JSON', { status: 400 });
    }

    // Normalize across the two known payload shapes
    const deliveryId = payload.delivery?.id ?? payload.delivery_id;
    const status = payload.delivery?.status ?? payload.status;
    if (!deliveryId || !status) {
        console.warn('[uber-direct-webhook] Missing delivery id or status in payload');
        return new NextResponse('OK', { status: 200 }); // ack so Uber stops retrying
    }

    const targetStatus = mapUberDirectStatus(status);
    if (!targetStatus) {
        console.log('[uber-direct-webhook] Unmapped status:', status);
        return new NextResponse('OK', { status: 200 });
    }

    const fulfillment = await prisma.orderFulfillment.findFirst({
        where: { externalOrderId: deliveryId },
        include: {
            location: { select: { name: true, notificationEmail: true } },
            order: { select: { guestEmail: true, user: { select: { name: true, email: true } } } },
        },
    });
    if (!fulfillment) {
        console.warn('[uber-direct-webhook] No fulfillment found for delivery', deliveryId);
        return new NextResponse('OK', { status: 200 });
    }

    // Monotonic courier-status rank (same as DoorDash webhook): never move
    // backwards. CANCELLED is allowed from any non-DELIVERED state; DELIVERED
    // is terminal.
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
                '[uber-direct-webhook] Late event for cancelled delivery on fulfillment',
                fulfillment.id, 'status:', status, '— ignoring',
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
            '[uber-direct-webhook] Fulfillment', fulfillment.id,
            `courierStatus ${current ?? '(none)'} → ${targetStatus}`,
            `(status: ${status})`,
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
                    carrier: 'Uber Direct',
                    issue: `Uber Direct reported "${status}" — this delivery will not be completed.`,
                    kind: status === 'returned' ? 'RETURNED' : 'CANCELLED',
                }).catch(e => console.warn('[uber-direct-webhook] Ops email failed:', e instanceof Error ? e.message : e));
            }
            const customerTo = fulfillment.order.guestEmail ?? fulfillment.order.user.email;
            if (customerTo) {
                sendDeliveryIssueCustomerEmail({
                    to: customerTo,
                    name: fulfillment.order.user.name,
                    orderId: fulfillment.orderId,
                }).catch(e => console.warn('[uber-direct-webhook] Customer email failed:', e instanceof Error ? e.message : e));
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
                console.log('[uber-direct-webhook] All fulfillments delivered — Order', fulfillment.orderId, '→ DELIVERED');
            }
        }
    } catch (e) {
        console.error('[uber-direct-webhook] Update failed:', e instanceof Error ? e.message : e);
        return new NextResponse('Internal error', { status: 500 });
    }

    return new NextResponse('OK', { status: 200 });
}
