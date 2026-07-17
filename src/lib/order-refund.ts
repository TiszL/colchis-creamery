// Shared full-refund core + carrier-cancel helper (KDS PR-B).
//
// Lives in lib (NOT a 'use server' module) deliberately: exporting these from
// an actions file would turn them into publicly invocable server-action
// endpoints with no auth. Here they are plain functions — callers (admin
// refund action, kitchen cancel action, customer cancel, webhooks) are
// responsible for gating before calling.

import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { effectiveReservationItems, restoreStock } from '@/lib/stock-reservation';
import { doordashCancelDelivery } from '@/lib/doordash';
import { uberCancelDelivery } from '@/lib/uber-direct';
import { sendOpsAlertEmail } from '@/lib/email';

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
// refund helps nobody. (Exported: the payment-sync late-success auto-refund
// needs the same check.)
export async function chargeHasTransfer(paymentIntentId: string): Promise<boolean> {
    try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
        const charge = pi.latest_charge;
        return !!(charge && typeof charge !== 'string' && charge.transfer);
    } catch (e) {
        console.warn('[chargeHasTransfer] lookup failed — refunding without transfer reversal:', e);
        return false;
    }
}

/**
 * Atomic once-only claim for restoring an order's FULL stock after a refund.
 * The app refund flow and the charge.refunded webhook can race (the app's own
 * Stripe refund triggers the webhook within seconds); both paths must acquire
 * this claim before calling restoreStock, so the restore happens exactly once
 * no matter the interleaving. Claims are never released — restock is a
 * one-way door per order. Exported for stripe-payment-sync.
 */
export async function claimFullRestock(orderId: string): Promise<boolean> {
    try {
        await prisma.processedStripeEvent.create({
            data: { id: `refund-restock:${orderId}`, type: 'internal.refund-restock' },
        });
        return true;
    } catch (e) {
        if ((e as { code?: string })?.code === 'P2002') return false;
        throw e;
    }
}

/**
 * Race-tolerant Refund audit insert. The charge.refunded webhook may record
 * the same Stripe refund id first (it fires seconds after our refunds.create).
 * On conflict, ADOPT the webhook's row — overwrite its generic fields with the
 * app's richer attribution — instead of crashing the refund flow after the
 * money already moved.
 */
