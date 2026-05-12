// Phase 8.1 — DoorDash Drive status webhook.
//
// DoorDash POSTs here on every delivery lifecycle event (created, dasher
// confirmed, picked up, dropped off, cancelled). We verify the signature,
// map their event to our OrderFulfillment.status enum, and update the row.
//
// Idempotency: state-machine checks ensure repeat deliveries are no-ops. The
// fulfillment is matched via OrderFulfillment.externalOrderId (which we set
// when creating the delivery in the Stripe webhook).
//
// Webhook setup: configure in DoorDash developer dashboard to POST to
// https://yourdomain.com/api/webhooks/doordash with the X-DoorDash-Signature
// header. Use the same signing secret that the JWT auth uses.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapDoorDashEvent, verifyDoorDashSignature } from '@/lib/doordash';

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
    const signatureHeader = req.headers.get('x-doordash-signature');

    // In production, refuse unsigned requests. In dev (no secret configured),
    // accept everything so test webhooks fired from the DD dashboard work.
    if (process.env.DOORDASH_SIGNING_SECRET) {
        if (!verifyDoorDashSignature(rawBody, signatureHeader)) {
            console.warn('[doordash-webhook] Invalid signature');
            return new NextResponse('Invalid signature', { status: 401 });
        }
    } else {
        console.warn('[doordash-webhook] DOORDASH_SIGNING_SECRET unset — accepting unsigned request');
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

    // Idempotency: skip if already at target. Never regress DELIVERED or
    // re-open CANCELLED (terminal states).
    if (fulfillment.status === targetStatus) {
        return new NextResponse('OK', { status: 200 });
    }
    if (fulfillment.status === 'CANCELLED' && targetStatus !== 'CANCELLED') {
        console.warn(
            '[doordash-webhook] Late event for cancelled fulfillment',
            fulfillment.id, 'event:', eventName, '— ignoring',
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
            '[doordash-webhook] Fulfillment', fulfillment.id,
            `${fulfillment.status} → ${targetStatus}`,
            `(event: ${eventName})`,
        );
    } catch (e) {
        console.error('[doordash-webhook] Update failed:', e instanceof Error ? e.message : e);
        return new NextResponse('Internal error', { status: 500 });
    }

    return new NextResponse('OK', { status: 200 });
}
