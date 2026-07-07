// Phase 7a.6 — Stripe webhook handler.
//
// Triggered by Stripe (or `stripe listen --forward-to ...` in dev) when a
// PaymentIntent we created in 7a.5 reaches a terminal state. Source of truth
// for: did the customer actually pay?  → commit stock, mark Order paid, record
// the Stripe Tax transaction. On failure: release stock, cancel Order.
//
// Idempotency: Stripe retries failed deliveries up to ~3 days. Our state-machine
// checks (paymentStatus === 'PAID', orderStatus === 'CANCELLED') ensure repeat
// deliveries are no-ops. The @unique stripePaymentIntentId column on Order
// guarantees we'll always find at most one matching Order per event.
//
// Local dev setup (one-time):
//   brew install stripe/stripe-cli/stripe
//   stripe login
//   stripe listen --forward-to localhost:3000/api/webhooks/stripe
//   # paste the printed whsec_... into .env.local as STRIPE_WEBHOOK_SECRET, restart dev

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import type { DeliveryMethod } from '@prisma/client';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { commitStock, releaseStock } from '@/lib/stock-reservation';
import { sendOrderConfirmation, sendNewOrderKitchenEmail, type OrderForEmail } from '@/lib/email';
import { easypostBuyLabel, isEasyPostConfigured } from '@/lib/easypost';
import { isOpenNow, nextOpenSlot } from '@/lib/location-hours';

/**
 * Phase 5 — best-effort parser for Order.shippingAddress (free-text snapshot).
 *
 * Expected format from checkout: "line1, city, state zip[, country]".
 * Returns null when the string doesn't conform. EasyPost label-buy then
 * skips this fulfillment with a warning (ops books manually). A follow-up
 * migration should add structured address columns to Order.
 */
function parseFreeTextShippingAddress(addr: string | null | undefined): { line1: string; city: string; state: string; postalCode: string; country: string } | null {
    if (!addr) return null;
    const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) return null;
    const line1 = parts[0];
    const city  = parts[1];
    const stateZip = parts[2];
    const m = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
    if (!m) return null;
    const country = parts[3] || 'US';
    return { line1, city, state: m[1].toUpperCase(), postalCode: m[2], country };
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // signature verification needs Node crypto

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

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

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[stripe-webhook] Signature verification failed:', msg);
        return new NextResponse(`Webhook Error: ${msg}`, { status: 400 });
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
                await handlePaymentSucceeded(event.data.object);
                break;
            case 'payment_intent.payment_failed':
            case 'payment_intent.canceled':
                await handlePaymentFailed(event.data.object);
                break;
            // Phase 4 (4d) — Connect events. These fire on the same webhook
            // endpoint when the endpoint is configured to receive Connect
            // events in the Stripe dashboard. The connected-account ID is
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
                // Acknowledge unknown events so Stripe stops retrying. Useful types we
                // might add later: charge.refunded (refund flow), payment_intent.processing.
                console.log('[stripe-webhook] Unhandled event type:', event.type);
        }
    } catch (e) {
        // 500 so Stripe retries with exponential backoff. Our state-machine checks
        // make those retries safe (re-running on an already-PAID order is a no-op).
        console.error('[stripe-webhook] Handler threw for', event.type, e);
        // Release the idempotency claim so the retry can reprocess this event.
        await prisma.processedStripeEvent.delete({ where: { id: event.id } }).catch(() => undefined);
        return new NextResponse('Internal handler error', { status: 500 });
    }

    return new NextResponse('OK', { status: 200 });
}

