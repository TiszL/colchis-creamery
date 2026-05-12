'use server';

// Phase 7a.5 — createCheckoutSession.
//
// Customer pipeline:
//   client validates → calls this action → server re-validates everything →
//   reserves stock → creates Order + Fulfillments → calls Stripe Tax API →
//   creates Stripe PaymentIntent (amount includes tax) → returns
//   { clientSecret, orderId } → client mounts <Elements> + confirms payment.
//
// Stripe Tax (Path B): we call `tax.calculations.create()` BEFORE the PaymentIntent
// because `automatic_tax: { enabled: true }` is NOT supported on PaymentIntent.create
// (it's a Checkout Sessions / Subscriptions field). The tax calculation id is stored
// in PI metadata so the 7a.6 webhook can record the tax transaction via
// `tax.transactions.createFromCalculation(...)` on payment_intent.succeeded.
//
// Idempotency: not implemented in 7a.5. The button disable in CheckoutClient handles
// the obvious double-click case. Webhook-side dedupe uses Order.stripePaymentIntentId
// @unique. 7b will add proper client-supplied idempotency keys.

import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { getSession } from '@/lib/session';
import { reserveStock, releaseStock } from '@/lib/stock-reservation';
import { applyFreeShippingRule, planFulfillment } from '@/lib/shipping';
import type { FulfillmentChannel } from '@prisma/client';
import type Stripe from 'stripe';

export type CheckoutInput = {
    items: { productId: string; quantity: number }[];
    address: {
        line1: string;
        line2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        lat: number;
        lng: number;
        formatted: string;
        googlePlaceId?: string;
    };
    selectedChannels: { locationId: string; channel: FulfillmentChannel }[];
    contact: { name: string; email: string; phone: string };
};

export type CheckoutResult =
    | { ok: true; clientSecret: string; orderId: string }
    | { ok: false; error: string; failingItem?: { productId: string } };

const RESERVATION_TTL_MS = 15 * 60 * 1000;

