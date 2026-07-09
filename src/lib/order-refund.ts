// Shared full-refund core + carrier-cancel helper (KDS PR-B).
//
// Lives in lib (NOT a 'use server' module) deliberately: exporting these from
// an actions file would turn them into publicly invocable server-action
// endpoints with no auth. Here they are plain functions — callers (admin
// refund action, kitchen cancel action, customer cancel, webhooks) are
// responsible for gating before calling.

import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { restoreStock } from '@/lib/stock-reservation';
import { doordashCancelDelivery } from '@/lib/doordash';
import { uberCancelDelivery } from '@/lib/uber-direct';

/* ─── Carrier cancel helper ────────────────────────────────────────────── */
//
// Used by cancelOrder (customer), refundOrderFullCore (shared full-refund
// path), and KDS re-dispatch flows to call the carrier's cancel API for any
// in-flight delivery. Best-effort: failure (e.g., driver already picked up)
// is logged and ignored — the customer's Stripe refund has already gone
// through. Skips fulfillments without an externalOrderId, with terminal
// status, or on non-carrier channels.
export async function cancelActiveCarrierDeliveries(
    fulfillments: ReadonlyArray<{
        id: string;
        deliveryMethod: string;
        externalOrderId: string | null;
        status: string;
    }>,
    logPrefix: string,
): Promise<void> {
    for (const f of fulfillments) {
        if (!f.externalOrderId) continue;
        if (f.status === 'DELIVERED' || f.status === 'CANCELLED') continue;
        let cancelled = false;
        if (f.deliveryMethod === 'DOORDASH_DRIVE') {
            cancelled = await doordashCancelDelivery(f.externalOrderId);
        } else if (f.deliveryMethod === 'UBER_DIRECT') {
            cancelled = await uberCancelDelivery(f.externalOrderId);
        } else {
            continue; // non-carrier channels (pickup/dine-in/own-driver) have nothing to cancel
        }
        if (cancelled) {
            console.log(`${logPrefix} Cancelled carrier delivery`, f.externalOrderId, '(', f.deliveryMethod, ')');
        } else {
            console.warn(`${logPrefix} Could not cancel carrier delivery`, f.externalOrderId, '(', f.deliveryMethod, ') — may have been picked up; reconcile in carrier dashboard');
        }
    }
}

/* ─── Shared full-refund core ──────────────────────────────────────────── */

export type RefundFullCoreOpts = {
    /** null = system-initiated (webhook / cron). */
    initiatedByUserId: string | null;
    /** Whether to also call restoreStock (at most once per order — guarded
        via the Refund rows' restoredStock flag). */
    restoreStock: boolean;
    /** Audit reason written to the Refund row + Stripe metadata. */
    reason: string;
    /** Optional free-text admin note (threaded through by refundOrder). */
    notes?: string | null;
};

