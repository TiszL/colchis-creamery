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
import { markExpiredAmendments } from '@/lib/order-edit';
import type Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { releaseStock } from '@/lib/stock-reservation';
import { processPaymentSucceeded, markPaymentProcessing, reconcileOrderFromStripe } from '@/lib/stripe-payment-sync';
import { sendOpsAlertEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Bounded sweeps (take:50 / take:25) each cost up to ~2 Stripe round-trips per
// order; give the function room so a slow Stripe day can't kill it mid-loop.
export const maxDuration = 60;

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
        // Bounded batch: each order can cost 1-2 Stripe round-trips; an
        // unbounded sweep under a backlog risks hitting the function timeout
        // mid-loop. Oldest first; the rest are picked up next sweep (5 min).
        orderBy: { reservationExpiresAt: 'asc' },
        take: 50,
    });

    let released = 0;
    let rescued = 0;
    let deferred = 0;
    let errors = 0;
    const releasedIds: string[] = [];

    for (const order of expiredOrders) {
        try {
            // Launch hardening — NEVER cancel on our clock alone. Ask Stripe what
            // actually happened first: if the webhook is broken/delayed, the
            // payment may have succeeded (rescue → mark PAID via the shared
            // payment-sync path) or be settling (ACH 'processing' → defer). Only
            // genuinely unpaid orders get cancelled — and their PaymentIntent is
            // cancelled at Stripe too, so a late customer confirm can't charge a
            // card for an order we already killed.
            if (order.stripePaymentIntentId) {
                let pi: Stripe.PaymentIntent | null = null;
                try {
                    pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
                } catch (e) {
                    const code = (e as { code?: string })?.code;
                    if (code !== 'resource_missing') {
                        // Stripe unreachable — do NOT cancel blind; retry next sweep.
                        console.error(`[cron/release-reservations] PI lookup failed for order ${order.id} — deferring:`, e instanceof Error ? e.message : e);
                        errors++;
                        continue;
                    }
                    // resource_missing: PI id is bogus/mode-mismatched — safe to cancel.
                }
                if (pi?.status === 'succeeded') {
                    await processPaymentSucceeded(pi);
                    // Verify the rescue actually landed — a stalled paid-sync
                    // claim makes processPaymentSucceeded a silent no-op, and
                    // logging RESCUED forever would mask a charged customer
                    // whose order never flips PAID.
                    const check = await prisma.order.findUnique({ where: { id: order.id }, select: { paymentStatus: true } });
                    if (check?.paymentStatus === 'PAID' || check?.paymentStatus === 'REFUNDED') {
                        console.warn(`[cron/release-reservations] RESCUED paid order the webhook missed: ${order.id}`);
                        rescued++;
                    } else {
                        console.error(`[cron/release-reservations] Rescue attempted but order still ${check?.paymentStatus} (stalled paid-sync lease? retries next sweep): ${order.id}`);
                        errors++;
                    }
                    continue;
                }
                if (pi?.status === 'processing') {
                    await markPaymentProcessing(pi);
                    deferred++;
                    continue;
                }
                if (pi && pi.status !== 'canceled') {
                    // requires_payment_method / requires_confirmation / requires_action:
                    // kill the intent so it can't succeed after we cancel the order.
                    try {
                        await stripe.paymentIntents.cancel(pi.id, { cancellation_reason: 'abandoned' });
                    } catch (cancelErr) {
                        // The customer may have completed payment in the race
                        // window (the cancel then fails). Re-check before
                        // cancelling the order — proceeding blind here would
                        // overwrite a PAID commit and strand the charge.
                        console.warn(`[cron/release-reservations] PI cancel failed for ${pi.id} — re-checking:`, cancelErr instanceof Error ? cancelErr.message : cancelErr);
                        const recheck = await stripe.paymentIntents.retrieve(pi.id);
                        if (recheck.status === 'succeeded') {
                            await processPaymentSucceeded(recheck);
                            rescued++;
                            continue;
                        }
                        if (recheck.status === 'processing') {
                            await markPaymentProcessing(recheck);
                            deferred++;
                            continue;
                        }
                    }
                }
            }

            const reservationItems = order.fulfillments.flatMap(f =>
                f.items.map(it => ({
                    productId: it.orderItem.productId,
                    locationId: f.locationId,
                    quantity: it.quantity,
                })),
            );

            // ATOMIC state-guarded flip FIRST; release stock only if WE won it.
            // The PI cancel above makes Stripe emit payment_intent.canceled,
            // which the webhook can process within seconds — racing this very
            // loop. Whoever flips the order first does the release; the loser
            // must NOT release again (releaseStock clamps per stock ROW, so a
            // double release eats OTHER orders' reservations). A crash after
            // the flip leaves a recoverable leak, never corruption.
            const flipped = await prisma.order.updateMany({
                where: {
                    id: order.id,
                    paymentStatus: 'UNPAID',
                    orderStatus: { not: 'CANCELLED' },
                },
                data: {
                    orderStatus: 'CANCELLED',
                    paymentStatus: 'FAILED',
                    reservationExpiresAt: null,
                },
            });
            if (flipped.count === 0) {
                console.log(`[cron/release-reservations] Order ${order.id} was handled concurrently (webhook race) — skipping release.`);
                continue;
            }
            await prisma.orderFulfillment.updateMany({
                where: { orderId: order.id },
                data: { status: 'CANCELLED' },
            });

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

    // Second sweep: PROCESSING (delayed-settlement / ACH) orders. The bank
    // answers in days and the failure/success webhooks can be missed like any
    // other — without this, PROCESSING would be a reconciliation dead-end and
    // a webhook outage would strand a settled debit forever. Each order costs
    // one Stripe retrieve; reconcile flips it to PAID or FAILED as warranted.
    let processingChecked = 0;
    let processingSettled = 0;
    const processingOrders = await prisma.order.findMany({
        where: { paymentStatus: 'PROCESSING' },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 25,
    });
    for (const o of processingOrders) {
        try {
            const result = await reconcileOrderFromStripe(o.id);
            processingChecked++;
            if (result === 'paid' || result === 'failed') {
                console.warn(`[cron/release-reservations] PROCESSING order ${o.id} settled via reconcile: ${result}`);
                processingSettled++;
            }
        } catch (e) {
            console.error(`[cron/release-reservations] PROCESSING reconcile failed for ${o.id}:`, e instanceof Error ? e.message : e);
            errors++;
        }
    }

    // Third sweep: PAID orders sitting UNACCEPTED in the kitchen queue. An
    // asleep tablet means the chime never fired and nobody is watching — the
    // customer paid and their order is silently dying. One escalation email
    // per fulfillment (stamped), to the location's kitchen inbox + ops.
    // Scheduled (after-hours) orders only count once their scheduled time is
    // due — an overnight order awaiting opening is NOT stuck.
    let escalated = 0;
    const UNACCEPTED_ALERT_MS = 5 * 60 * 1000;
    const stuck = await prisma.orderFulfillment.findMany({
        where: {
            status: 'PENDING',
            unacceptedAlertAt: null,
            deliveryMethod: { in: ['DOORDASH_DRIVE', 'UBER_DIRECT', 'OWN_DELIVERY', 'IN_STORE_PICKUP', 'IN_STORE_DINE_IN'] },
            order: { paymentStatus: 'PAID' },
        },
        select: {
            id: true, createdAt: true, scheduledFor: true, orderId: true,
            location: { select: { id: true, name: true, notificationEmail: true } },
        },
        take: 25,
    });
    for (const f of stuck) {
        try {
            const dueSince = f.scheduledFor && f.scheduledFor > f.createdAt ? f.scheduledFor : f.createdAt;
            if (now.getTime() - dueSince.getTime() < UNACCEPTED_ALERT_MS) continue;
            const minutes = Math.round((now.getTime() - dueSince.getTime()) / 60000);
            await sendOpsAlertEmail({
                subject: `PAID ORDER UNACCEPTED for ${minutes} min — wake the kitchen`,
                orderId: f.orderId,
                alsoTo: f.location.notificationEmail ? [f.location.notificationEmail] : [],
                lines: [
                    `A paid order at ${f.location.name} has been waiting ${minutes} minutes with nobody accepting it.`,
                    'The kitchen tablet may be asleep or the queue closed. Open the order queue and Accept it now:',
                    `${process.env.NEXT_PUBLIC_SITE_URL || ''}/location-portal/${f.location.id}/orders`,
                    'If the kitchen cannot fulfill it, use "Problem with order?" to cancel & refund — do not leave the customer waiting in silence.',
                ],
            });
            await prisma.orderFulfillment.update({
                where: { id: f.id },
                data: { unacceptedAlertAt: now },
            });
            escalated++;
        } catch (e) {
            console.error(`[cron/release-reservations] escalation failed for fulfillment ${f.id}:`, e instanceof Error ? e.message : e);
            errors++;
        }
    }

    if (released > 0 || rescued > 0 || deferred > 0 || errors > 0 || processingSettled > 0 || escalated > 0) {
        console.log(
            `[cron/release-reservations] Sweep complete: scanned=${expiredOrders.length} released=${released} rescued=${rescued} deferred=${deferred} processingChecked=${processingChecked} processingSettled=${processingSettled} escalated=${escalated} errors=${errors}`,
        );
    }

    // Phase 2b — bookkeeping sweep for overdue payment-link amendments
    // (Stripe expired the hosted sessions itself; no stock or money is held).
    const expiredAmendments = await markExpiredAmendments().catch(e => {
        console.error('[cron/release-reservations] amendment sweep failed:', e);
        return 0;
    });

    return NextResponse.json({
        ok: true,
        timestamp: now.toISOString(),
        expiredAmendments,
        scanned: expiredOrders.length,
        released,
        rescued,
        deferred,
        processingChecked,
        processingSettled,
        escalated,
        errors,
        releasedIds,
    });
}
