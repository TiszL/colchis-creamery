'use server';

// Phase 7b.5 — Customer-initiated order cancellation.
//
// Customer can cancel their own order if ALL of:
//   - paymentStatus = PAID (so there's a payment to refund)
//   - orderStatus != CANCELLED (idempotency)
//   - (now - createdAt) < 15 min (recent enough to refund cleanly)
//   - no fulfillment has advanced past CONFIRMED (kitchen hasn't started)
//
// Effects: Stripe refund (full) + Stripe Tax reversal (best-effort) + restore
// stock to inventory + flip Order/Fulfillment statuses to CANCELLED/REFUNDED.
//
// Guests (no session) can't cancel through this action — they email support.
// Admin-initiated cancel/refund is a separate flow (7b.6) with partial-refund
// support and audit trail.

import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { getSession } from '@/lib/session';
import { restoreStock } from '@/lib/stock-reservation';
import { CANCEL_WINDOW_MS, PAST_CONFIRMED_FULFILLMENT_STATUSES } from '@/lib/order-policy';
import { revalidatePath } from 'next/cache';

export type CancelOrderResult =
    | { ok: true }
    | { ok: false; error: string };

export async function cancelOrder(orderId: string): Promise<CancelOrderResult> {
    if (!orderId) return { ok: false, error: 'Missing order id.' };

    const session = await getSession();
    if (!session?.userId) return { ok: false, error: 'Please log in to cancel an order.' };

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            fulfillments: {
                include: { items: { include: { orderItem: true } } },
            },
        },
    });
    // Foreign or missing — mirror 404 semantics to avoid leaking existence.
    if (!order || order.userId !== session.userId) {
        return { ok: false, error: 'Order not found.' };
    }

    /* ─── Eligibility (server-side; UI hint is best-effort) ──────────────── */

    if (order.paymentStatus !== 'PAID') {
        return { ok: false, error: 'Only paid orders can be cancelled.' };
    }
    if (order.orderStatus === 'CANCELLED') {
        return { ok: false, error: 'This order is already cancelled.' };
    }
    const ageMs = Date.now() - order.createdAt.getTime();
    if (ageMs >= CANCEL_WINDOW_MS) {
        const mins = Math.floor(CANCEL_WINDOW_MS / 60000);
        return { ok: false, error: `Orders can only be cancelled within ${mins} minutes of placing. Please contact support.` };
    }
    if (order.fulfillments.some(f => PAST_CONFIRMED_FULFILLMENT_STATUSES.has(f.status))) {
        return { ok: false, error: 'Some items are already being prepared — please contact support to cancel.' };
    }
    if (!order.stripePaymentIntentId) {
        return { ok: false, error: 'Missing payment reference — please contact support.' };
    }

    /* ─── Stripe refund (full) ───────────────────────────────────────────── */

    let stripeRefundId: string | null = null;
    try {
        const refund = await stripe.refunds.create({
            payment_intent: order.stripePaymentIntentId,
            metadata: { orderId: order.id, reason: 'customer_cancellation' },
            reason: 'requested_by_customer',
        });
        stripeRefundId = refund.id;
    } catch (e) {
        console.error('[cancelOrder] Stripe refund failed for Order', order.id, ':', e instanceof Error ? e.message : e);
        return { ok: false, error: 'Refund failed. Please contact support.' };
    }

    /* ─── Stripe Tax reversal (best-effort) ──────────────────────────────── */
    //
    // Tax compliance: the original Stripe Tax transaction (recorded by the
    // webhook on payment_intent.succeeded) needs a matching reversal to keep
    // tax reporting consistent. Failure here is non-fatal — the customer's
    // refund already went through. Admin can manually reverse via dashboard.

    let taxReversed = false;
    if (order.stripeTaxTransactionId) {
        try {
            await stripe.tax.transactions.createReversal({
                mode: 'full',
                original_transaction: order.stripeTaxTransactionId,
                reference: `${order.id}-cancel-${Date.now()}`,
            });
            taxReversed = true;
        } catch (e) {
            console.warn(
                '[cancelOrder] Tax reversal failed for Order', order.id,
                '(refund succeeded; admin should reconcile):',
                e instanceof Error ? e.message : e,
            );
        }
    }

    /* ─── Restore stock + flip statuses + audit ──────────────────────────── */

    const restoreItems = order.fulfillments.flatMap(f =>
        f.items.map(it => ({
            productId: it.orderItem.productId,
            locationId: f.locationId,
            quantity: it.quantity,
        })),
    );
    await restoreStock(restoreItems);

    // amountCents from totalAmount (string dollars) — fall back to 0 if NaN
    const amountCents = Math.round((parseFloat(order.totalAmount) || 0) * 100);

    // Interactive form so we can pass a longer timeout — Prisma's array form
    // doesn't accept timeout options. Cold Neon connections can push the
    // default 5s budget when chaining three writes.
    await prisma.$transaction(async (tx) => {
        await tx.order.update({
            where: { id: order.id },
            data: {
                orderStatus: 'CANCELLED',
                paymentStatus: 'REFUNDED',
            },
        });
        await tx.orderFulfillment.updateMany({
            where: { orderId: order.id },
            data: { status: 'CANCELLED' },
        });
        // Phase 7b.6: write an audit row for this refund. initiatedByUserId is
        // the customer themselves; admin-issued refunds go through refundOrder.
        await tx.refund.create({
            data: {
                orderId: order.id,
                initiatedByUserId: session.userId,
                amountCents,
                reason: 'customer_cancellation',
                stripeRefundId,
                restoredStock: true,
                reversedTax: taxReversed,
            },
        });
    }, { timeout: 15_000 });

    console.log('[cancelOrder] Cancelled + refunded Order', order.id);

    // Refresh the customer's order detail + account list
    revalidatePath(`/[locale]/account/orders/${order.id}`, 'page');
    revalidatePath('/[locale]/account', 'page');

    return { ok: true };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Phase 7b.6 — Admin refund flow.
   ═══════════════════════════════════════════════════════════════════════════ */