/** Richer-return variant so the admin refund action can surface refundId/amountCents. */
export async function refundOrderFullInternal(
    orderId: string,
    opts: RefundFullCoreOpts,
): Promise<{ ok: true; refundId: string; amountCents: number } | { ok: false; error: string }> {
    if (!orderId) return { ok: false, error: 'Missing order id.' };

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            refunds: true,
            fulfillments: {
                include: { items: { include: { orderItem: true } } },
            },
        },
    });
    if (!order) return { ok: false, error: 'Order not found.' };
    if (order.paymentStatus !== 'PAID') {
        return { ok: false, error: 'Only paid orders can be refunded.' };
    }
    if (!order.stripePaymentIntentId) {
        return { ok: false, error: 'This order has no payment intent — nothing to refund.' };
    }

    // Full refund of the remaining balance (= full total when no priors).
    const totalCents = Math.round((parseFloat(order.totalAmount) || 0) * 100);
    const alreadyRefundedCents = order.refunds.reduce((sum, r) => sum + r.amountCents, 0);
    const amountCents = totalCents - alreadyRefundedCents;
    if (amountCents <= 0) {
        return { ok: false, error: 'This order is already fully refunded.' };
    }

    /* ─── Stripe refund ───────────────────────────────────────────────── */

    let stripeRefundId: string | null = null;
    try {
        const refund = await stripe.refunds.create({
            payment_intent: order.stripePaymentIntentId,
            amount: amountCents,
            // Connect destination charges: reverse the transfer too so the refund
            // pulls from the connected account, not just the platform balance.
            // Stripe ignores this on plain platform charges, so it's safe always.
            reverse_transfer: true,
            metadata: {
                orderId: order.id,
                reason: opts.reason,
                ...(opts.initiatedByUserId ? { initiatedByUserId: opts.initiatedByUserId } : {}),
            },
        });
        stripeRefundId = refund.id;
    } catch (e) {
        console.error('[refundOrderFullCore] Stripe refund failed:', e);
        return { ok: false, error: `Refund failed: ${e instanceof Error ? e.message : 'unknown error'}` };
    }

    /* ─── Tax reversal (best-effort, first refund only) ───────────────── */

    let taxReversed = false;
    if (alreadyRefundedCents === 0 && order.stripeTaxTransactionId) {
        try {
            await stripe.tax.transactions.createReversal({
                mode: 'full',
                original_transaction: order.stripeTaxTransactionId,
                reference: `${order.id}-refund-${Date.now()}`,
            });
            taxReversed = true;
        } catch (e) {
            console.warn('[refundOrderFullCore] Tax reversal failed:', e instanceof Error ? e.message : e);
        }
    }

    /* ─── Optional stock restore (at most once per order) ─────────────── */

    let stockRestored = false;
    const alreadyRestored = order.refunds.some(r => r.restoredStock);
    if (opts.restoreStock && !alreadyRestored) {
        const restoreItems = order.fulfillments.flatMap(f =>
            f.items.map(it => ({
                productId: it.orderItem.productId,
                locationId: f.locationId,
                quantity: it.quantity,
            })),
        );
        await restoreStock(restoreItems, {
            orderId: order.id,
            ...(opts.initiatedByUserId ? { initiatedByUserId: opts.initiatedByUserId } : {}),
        });
        stockRestored = true;
    }

    // Cancel any active carrier deliveries so the driver isn't en route after
    // we've refunded the customer. Best-effort — see helper for the contract.
    await cancelActiveCarrierDeliveries(order.fulfillments, '[refundOrderFullCore]');

    /* ─── Audit + status flips ────────────────────────────────────────── */

    const refundRecord = await prisma.refund.create({
        data: {
            orderId: order.id,
            initiatedByUserId: opts.initiatedByUserId,
            amountCents,
            reason: opts.reason,
            notes: opts.notes?.trim() || null,
            stripeRefundId,
            restoredStock: stockRestored,
            reversedTax: taxReversed,
        },
    });

    await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'REFUNDED' },
    });
    // Terminal statuses stay put — a DELIVERED leg really happened.
    await prisma.orderFulfillment.updateMany({
        where: { orderId: order.id, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        data: { status: 'CANCELLED' },
    });

    console.log(`[refundOrderFullCore] $${(amountCents / 100).toFixed(2)} refunded on Order ${order.id} (fully refunded)`);

    return { ok: true, refundId: refundRecord.id, amountCents };
}

/**
 * Full refund of an order — Stripe refund (reverse_transfer) + best-effort tax
 * reversal + optional stock restore + carrier delivery cancel + Refund audit
 * row + paymentStatus REFUNDED + non-terminal fulfillments → CANCELLED.
 * amountRefunded is a dollar string, e.g. "45.00".
 */
export async function refundOrderFullCore(
    orderId: string,
    opts: { initiatedByUserId: string | null; restoreStock: boolean; reason: string },
): Promise<{ ok: true; amountRefunded: string } | { ok: false; error: string }> {
    const result = await refundOrderFullInternal(orderId, opts);
    if (!result.ok) return result;
    return { ok: true, amountRefunded: (result.amountCents / 100).toFixed(2) };
}
