// Phase 2b — order-edit engine (request → approve → execute).
//
// Lives in lib (NOT 'use server') deliberately: exporting these from an
// actions file would create unauthenticated public endpoints. Callers
// (location-orders actions, the Stripe webhook, the reservation cron) gate
// access before calling.
//
// Money model (keeps refund attribution clean per payment source):
//   * REMOVE lines execute immediately at approval through the existing
//     partial-refund core — money returns to whichever PaymentIntent the
//     removed line was paid on.
//   * ADD lines (incl. the "add" half of a pricier swap) ride an
//     OrderAmendment: a Stripe Checkout Session the customer pays from a
//     link. The added OrderItem rows are created ONLY when
//     checkout.session.completed arrives — an unpaid amendment changes
//     nothing. Their money lives on the amendment's own PaymentIntent
//     (OrderItem.amendmentId routes later refunds to it).

import { prisma } from '@/lib/db';
import { stripe, isStripeLiveMode } from '@/lib/stripe';
import { sellableStockWhere } from '@/lib/stock-availability';
import { commitStock } from '@/lib/stock-reservation';
import { kitchenRemoveItemsCore } from '@/lib/order-refund';
import { signOrderToken } from '@/lib/order-token';
import {
    sendAmendmentPaymentEmail,
    sendAmendmentPaidEmail,
    sendOrderItemsRemovedCustomerEmail,
    sendOpsAlertEmail,
} from '@/lib/email';

const AMENDMENT_TTL_MINUTES = 35; // Stripe Checkout minimum expiry is 30 min