export type RefundOrderInput = {
    orderId: string;
    /** Dollars. 0 or negative = full refund of remaining balance. */
    amountDollars: number;
    reason: 'admin_full' | 'admin_partial' | 'admin_other';
    notes?: string;
    /** Whether to also call restoreStock — typically true for full first refund,
        false for partial (admin reconciles inventory separately). */
    restoreStock: boolean;
};

export type RefundOrderResult =
    | { ok: true; refundId: string; amountCents: number; fullyRefunded: boolean }
    | { ok: false; error: string };

/**
 * Admin-issued refund. Supports full or partial. Logs an audit row in the
 * Refund table. Updates Order.paymentStatus only when total refunded reaches
 * the order's total (orderStatus is left alone — admin decides via the
 * fulfillment-status advance buttons).
 *
 * Tax reversal is attempted only on a full-first-refund (one shot, full mode);
 * partial reversals would need line-item math which is out of scope for 7b.
 */
export async function refundOrder(input: RefundOrderInput): Promise<RefundOrderResult> {
    const session = await getSession();
    if (!session?.userId) return { ok: false, error: 'Not authenticated.' };
    if (session.role !== 'MASTER_ADMIN') {
        return { ok: false, error: 'Admin access required.' };
    }
    if (!input.orderId) return { ok: false, error: 'Missing order id.' };

    const order = await prisma.order.findUnique({
        where: { id: input.orderId },
        include: {
            refunds: true,
            fulfillments: {
                include: { items: { include: { orderItem: true } } },
            },
        },
    });
    if (!order) return { ok: false, error: 'Order not found.' };
    if (!order.stripePaymentIntentId) {
        return { ok: false, error: 'This order has no payment intent — nothing to refund.' };
    }

    /* ─── Compute amount ──────────────────────────────────────────────── */

    const totalCents = Math.round((parseFloat(order.totalAmount) || 0) * 100);
    const alreadyRefundedCents = order.refunds.reduce((sum, r) => sum + r.amountCents, 0);
    const remainingCents = totalCents - alreadyRefundedCents;

    if (remainingCents <= 0) {
        return { ok: false, error: 'This order is already fully refunded.' };
    }

    let amountCents: number;
    if (input.amountDollars <= 0) {
        amountCents = remainingCents;
    } else {
        amountCents = Math.round(input.amountDollars * 100);
        if (amountCents > remainingCents) {
            const max = (remainingCents / 100).toFixed(2);
            return { ok: false, error: `Maximum refundable amount is $${max}.` };
        }
    }
    if (amountCents <= 0) return { ok: false, error: 'Refund amount must be positive.' };

    /* ─── Stripe refund ───────────────────────────────────────────────── */

    let stripeRefundId: string | null = null;
    try {
        const refund = await stripe.refunds.create({
            payment_intent: order.stripePaymentIntentId,
            amount: amountCents,
            metadata: {
                orderId: order.id,
                reason: input.reason,
                initiatedByUserId: session.userId,
            },
        });
        stripeRefundId = refund.id;
    } catch (e) {
        console.error('[refundOrder] Stripe refund failed:', e);
        return { ok: false, error: `Refund failed: ${e instanceof Error ? e.message : 'unknown error'}` };
    }

    /* ─── Tax reversal (full refund, first refund only) ───────────────── */

    let taxReversed = false;
    const isFullFirstRefund = alreadyRefundedCents === 0 && amountCents === totalCents;
    if (isFullFirstRefund && order.stripeTaxTransactionId) {
        try {
            await stripe.tax.transactions.createReversal({
                mode: 'full',
                original_transaction: order.stripeTaxTransactionId,
                reference: `${order.id}-admin-refund-${Date.now()}`,
            });
            taxReversed = true;
        } catch (e) {
            console.warn('[refundOrder] Tax reversal failed:', e instanceof Error ? e.message : e);
        }
    }

    /* ─── Optional stock restore ──────────────────────────────────────── */

    let stockRestored = false;
    if (input.restoreStock) {
        const restoreItems = order.fulfillments.flatMap(f =>
            f.items.map(it => ({
                productId: it.orderItem.productId,
                locationId: f.locationId,
                quantity: it.quantity,
            })),
        );
        await restoreStock(restoreItems);
        stockRestored = true;
    }

    /* ─── Audit + Order status update ─────────────────────────────────── */

    const newTotalRefunded = alreadyRefundedCents + amountCents;
    const fullyRefunded = newTotalRefunded >= totalCents;

    const refundRecord = await prisma.refund.create({
        data: {
            orderId: order.id,
            initiatedByUserId: session.userId,
            amountCents,
            reason: input.reason,
            notes: input.notes?.trim() || null,
            stripeRefundId,
            restoredStock: stockRestored,
            reversedTax: taxReversed,
        },
    });

    if (fullyRefunded && order.paymentStatus !== 'REFUNDED') {
        await prisma.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'REFUNDED' },
        });
    }

    console.log(
        `[refundOrder] $${(amountCents / 100).toFixed(2)} refunded on Order ${order.id}`,
        fullyRefunded ? '(fully refunded)' : `(${((newTotalRefunded / totalCents) * 100).toFixed(0)}% of total)`,
    );

    revalidatePath(`/[locale]/admin/orders/${order.id}`, 'page');
    revalidatePath('/[locale]/admin/orders', 'page');

    return { ok: true, refundId: refundRecord.id, amountCents, fullyRefunded };
}