export async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
    /* ─── 1. Basic input validation ────────────────────────────────────── */

    if (!input.items?.length) {
        return { ok: false, error: 'Your cart is empty.' };
    }
    if (!input.contact?.email || !input.contact?.phone || !input.contact?.name) {
        return { ok: false, error: 'Please fill in your contact details.' };
    }
    const addr = input.address;
    if (!addr || !addr.lat || !addr.lng || !addr.line1 || !addr.city || !addr.state || !addr.postalCode || !addr.country) {
        return { ok: false, error: 'Please re-enter your delivery address — some fields are missing.' };
    }
    if (!input.selectedChannels?.length) {
        return { ok: false, error: 'Please choose a delivery method for each fulfillment.' };
    }

    /* ─── 2. Re-validate cart server-side (real prices from DB) ────────── */

    const products = await prisma.product.findMany({
        where: { id: { in: input.items.map(i => i.productId) } },
        select: { id: true, name: true, priceB2c: true },
    });
    const productMap = new Map(products.map(p => [p.id, p]));
    for (const item of input.items) {
        if (!productMap.has(item.productId)) {
            return { ok: false, error: 'A product in your cart is no longer available.', failingItem: { productId: item.productId } };
        }
    }
    const subtotal = input.items.reduce((sum, item) => {
        const p = productMap.get(item.productId)!;
        return sum + parseFloat(p.priceB2c) * item.quantity;
    }, 0);

    /* ─── 3. Re-plan fulfillment with the chosen address ───────────────── */

    const plan = await planFulfillment(input.items, addr.lat, addr.lng);
    if (plan.hasUndeliverable) {
        const first = plan.undeliverableItems[0];
        return {
            ok: false,
            error: `Can't deliver "${first.productName}" — ${first.reason}.`,
            failingItem: { productId: first.productId },
        };
    }
    if (plan.groups.length === 0) {
        return { ok: false, error: 'No deliverable items in your cart.' };
    }

    /* ─── 4. Re-verify selected channels still valid for this plan ─────── */

    const chosenQuotes = [];
    for (const sel of input.selectedChannels) {
        const group = plan.groups.find(g => g.locationId === sel.locationId);
        if (!group) {
            return { ok: false, error: 'Delivery options changed. Please re-select on the previous page.' };
        }
        const quote = group.availableChannels.find(c => c.channel === sel.channel);
        if (!quote) {
            return {
                ok: false,
                error: `"${sel.channel.replace(/_/g, ' ')}" is no longer available for ${group.locationName}. Please pick another method.`,
            };
        }
        chosenQuotes.push(quote);
    }
    if (chosenQuotes.length !== plan.groups.length) {
        return { ok: false, error: 'Please choose a delivery method for every fulfillment.' };
    }

    /* ─── 5. Compute totals (free-shipping rule re-applied server-side) ─ */

    const finalQuotes = applyFreeShippingRule(chosenQuotes, subtotal);
    const shippingTotal = finalQuotes.reduce((s, q) => s + q.shippingCost, 0);

    /* ─── 6. Resolve user (logged-in OR find/create guest by email) ────── */

    const session = await getSession();
    let userId: string;
    let isGuest = false;
    if (session?.userId) {
        userId = session.userId;
    } else {
        isGuest = true;
        const existing = await prisma.user.findUnique({ where: { email: input.contact.email } });
        if (existing) {
            // Existing email — attach order to that User (may or may not have a password).
            // We don't overwrite passwordHash/name/phone here — that would let strangers
            // mutate other people's accounts via guest checkout.
            userId = existing.id;
        } else {
            const newUser = await prisma.user.create({
                data: {
                    email: input.contact.email,
                    name: input.contact.name,
                    phone: input.contact.phone,
                    passwordHash: null,
                    role: 'B2C_CUSTOMER',
                },
            });
            userId = newUser.id;
        }
    }

    /* ─── 7. Atomic stock reservation ──────────────────────────────────── */

    const reservationItems: { productId: string; locationId: string; quantity: number }[] = [];
    for (const group of plan.groups) {
        for (const item of group.items) {
            reservationItems.push({
                productId: item.productId,
                locationId: group.locationId,
                quantity: item.quantity,
            });
        }
    }
    const reservation = await reserveStock(reservationItems);
    if (!reservation.ok) {
        return {
            ok: false,
            error: reservation.error,
            failingItem: reservation.failingItem ? { productId: reservation.failingItem.productId } : undefined,
        };
    }

    /* ─── 8. Create Order + OrderItem + Fulfillment rows (transaction) ─ */

    let order: { id: string };
    try {
        order = await prisma.$transaction(async (tx) => {
            const totalBeforeTax = subtotal + shippingTotal;
            const newOrder = await tx.order.create({
                data: {
                    userId,
                    orderType: 'B2C',
                    totalAmount: totalBeforeTax.toFixed(2), // updated after tax calc below
                    subtotalAmount: subtotal.toFixed(2),
                    shippingAmount: shippingTotal.toFixed(2),
                    guestEmail: isGuest ? input.contact.email : null,
                    guestPhone: isGuest ? input.contact.phone : null,
                    paymentStatus: 'UNPAID',
                    orderStatus: 'PROCESSING',
                    shippingAddress: addr.formatted,
                    shippingLat: addr.lat,
                    shippingLng: addr.lng,
                    reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
                },
            });

            // OrderItem rows (one per cart line), indexed by productId for fulfillment wiring
            const orderItemByProductId = new Map<string, string>();
            for (const item of input.items) {
                const product = productMap.get(item.productId)!;
                const oi = await tx.orderItem.create({
                    data: {
                        orderId: newOrder.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: product.priceB2c,
                    },
                });
                orderItemByProductId.set(item.productId, oi.id);
            }

            // OrderFulfillment + OrderFulfillmentItem rows per group
            for (const group of plan.groups) {
                const quote = finalQuotes.find(q => q.locationId === group.locationId)!;
                const fulfillment = await tx.orderFulfillment.create({
                    data: {
                        orderId: newOrder.id,
                        locationId: group.locationId,
                        channel: quote.channel,
                        status: 'PENDING',
                        shippingCost: quote.shippingCost.toFixed(2),
                        packagingType: quote.packagingType,
                    },
                });
                for (const item of group.items) {
                    const orderItemId = orderItemByProductId.get(item.productId);
                    if (!orderItemId) continue; // defensive — orderItem always exists by construction
                    await tx.orderFulfillmentItem.create({
                        data: {
                            fulfillmentId: fulfillment.id,
                            orderItemId,
                            quantity: item.quantity,
                        },
                    });
                }
            }

            return { id: newOrder.id };
        }, { timeout: 15_000 }); // cold-Neon-safe: default 5s isn't enough for multi-item orders
    } catch (e) {
        await releaseStock(reservationItems);
        console.error('[checkout] Order transaction failed:', e);
        return { ok: false, error: 'Could not create your order. Please try again.' };
    }

    /* ─── 9. Stripe Tax calculation (Path B) ───────────────────────────── */
    //
    // Build line items: each cart product + a single shipping line item.
    // Failure here is non-fatal: we log and proceed with tax=$0 so dev/test works
    // before the user has fully configured Stripe Tax in their dashboard. In
    // production, tax-configuration issues should be caught via Stripe dashboard
    // observability, not by failing the customer's checkout.

    let taxAmount = 0;
    let taxCalculationId: string | null = null;
    try {
        const calculation = await stripe.tax.calculations.create({
            currency: 'usd',
            line_items: [
                ...input.items.map(item => {
                    const product = productMap.get(item.productId)!;
                    return {
                        amount: Math.round(parseFloat(product.priceB2c) * item.quantity * 100),
                        reference: `product:${item.productId}`,
                        quantity: item.quantity,
                        tax_behavior: 'exclusive' as const,
                    };
                }),
                {
                    amount: Math.round(shippingTotal * 100),
                    reference: 'shipping',
                    quantity: 1,
                    tax_behavior: 'exclusive' as const,
                    tax_code: 'txcd_92010001', // Stripe Tax code for shipping
                },
            ],
            customer_details: {
                address: {
                    line1: addr.line1,
                    line2: addr.line2 || undefined,
                    city: addr.city,
                    state: addr.state,
                    postal_code: addr.postalCode,
                    country: addr.country,
                },
                address_source: 'shipping',
            },
        });
        taxCalculationId = calculation.id;
        taxAmount = (calculation.tax_amount_exclusive ?? 0) / 100;
    } catch (e) {
        // Don't fail the customer for Stripe Tax misconfig. Surface in logs so the
        // user-operator sees it. In prod this should trigger an alert (7b/8).
        console.warn('[checkout] Stripe Tax calculation failed — falling back to tax=$0:', e instanceof Error ? e.message : e);
    }

    const totalWithTax = subtotal + shippingTotal + taxAmount;

    /* ─── 10. Create the Stripe PaymentIntent ──────────────────────────── */

    let paymentIntent: Stripe.PaymentIntent;
    try {
        const stripeAddress: Stripe.AddressParam = {
            line1: addr.line1,
            line2: addr.line2 || undefined,
            city: addr.city,
            state: addr.state,
            postal_code: addr.postalCode,
            country: addr.country,
        };
        const metadata: Record<string, string> = {
            orderId: order.id,
            userId,
            isGuest: isGuest ? 'true' : 'false',
        };
        if (taxCalculationId) metadata.tax_calculation_id = taxCalculationId;

        paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalWithTax * 100),
            currency: 'usd',
            shipping: {
                name: input.contact.name,
                phone: input.contact.phone,
                address: stripeAddress,
            },
            metadata,
            receipt_email: input.contact.email,
            automatic_payment_methods: { enabled: true },
        });
    } catch (e) {
        await releaseStock(reservationItems);
        await prisma.order.delete({ where: { id: order.id } }).catch(() => { /* best effort */ });
        console.error('[checkout] PaymentIntent creation failed:', e);
        const msg = e instanceof Error ? e.message : 'Unknown Stripe error';
        return { ok: false, error: `Payment system error: ${msg}` };
    }

    if (!paymentIntent.client_secret) {
        await releaseStock(reservationItems);
        await prisma.order.delete({ where: { id: order.id } }).catch(() => { /* best effort */ });
        return { ok: false, error: 'Payment system returned no client secret. Please try again.' };
    }

    /* ─── 11. Persist totals + PaymentIntent id + tax calc id on Order ──── */

    await prisma.order.update({
        where: { id: order.id },
        data: {
            stripePaymentIntentId: paymentIntent.id,
            taxAmount: taxAmount.toFixed(2),
            totalAmount: totalWithTax.toFixed(2),
            // Storing the calc id locally (in addition to PI metadata) so the webhook
            // can recover its idempotency state without re-fetching the PI, and so a
            // future admin tool can find calc-without-transaction orders to retry.
            stripeTaxCalculationId: taxCalculationId,
        },
    });

    return {
        ok: true,
        clientSecret: paymentIntent.client_secret,
        orderId: order.id,
    };
}
