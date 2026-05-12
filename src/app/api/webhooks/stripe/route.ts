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
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { commitStock, releaseStock } from '@/lib/stock-reservation';
import { sendOrderConfirmation, type OrderForEmail } from '@/lib/email';
import { doordashCreateDelivery, isDoorDashConfigured } from '@/lib/doordash';
import { uberCreateDelivery, isUberDirectConfigured } from '@/lib/uber-direct';

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

    try {
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;
            case 'payment_intent.payment_failed':
            case 'payment_intent.canceled':
                await handlePaymentFailed(event.data.object);
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
        console.warn(
            '[stripe-webhook] payment_intent.succeeded received but Order is CANCELLED — needs manual review:',
            order.id, 'PI:', pi.id,
        );
        return;
    }

    const reservationItems = reservationItemsFromOrder(order);

    // Commit stock OUTSIDE the Prisma transaction below — commitStock has its own
    // internal transaction. Nesting prisma.$transaction is not supported.
    await commitStock(reservationItems);

    await prisma.$transaction([
        prisma.order.update({
            where: { id: order.id },
            data: {
                paymentStatus: 'PAID',
                orderStatus: 'CONFIRMED',
                // Reservation TTL is no longer relevant — leaving it set could trip
                // the 7b cleanup cron into a redundant pass. Clear it on payment.
                reservationExpiresAt: null,
            },
        }),
        prisma.orderFulfillment.updateMany({
            where: { orderId: order.id },
            data: { status: 'CONFIRMED' },
        }),
    ]);

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

    // Phase 8.1: dispatch DoorDash deliveries for any DOORDASH_DRIVE fulfillments.
    // Best-effort: if creation fails (DD outage, invalid address, etc.), log and
    // continue. Admin sees the warning in logs and can manually arrange delivery
    // until 7c+ retry tooling lands. Skips entirely if DD isn't configured.
    if (isDoorDashConfigured()) {
        try {
            await dispatchDoorDashDeliveries(order.id);
        } catch (e) {
            console.warn(
                '[stripe-webhook] DoorDash delivery dispatch failed for Order',
                order.id, ':', e instanceof Error ? e.message : e,
            );
        }
    }

    // Phase 8.2: same shape for Uber Direct fulfillments. Independent of DD —
    // an order can have both DD and Uber legs (different products/locations).
    if (isUberDirectConfigured()) {
        try {
            await dispatchUberDirectDeliveries(order.id);
        } catch (e) {
            console.warn(
                '[stripe-webhook] Uber Direct dispatch failed for Order',
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

/* ─── DoorDash delivery dispatch (Phase 8.1) ───────────────────────────── */

async function dispatchDoorDashDeliveries(orderId: string) {
    // Load everything we need for DD's POST /drive/v2/deliveries body.
    // Iterates fulfillments and only acts on channel=DOORDASH_DRIVE.
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            user: { select: { name: true, email: true, phone: true } },
            fulfillments: {
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
    if (!order) return;

    const recipientEmail = order.guestEmail || order.user.email;
    const recipientPhone = order.guestPhone || order.user.phone || '';
    const fullName = (order.user.name || '').trim();
    const firstName = fullName.split(/\s+/)[0] || 'Customer';
    const lastName = fullName.split(/\s+/).slice(1).join(' ') || undefined;

    for (const f of order.fulfillments) {
        if (f.channel !== 'DOORDASH_DRIVE') continue;
        if (f.externalOrderId) continue; // idempotency — already dispatched

        const loc = f.location;
        const pickupAddress = [loc.addressLine1, loc.city, loc.state, loc.postalCode]
            .filter(Boolean).join(', ');

        // Per-fulfillment order value in cents. Items in this leg only.
        const orderValueCents = f.items.reduce((sum, it) => {
            const unit = parseFloat(it.orderItem.unitPrice);
            if (isNaN(unit)) return sum;
            return sum + Math.round(unit * 100) * it.quantity;
        }, 0);

        const result = await doordashCreateDelivery({
            externalOrderId: order.id,
            pickup: {
                address: pickupAddress,
                phone: loc.phone || '+15555550123',
                businessName: loc.name,
                instructions: loc.notes || undefined,
            },
            dropoff: {
                address: order.shippingAddress || '',
                phone: recipientPhone || '+15555550123',
                firstName,
                lastName,
                email: recipientEmail || undefined,
            },
            orderValueCents,
            items: f.items.map(it => ({
                name: it.orderItem.product.name,
                quantity: it.quantity,
            })),
        });

        if (result) {
            await prisma.orderFulfillment.update({
                where: { id: f.id },
                data: {
                    externalOrderId: result.externalDeliveryId,
                    trackingNumber: result.trackingUrl || null,
                },
            });
            console.log('[doordash] Delivery created for fulfillment', f.id, ':', result.externalDeliveryId);
        } else {
            console.warn('[doordash] Delivery creation failed for fulfillment', f.id);
        }
    }
}

/* ─── Uber Direct delivery dispatch (Phase 8.2) ────────────────────────── */

async function dispatchUberDirectDeliveries(orderId: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            user: { select: { name: true, email: true, phone: true } },
            fulfillments: {
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
    if (!order) return;

    const recipientEmail = order.guestEmail || order.user.email;
    const recipientPhone = order.guestPhone || order.user.phone || '';
    const fullName = (order.user.name || '').trim();
    const firstName = fullName.split(/\s+/)[0] || 'Customer';
    const lastName = fullName.split(/\s+/).slice(1).join(' ') || undefined;

    // Parse shipping address back into components. shippingAddress is a free-text
    // formatted string like "123 Main St, City, ST 12345". For Uber we need
    // structured components — best-effort parse. If parsing fails, skip this
    // delivery (admin will see the warning and can intervene).
    const parsed = parseShippingAddress(order.shippingAddress);
    if (!parsed) {
        console.warn(
            '[uber-direct] Skipping dispatch — could not parse shippingAddress for Order',
            order.id,
        );
        return;
    }

    for (const f of order.fulfillments) {
        if (f.channel !== 'UBER_DIRECT') continue;
        if (f.externalOrderId) continue; // idempotency

        const loc = f.location;
        if (!loc.addressLine1 || !loc.city || !loc.state || !loc.postalCode) {
            console.warn('[uber-direct] Location missing address components for fulfillment', f.id);
            continue;
        }

        const orderValueCents = f.items.reduce((sum, it) => {
            const unit = parseFloat(it.orderItem.unitPrice);
            if (isNaN(unit)) return sum;
            return sum + Math.round(unit * 100) * it.quantity;
        }, 0);

        const result = await uberCreateDelivery({
            externalOrderId: order.id,
            pickup: {
                name: loc.name,
                businessName: loc.name,
                address: {
                    line1: loc.addressLine1,
                    line2: loc.addressLine2 || undefined,
                    city: loc.city,
                    state: loc.state,
                    postalCode: loc.postalCode,
                    country: loc.country || 'US',
                },
                phone: loc.phone || '+15555550123',
                instructions: loc.notes || undefined,
            },
            dropoff: {
                firstName,
                lastName,
                address: parsed,
                phone: recipientPhone || '+15555550123',
                email: recipientEmail || undefined,
            },
            orderValueCents,
            items: f.items.map(it => ({
                name: it.orderItem.product.name,
                quantity: it.quantity,
            })),
        });

        if (result) {
            await prisma.orderFulfillment.update({
                where: { id: f.id },
                data: {
                    externalOrderId: result.deliveryId,
                    trackingNumber: result.trackingUrl || null,
                },
            });
            console.log('[uber-direct] Delivery created for fulfillment', f.id, ':', result.deliveryId);
        } else {
            console.warn('[uber-direct] Delivery creation failed for fulfillment', f.id);
        }
    }
}

/** Best-effort split of "line1, city, ST zip" formatted strings into components.
 *  Returns null if the format doesn't parse — caller logs + skips dispatch. */
function parseShippingAddress(formatted: string | null): {
    line1: string; city: string; state: string; postalCode: string; country: string;
} | null {
    if (!formatted) return null;
    // Pattern: "<line1>, <city>, <STATE> <ZIP>" (US format from Google Places)
    const m = formatted.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
    if (!m) return null;
    return {
        line1: m[1].trim(),
        city: m[2].trim(),
        state: m[3].trim(),
        postalCode: m[4].trim(),
        country: 'US',
    };
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
