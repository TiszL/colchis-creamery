// Resolve net-terms webhook — reconciles B2bInvoice status/paidAt.
//
// Resolve posts invoice/charge lifecycle events here. Without this, every
// B2bInvoice stays PENDING forever (the partner billing page + admin AR aging
// would show permanently stale state). We verify the signature, map Resolve's
// status to our B2bInvoiceStatus, and update the matching invoice.
//
// NOTE: Resolve's exact event shape + signature header are spec-unverified (see
// TODOs in src/lib/resolve.ts) — we read the charge id + status defensively and
// always 200-ack so Resolve stops retrying once we've recorded what we can.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyResolveSignature, mapResolveStatus } from '@/lib/resolve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    const rawBody = await req.text();
    const sig =
        req.headers.get('x-resolve-signature') ??
        req.headers.get('resolve-signature') ??
        req.headers.get('x-signature');
    if (!verifyResolveSignature(rawBody, sig)) {
        return new NextResponse('Invalid signature', { status: 401 });
    }

    let event: Record<string, unknown>;
    try {
        event = JSON.parse(rawBody);
    } catch {
        return new NextResponse('Bad JSON', { status: 400 });
    }

    // Defensive extraction across Resolve event shapes.
    const data = (event.data ?? event.charge ?? event) as Record<string, unknown>;
    const chargeId = (data.id ?? data.charge_id ?? event.id) as string | undefined;
    const rawStatus = (data.status ?? event.status ?? null) as string | null;

    if (!chargeId) {
        console.warn('[resolve-webhook] no charge id in event; keys:', Object.keys(event));
        return new NextResponse('OK', { status: 200 });
    }

    const invoice = await prisma.b2bInvoice.findFirst({
        where: { resolveInvoiceId: chargeId },
        select: { id: true },
    });
    if (!invoice) {
        console.warn('[resolve-webhook] no B2bInvoice for charge', chargeId);
        return new NextResponse('OK', { status: 200 });
    }

    const mapped = mapResolveStatus(rawStatus);
    await prisma.b2bInvoice.update({
        where: { id: invoice.id },
        data: {
            resolveStatus: rawStatus,
            ...(mapped ? { status: mapped } : {}),
            ...(mapped === 'PAID' ? { paidAt: new Date() } : {}),
        },
    });
    console.log(`[resolve-webhook] invoice ${invoice.id} → ${mapped ?? '(status unchanged)'} (raw="${rawStatus}")`);
    return new NextResponse('OK', { status: 200 });
}
