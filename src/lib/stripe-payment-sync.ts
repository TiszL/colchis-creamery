// Launch hardening — shared Stripe payment state sync.
//
// Before this module, the webhook route was the ONLY code that could flip an
// order to PAID. A misconfigured live webhook secret therefore meant: customer
// charged → order stays UNPAID → reservation cron cancels it → auto-refund
// (also webhook-only) never fires. Charged customers, cancelled orders,
// silence.
//
// Now three callers share ONE processing path:
//   • the Stripe webhook (normal path),
//   • the checkout success page (reconciles as soon as the customer lands),
//   • the reservation-release cron (checks Stripe BEFORE cancelling anything).
//
// Plain lib (NOT 'use server') — exporting these from an actions file would
// create unauthenticated public endpoints. Callers gate access themselves.
//
// Concurrency: the webhook, success page, and cron can race on the same order.
// commitStock's state-machine checks make sequential retries no-ops, but two
// CONCURRENT commits could both pass the pre-check. processPaymentSucceeded
// therefore takes a per-order claim (a `paid-sync:<orderId>` row in
// ProcessedStripeEvent — insert is atomic, duplicate → someone else has it).
// The claim is released on failure so a retry can reprocess, and kept forever
// on success as a permanent idempotency record.

import type Stripe from 'stripe';
import type { DeliveryMethod } from '@prisma/client';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { commitStock, releaseStock, restoreStock } from '@/lib/stock-reservation';
import { cancelActiveCarrierDeliveries } from '@/lib/order-refund';
import {
    sendOrderConfirmation,
    sendNewOrderKitchenEmail,
    sendOpsAlertEmail,
    type OrderForEmail,
} from '@/lib/email';
import { easypostBuyLabel, isEasyPostConfigured } from '@/lib/easypost';
import { isOpenNow, nextOpenSlot } from '@/lib/location-hours';

// Delayed-notification methods (ACH debit etc.) settle in 1-5 business days.
// While a PaymentIntent sits in 'processing' we hold the stock reservation
// this long so the cron doesn't sweep the order before the bank answers.
const PROCESSING_RESERVATION_MS = 7 * 24 * 60 * 60 * 1000;

/* ─── Per-order paid-processing claim (see header) ─────────────────────── */

async function claimPaidSync(orderId: string): Promise<boolean> {
    try {
        await prisma.processedStripeEvent.create({
            data: { id: `paid-sync:${orderId}`, type: 'internal.paid-sync' },
        });
        return true;
    } catch (e) {
        if ((e as { code?: string })?.code === 'P2002') return false;
        throw e;
    }
}

async function releasePaidSyncClaim(orderId: string): Promise<void> {
    await prisma.processedStripeEvent
        .delete({ where: { id: `paid-sync:${orderId}` } })
        .catch(() => undefined);
}

/* ─── Succeeded ────────────────────────────────────────────────────────── */

