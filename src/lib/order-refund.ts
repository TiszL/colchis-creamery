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

/* ─── Refund helpers ───────────────────────────────────────────────────── */

// Whether the payment's charge has a Connect transfer (destination charge).
// Stripe REJECTS reverse_transfer on plain platform charges ("Cannot reverse
// transfer on charge … because it does not have an associated transfer" —
// hit on pre-Connect orders), so it must only be sent when a transfer exists.
// On lookup failure default to false: the refund still goes through from the
// platform balance; a missed reversal is reconciled manually, a hard-failed
// refund helps nobody.
async function chargeHasTransfer(paymentIntentId: string): Promise<boolean> {
    try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
        const charge = pi.latest_charge;
        return !!(charge && typeof charge !== 'string' && charge.transfer);
    } catch (e) {
        console.warn('[chargeHasTransfer] lookup failed — refunding without transfer reversal:', e);
        return false;
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
            // Only when a transfer exists — Stripe rejects it on platform charges.
            reverse_transfer: await chargeHasTransfer(order.stripePaymentIntentId),
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

/* ─── Kitchen partial refund (item removal) ────────────────────────────── */

/** Dollar-string → integer cents. Order money fields are unprefixed dollar strings. */
function toCents(s: string | null | undefined): number {
    return Math.round((parseFloat(s ?? '') || 0) * 100);
}

/**
 * Kitchen removes item(s) from a paid order and refunds the customer their
 * price + proportional tax share. Shipping is NEVER refunded (the delivery
 * still happens). The order continues — paymentStatus stays PAID, kitchen
 * flow untouched. Refunding the entire remaining balance is rejected: that's
 * the full cancel flow's job (which also cancels the courier).
 *
 * Callers gate auth (kitchen role / master admin) before calling.
 */
export async function kitchenRemoveItemsCore(
    orderId: string,
    removals: { orderItemId: string; quantity: number }[],
    opts: { initiatedByUserId: string | null; reason: string },
): Promise<
    | { ok: true; amountRefunded: string; removed: { name: string; quantity: number }[] }
    | { ok: false; error: string }
> {
    if (!orderId) return { ok: false, error: 'Missing order id.' };
    if (removals.length === 0) return { ok: false, error: 'No items selected for removal.' };

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            refunds: true,
            orderItems: { include: { product: { select: { name: true } } } },
            fulfillments: {
                select: { locationId: true, items: { select: { orderItemId: true, quantity: true } } },
            },
        },
    });
    if (!order) return { ok: false, error: 'Order not found.' };
    if (order.paymentStatus !== 'PAID') {
        return { ok: false, error: 'Only paid orders can have items refunded.' };
    }
    if (!order.stripePaymentIntentId) {
        return { ok: false, error: 'This order has no payment intent — nothing to refund.' };
    }

    // Merge duplicate removals per orderItem so the removable-quantity cap
    // can't be bypassed by splitting one item across entries.
    const removalByItem = new Map<string, number>();
    for (const r of removals) {
        removalByItem.set(r.orderItemId, (removalByItem.get(r.orderItemId) ?? 0) + r.quantity);
    }

    const itemById = new Map(order.orderItems.map(it => [it.id, it]));
    for (const [orderItemId, qty] of removalByItem) {
        const item = itemById.get(orderItemId);
        if (!item) return { ok: false, error: 'One of the selected items does not belong to this order.' };
        if (!Number.isInteger(qty) || qty < 1) {
            return { ok: false, error: 'Removal quantities must be whole numbers of at least 1.' };
        }
        const removable = item.quantity - item.refundedQuantity;
        if (qty > removable) {
            return { ok: false, error: `Cannot remove ${qty} × ${item.product.name} — only ${removable} left on the order.` };
        }
    }

    /* ─── Cents math ──────────────────────────────────────────────────── */
    // Each removed unit refunds its price + a proportional share of the
    // order's tax (itemCents / subtotalCents). Shipping is never refunded.
    const subtotalCents = toCents(order.subtotalAmount)
        || order.orderItems.reduce((sum, it) => sum + toCents(it.unitPrice) * it.quantity, 0);
    const taxCents = toCents(order.taxAmount);

    let refundCents = 0;
    for (const [orderItemId, qty] of removalByItem) {
        const item = itemById.get(orderItemId)!;
        const itemCents = toCents(item.unitPrice) * qty;
        const taxShare = subtotalCents > 0 ? Math.round(taxCents * itemCents / subtotalCents) : 0;
        refundCents += itemCents + taxShare;
    }
    if (refundCents <= 0) {
        return { ok: false, error: 'Nothing to refund for the selected items.' };
    }
    const alreadyRefundedCents = order.refunds.reduce((sum, r) => sum + r.amountCents, 0);
    const remainingCents = toCents(order.totalAmount) - alreadyRefundedCents;
    if (refundCents >= remainingCents) {
        return { ok: false, error: 'This would refund the entire remaining balance — use the full cancel flow instead.' };
    }

    /* ─── Stripe partial refund ───────────────────────────────────────── */
    // NOTE: no Stripe Tax transaction reversal here — line-item tax reversal
    // is out of scope for the kitchen flow; the accountant tooling reconciles
    // partial-refund tax from the Refund rows (reversedTax stays false).
    let stripeRefundId: string;
    try {
        const refund = await stripe.refunds.create({
            payment_intent: order.stripePaymentIntentId,
            amount: refundCents,
            // Connect destination charges: reverse the transfer too. Only when
            // a transfer exists — Stripe rejects it on platform charges.
            reverse_transfer: await chargeHasTransfer(order.stripePaymentIntentId),
            metadata: {
                orderId: order.id,
                reason: 'kitchen_item_removed',
                ...(opts.initiatedByUserId ? { initiatedByUserId: opts.initiatedByUserId } : {}),
            },
        });
        stripeRefundId = refund.id;
    } catch (e) {
        console.error('[kitchenRemoveItemsCore] Stripe refund failed:', e);
        return { ok: false, error: `Refund failed: ${e instanceof Error ? e.message : 'unknown error'}` };
    }

    /* ─── Audit: refundedQuantity increments + Refund row (one tx) ─────── */

    await prisma.$transaction([
        ...[...removalByItem].map(([orderItemId, qty]) =>
            prisma.orderItem.update({
                where: { id: orderItemId },
                data: { refundedQuantity: { increment: qty } },
            }),
        ),
        prisma.refund.create({
            data: {
                orderId: order.id,
                initiatedByUserId: opts.initiatedByUserId,
                amountCents: refundCents,
                reason: 'kitchen_item_removed',
                notes: opts.reason || null,
                stripeRefundId,
                restoredStock: true,
                reversedTax: false,
            },
        }),
    ]);

    /* ─── Stock restore (outside the tx, mirrors refundOrderFullInternal) ── */
    // Map each orderItem to its fulfillment's location so restoreStock gets
    // (productId, locationId) pairs.
    const locationByOrderItem = new Map<string, string>();
    for (const f of order.fulfillments) {
        for (const fi of f.items) {
            if (!locationByOrderItem.has(fi.orderItemId)) {
                locationByOrderItem.set(fi.orderItemId, f.locationId);
            }
        }
    }
    const restoreItems = [...removalByItem].flatMap(([orderItemId, qty]) => {
        const locationId = locationByOrderItem.get(orderItemId);
        if (!locationId) {
            console.warn('[kitchenRemoveItemsCore] No fulfillment location for orderItem', orderItemId, '— skipping stock restore for it');
            return [];
        }
        return [{ productId: itemById.get(orderItemId)!.productId, locationId, quantity: qty }];
    });
    await restoreStock(restoreItems, {
        orderId: order.id,
        ...(opts.initiatedByUserId ? { initiatedByUserId: opts.initiatedByUserId } : {}),
    });

    const removed = [...removalByItem].map(([orderItemId, qty]) => ({
        name: itemById.get(orderItemId)!.product.name,
        quantity: qty,
    }));
    console.log(`[kitchenRemoveItemsCore] $${(refundCents / 100).toFixed(2)} refunded on Order ${order.id} (${removed.length} item line(s) removed)`);

    return { ok: true, amountRefunded: (refundCents / 100).toFixed(2), removed };
}