async function upsertRefundRecord(data: {
    orderId: string;
    initiatedByUserId: string | null;
    amountCents: number;
    reason: string;
    notes: string | null;
    stripeRefundId: string | null;
    restoredStock: boolean;
    reversedTax: boolean;
}) {
    try {
        return await prisma.refund.create({ data });
    } catch (e) {
        if ((e as { code?: string })?.code === 'P2002' && data.stripeRefundId) {
            const existing = await prisma.refund.findUnique({ where: { stripeRefundId: data.stripeRefundId } });
            if (existing) {
                return await prisma.refund.update({
                    where: { id: existing.id },
                    data: {
                        initiatedByUserId: data.initiatedByUserId,
                        reason: data.reason,
                        notes: data.notes,
                        restoredStock: existing.restoredStock || data.restoredStock,
                        reversedTax: existing.reversedTax || data.reversedTax,
                    },
                });
            }
        }
        throw e;
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
            // Phase 2b — paid amendments have their OWN PaymentIntents that a
            // full refund must also return.
            amendments: {
                where: { status: 'PAID', stripePaymentIntentId: { not: null } },
                select: { id: true, stripePaymentIntentId: true, stripeTaxTransactionId: true },
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

    // Kill any live payment link first — a refunded order must not be able to
    // collect an amendment payment afterwards. (Lazy import avoids a module
    // cycle: order-edit imports kitchenRemoveItemsCore from this file.)
    const { cancelAllPendingAmendments } = await import('@/lib/order-edit');
    await cancelAllPendingAmendments(order.id).catch(e =>
        console.warn('[refundOrderFullCore] pending-amendment cancel failed:', e));

    // Full refund of the remaining balance (= full total when no priors).
    const totalCents = Math.round((parseFloat(order.totalAmount) || 0) * 100);
    const alreadyRefundedCents = order.refunds.reduce((sum, r) => sum + r.amountCents, 0);
    const amountCents = totalCents - alreadyRefundedCents;
    if (amountCents <= 0) {
        return { ok: false, error: 'This order is already fully refunded.' };
    }

    /* ─── Stripe refund(s) ────────────────────────────────────────────── */
    // No paid amendments (the near-universal case): one explicit-amount refund
    // of the remaining balance on the original PI — exact behavior unchanged.
    //
    // WITH paid amendments the order's money is split across multiple
    // PaymentIntents, so "remaining balance" can exceed any single charge.
    // Refund each PI WITHOUT an amount — Stripe refunds that charge's own
    // remainder natively — and record what actually came back per PI.

    let stripeRefundId: string | null = null;
    let extraRefunds: Array<{ id: string; amountCents: number }> = [];
    let actualAmountCents = amountCents;
    try {
        if (order.amendments.length === 0) {
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
        } else {
            actualAmountCents = 0;
            const pis = [order.stripePaymentIntentId, ...order.amendments.map(a => a.stripePaymentIntentId!)];
            for (const pi of pis) {
                try {
                    const refund = await stripe.refunds.create({
                        payment_intent: pi,
                        reverse_transfer: await chargeHasTransfer(pi),
                        metadata: {
                            orderId: order.id,
                            reason: opts.reason,
                            ...(opts.initiatedByUserId ? { initiatedByUserId: opts.initiatedByUserId } : {}),
                        },
                    });
                    if (stripeRefundId === null) stripeRefundId = refund.id;
                    else extraRefunds.push({ id: refund.id, amountCents: refund.amount });
                    actualAmountCents += refund.amount;
                } catch (e) {
                    // "Charge already fully refunded" on one PI must not block
                    // refunding the others (e.g. a prior partial removal).
                    const msg = e instanceof Error ? e.message : String(e);
                    const code = (e as { code?: string })?.code;
                    if (code === 'charge_already_refunded' || /already.*refunded/i.test(msg)) {
                        console.log('[refundOrderFullCore] PI already fully refunded, skipping:', pi);
                        continue;
                    }
                    throw e;
                }
            }
            if (stripeRefundId === null && extraRefunds.length === 0) {
                return { ok: false, error: 'Every payment on this order is already refunded.' };
            }
        }
    } catch (e) {
        console.error('[refundOrderFullCore] Stripe refund failed:', e);
        return { ok: false, error: `Refund failed: ${e instanceof Error ? e.message : 'unknown error'}` };
    }

    /* ─── Amendment tax reversals (best-effort) ───────────────────────── */
    for (const a of order.amendments) {
        if (!a.stripeTaxTransactionId) continue;
        try {
            await stripe.tax.transactions.createReversal({
                mode: 'full',
                original_transaction: a.stripeTaxTransactionId,
                reference: `${order.id}-amend-${a.id.slice(0, 8)}-refund-${Date.now()}`,
            });
        } catch (e) {
            console.warn('[refundOrderFullCore] amendment tax reversal failed:', e instanceof Error ? e.message : e);
        }
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
    // Once-only across BOTH the app flow and the charge.refunded webhook (which
    // our own refunds.create above triggers within seconds) — atomic claim, not
    // a read of possibly-stale Refund rows.
    if (opts.restoreStock && (await claimFullRestock(order.id))) {
        // Net of units the kitchen already removed + restored (see helper).
        const restoreItems = effectiveReservationItems(order.fulfillments);
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

    // Multi-PI refunds: the primary row carries the first refund; each extra
    // PI's refund gets its own row so sum(Refund.amountCents) stays truthful.
    const primaryAmountCents = actualAmountCents - extraRefunds.reduce((sum, r) => sum + r.amountCents, 0);
    const refundRecord = await upsertRefundRecord({
        orderId: order.id,
        initiatedByUserId: opts.initiatedByUserId,
        amountCents: primaryAmountCents,
        reason: opts.reason,
        notes: opts.notes?.trim() || null,
        stripeRefundId,
        restoredStock: stockRestored,
        reversedTax: taxReversed,
    });
    for (const extra of extraRefunds) {
        await upsertRefundRecord({
            orderId: order.id,
            initiatedByUserId: opts.initiatedByUserId,
            amountCents: extra.amountCents,
            reason: opts.reason,
            notes: 'amendment payment refund',
            stripeRefundId: extra.id,
            restoredStock: false,
            reversedTax: false,
        });
    }

    await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'REFUNDED' },
    });
    // Terminal statuses stay put — a DELIVERED leg really happened.
    await prisma.orderFulfillment.updateMany({
        where: { orderId: order.id, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        data: { status: 'CANCELLED' },
    });

    console.log(`[refundOrderFullCore] $${(actualAmountCents / 100).toFixed(2)} refunded on Order ${order.id} (fully refunded)`);

    return { ok: true, refundId: refundRecord.id, amountCents: actualAmountCents };
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
    opts: { initiatedByUserId: string | null; reason: string; idempotencyKeyBase?: string },
): Promise<
    | { ok: true; amountRefunded: string; removed: { name: string; quantity: number }[] }
    | { ok: false; error: string; partiallyRefunded?: boolean }
> {
    if (!orderId) return { ok: false, error: 'Missing order id.' };
    if (removals.length === 0) return { ok: false, error: 'No items selected for removal.' };

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            refunds: true,
            orderItems: { include: { product: { select: { name: true } }, amendment: { select: { stripePaymentIntentId: true, stripeTaxTransactionId: true } } } },
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
    // order's tax (itemCents / taxedBaseCents). Shipping is never refunded.
    const subtotalCents = toCents(order.subtotalAmount)
        || order.orderItems.reduce((sum, it) => sum + toCents(it.unitPrice) * it.quantity, 0);
    // taxAmount includes shipping tax (checkout submits shipping via the
    // calculation's shipping_cost param), so shares pro-rate over that base.
    const taxedBaseCents = subtotalCents + toCents(order.shippingAmount);
    const taxCents = toCents(order.taxAmount);

    // Phase 2b: a line added by a paid amendment was charged on the
    // amendment's OWN PaymentIntent — its refund must target that PI. Group
    // removal cents per source PI (one refunds.create per PI below).
    type PiGroup = { refundCents: number; taxTransactionId: string | null; lines: Array<{ orderItemId: string; qty: number }> };
    const byPi = new Map<string, PiGroup>();
    let refundCents = 0;
    for (const [orderItemId, qty] of removalByItem) {
        const item = itemById.get(orderItemId)!;
        const itemCents = toCents(item.unitPrice) * qty;
        // Phase 2: exact per-line tax captured at checkout (OrderItem.taxCents
        // covers the FULL line). Telescoped against refundedQuantity so repeated
        // partial removals sum exactly and can never exceed the tax collected.
        // Legacy orders (null) pro-rate the aggregate.
        const taxShare = item.taxCents !== null
            ? Math.round(item.taxCents * (item.refundedQuantity + qty) / item.quantity)
              - Math.round(item.taxCents * item.refundedQuantity / item.quantity)
            : taxedBaseCents > 0 ? Math.round(taxCents * itemCents / taxedBaseCents) : 0;
        refundCents += itemCents + taxShare;
        const pi = item.amendment?.stripePaymentIntentId ?? order.stripePaymentIntentId!;
        const group = byPi.get(pi) ?? {
            refundCents: 0,
            // Reversal target follows the money: amendment lines reverse the
            // amendment's tax transaction, original lines the order's.
            taxTransactionId: item.amendment ? item.amendment.stripeTaxTransactionId : order.stripeTaxTransactionId,
            lines: [],
        };
        group.refundCents += itemCents + taxShare;
        group.lines.push({ orderItemId, qty });
        byPi.set(pi, group);
    }
    if (refundCents <= 0) {
        return { ok: false, error: 'Nothing to refund for the selected items.' };
    }
    const alreadyRefundedCents = order.refunds.reduce((sum, r) => sum + r.amountCents, 0);
    const remainingCents = toCents(order.totalAmount) - alreadyRefundedCents;
    if (refundCents >= remainingCents) {
        return { ok: false, error: 'This would refund the entire remaining balance — use the full cancel flow instead.' };
    }

    /* ─── Stripe partial refunds — one per source PaymentIntent ──────── */
    // Phase 4a: each group also issues a best-effort PARTIAL Stripe Tax
    // reversal (flat_amount = the refunded total, negative, per API contract)
    // against its source transaction, keeping tax records aligned with money
    // actually kept. Failure leaves reversedTax=false for the accountant.
    //
    // Groups process SEQUENTIALLY and each group commits its own audit tx
    // (refundedQuantity increments + Refund row) right after its Stripe
    // refund succeeds — a later group's failure can't orphan an earlier
    // group's money movement. In practice a single order has one PI unless
    // an amendment line is being removed.
    const stripeRefundIds: string[] = [];
    let refundedSoFarCents = 0;
    for (const [pi, group] of byPi) {
        let stripeRefundId: string;
        try {
            const refund = await stripe.refunds.create({
                payment_intent: pi,
                amount: group.refundCents,
                // Connect destination charges: reverse the transfer too. Only when
                // a transfer exists — Stripe rejects it on platform charges.
                reverse_transfer: await chargeHasTransfer(pi),
                metadata: {
                    orderId: order.id,
                    reason: 'kitchen_item_removed',
                    ...(opts.initiatedByUserId ? { initiatedByUserId: opts.initiatedByUserId } : {}),
                },
            // Callers with a natural retry scope (edit-request approval) pass a
            // key so a retried call returns the ORIGINAL refund, not a second one.
            }, opts.idempotencyKeyBase ? { idempotencyKey: `${opts.idempotencyKeyBase}:${pi}` } : undefined);
            stripeRefundId = refund.id;
        } catch (e) {
            console.error('[kitchenRemoveItemsCore] Stripe refund failed on PI', pi, ':', e);
            if (refundedSoFarCents > 0) {
                return { ok: false, partiallyRefunded: true, error: `Partially done: $${(refundedSoFarCents / 100).toFixed(2)} was refunded, but the rest failed (${e instanceof Error ? e.message : 'unknown error'}). Check the order's refund history before retrying.` };
            }
            return { ok: false, error: `Refund failed: ${e instanceof Error ? e.message : 'unknown error'}` };
        }

        /* Audit: this group's refundedQuantity increments + Refund row (one tx). */
        await prisma.$transaction([
            ...group.lines.map(({ orderItemId, qty }) =>
                prisma.orderItem.update({
                    where: { id: orderItemId },
                    data: { refundedQuantity: { increment: qty } },
                }),
            ),
            // The charge.refunded webhook fires within seconds of our refunds.create
            // above and may have recorded this refund id first with generic
            // attribution — replace its row with ours atomically instead of
            // crashing the whole edit on the unique constraint.
            prisma.refund.deleteMany({ where: { stripeRefundId } }),
            prisma.refund.create({
                data: {
                    orderId: order.id,
                    initiatedByUserId: opts.initiatedByUserId,
                    amountCents: group.refundCents,
                    reason: 'kitchen_item_removed',
                    notes: opts.reason || null,
                    stripeRefundId,
                    // Flipped to true below only AFTER restoreStock succeeds — it
                    // runs outside this tx and can fail.
                    restoredStock: false,
                    reversedTax: false,
                },
            }),
        ]);
        // Best-effort partial tax reversal for this group's source transaction.
        if (group.taxTransactionId) {
            try {
                await stripe.tax.transactions.createReversal({
                    mode: 'partial',
                    original_transaction: group.taxTransactionId,
                    reference: `${order.id}-rm-${stripeRefundId.slice(-8)}`,
                    flat_amount: -group.refundCents,
                });
                await prisma.refund.updateMany({ where: { stripeRefundId }, data: { reversedTax: true } });
            } catch (e) {
                console.warn('[kitchenRemoveItemsCore] partial tax reversal failed (accountant reconciles):', e instanceof Error ? e.message : e);
            }
        }
        stripeRefundIds.push(stripeRefundId);
        refundedSoFarCents += group.refundCents;
    }

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
    try {
        await restoreStock(restoreItems, {
            orderId: order.id,
            ...(opts.initiatedByUserId ? { initiatedByUserId: opts.initiatedByUserId } : {}),
        });
        await prisma.refund.updateMany({ where: { stripeRefundId: { in: stripeRefundIds } }, data: { restoredStock: true } });
    } catch (e) {
        console.error('[kitchenRemoveItemsCore] Stock restore failed for Order', order.id, '— Refund(s)', stripeRefundIds.join(','), 'left restoredStock=false; reconcile inventory manually:', e);
        // Money already moved — surface the inventory discrepancy to ops the
        // same way syncExternalRefund does, instead of relying on server logs.
        try {
            await sendOpsAlertEmail({
                subject: 'Stock restore FAILED after kitchen item removal',
                orderId: order.id,
                lines: [
                    `Stripe refund(s) ${stripeRefundIds.join(', ')} succeeded but restoring inventory failed; Refund.restoredStock is false.`,
                    `Un-restored lines: ${restoreItems.map(r => `${r.quantity}× product ${r.productId} @ location ${r.locationId}`).join('; ') || '(none mapped)'}.`,
                    'Reconcile the location stock counts manually, then update the Refund row.',
                ],
            });
        } catch (alertErr) {
            console.error('[kitchenRemoveItemsCore] ops alert failed too:', alertErr);
        }
    }

    const removed = [...removalByItem].map(([orderItemId, qty]) => ({
        name: itemById.get(orderItemId)!.product.name,
        quantity: qty,
    }));
    console.log(`[kitchenRemoveItemsCore] $${(refundCents / 100).toFixed(2)} refunded on Order ${order.id} (${removed.length} item line(s) removed)`);

    return { ok: true, amountRefunded: (refundCents / 100).toFixed(2), removed };
}