export async function processPaymentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
    const order = await loadOrderForPI(pi.id);
    if (!order) {
        console.warn('[payment-sync] succeeded for unknown PI:', pi.id);
        return;
    }

    // Idempotency — Stripe may retry; we may have already committed this order.
    if (order.paymentStatus === 'PAID') {
        console.log('[payment-sync] Order already PAID, no-op:', order.id);
        return;
    }
    // The reservation-cleanup cron cancelled this order (stock already
    // released) before the payment confirmed. We can't fulfill it, so refund
    // the captured funds rather than charge-without-shipping.
    if (order.orderStatus === 'CANCELLED') {
        console.warn('[payment-sync] Late success on CANCELLED order — auto-refunding:', order.id, 'PI:', pi.id);
        try {
            await stripe.refunds.create({ payment_intent: pi.id });
            await prisma.order.update({
                where: { id: order.id },
                data: { paymentStatus: 'REFUNDED' },
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            // Idempotent: refunding an already-refunded PI throws and lands here.
            // Anything else means a customer is charged for a cancelled order —
            // that must reach a human, not just the logs.
            console.error('[payment-sync] Auto-refund failed for late success on', order.id, ':', msg);
            if (!/already been refunded|has already been refunded/i.test(msg)) {
                await sendOpsAlertEmail({
                    subject: 'Auto-refund FAILED on a cancelled order',
                    orderId: order.id,
                    lines: [
                        `Payment ${pi.id} succeeded AFTER the order was cancelled, and the automatic refund failed: ${msg}`,
                        'The customer is currently charged for an order we will not fulfill.',
                        'Refund it manually in the Stripe dashboard (Payments → search the payment id), then verify the order shows REFUNDED in admin.',
                    ],
                }).catch(() => undefined);
            }
        }
        return;
    }

    if (!(await claimPaidSync(order.id))) {
        // Success page / cron / webhook raced us — exactly one caller proceeds.
        console.log('[payment-sync] paid-sync already claimed for order, no-op:', order.id);
        return;
    }

    try {
        await commitPaidOrder(order, pi);
    } catch (e) {
        await releasePaidSyncClaim(order.id);
        throw e;
    }
}

async function commitPaidOrder(order: OrderForSync, pi: Stripe.PaymentIntent): Promise<void> {
    const reservationItems = reservationItemsFromOrder(order);

    // Commit stock AND flip the order to PAID/CONFIRMED ATOMICALLY: the order +
    // fulfillment updates run inside commitStock's transaction via onCommitted.
    // A partial failure rolls the whole thing back and the retry reprocesses.
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
            // Kitchen-driven dispatch: kitchen legs stay PENDING until staff
            // Accept them in the location portal. Only warehouse/B2B legs
            // auto-confirm on payment.
            await tx.orderFulfillment.updateMany({
                where: {
                    orderId: order.id,
                    deliveryMethod: { in: ['UPS_2DAY', 'MANUAL_DISPATCH'] },
                },
                data: { status: 'CONFIRMED' },
            });
        },
    });

    // Record the Stripe Tax transaction for compliance reporting. Idempotent:
    // skipped when a transaction is already recorded for this order. The PI
    // metadata fallback covers orders whose post-PI update never landed.
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
            // transaction null) is a flag for the admin retry tool.
            console.warn('[payment-sync] tax.transactions.createFromCalculation failed for Order', order.id, ':', e instanceof Error ? e.message : e);
        }
    }

    // After-hours scheduling hints + kitchen alert emails. Best-effort.
    try {
        await scheduleAndNotifyKitchenLegs(order.id);
    } catch (e) {
        console.warn('[payment-sync] Kitchen scheduling/notification failed for Order', order.id, ':', e instanceof Error ? e.message : e);
    }

    // Phase 5 (5c): buy UPS labels for NATIONAL_SHIP fulfillments. Best-effort;
    // idempotency inside skips already-bought labels.
    if (isEasyPostConfigured()) {
        try {
            await dispatchUpsLabels(order.id);
        } catch (e) {
            console.warn('[payment-sync] UPS label dispatch failed for Order', order.id, ':', e instanceof Error ? e.message : e);
        }
    }

    // Confirmation email (best-effort).
    try {
        const fresh = await loadOrderForEmail(order.id);
        if (fresh) await sendOrderConfirmation(fresh);
    } catch (e) {
        console.warn('[payment-sync] Order confirmation email failed for Order', order.id, ':', e instanceof Error ? e.message : e);
    }

    console.log('[payment-sync] Order paid + stock committed:', order.id);
}

/* ─── Failed / canceled ────────────────────────────────────────────────── */

export async function processPaymentFailed(pi: Stripe.PaymentIntent): Promise<void> {
    const order = await loadOrderForPI(pi.id);
    if (!order) {
        console.warn('[payment-sync] payment failure for unknown PI:', pi.id);
        return;
    }

    // Idempotency — already terminal in either direction.
    if (order.paymentStatus === 'PAID') {
        console.warn('[payment-sync] Payment failure event but Order is already PAID — needs manual review:', order.id, 'PI:', pi.id);
        return;
    }
    if (order.orderStatus === 'CANCELLED') {
        console.log('[payment-sync] Order already CANCELLED, no-op:', order.id);
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

    console.log('[payment-sync] Order cancelled + stock released:', order.id);
}

/* ─── Processing (delayed settlement: ACH etc.) ────────────────────────── */

/**
 * payment_intent.processing — the bank will answer in days, not seconds.
 * Mark the order PROCESSING (which removes it from the reservation cron's
 * UNPAID sweep predicate) and extend the stock reservation so inventory
 * stays honest while the payment settles. succeeded/failed transitions the
 * order onward through the handlers above.
 */
export async function markPaymentProcessing(pi: Stripe.PaymentIntent): Promise<void> {
    const updated = await prisma.order.updateMany({
        where: { stripePaymentIntentId: pi.id, paymentStatus: 'UNPAID' },
        data: {
            paymentStatus: 'PROCESSING',
            reservationExpiresAt: new Date(Date.now() + PROCESSING_RESERVATION_MS),
        },
    });
    if (updated.count > 0) {
        console.log('[payment-sync] Order marked PROCESSING (delayed settlement), reservation extended for PI:', pi.id);
    }
}

/* ─── Reconcile (webhook-independent recovery) ─────────────────────────── */

export type ReconcileResult = 'settled' | 'paid' | 'processing' | 'pending' | 'unknown';

/**
 * Ask Stripe directly what happened to an order's payment and sync our state.
 * Called from the checkout success page (customer just paid — don't depend on
 * the webhook having fired) and from the reservation cron (never cancel an
 * order without checking Stripe first). Safe to call repeatedly.
 */
export async function reconcileOrderFromStripe(orderId: string): Promise<ReconcileResult> {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, paymentStatus: true, stripePaymentIntentId: true },
    });
    if (!order?.stripePaymentIntentId) return 'unknown';
    if (order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED') return 'settled';

    const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
    if (pi.status === 'succeeded') {
        await processPaymentSucceeded(pi);
        return 'paid';
    }
    if (pi.status === 'processing') {
        await markPaymentProcessing(pi);
        return 'processing';
    }
    return 'pending';
}

