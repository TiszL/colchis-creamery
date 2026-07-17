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

    const request = await prisma.orderEditRequest.create({
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

    const order = req.fulfillment.order;
    const removals = req.lines
        .filter(l => l.type === 'REMOVE' && l.orderItemId && l.removeQuantity)
        .map(l => ({ orderItemId: l.orderItemId!, quantity: l.removeQuantity! }));
    const adds = req.lines.filter(l => l.type === 'ADD' && l.addProductId && l.addQuantity);

    /* ─── Adds first: create the amendment + Checkout Session. This has no
       side effects on the order itself, so a failure here leaves everything
       untouched and the request PENDING (retryable). ─── */
    let paymentUrl: string | null = null;
    let amendmentId: string | null = null;
    if (adds.length > 0) {
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
                data: { stripeCheckoutSessionId: session.id, paymentUrl },
            });
        } catch (e) {
            // Roll the empty amendment back so a retry starts clean.
            await prisma.orderAmendment.delete({ where: { id: amendment.id } }).catch(() => undefined);
            console.error('[order-edit] Checkout session creation failed:', e);
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
        });
        if (!result.ok) {
            if (amendmentId) {
                await cancelPendingAmendment(amendmentId).catch(() => undefined);
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

export async function applyPaidAmendment(
    sessionId: string,
    paymentIntentId: string | null,
): Promise<void> {
    // Guarded flip — only the winner executes side effects, so Stripe retries
    // and duplicate deliveries are no-ops beyond this point.
    const won = await prisma.orderAmendment.updateMany({
        where: { stripeCheckoutSessionId: sessionId, status: 'PENDING_PAYMENT' },
        data: { status: 'PAID', stripePaymentIntentId: paymentIntentId, resolvedAt: new Date() },
    });
    if (won.count === 0) {
        console.log('[order-edit] applyPaidAmendment: no pending amendment for session', sessionId, '(already applied or unknown)');
        return;
    }

    const amendment = await prisma.orderAmendment.findUnique({
        where: { stripeCheckoutSessionId: sessionId },
        include: {
            request: { include: { lines: true, fulfillment: { select: { id: true, locationId: true } } } },
            order: {
                select: {
                    id: true, subtotalAmount: true, taxAmount: true, totalAmount: true,
                    guestEmail: true, user: { select: { email: true, name: true } },
                },
            },
        },
    });
    if (!amendment?.request) {
        console.error('[order-edit] PAID amendment has no request — cannot apply lines', sessionId);
        return;
    }
    const adds = amendment.request.lines.filter(l => l.type === 'ADD' && l.addProductId && l.addQuantity);
    if (adds.length === 0) {
        console.error('[order-edit] PAID amendment has no ADD lines', amendment.id);
        return;
    }
    const fulfillment = amendment.request.fulfillment;
    const order = amendment.order;

    /* Per-line tax: pro-rate the amendment's aggregate by line value; the
       last line takes the remainder so the sum is exact by construction. */
    const lineValues = adds.map(l => toCents(l.addUnitPrice) * l.addQuantity!);
    const valueSum = lineValues.reduce((a, b) => a + b, 0) || 1;
    const lineTax = lineValues.map(v => Math.round(amendment.taxCents * v / valueSum));
    lineTax[lineTax.length - 1] = amendment.taxCents - lineTax.slice(0, -1).reduce((a, b) => a + b, 0);

    /* Stock commit + OrderItem/FulfillmentItem creation + totals bump — one
       transaction, so a crash can't leave stock sold without the lines (or
       vice versa). commitStock clamps reservedQuantity at 0 for unreserved
       items and skips quantity/FIFO for MTO — exactly what additions need. */
    await commitStock(
        adds.map(l => ({ productId: l.addProductId!, locationId: fulfillment.locationId, quantity: l.addQuantity! })),
        {
            orderId: order.id,
            onCommitted: async (tx) => {
                for (let i = 0; i < adds.length; i++) {
                    const l = adds[i];
                    const item = await tx.orderItem.create({
                        data: {
                            orderId: order.id,
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
                // Totals grow by what the customer just paid, keeping every
                // surface's "total minus refunds" math truthful.
                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        subtotalAmount: ((toCents(order.subtotalAmount) + amendment.itemsCents) / 100).toFixed(2),
                        taxAmount: ((toCents(order.taxAmount) + amendment.taxCents) / 100).toFixed(2),
                        totalAmount: ((toCents(order.totalAmount) + amendment.itemsCents + amendment.taxCents) / 100).toFixed(2),
                    },
                });
            },
        },
    );

    /* Tax transaction — best-effort, mirrors the payment-sync convention. */
    if (amendment.stripeTaxCalculationId) {
        try {
            await stripe.tax.transactions.createFromCalculation({
                calculation: amendment.stripeTaxCalculationId,
                reference: `${order.id}-amend-${amendment.id.slice(0, 8)}`,
            });
        } catch (e) {
            console.warn('[order-edit] Amendment tax transaction failed (reconcile manually):', e);
        }
    }

    /* Confirmation email — best-effort. */
    const to = order.guestEmail ?? order.user?.email;
    if (to) {
        try {
            const names = await prisma.product.findMany({
                where: { id: { in: adds.map(l => l.addProductId!) } },
                select: { id: true, name: true },
            });
            await sendAmendmentPaidEmail({
                to,
                name: order.user?.name ?? null,
                orderId: order.id,
                items: adds.map(l => ({
                    name: names.find(p => p.id === l.addProductId)?.name ?? 'Item',
                    quantity: l.addQuantity!,
                })),
                amountDollars: ((amendment.itemsCents + amendment.taxCents) / 100).toFixed(2),
            });
        } catch (e) {
            console.error('[order-edit] amendment-paid email failed:', e);
        }
    }
    console.log('[order-edit] Amendment applied:', amendment.id, 'order', order.id);
}

/* ─── 4. Expiry + manager cancel ──────────────────────────────────────── */

export async function cancelPendingAmendment(amendmentId: string): Promise<Result> {
    const flipped = await prisma.orderAmendment.updateMany({
        where: { id: amendmentId, status: 'PENDING_PAYMENT' },
        data: { status: 'CANCELLED', resolvedAt: new Date() },
    });
    if (flipped.count === 0) return { ok: false, error: 'Payment link is no longer pending.' };
    const a = await prisma.orderAmendment.findUnique({
        where: { id: amendmentId },
        select: { stripeCheckoutSessionId: true },
    });
    if (a?.stripeCheckoutSessionId) {
        // Best-effort: kill the hosted page so the customer can't pay a dead link.
        await stripe.checkout.sessions.expire(a.stripeCheckoutSessionId).catch(e =>
            console.warn('[order-edit] session expire failed (may already be expired):', e?.message ?? e));
    }
    return { ok: true };
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
