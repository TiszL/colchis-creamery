// Phase 5 (5d) — EasyPost tracker status webhook.
//
// EasyPost POSTs here whenever a tracker status changes for a shipment we
// bought a label for (NATIONAL_SHIP fulfillments). We verify the
// X-Hmac-Signature header against EASYPOST_WEBHOOK_SECRET, then map
// EasyPost's tracker.status to our OrderFulfillment.status enum and
// update the row.
//
// Idempotency: same state-machine pattern as DD/Uber webhooks. Never
// regresses DELIVERED or re-opens CANCELLED.
//
// Webhook setup: in EasyPost dashboard → Webhooks → Add endpoint →
// URL = https://<your-public-host>/api/webhooks/easypost,
// Secret = (generate one; copy into EASYPOST_WEBHOOK_SECRET env).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapEasyPostTracker, verifyEasyPostSignature, type EasyPostTrackerStatus } from '@/lib/easypost';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface EpWebhookPayload {
    description?: string;            // e.g. "tracker.updated"
    result?: {
        id?: string;
        tracking_code?: string;
        status?: EasyPostTrackerStatus;
        shipment_id?: string;
        public_url?: string;
    };
}

export async function POST(req: Request) {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hmac-signature');

    if (!verifyEasyPostSignature(rawBody, signature)) {
        console.warn('[easypost-webhook] Invalid X-Hmac-Signature');
        return new NextResponse('Invalid signature', { status: 401 });
    }

    let payload: EpWebhookPayload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return new NextResponse('Invalid JSON', { status: 400 });
    }

    // Only act on tracker events; ignore others (shipment.*, batch.*, etc.).
    if (payload.description && !payload.description.startsWith('tracker.')) {
        return new NextResponse('OK', { status: 200 });
    }

    const status = payload.result?.status;
    const shipmentId = payload.result?.shipment_id;
    const trackingCode = payload.result?.tracking_code;
    if (!status || (!shipmentId && !trackingCode)) {
        console.warn('[easypost-webhook] Missing status or shipment_id/tracking_code in payload');
        return new NextResponse('OK', { status: 200 });
    }

    const targetStatus = mapEasyPostTracker(status);
    if (!targetStatus) {
        console.log('[easypost-webhook] Unmapped tracker status:', status);
        return new NextResponse('OK', { status: 200 });
    }

    // Lookup fulfillment by either shipment_id (preferred — stored as
    // externalOrderId in 5c) or by trackingNumber as a fallback.
    const fulfillment = await prisma.orderFulfillment.findFirst({
        where: shipmentId
            ? { externalOrderId: shipmentId }
            : { trackingNumber: trackingCode! },
    });
    if (!fulfillment) {
        console.warn('[easypost-webhook] No fulfillment found for shipment', shipmentId, '/ tracking', trackingCode);
        return new NextResponse('OK', { status: 200 });
    }

    if (fulfillment.status === targetStatus) {
        return new NextResponse('OK', { status: 200 });
    }
    if (fulfillment.status === 'CANCELLED' && targetStatus !== 'CANCELLED') {
        console.warn(
            '[easypost-webhook] Late event for cancelled fulfillment',
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
                ...(trackingCode && trackingCode !== fulfillment.trackingNumber ? { trackingNumber: trackingCode } : {}),
            },
        });
        console.log(
            '[easypost-webhook] Fulfillment', fulfillment.id,
            `${fulfillment.status} → ${targetStatus}`,
            `(EP status: ${status})`,
        );
    } catch (e) {
        console.error('[easypost-webhook] Update failed:', e instanceof Error ? e.message : e);
        return new NextResponse('Internal error', { status: 500 });
    }

    return new NextResponse('OK', { status: 200 });
}
