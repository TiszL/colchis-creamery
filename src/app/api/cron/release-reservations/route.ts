// Phase 7b.1 — Reservation cleanup cron.
//
// Walks Orders whose reservationExpiresAt has passed AND that never reached PAID,
// releases their stock back into inventory, and marks them CANCELLED. Without
// this, abandoned checkouts (customer clicked Place Order, never finished card
// confirmation) would hold stock until manually cleared.
//
// Schedule: every 5 minutes via vercel.json. The 15-minute reservation TTL means
// cleanup happens within 5 minutes of expiry at worst.
//
// Idempotency: state-machine checks in the query (paymentStatus UNPAID AND
// orderStatus != CANCELLED) ensure each order is processed at most once. The
// per-order try/catch means a single failure doesn't abort the whole sweep.
//
// Auth: Vercel Cron Jobs send `Authorization: Bearer <CRON_SECRET>` when the
// matching env var is set on the deployment. In dev, set CRON_SECRET in
// .env.local and curl with `Authorization: Bearer <value>` to test.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { releaseStock } from '@/lib/stock-reservation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
    // Bearer-token auth. Skip the check if CRON_SECRET is unset so localhost
    // testing works without setup; production deploys must set it.
    if (CRON_SECRET) {
        const auth = req.headers.get('authorization');
        if (auth !== `Bearer ${CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
    } else if (process.env.NODE_ENV === 'production') {
        console.error('[cron/release-reservations] CRON_SECRET unset in production — refusing.');
        return new NextResponse('Forbidden', { status: 403 });
    } else {
        console.warn('[cron/release-reservations] CRON_SECRET unset — endpoint is unauthenticated (dev).');
    }

    const now = new Date();
    // Grace window: don't cancel orders that only just expired — a customer
    // completing 3DS / redirect auth can confirm payment slightly after the TTL
    // (the webhook also reconciles late successes). 5 min past expiry.
    const GRACE_MS = 5 * 60 * 1000;
    const expiredOrders = await prisma.order.findMany({
        where: {
            reservationExpiresAt: { lt: new Date(now.getTime() - GRACE_MS) },
            paymentStatus: 'UNPAID',
            orderStatus: { not: 'CANCELLED' },
        },
        include: {
            fulfillments: {
                include: {
                    items: { include: { orderItem: true } },
                },
            },
        },
    });

    let released = 0;
    let errors = 0;
    const releasedIds: string[] = [];

    for (const order of expiredOrders) {
        try {
            const reservationItems = order.fulfillments.flatMap(f =>
                f.items.map(it => ({
                    productId: it.orderItem.productId,
                    locationId: f.locationId,
                    quantity: it.quantity,
                })),
            );

            // Flip status FIRST so a crash before releaseStock leaves a recoverable
            // stock *leak* (re-runnable next sweep) rather than a double-release that
            // would corrupt a concurrent reservation. CANCELLED + reservationExpiresAt
            // = null also removes this order from the sweep predicate.
            await prisma.$transaction([
                prisma.order.update({
                    where: { id: order.id },
                    data: {
                        orderStatus: 'CANCELLED',
                        paymentStatus: 'FAILED',
                        reservationExpiresAt: null,
                    },
                }),
                prisma.orderFulfillment.updateMany({
                    where: { orderId: order.id },
                    data: { status: 'CANCELLED' },
                }),
            ]);

            await releaseStock(reservationItems);

            releasedIds.push(order.id);
            released++;
        } catch (e) {
            console.error(
                `[cron/release-reservations] Failed for order ${order.id}:`,
                e instanceof Error ? e.message : e,
            );
            errors++;
        }
    }

    if (released > 0 || errors > 0) {
        console.log(
            `[cron/release-reservations] Sweep complete: scanned=${expiredOrders.length} released=${released} errors=${errors}`,
        );
    }

    return NextResponse.json({
        ok: true,
        timestamp: now.toISOString(),
        scanned: expiredOrders.length,
        released,
        errors,
        releasedIds,
    });
}
