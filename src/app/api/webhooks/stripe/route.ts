// Phase 7a.6 — Stripe webhook handler (slimmed in the launch-hardening pass:
// payment-state processing now lives in src/lib/stripe-payment-sync.ts so the
// checkout success page and the reservation cron can reconcile orders through
// the SAME code path when the webhook is delayed or misconfigured).
//
// Idempotency: Stripe retries failed deliveries up to ~3 days. Event-level
// claims (ProcessedStripeEvent) + the payment-sync state machine ensure repeat
// deliveries are no-ops.
//
// Local dev setup (one-time):
//   brew install stripe/stripe-cli/stripe
//   stripe login
//   stripe listen --forward-to localhost:3000/api/webhooks/stripe
//   # paste the printed whsec_... into .env.local as STRIPE_WEBHOOK_SECRET, restart dev

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import {
    processPaymentSucceeded,
    processPaymentFailed,
    markPaymentProcessing,
    syncExternalRefund,
    alertDisputeCreated,
} from '@/lib/stripe-payment-sync';
import { applyPaidAmendment } from '@/lib/order-edit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // signature verification needs Node crypto

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
// Connect events can arrive on a SEPARATE webhook endpoint with its own
// signing secret ("Listen to events on connected accounts" in the dashboard).
// When configured, signatures are checked against both secrets.
const CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

export async function POST(req: Request) {
    if (!WEBHOOK_SECRET) {
        console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set — refusing to process.');
        return new NextResponse('Webhook secret not configured', { status: 500 });
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
        return new NextResponse('Missing Stripe-Signature header', { status: 400 });
    }

    const rawBody = await req.text();

    let event: Stripe.Event | null = null;
    let lastError = 'Unknown error';
    for (const secret of [WEBHOOK_SECRET, CONNECT_WEBHOOK_SECRET].filter((s): s is string => !!s)) {
        try {
            event = stripe.webhooks.constructEvent(rawBody, signature, secret);
            break;
        } catch (e) {
            lastError = e instanceof Error ? e.message : 'Unknown error';
        }
    }
    if (!event) {
        console.error('[stripe-webhook] Signature verification failed:', lastError);
        return new NextResponse(`Webhook Error: ${lastError}`, { status: 400 });
    }

    // Event-level idempotency: claim the event id (PK = Stripe event.id). A
    // duplicate delivery / retry conflicts on insert and short-circuits, so side
    // effects can never apply twice. On processing failure we release the claim
    // (in the catch below) so Stripe's retry reprocesses cleanly.
    try {
        await prisma.processedStripeEvent.create({ data: { id: event.id, type: event.type } });
    } catch (e) {
        if ((e as { code?: string })?.code === 'P2002') {
            return new NextResponse('Already processed', { status: 200 });
        }
        throw e;
    }

    try {
        switch (event.type) {
            case 'payment_intent.succeeded':
                await processPaymentSucceeded(event.data.object);
                break;
            case 'payment_intent.payment_failed':
            case 'payment_intent.canceled':
                await processPaymentFailed(event.data.object);
                break;
            // Delayed-settlement methods (ACH debit): the bank answers in days.
            // Mark the order PROCESSING so the reservation cron doesn't cancel
            // an in-flight payment.
            case 'payment_intent.processing':
                await markPaymentProcessing(event.data.object);
                break;
            // Refunds issued OUTSIDE the app (Stripe dashboard/API) must stop
            // the kitchen from cooking the order.
            case 'charge.refunded':
                await syncExternalRefund(event.data.object);
                break;
            case 'charge.dispute.created':
                await alertDisputeCreated(event.data.object);
                break;
            // Phase 2b — order-amendment payment links (added items). Only
            // sessions we minted carry kind=order_amendment; anything else is
            // acked and ignored.
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.metadata?.kind === 'table_order' && session.metadata.orderId) {
                    if (session.payment_status === 'paid') {
                        const { applyPaidTableOrder } = await import('@/lib/table-ordering');
                        await applyPaidTableOrder(
                            session.metadata.orderId,
                            typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
                        );
                    } else {
                        console.warn('[stripe-webhook] table_order session completed unpaid — ignoring:', session.id);
                    }
                    break;
                }
                if (session.metadata?.kind === 'order_amendment') {
                    // Sessions are card-only, but belt-and-braces: never apply
                    // an amendment whose funds have not actually arrived.
                    if (session.payment_status === 'paid') {
                        await applyPaidAmendment(
                            session.id,
                            typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
                        );
                    } else {
                        console.warn('[stripe-webhook] amendment session completed with payment_status', session.payment_status, '— not applying:', session.id);
                    }
                } else {
                    console.log('[stripe-webhook] checkout.session.completed (non-amendment) ignored:', session.id);
                }
                break;
            }
            case 'checkout.session.expired': {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.metadata?.kind === 'table_order' && session.metadata.orderId) {
                    // Prompt release beats waiting for the reservation cron:
                    // guarded flip first, release only when we won it.
                    const flipped = await prisma.order.updateMany({
                        where: { id: session.metadata.orderId, paymentStatus: 'UNPAID', orderStatus: { not: 'CANCELLED' } },
                        data: { orderStatus: 'CANCELLED' },
                    });
                    if (flipped.count === 1) {
                        const order = await prisma.order.findUnique({
                            where: { id: session.metadata.orderId },
                            select: { fulfillments: { select: { locationId: true, items: { select: { orderItemId: true, quantity: true, orderItem: { select: { productId: true, refundedQuantity: true } } } } } } },
                        });
                        if (order) {
                            const { effectiveReservationItems, releaseStock } = await import('@/lib/stock-reservation');
                            await releaseStock(effectiveReservationItems(order.fulfillments));
                        }
                    }
                    break;
                }
                if (session.metadata?.kind === 'order_amendment') {
                    await prisma.orderAmendment.updateMany({
                        where: { stripeCheckoutSessionId: session.id, status: 'PENDING_PAYMENT' },
                        data: { status: 'EXPIRED', resolvedAt: new Date() },
                    });
                }
                break;
            }
            // Phase 4 (4d) — Connect events. The connected-account ID is
            // available on `event.account` (or on event.data.object.id for
            // account.updated).
            case 'account.updated':
                await handleAccountUpdated(event.data.object as Stripe.Account);
                break;
            case 'payout.created':
            case 'payout.paid':
            case 'payout.failed':
                await handlePayoutEvent(event);
                break;
            default:
                // Acknowledge unknown events so Stripe stops retrying.
                console.log('[stripe-webhook] Unhandled event type:', event.type);
        }
    } catch (e) {
        // 500 so Stripe retries with exponential backoff. The payment-sync
        // state machine makes those retries safe.
        console.error('[stripe-webhook] Handler threw for', event.type, e);
        // Release the idempotency claim so the retry can reprocess this event.
        await prisma.processedStripeEvent.delete({ where: { id: event.id } }).catch(() => undefined);
        return new NextResponse('Internal handler error', { status: 500 });
    }

    return new NextResponse('OK', { status: 200 });
}

