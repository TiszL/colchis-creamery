// Phase 8.2 — Uber Direct status webhook.
//
// Uber POSTs delivery lifecycle events here. Verifies the signature, maps the
// status to our OrderFulfillment.status enum, and updates the matching row by
// externalOrderId (= Uber's delivery id, set when we created the delivery in
// the Stripe webhook).
//
// Idempotency: state-machine checks ensure repeat deliveries are no-ops.
//
// Webhook setup: configure in Uber Direct dashboard to POST to
// https://yourdomain.com/api/webhooks/uber-direct with the X-Uber-Signature
// header. Use UBER_DIRECT_WEBHOOK_SECRET as the signing key (separate from
// the OAuth client_secret).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapUberDirectStatus, verifyUberDirectSignature } from '@/lib/uber-direct';

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
    } else {
        console.warn('[uber-direct-webhook] UBER_DIRECT_WEBHOOK_SECRET unset — accepting unsigned request');
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
    });
    if (!fulfillment) {
        console.warn('[uber-direct-webhook] No fulfillment found for delivery', deliveryId);
        return new NextResponse('OK', { status: 200 });
    }

    // Idempotency + terminal guards (same as DoorDash webhook)
    if (fulfillment.status === targetStatus) {
        return new NextResponse('OK', { status: 200 });
    }
    if (fulfillment.status === 'CANCELLED' && targetStatus !== 'CANCELLED') {
        console.warn(
            '[uber-direct-webhook] Late event for cancelled fulfillment',
            fulfillment.id, 'status:', status, '— ignoring',
        );
        return new NextResponse('OK', { status: 200 });
    }
    if (fulfillment.status === 'DELIVERED' && targetStatus !== 'DELIVERED' && targetStatus !== 'CANCELLED') {
        return new NextResponse('OK', { status: 200 });
    }

    try {
        await prisma.orderFulfillment.update({
            where: { id: fulfillment.id },
            data: {
                status: targetStatus,
                ...(payload.delivery?.tracking_url ? { trackingNumber: payload.delivery.tracking_url } : {}),
            },
        });
        console.log(
            '[uber-direct-webhook] Fulfillment', fulfillment.id,
            `${fulfillment.status} → ${targetStatus}`,
            `(status: ${status})`,
        );
    } catch (e) {
        console.error('[uber-direct-webhook] Update failed:', e instanceof Error ? e.message : e);
        return new NextResponse('Internal error', { status: 500 });
    }

    return new NextResponse('OK', { status: 200 });
}