export type EditLineInput =
    | { type: 'REMOVE'; orderItemId: string; quantity: number }
    | { type: 'ADD'; productId: string; quantity: number };

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function toCents(s: string | null | undefined): number {
    if (!s) return 0;
    const n = parseFloat(s);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Shared edit-window rule (mirrors kitchenRemoveOrderItems): through READY
 *  until the courier picks up / own-delivery departs. */
function isEditableWindow(status: string, courierStatus: string | null): boolean {
    if (['PENDING', 'CONFIRMED', 'PREPARING'].includes(status)) return true;
    return status === 'READY' && !['OUT_FOR_DELIVERY', 'DELIVERED'].includes(courierStatus ?? '');
}

/* ─── 1. Create a request ─────────────────────────────────────────────── */

export async function createOrderEditRequest(opts: {
    fulfillmentId: string;
    locationId: string;
    lines: EditLineInput[];
    reason: string;
    requestedById: string;
    requestedByName: string;
}): Promise<Result<{ requestId: string }>> {
    const reason = opts.reason.trim();
    if (!reason) return { ok: false, error: 'Please write why the order is changing.' };
    if (opts.lines.length === 0) return { ok: false, error: 'No changes proposed.' };

    const f = await prisma.orderFulfillment.findUnique({
        where: { id: opts.fulfillmentId },
        select: {
            locationId: true,
            status: true,
            courierStatus: true,
            items: { select: { orderItemId: true, quantity: true, orderItem: { select: { refundedQuantity: true } } } },
            order: {
                select: {
                    id: true,
                    paymentStatus: true,
                    fulfillments: { select: { locationId: true } },
                },
            },
        },
    });
    if (!f || f.locationId !== opts.locationId) return { ok: false, error: 'Not found' };
    if (f.order.paymentStatus !== 'PAID') return { ok: false, error: 'Order is not paid.' };
    if (f.order.fulfillments.some(x => x.locationId !== opts.locationId)) {
        return { ok: false, error: 'Multi-location order — contact the admin.' };
    }
    if (!isEditableWindow(f.status, f.courierStatus)) {
        return { ok: false, error: 'Too late to edit — the order already left the kitchen.' };
    }

    const pending = await prisma.orderEditRequest.findFirst({
        where: { fulfillmentId: opts.fulfillmentId, status: 'PENDING' },
        select: { id: true },
    });
    if (pending) return { ok: false, error: 'A change request is already waiting for a manager.' };
    // One live payment link at a time — concurrent amendments would race the
    // totals math and confuse the customer with two links.
    const liveLink = await prisma.orderAmendment.findFirst({
        where: { orderId: f.order.id, status: 'PENDING_PAYMENT' },
        select: { id: true },
    });
    if (liveLink) return { ok: false, error: 'A payment link is still outstanding for this order — wait for it or cancel it first.' };

    /* Validate REMOVE lines against effective quantities. */
    const effectiveByItem = new Map(
        f.items.map(i => [i.orderItemId, i.quantity - i.orderItem.refundedQuantity]),
    );
    const removeByItem = new Map<string, number>();
    for (const l of opts.lines) {
        if (l.type !== 'REMOVE') continue;
        if (!Number.isInteger(l.quantity) || l.quantity < 1) {
            return { ok: false, error: 'Removal quantities must be whole numbers of at least 1.' };
        }
        removeByItem.set(l.orderItemId, (removeByItem.get(l.orderItemId) ?? 0) + l.quantity);
    }
    for (const [orderItemId, qty] of removeByItem) {
        const effective = effectiveByItem.get(orderItemId);
        if (effective === undefined) return { ok: false, error: 'A selected item does not belong to this order.' };
        if (qty > effective) return { ok: false, error: 'Cannot remove more units than the order still has.' };
    }

    /* Validate ADD lines: product must be genuinely sellable at THIS location. */
    const addLines = opts.lines.filter(l => l.type === 'ADD');
    const addProducts = new Map<string, { priceB2c: string }>();
    if (addLines.length > 0) {
        const location = await prisma.location.findUnique({
            where: { id: opts.locationId },
            select: { allowsChannels: true },
        });
        if (!location) return { ok: false, error: 'Location not found.' };
        const products = await prisma.product.findMany({
            where: {
                id: { in: addLines.map(l => (l as { productId: string }).productId) },
                isActive: true,
                isB2cVisible: true,
                isCartOrderable: true,
                status: 'ACTIVE',
                stocks: { some: { ...sellableStockWhere(), locationId: opts.locationId } },
            },
            select: { id: true, priceB2c: true, salesChannel: true },
        });
        for (const l of addLines) {
            if (!Number.isInteger(l.quantity) || l.quantity < 1) {
                return { ok: false, error: 'Added quantities must be whole numbers of at least 1.' };
            }
            const p = products.find(x => x.id === (l as { productId: string }).productId);
            if (!p) return { ok: false, error: 'An added product is not available at this location right now.' };
            if (!location.allowsChannels.includes(p.salesChannel)) {
                return { ok: false, error: 'An added product is not offered by this location.' };
            }
            addProducts.set(p.id, { priceB2c: p.priceB2c });
        }
    }

    /* Removing every remaining unit with nothing added = cancellation in disguise. */
    if (addLines.length === 0) {
        const coversEverything = f.items.every(i => {
            const effective = i.quantity - i.orderItem.refundedQuantity;
            return effective <= 0 || (removeByItem.get(i.orderItemId) ?? 0) >= effective;
        });
        if (coversEverything) {
            return { ok: false, error: 'This removes every item — use the cancel flow instead.' };
        }
    }

    let request;
    try {
        request = await prisma.orderEditRequest.create({
        data: {
            fulfillmentId: opts.fulfillmentId,
            locationId: opts.locationId,
            requestedById: opts.requestedById,
            requestedByName: opts.requestedByName,
            reason,
            customerContactedAt: new Date(),
            lines: {
                create: opts.lines.map(l =>
                    l.type === 'REMOVE'
                        ? { type: 'REMOVE', orderItemId: l.orderItemId, removeQuantity: l.quantity }
                        : {
                              type: 'ADD',
                              addProductId: l.productId,
                              addQuantity: l.quantity,
                              // Snapshot so the approved charge can't drift with catalog edits.
                              addUnitPrice: addProducts.get(l.productId)!.priceB2c,
                          },
                ),
            },
        },
        select: { id: true },
        });
    } catch (e) {
        // Partial unique index (one PENDING per fulfillment) closes the
        // findFirst-then-create race between two tablets.
        if ((e as { code?: string })?.code === 'P2002') {
            return { ok: false, error: 'A change request is already waiting for a manager.' };
        }
        throw e;
    }
    return { ok: true, requestId: request.id };
}

/* ─── 2. Approve + execute ────────────────────────────────────────────── */

export async function approveOrderEditRequest(
    requestId: string,
    locationId: string,
    opts: { resolvedById: string | null; resolvedByName: string | null; note: string | null },
): Promise<Result<{ amountRefunded: string | null; paymentUrl: string | null }>> {
    const req = await prisma.orderEditRequest.findUnique({
        where: { id: requestId },
        include: {
            lines: true,
            fulfillment: {
                select: {
                    id: true,
                    locationId: true,
                    status: true,
                    courierStatus: true,
                    location: { select: { name: true, stripeConnectAccountId: true, stripeOnboardingStatus: true, stripeAccountLivemode: true } },
                    order: {
                        select: {
                            id: true,
                            paymentStatus: true,
                            guestEmail: true,
                            shippingLine1: true, shippingAddressLine2: true, shippingCity: true,
                            shippingState: true, shippingPostalCode: true,
                            user: { select: { email: true, name: true } },
                        },
                    },
                },
            },
        },
    });
    if (!req || req.locationId !== locationId) return { ok: false, error: 'Not found' };
    if (req.status !== 'PENDING') return { ok: false, error: `Already ${req.status.toLowerCase()}` };
    if (req.fulfillment.order.paymentStatus !== 'PAID') return { ok: false, error: 'Order is not paid.' };
    if (!isEditableWindow(req.fulfillment.status, req.fulfillment.courierStatus)) {
        return { ok: false, error: 'Too late — the order already left the kitchen.' };
    }

    // Idempotency gate: only ONE caller may execute a request. A concurrent
    // double-click (or a retry racing a slow first attempt) loses this flip
    // and is rejected instead of double-refunding the same lines.
    const claimed = await prisma.orderEditRequest.updateMany({
        where: { id: req.id, status: 'PENDING' },
        data: { status: 'EXECUTING' },
    });
    if (claimed.count === 0) return { ok: false, error: 'This request is already being executed.' };
    // On clean failure paths below we flip back to PENDING so the manager can
    // retry; a crash mid-execution intentionally leaves EXECUTING (ops must
    // check the refund history before anyone retries).
    const releaseClaim = () =>
        prisma.orderEditRequest.updateMany({
            where: { id: req.id, status: 'EXECUTING' },
            data: { status: 'PENDING' },
        }).catch(() => undefined);

    const order = req.fulfillment.order;
    const removals = req.lines
        .filter(l => l.type === 'REMOVE' && l.orderItemId && l.removeQuantity)
        .map(l => ({ orderItemId: l.orderItemId!, quantity: l.removeQuantity! }));
    const adds = req.lines.filter(l => l.type === 'ADD' && l.addProductId && l.addQuantity);

    /* ─── Adds first: create the amendment + Checkout Session. This has no
       side effects on the order itself, so a failure here leaves everything
       untouched and the request retryable. ─── */
    let paymentUrl: string | null = null;
    let amendmentId: string | null = null;
    if (adds.length > 0) {
        // Re-validate sellability NOW — a product 86'd or deactivated since the
        // request was filed must not be charged to the customer.
        const stillSellable = await prisma.product.findMany({
            where: {
                id: { in: adds.map(l => l.addProductId!) },
                isActive: true,
                isB2cVisible: true,
                isCartOrderable: true,
                status: 'ACTIVE',
                stocks: { some: { ...sellableStockWhere(), locationId } },
            },
            select: { id: true },
        });
        const sellableIds = new Set(stillSellable.map(pr => pr.id));
        const gone = adds.filter(l => !sellableIds.has(l.addProductId!));
        if (gone.length > 0) {
            await releaseClaim();
            return { ok: false, error: 'An added product is no longer available at this location — decline and re-propose.' };
        }
        const addProducts = await prisma.product.findMany({
            where: { id: { in: adds.map(l => l.addProductId!) } },
            select: { id: true, name: true },
        });
        const nameOf = (id: string) => addProducts.find(p => p.id === id)?.name ?? 'Item';
        const itemsCents = adds.reduce((sum, l) => sum + toCents(l.addUnitPrice) * l.addQuantity!, 0);
        if (itemsCents <= 0) return { ok: false, error: 'Added items have no price — cannot charge.' };

        /* Tax on the additions — same engine as checkout; address from the
           order snapshot. Missing address (legacy rows) ⇒ tax 0 + loud log. */
        let taxCents = 0;
        let taxCalculationId: string | null = null;
        if (order.shippingLine1 && order.shippingCity && order.shippingState && order.shippingPostalCode) {
            try {
                const calc = await stripe.tax.calculations.create({
                    currency: 'usd',
                    line_items: adds.map(l => ({
                        amount: toCents(l.addUnitPrice) * l.addQuantity!,
                        reference: `edit:${l.id}`,
                        quantity: l.addQuantity!,
                        tax_behavior: 'exclusive' as const,
                    })),
                    customer_details: {
                        address: {
                            line1: order.shippingLine1,
                            line2: order.shippingAddressLine2 || undefined,
                            city: order.shippingCity,
                            state: order.shippingState,
                            postal_code: order.shippingPostalCode,
                            country: 'US',
                        },
                        address_source: 'shipping',
                    },
                });
                taxCents = calc.tax_amount_exclusive ?? 0;
                taxCalculationId = calc.id;
            } catch (e) {
                console.error('[order-edit] Amendment tax calculation failed — charging without tax:', e);
            }
        } else {
            console.warn('[order-edit] Order has no structured address — amendment charged without tax', order.id);
        }

        /* Connect routing — same mode-scoped rule as checkout. */
        const loc = req.fulfillment.location;
        const destination =
            loc.stripeConnectAccountId &&
            loc.stripeOnboardingStatus === 'complete' &&
            (loc.stripeAccountLivemode ?? false) === isStripeLiveMode()
                ? loc.stripeConnectAccountId
                : null;

        // A prior failed/crashed attempt may have left an amendment bound to
        // this request (requestId is unique). Reuse a still-pending one's row;
        // detach a dead one so the fresh create succeeds.
        const prior = await prisma.orderAmendment.findUnique({
            where: { requestId: req.id },
            select: { id: true, status: true },
        });
        if (prior) {
            if (prior.status === 'PAID') {
                await releaseClaim();
                return { ok: false, error: 'This request already has a paid amendment — check the order.' };
            }
            await prisma.orderAmendment.update({
                where: { id: prior.id },
                data: { requestId: null, status: prior.status === 'PENDING_PAYMENT' ? 'CANCELLED' : prior.status, resolvedAt: new Date() },
            });
        }
        const amendment = await prisma.orderAmendment.create({
            data: {
                orderId: order.id,
                requestId: req.id,
                itemsCents,
                taxCents,
                stripeTaxCalculationId: taxCalculationId,
                expiresAt: new Date(Date.now() + AMENDMENT_TTL_MINUTES * 60 * 1000),
            },
            select: { id: true },
        });
        amendmentId = amendment.id;

        const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const token = await signOrderToken(order.id);
        try {
            const session = await stripe.checkout.sessions.create({
                mode: 'payment',
                // Synchronous methods only — an async debit (ACH) would fire
                // checkout.session.completed with payment_status 'unpaid' and
                // settle days later; a phone-call addition can't wait for that.
                payment_method_types: ['card'],
                line_items: [
                    ...adds.map(l => ({
                        price_data: {
                            currency: 'usd',
                            product_data: { name: nameOf(l.addProductId!) },
                            unit_amount: toCents(l.addUnitPrice),
                        },
                        quantity: l.addQuantity!,
                    })),
                    ...(taxCents > 0
                        ? [{
                              price_data: {
                                  currency: 'usd',
                                  product_data: { name: 'Sales tax' },
                                  unit_amount: taxCents,
                              },
                              quantity: 1,
                          }]
                        : []),
                ],
                ...(destination ? { payment_intent_data: { transfer_data: { destination } } } : {}),
                metadata: { kind: 'order_amendment', amendmentId: amendment.id, orderId: order.id },
                customer_email: order.guestEmail ?? order.user?.email ?? undefined,
                expires_at: Math.floor(Date.now() / 1000) + AMENDMENT_TTL_MINUTES * 60,
                success_url: `${site}/orders/${token}?amendment=paid`,
                cancel_url: `${site}/orders/${token}`,
            });
            paymentUrl = session.url ?? null;
            await prisma.orderAmendment.update({
                where: { id: amendment.id },
                // Mirror Stripe's ACTUAL session expiry so the sweep cron can
                // never flip EXPIRED while the hosted page is still payable.
                data: {
                    stripeCheckoutSessionId: session.id,
                    paymentUrl,
                    ...(session.expires_at ? { expiresAt: new Date(session.expires_at * 1000) } : {}),
                },
            });
        } catch (e) {
            // Roll the empty amendment back so a retry starts clean.
            await prisma.orderAmendment.delete({ where: { id: amendment.id } }).catch(() => undefined);
            console.error('[order-edit] Checkout session creation failed:', e);
            await releaseClaim();
            return { ok: false, error: 'Could not create the payment link. Please try again.' };
        }
    }

    /* ─── Removals: money moves here. If this fails after a session was
       created, expire the session and leave the request PENDING. ─── */
    let amountRefunded: string | null = null;
    if (removals.length > 0) {
        const result = await kitchenRemoveItemsCore(order.id, removals, {
            initiatedByUserId: opts.resolvedById,
            reason: opts.note || req.reason,
            // Stripe-side dedupe: a retried refund for the same request+PI
            // returns the original refund instead of double-refunding.
            idempotencyKeyBase: `edit-req:${req.id}`,
        });
        if (!result.ok) {
            if (amendmentId) {
                await cancelPendingAmendment(amendmentId).catch(() => undefined);
            }
            if (result.partiallyRefunded) {
                // Money moved for SOME lines — leave the request EXECUTING so a
                // blind retry can't re-run everything, and alert ops.
                await sendOpsAlertEmail({
                    subject: 'Order-edit approval PARTIALLY executed — manual review needed',
                    orderId: order.id,
                    lines: [
                        `Edit request ${req.id}: some removal refunds succeeded, then: ${result.error}`,
                        'The request is locked in EXECUTING. Verify the refund history, finish or undo manually, then resolve the request in the DB.',
                    ],
                }).catch(() => undefined);
            } else {
                await releaseClaim();
            }
            return { ok: false, error: result.error };
        }
        amountRefunded = result.amountRefunded;
    }

    await prisma.orderEditRequest.update({
        where: { id: req.id },
        data: {
            status: 'APPROVED',
            resolvedById: opts.resolvedById,
            resolvedByName: opts.resolvedByName,
            resolutionNote: opts.note,
            resolvedAt: new Date(),
        },
    });

    /* ─── Customer comms (best-effort, never fail the approval). ─── */
    const to = order.guestEmail ?? order.user?.email;
    if (to) {
        try {
            if (removals.length > 0 && amountRefunded) {
                const removedItems = await prisma.orderItem.findMany({
                    where: { id: { in: removals.map(r => r.orderItemId) } },
                    select: { id: true, product: { select: { name: true } } },
                });
                await sendOrderItemsRemovedCustomerEmail({
                    to,
                    name: order.user?.name ?? null,
                    orderId: order.id,
                    removed: removals.map(r => ({
                        name: removedItems.find(i => i.id === r.orderItemId)?.product.name ?? 'Item',
                        quantity: r.quantity,
                    })),
                    amountRefunded,
                    reason: opts.note || req.reason,
                });
            }
            if (amendmentId && paymentUrl) {
                const amendment = await prisma.orderAmendment.findUnique({
                    where: { id: amendmentId },
                    select: { itemsCents: true, taxCents: true },
                });
                const addNames = await prisma.product.findMany({
                    where: { id: { in: adds.map(l => l.addProductId!) } },
                    select: { id: true, name: true },
                });
                await sendAmendmentPaymentEmail({
                    to,
                    name: order.user?.name ?? null,
                    orderId: order.id,
                    items: adds.map(l => ({
                        name: addNames.find(p => p.id === l.addProductId)?.name ?? 'Item',
                        quantity: l.addQuantity!,
                    })),
                    amountDollars: (((amendment?.itemsCents ?? 0) + (amendment?.taxCents ?? 0)) / 100).toFixed(2),
                    payUrl: paymentUrl,
                    expiresMinutes: AMENDMENT_TTL_MINUTES,
                });
            }
        } catch (e) {
            console.error('[order-edit] customer email failed:', e);
        }
    }

    return { ok: true, amountRefunded, paymentUrl };
}

/* ─── 3. Webhook: the customer paid the amendment ─────────────────────── */

/** Sentinel thrown inside the apply tx when another delivery already won —
 *  aborts the transaction (rolling back stock decrements) without an error. */
class AmendmentAlreadyApplied extends Error {}

export async function applyPaidAmendment(
    sessionId: string,
    paymentIntentId: string | null,
): Promise<void> {
    const amendment = await prisma.orderAmendment.findUnique({
        where: { stripeCheckoutSessionId: sessionId },
        include: {
            request: { include: { lines: true, fulfillment: { select: { id: true, locationId: true, status: true } } } },
            order: {
                select: {
                    id: true, paymentStatus: true,
                    guestEmail: true, user: { select: { email: true, name: true } },
                },
            },
        },
    });
    if (!amendment?.request) {
        console.error('[order-edit] completed session has no amendment/request — ignoring', sessionId);
        return;
    }

    /* The customer's completed payment is authoritative over our own
       bookkeeping races (cron-EXPIRED before the webhook arrived). But when
       the money can no longer buy anything — manager cancelled the link, or
       the order itself was refunded/cancelled — refund it immediately and
       alert ops instead of silently keeping it. */
    const orderDead =
        amendment.order.paymentStatus !== 'PAID' ||
        amendment.request.fulfillment.status === 'CANCELLED';
    if (amendment.status === 'CANCELLED' || (orderDead && amendment.status !== 'PAID')) {
        console.error('[order-edit] payment landed on a dead amendment/order — auto-refunding', sessionId);
        if (paymentIntentId) {
            try {
                await stripe.refunds.create({
                    payment_intent: paymentIntentId,
                    metadata: { orderId: amendment.order.id, reason: 'amendment_after_cancel' },
                });
            } catch (e) {
                console.error('[order-edit] auto-refund of dead amendment FAILED:', e);
            }
        }
        await prisma.orderAmendment.updateMany({
            where: { id: amendment.id, status: { in: ['PENDING_PAYMENT', 'EXPIRED', 'CANCELLED'] } },
            data: { status: 'CANCELLED', stripePaymentIntentId: paymentIntentId, resolvedAt: new Date() },
        });
        await sendOpsAlertEmail({
            subject: 'Amendment paid after cancel/refund — auto-refunded',
            orderId: amendment.order.id,
            lines: [
                `Checkout session ${sessionId} completed after the amendment/order was cancelled.`,
                paymentIntentId
                    ? `An automatic refund of PaymentIntent ${paymentIntentId} was attempted — verify it in the Stripe dashboard.`
                    : 'No PaymentIntent id was present on the session — refund manually from the Stripe dashboard.',
            ],
        }).catch(() => undefined);
        return;
    }
    if (amendment.status === 'PAID') {
        // The atomic apply below flips PAID together with line creation, so
        // PAID here means a previous delivery fully applied — clean no-op.
        console.log('[order-edit] amendment already applied:', amendment.id);
        return;
    }

    const adds = amendment.request.lines.filter(l => l.type === 'ADD' && l.addProductId && l.addQuantity);
    if (adds.length === 0) {
        console.error('[order-edit] PAID amendment has no ADD lines', amendment.id);
        return;
    }
    const fulfillment = amendment.request.fulfillment;

    /* Per-line tax: floor-allocate, then hand out the remainder cent-by-cent
       to the largest lines — sums exactly, never negative. */
    const lineValues = adds.map(l => toCents(l.addUnitPrice) * l.addQuantity!);
    const valueSum = lineValues.reduce((a, b) => a + b, 0) || 1;
    const lineTax = lineValues.map(v => Math.floor(amendment.taxCents * v / valueSum));
    let remainder = amendment.taxCents - lineTax.reduce((a, b) => a + b, 0);
    const byValueDesc = lineValues.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    for (const { i } of byValueDesc) {
        if (remainder <= 0) break;
        lineTax[i] += 1;
        remainder -= 1;
    }

    /* Atomic apply: the PENDING_PAYMENT/EXPIRED→PAID flip is the FIRST write
       INSIDE the same transaction as the stock decrement, line creation, and
       totals bump. A crash anywhere rolls the whole thing back with the
       amendment still un-applied, so Stripe's retry re-applies cleanly; a
       duplicate delivery loses the flip and aborts via the sentinel. */
    try {
        await commitStock(
            adds.map(l => ({ productId: l.addProductId!, locationId: fulfillment.locationId, quantity: l.addQuantity! })),
            {
                orderId: amendment.order.id,
                onCommitted: async (tx) => {
                    const won = await tx.orderAmendment.updateMany({
                        // EXPIRED included: a completed payment beats our own
                        // bookkeeping race with the expiry cron.
                        where: { id: amendment.id, status: { in: ['PENDING_PAYMENT', 'EXPIRED'] } },
                        data: { status: 'PAID', stripePaymentIntentId: paymentIntentId, resolvedAt: new Date() },
                    });
                    if (won.count === 0) throw new AmendmentAlreadyApplied();
                    for (let i = 0; i < adds.length; i++) {
                        const l = adds[i];
                        const item = await tx.orderItem.create({
                            data: {
                                orderId: amendment.order.id,
                                productId: l.addProductId!,
                                quantity: l.addQuantity!,
                                unitPrice: l.addUnitPrice!,
                                taxCents: lineTax[i],
                                amendmentId: amendment.id,
                            },
                            select: { id: true },
                        });
                        await tx.orderFulfillmentItem.create({
                            data: { fulfillmentId: fulfillment.id, orderItemId: item.id, quantity: l.addQuantity! },
                        });
                    }
                    // Totals RE-READ inside the tx (concurrent refunds/amendments
                    // must not clobber each other), then grown by exactly what
                    // the customer paid — every total-minus-refunds surface
                    // stays truthful.
                    const fresh = await tx.order.findUnique({
                        where: { id: amendment.order.id },
                        select: { subtotalAmount: true, taxAmount: true, totalAmount: true },
                    });
                    await tx.order.update({
                        where: { id: amendment.order.id },
                        data: {
                            subtotalAmount: ((toCents(fresh?.subtotalAmount) + amendment.itemsCents) / 100).toFixed(2),
                            taxAmount: ((toCents(fresh?.taxAmount) + amendment.taxCents) / 100).toFixed(2),
                            totalAmount: ((toCents(fresh?.totalAmount) + amendment.itemsCents + amendment.taxCents) / 100).toFixed(2),
                        },
                    });
                },
            },
        );
    } catch (e) {
        if (e instanceof AmendmentAlreadyApplied) {
            console.log('[order-edit] duplicate delivery lost the apply race — no-op:', amendment.id);
            return;
        }
        throw e; // webhook route 500s → claim released → Stripe retries → clean re-apply
    }

    /* Tax transaction — best-effort; the id is persisted so a later full
       refund can reverse it. */
    if (amendment.stripeTaxCalculationId) {
        try {
            const txn = await stripe.tax.transactions.createFromCalculation({
                calculation: amendment.stripeTaxCalculationId,
                reference: `${amendment.order.id}-amend-${amendment.id.slice(0, 8)}`,
            });
            await prisma.orderAmendment.update({
                where: { id: amendment.id },
                data: { stripeTaxTransactionId: txn.id },
            });
        } catch (e) {
            console.warn('[order-edit] Amendment tax transaction failed (reconcile manually):', e);
        }
    }

    /* Confirmation email — best-effort. */
    const to = amendment.order.guestEmail ?? amendment.order.user?.email;
    if (to) {
        try {
            const names = await prisma.product.findMany({
                where: { id: { in: adds.map(l => l.addProductId!) } },
                select: { id: true, name: true },
            });
            await sendAmendmentPaidEmail({
                to,
                name: amendment.order.user?.name ?? null,
                orderId: amendment.order.id,
                items: adds.map(l => ({
                    name: names.find(pr => pr.id === l.addProductId)?.name ?? 'Item',
                    quantity: l.addQuantity!,
                })),
                amountDollars: ((amendment.itemsCents + amendment.taxCents) / 100).toFixed(2),
            });
        } catch (e) {
            console.error('[order-edit] amendment-paid email failed:', e);
        }
    }
    console.log('[order-edit] Amendment applied:', amendment.id, 'order', amendment.order.id);
}

/* ─── 4. Expiry + manager cancel ──────────────────────────────────────── */

export async function cancelPendingAmendment(amendmentId: string): Promise<Result> {
    const a = await prisma.orderAmendment.findUnique({
        where: { id: amendmentId },
        select: { status: true, stripeCheckoutSessionId: true },
    });
    if (!a || a.status !== 'PENDING_PAYMENT') return { ok: false, error: 'Payment link is no longer pending.' };

    // Expire the hosted page FIRST — if the customer completed payment moments
    // ago, expire fails on the complete session and the webhook must win, not
    // our cancel. Only flip CANCELLED once the session is verifiably dead.
    if (a.stripeCheckoutSessionId) {
        try {
            await stripe.checkout.sessions.expire(a.stripeCheckoutSessionId);
        } catch (e) {
            try {
                const session = await stripe.checkout.sessions.retrieve(a.stripeCheckoutSessionId);
                if (session.status === 'complete') {
                    return { ok: false, error: 'The customer already paid this link — the items are being added.' };
                }
            } catch { /* fall through — session lookup failed, treat as dead */ }
            console.warn('[order-edit] session expire failed (treating as dead):', e instanceof Error ? e.message : e);
        }
    }
    const flipped = await prisma.orderAmendment.updateMany({
        where: { id: amendmentId, status: 'PENDING_PAYMENT' },
        data: { status: 'CANCELLED', resolvedAt: new Date() },
    });
    if (flipped.count === 0) return { ok: false, error: 'Payment link is no longer pending.' };
    return { ok: true };
}

/** Cancel every live payment link on an order — full-refund/cancel flows call
 *  this so a refunded order can't collect an amendment payment afterwards. */
export async function cancelAllPendingAmendments(orderId: string): Promise<void> {
    const pending = await prisma.orderAmendment.findMany({
        where: { orderId, status: 'PENDING_PAYMENT' },
        select: { id: true },
    });
    for (const a of pending) {
        const res = await cancelPendingAmendment(a.id);
        if (!res.ok) console.warn('[order-edit] could not cancel amendment', a.id, res.error);
    }
}

/** Cron sweep: flip overdue PENDING_PAYMENT amendments to EXPIRED. Stripe
 *  expires the hosted session itself (expires_at was set at creation), so
 *  this is bookkeeping — no stock or money is held by a pending amendment. */
export async function markExpiredAmendments(): Promise<number> {
    const overdue = await prisma.orderAmendment.updateMany({
        where: { status: 'PENDING_PAYMENT', expiresAt: { lt: new Date() } },
        data: { status: 'EXPIRED', resolvedAt: new Date() },
    });
    if (overdue.count > 0) console.log('[order-edit] Expired', overdue.count, 'stale amendment(s)');
    return overdue.count;
}