/* ─── Handlers ─────────────────────────────────────────────────────────── */

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
    const order = await loadOrderForPI(pi.id);
    if (!order) {
        console.warn('[stripe-webhook] payment_intent.succeeded for unknown PI:', pi.id);
        return;
    }

    // Idempotency — Stripe may retry; we may have already committed this order.
    if (order.paymentStatus === 'PAID') {
        console.log('[stripe-webhook] Order already PAID, no-op:', order.id);
        return;
    }
    // Race-condition guard: payment_failed arrived first and we already cancelled.
    // Stripe has succeeded on their side though, so we need manual intervention to
    // either refund or re-fulfill. Don't double-process here.
    if (order.orderStatus === 'CANCELLED') {
        // The reservation-cleanup cron cancelled this order (stock already
        // released) before the customer's payment confirmed. We can't fulfill it,
        // so refund the captured funds rather than charge-without-shipping.
        // Idempotent: refunding an already-refunded PI throws and is swallowed.
        console.warn('[stripe-webhook] Late success on CANCELLED order — auto-refunding:', order.id, 'PI:', pi.id);
        try {
            await stripe.refunds.create({ payment_intent: pi.id });
            await prisma.order.update({
                where: { id: order.id },
                data: { paymentStatus: 'REFUNDED' },
            });
        } catch (e) {
            console.error('[stripe-webhook] Auto-refund failed for late success on', order.id, ':', e instanceof Error ? e.message : e);
        }
        return;
    }

    const reservationItems = reservationItemsFromOrder(order);

    // Commit stock AND flip the order to PAID/CONFIRMED ATOMICALLY: the order +
    // fulfillment updates run inside commitStock's transaction via onCommitted.
    // Previously these were separate transactions, so a crash between them left
    // stock committed while the order stayed UNPAID — and a Stripe retry then
    // re-committed (double-decrement). Now a partial failure rolls the whole
    // thing back and the retry reprocesses cleanly.
    // Phase 3 (3d): pass orderId so batch SALE movements are traceable.
    await commitStock(reservationItems, {
        orderId: order.id,
        onCommitted: async (tx) => {
            await tx.order.update({
                where: { id: order.id },
                data: {
                    paymentStatus: 'PAID',
                    orderStatus: 'CONFIRMED',
                    reservationExpiresAt: null,
                },
            });
            // Kitchen-driven dispatch: kitchen legs (DoorDash/Uber/own delivery/
            // pickup/dine-in) stay PENDING until staff Accept them in the
            // location portal (which books the courier via carrier-dispatch).
            // Only warehouse/B2B legs auto-confirm on payment.
            await tx.orderFulfillment.updateMany({
                where: {
                    orderId: order.id,
                    deliveryMethod: { in: ['UPS_2DAY', 'MANUAL_DISPATCH'] },
                },
                data: { status: 'CONFIRMED' },
            });
        },
    });

    // Record the Stripe Tax transaction for compliance reporting.
    // Idempotency: skip if we've already recorded a transaction for this order
    // (belt-and-suspenders on top of the early-return when paymentStatus is PAID).
    // The DB field is the source of truth so a Stripe-side outage doesn't desync us.
    const taxCalculationId = order.stripeTaxCalculationId ?? pi.metadata?.tax_calculation_id;
    if (taxCalculationId && !order.stripeTaxTransactionId) {
        try {
            const txn = await stripe.tax.transactions.createFromCalculation({
                calculation: taxCalculationId,
                reference: order.id,
            });
            await prisma.order.update({
                where: { id: order.id },
                data: { stripeTaxTransactionId: txn.id },
            });
        } catch (e) {
            // Non-fatal: payment already succeeded. The orphan (calculation set,
            // transaction null) is a flag for the 7b admin retry tool.
            console.warn(
                '[stripe-webhook] tax.transactions.createFromCalculation failed for Order',
                order.id, ':', e instanceof Error ? e.message : e,
            );
        }
    }

    // Kitchen-driven dispatch: couriers are no longer booked here. Staff Accept
    // in the location portal triggers dispatchCourierForFulfillment (see
    // '@/lib/carrier-dispatch'). Here we only stamp after-hours legs with a
    // scheduledFor display hint and alert the kitchen(s). Best-effort.
    try {
        await scheduleAndNotifyKitchenLegs(order.id);
    } catch (e) {
        console.warn(
            '[stripe-webhook] Kitchen scheduling/notification failed for Order',
            order.id, ':', e instanceof Error ? e.message : e,
        );
    }

    // Phase 5 (5c): buy UPS labels for any NATIONAL_SHIP fulfillments via
    // EasyPost. Same best-effort contract: a failed label-buy leaves the
    // fulfillment in CONFIRMED with no trackingNumber, and ops can re-run
    // (idempotency below skips already-bought labels). Skipped entirely if
    // EasyPost env unset.
    if (isEasyPostConfigured()) {
        try {
            await dispatchUpsLabels(order.id);
        } catch (e) {
            console.warn(
                '[stripe-webhook] UPS label dispatch failed for Order',
                order.id, ':', e instanceof Error ? e.message : e,
            );
        }
    }

    // Send confirmation email (best-effort — don't fail the webhook if Resend hiccups)
    try {
        const fresh = await loadOrderForEmail(order.id);
        if (fresh) await sendOrderConfirmation(fresh);
    } catch (e) {
        console.warn(
            '[stripe-webhook] Order confirmation email failed for Order',
            order.id, ':', e instanceof Error ? e.message : e,
        );
    }

    console.log('[stripe-webhook] Order paid + stock committed:', order.id);
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
    const order = await loadOrderForPI(pi.id);
    if (!order) {
        console.warn('[stripe-webhook] payment_intent failure for unknown PI:', pi.id);
        return;
    }

    // Idempotency — already terminal in either direction.
    if (order.paymentStatus === 'PAID') {
        console.warn(
            '[stripe-webhook] Payment failure event but Order is already PAID — needs manual review:',
            order.id, 'PI:', pi.id,
        );
        return;
    }
    if (order.orderStatus === 'CANCELLED') {
        console.log('[stripe-webhook] Order already CANCELLED, no-op:', order.id);
        return;
    }

    const reservationItems = reservationItemsFromOrder(order);
    await releaseStock(reservationItems);

    await prisma.$transaction([
        prisma.order.update({
            where: { id: order.id },
            data: {
                paymentStatus: 'FAILED',
                orderStatus: 'CANCELLED',
            },
        }),
        prisma.orderFulfillment.updateMany({
            where: { orderId: order.id },
            data: { status: 'CANCELLED' },
        }),
    ]);

    console.log('[stripe-webhook] Order cancelled + stock released:', order.id);
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