/* ─── External (dashboard) refunds + disputes ──────────────────────────── */

/**
 * charge.refunded — fires for refunds from ANY source, including the Stripe
 * dashboard. Before this handler, a dashboard refund left the order PAID and
 * the kitchen kept cooking it. Refunds issued through the app are already
 * recorded (deduped via Refund.stripeRefundId), so this is a no-op for them.
 */
export async function syncExternalRefund(charge: Stripe.Charge): Promise<void> {
    const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (!piId) return;

    const order = await prisma.order.findUnique({
        where: { stripePaymentIntentId: piId },
        include: {
            refunds: true,
            fulfillments: { include: { items: { include: { orderItem: true } } } },
        },
    });
    if (!order) {
        console.log('[payment-sync] charge.refunded for untracked PI:', piId);
        return;
    }

    // Record any Stripe refunds we don't know about yet (dashboard-initiated).
    const refundList = await stripe.refunds.list({ payment_intent: piId, limit: 100 });
    const known = new Set(order.refunds.map(r => r.stripeRefundId).filter(Boolean));
    const external = refundList.data.filter(r => !known.has(r.id) && r.status !== 'failed' && r.status !== 'canceled');
    for (const r of external) {
        // @unique on stripeRefundId makes a concurrent duplicate insert throw —
        // treat that as "someone else recorded it".
        await prisma.refund
            .create({
                data: {
                    orderId: order.id,
                    initiatedByUserId: null,
                    amountCents: r.amount,
                    reason: 'stripe_dashboard',
                    notes: 'Recorded from charge.refunded webhook (refund issued outside the app)',
                    stripeRefundId: r.id,
                },
            })
            .catch(e => {
                if ((e as { code?: string })?.code !== 'P2002') throw e;
            });
    }

    // Fully refunded → the order must stop being cooked/dispatched.
    const totalCents = Math.round((parseFloat(order.totalAmount) || 0) * 100);
    const fullyRefunded = charge.refunded === true || (charge.amount_refunded ?? 0) >= totalCents;
    if (!fullyRefunded) {
        if (external.length > 0) {
            console.log('[payment-sync] Partial dashboard refund recorded for order', order.id);
        }
        return;
    }
    if (order.paymentStatus === 'REFUNDED') return; // app-initiated full refund already handled everything

    await prisma.$transaction([
        prisma.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'REFUNDED', orderStatus: 'CANCELLED' },
        }),
        prisma.orderFulfillment.updateMany({
            where: {
                orderId: order.id,
                status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] },
            },
            data: { status: 'CANCELLED' },
        }),
    ]);

    // Recall any live courier so a driver isn't sent for a refunded order.
    try {
        await cancelActiveCarrierDeliveries(
            order.fulfillments.map(f => ({
                id: f.id,
                deliveryMethod: f.deliveryMethod,
                externalOrderId: f.externalOrderId,
                status: f.status,
            })),
            '[payment-sync:charge.refunded]',
        );
    } catch (e) {
        console.error('[payment-sync] courier recall failed after dashboard refund:', e);
    }

    // Restore stock at most once per order (mirrors refundOrderFullCore's guard).
    const alreadyRestored = order.refunds.some(r => r.restoredStock);
    if (!alreadyRestored && external.length > 0) {
        try {
            await restoreStock(reservationItemsFromOrder(order), { orderId: order.id, initiatedByUserId: null });
            await prisma.refund.updateMany({
                where: { stripeRefundId: external[0].id },
                data: { restoredStock: true },
            });
        } catch (e) {
            console.error('[payment-sync] restock failed after dashboard refund for order', order.id, ':', e);
        }
    }

    await sendOpsAlertEmail({
        subject: 'Order refunded from the Stripe dashboard',
        orderId: order.id,
        lines: [
            'A full refund was issued for this order outside the app (Stripe dashboard or API).',
            'The order has been marked REFUNDED, its kitchen fulfillments cancelled, couriers recalled, and stock restored.',
            'No customer email was sent automatically — contact the customer if they need an explanation.',
        ],
    }).catch(() => undefined);

    console.log('[payment-sync] Dashboard refund synced — order cancelled + refunded:', order.id);
}