/* ─── Phase 4 (4d) — Connect event handlers ──────────────────────────────── */

/**
 * account.updated — Stripe pushes this whenever a connected account changes.
 * We mirror the derived status into Location.stripeOnboardingStatus so the
 * admin panel + checkout routing stay current without polling.
 *
 * Idempotent: re-running on the same payload is a no-op (just rewrites the
 * same status value + bumps the timestamp).
 */
async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
    const accountId = account.id;
    // Look up the Location attached to this connected account. Stripe also
    // sends account.updated for ad-hoc dashboard edits — if we don't track
    // this account, just ack.
    const location = await prisma.location.findUnique({
        where: { stripeConnectAccountId: accountId },
        select: { id: true, name: true, stripeOnboardingStatus: true },
    });
    if (!location) {
        console.log('[stripe-webhook] account.updated for untracked account:', accountId);
        return;
    }

    const { deriveOnboardingStatus } = await import('@/lib/stripe-connect');
    const nextStatus = deriveOnboardingStatus(account);

    if (location.stripeOnboardingStatus === nextStatus) {
        // No-op: status hasn't changed; still bump timestamp so admin sees freshness.
        await prisma.location.update({
            where: { id: location.id },
            data: { stripeOnboardingUpdatedAt: new Date() },
        });
        return;
    }

    await prisma.location.update({
        where: { id: location.id },
        data: {
            stripeOnboardingStatus: nextStatus,
            stripeOnboardingUpdatedAt: new Date(),
        },
    });
    console.log(
        `[stripe-webhook] account.updated: location="${location.name}" ${location.stripeOnboardingStatus ?? '(none)'} → ${nextStatus}`,
    );
}

/**
 * payout.created / payout.paid / payout.failed — log only for now. A
 * future iteration could surface payout history to the admin Connect
 * panel and email-notify on failed payouts.
 */
async function handlePayoutEvent(event: Stripe.Event): Promise<void> {
    const accountId = event.account;
    const payout = event.data.object as Stripe.Payout;
    console.log(
        `[stripe-webhook] ${event.type}: account=${accountId ?? '(platform)'} payoutId=${payout.id} amount=${payout.amount}¢ ${payout.currency} status=${payout.status}`,
    );
}