type OrderForWebhook = NonNullable<Awaited<ReturnType<typeof loadOrderForPI>>>;

async function loadOrderForPI(paymentIntentId: string) {
    return prisma.order.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
        include: {
            fulfillments: {
                include: {
                    items: { include: { orderItem: true } },
                },
            },
        },
    });
}

function reservationItemsFromOrder(order: OrderForWebhook) {
    return order.fulfillments.flatMap(f =>
        f.items.map(it => ({
            productId: it.orderItem.productId,
            locationId: f.locationId,
            quantity: it.quantity,
        })),
    );
}

/* ─── Kitchen-leg scheduling + notification (kitchen-driven dispatch) ───── */

// Delivery methods whose lifecycle is owned by kitchen staff in the location
// portal. These stay PENDING on payment; staff Accept books couriers.
const KITCHEN_DELIVERY_METHODS: DeliveryMethod[] = [
    'DOORDASH_DRIVE',
    'UBER_DIRECT',
    'OWN_DELIVERY',
    'IN_STORE_PICKUP',
    'IN_STORE_DINE_IN',
];

/**
 * After stock commit: (1) stamp scheduledFor on kitchen legs whose location is
 * closed right now — display metadata for staff + customer (actual courier
 * dispatch happens at Accept regardless); (2) send one new-order alert email
 * per location to notificationEmail ?? BAKERY_NOTIFICATION_EMAIL. Best-effort
 * throughout — a failure here never fails the webhook.
 */
async function scheduleAndNotifyKitchenLegs(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            user: { select: { name: true, phone: true } },
            fulfillments: {
                where: { deliveryMethod: { in: KITCHEN_DELIVERY_METHODS } },
                include: {
                    location: true,
                    items: {
                        include: {
                            orderItem: { include: { product: { select: { name: true } } } },
                        },
                    },
                },
            },
        },
    });
    if (!order || order.fulfillments.length === 0) return;

    const customerName = (order.user.name || 'Customer').trim();
    const customerPhone = order.guestPhone || order.user.phone || null;

    // (1) After-hours: stamp scheduledFor when the location is currently closed.
    const scheduledByFulfillment = new Map<string, Date>();
    for (const f of order.fulfillments) {
        try {
            if (isOpenNow(f.location.hours as any)) continue;
            const slot = nextOpenSlot(f.location.hours as any);
            if (!slot) continue; // no hours configured — nothing to schedule
            await prisma.orderFulfillment.update({
                where: { id: f.id },
                data: { scheduledFor: slot },
            });
            scheduledByFulfillment.set(f.id, slot);
        } catch (e) {
            console.warn(
                '[stripe-webhook] scheduledFor stamp failed for fulfillment',
                f.id, ':', e instanceof Error ? e.message : e,
            );
        }
    }

    // (2) One kitchen alert per location.
    const byLocation = new Map<string, typeof order.fulfillments>();
    for (const f of order.fulfillments) {
        const legs = byLocation.get(f.locationId) ?? [];
        legs.push(f);
        byLocation.set(f.locationId, legs);
    }

    for (const [locationId, legs] of byLocation) {
        const location = legs[0].location;
        const to = location.notificationEmail || process.env.BAKERY_NOTIFICATION_EMAIL;
        if (!to) continue; // no recipient configured anywhere — skip

        try {
            await sendNewOrderKitchenEmail({
                to,
                orderId: order.id,
                locationId,
                locationName: location.name,
                items: legs.flatMap(f =>
                    f.items.map(it => ({
                        name: it.orderItem.product.name,
                        quantity: it.quantity,
                    })),
                ),
                deliveryMethods: [...new Set(legs.map(f => f.deliveryMethod))],
                customerName,
                customerPhone,
                scheduledFor: legs.map(f => scheduledByFulfillment.get(f.id)).find(Boolean) ?? null,
            });
        } catch (e) {
            console.warn(
                '[stripe-webhook] Kitchen alert email failed for location',
                locationId, 'Order', order.id, ':', e instanceof Error ? e.message : e,
            );
        }
    }
}