/**
 * charge.dispute.created — a customer disputed the charge with their bank.
 * There is nothing safe to automate here; get a human on it immediately
 * (disputes have response deadlines and cost a fee when lost).
 */
export async function alertDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    const piId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
    const order = piId
        ? await prisma.order.findUnique({ where: { stripePaymentIntentId: piId }, select: { id: true } })
        : null;
    console.error('[payment-sync] DISPUTE created:', dispute.id, 'PI:', piId, 'order:', order?.id ?? 'unknown', 'amount:', dispute.amount, 'reason:', dispute.reason);
    await sendOpsAlertEmail({
        subject: `Payment dispute opened (${dispute.reason})`,
        orderId: order?.id ?? null,
        lines: [
            `A customer disputed a charge of $${(dispute.amount / 100).toFixed(2)} (reason: ${dispute.reason}).`,
            `Respond in the Stripe dashboard before the deadline — Disputes → ${dispute.id}.`,
            'Do NOT ship/prepare anything else for this customer until resolved.',
        ],
    }).catch(() => undefined);
}

/* ─── Shared helpers (moved verbatim from the webhook route) ───────────── */

type OrderForSync = NonNullable<Awaited<ReturnType<typeof loadOrderForPI>>>;

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

function reservationItemsFromOrder(order: OrderForSync) {
    return order.fulfillments.flatMap(f =>
        f.items.map(it => ({
            productId: it.orderItem.productId,
            locationId: f.locationId,
            quantity: it.quantity,
        })),
    );
}

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
 * closed right now; (2) send one new-order alert email per location. Best-
 * effort throughout — a failure here never fails payment processing.
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
            console.warn('[payment-sync] scheduledFor stamp failed for fulfillment', f.id, ':', e instanceof Error ? e.message : e);
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
            console.warn('[payment-sync] Kitchen alert email failed for location', locationId, 'Order', order.id, ':', e instanceof Error ? e.message : e);
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

/* ─── UPS label dispatch (Phase 5 / 5c) ────────────────────────────────── */

/**
 * Phase 5 — best-effort parser for Order.shippingAddress (free-text snapshot).
 * Returns null when the string doesn't conform; EasyPost label-buy then skips
 * that fulfillment with a warning (ops books manually).
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

    // Prefer the structured 9c columns; fall back to parsing the free-text snapshot.
    const parsed = order.shippingLine1
        ? {
              line1: order.shippingLine1,
              city: order.shippingCity ?? '',
              state: order.shippingState ?? '',
              postalCode: order.shippingPostalCode ?? '',
              country: 'US',
          }
        : parseFreeTextShippingAddress(order.shippingAddress);
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
            await sendOpsAlertEmail({
                subject: 'UPS label NOT bought — unparseable ship-to address',
                orderId: order.id,
                lines: [
                    `Fulfillment ${f.id} needs a UPS label but the shipping address could not be parsed: "${order.shippingAddress ?? '(empty)'}".`,
                    'Buy the label manually and set the tracking number on the fulfillment in admin.',
                ],
            }).catch(() => undefined);
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
            console.log(`[easypost] Label bought for fulfillment ${f.id}: ${bought.carrier} ${bought.service} ${bought.trackingCode} (label: ${bought.labelUrl})`);
        } else {
            // A paid NATIONAL_SHIP order with no label is invisible unless ops hears.
            console.warn('[easypost] Label purchase failed for fulfillment', f.id, '— leaving for manual booking');
            await sendOpsAlertEmail({
                subject: 'UPS label purchase FAILED',
                orderId: order.id,
                lines: [
                    `EasyPost refused the label for fulfillment ${f.id} (see server logs for the API error).`,
                    'The customer has paid for shipping. Book the label manually and set the tracking number in admin.',
                ],
            }).catch(() => undefined);
        }
    }
}