async function loadOrderForEmail(orderId: string): Promise<OrderForEmail | null> {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            user: { select: { email: true, name: true } },
            fulfillments: {
                include: {
                    location: { select: { name: true } },
                    items: {
                        include: {
                            orderItem: {
                                include: { product: { select: { name: true } } },
                            },
                        },
                    },
                },
            },
        },
    });
    return order;
}

/* ─── UPS label dispatch (Phase 5 / 5c) ─────────────────────────────────── */

async function dispatchUpsLabels(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            user: { select: { name: true, email: true, phone: true } },
            fulfillments: {
                include: {
                    location: true,
                    items: { include: { orderItem: { include: { product: { select: { name: true } } } } } },
                },
            },
        },
    });
    if (!order) return;

    const recipientPhone = order.guestPhone || order.user.phone || undefined;
    const recipientEmail = order.guestEmail || order.user.email || undefined;
    const recipientName  = (order.user.name || 'Customer').trim();

    // Parse the snapshot address into components for EasyPost's structured payload.
    // Order keeps shippingAddress as free text + line2 + delivery notes —
    // structured columns (city/state/zip) for label-buy are a follow-up.
    const parsed = parseFreeTextShippingAddress(order.shippingAddress);
    const dropAddr = parsed
        ? { ...parsed, line2: order.shippingAddressLine2 || undefined }
        : null;

    for (const f of order.fulfillments) {
        if (f.deliveryMethod !== 'UPS_2DAY') continue;
        if (f.externalOrderId) continue; // idempotency: label already bought

        const loc = f.location;
        if (!loc.postalCode) {
            console.warn('[easypost] skipping fulfillment', f.id, '— pickup location', loc.name, 'missing postalCode');
            continue;
        }
        if (!dropAddr || !dropAddr.line1 || !dropAddr.city || !dropAddr.state || !dropAddr.postalCode) {
            console.warn('[easypost] skipping fulfillment', f.id, '— order ship-to address could not be parsed:', order.shippingAddress);
            continue;
        }

        const bought = await easypostBuyLabel({
            from: {
                name: loc.name,
                street1: loc.addressLine1,
                street2: loc.addressLine2 || undefined,
                city: loc.city,
                state: loc.state,
                zip: loc.postalCode,
                country: loc.country || 'US',
                phone: loc.phone || undefined,
            },
            to: {
                name: recipientName,
                street1: dropAddr.line1,
                street2: dropAddr.line2 || undefined,
                city: dropAddr.city,
                state: dropAddr.state,
                zip: dropAddr.postalCode,
                country: dropAddr.country || 'US',
                phone: recipientPhone,
                email: recipientEmail,
            },
            // Same MVP parcel as the rate quote in shipping.ts (5b). When we
            // add per-product weights, this should sum across f.items.
            parcel: { length: 10, width: 8, height: 6, weight: 64 },
            referenceOrderId: order.id,
        });

        if (bought) {
            await prisma.orderFulfillment.update({
                where: { id: f.id },
                data: {
                    externalOrderId: bought.shipmentId,
                    trackingNumber: bought.trackingCode,
                },
            });
            console.log(
                `[easypost] Label bought for fulfillment ${f.id}: ${bought.carrier} ${bought.service} ${bought.trackingCode} (label: ${bought.labelUrl})`,
            );
        } else {
            console.warn('[easypost] Label purchase failed for fulfillment', f.id, '— leaving for manual booking');
        }
    }
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

