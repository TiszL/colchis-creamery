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
import { stripe, isStripeLiveMode } from '@/lib/stripe';
import { sendOpsAlertEmail } from '@/lib/email';
import { getSession } from '@/lib/session';
import { rateLimit, callerIp, rateLimitMessage } from '@/lib/rate-limit';
import { reserveStock, releaseStock } from '@/lib/stock-reservation';
import { applyFreeShippingRule, planFulfillment } from '@/lib/shipping';
import { normalizeUSPhone } from '@/lib/phone';
import type { DeliveryMethod } from '@prisma/client';
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
        // Phase B: optional delivery details, snapshotted onto the Order so
        // historical orders remain accurate after UserAddress edits/deletes.
        // Carriers consume these as DD dropoff_instructions / Uber dropoff_notes.
        accessCode?: string;
        buildingName?: string;
        deliveryNotes?: string;
    };
    selectedChannels: { locationId: string; deliveryMethod: DeliveryMethod }[];
    contact: { name: string; email: string; phone: string };
};

export type CheckoutResult =
    | {
          ok: true;
          clientSecret: string;
          orderId: string;
          // Launch polish: exact charge breakdown (dollars, unprefixed). The
          // client shows these BEFORE confirming payment — customers must see
          // the tax-inclusive total they'll actually be charged.
          totals: { subtotal: string; shipping: string; tax: string; total: string };
      }
    | { ok: false; error: string; failingItem?: { productId: string } };

const RESERVATION_TTL_MS = 15 * 60 * 1000;

/**
 * Release an abandoned two-step checkout. "Place order" reserves stock +
 * creates an UNPAID Order + PaymentIntent, then the customer reviews the
 * tax-inclusive total; if they go back or change the cart, that reservation
 * must be freed IMMEDIATELY — otherwise their own held stock blocks their
 * retry until the reservation cron sweeps it ~20 min later (the customer
 * ordering more than half of a low-stock SKU hits this every time).
 *
 * Safe to call with a stale/paid/unknown id: it only ever cancels an order
 * whose PaymentIntent is still cancelable (not succeeded/processing), so a
 * payment that raced through is never disturbed. State-guarded + release-only-
 * if-flip-winner, mirroring the reservation cron, so it can't double-release
 * (which would corrupt other orders' reservations on shared stock rows).
 */
export async function abandonCheckoutOrder(orderId: string): Promise<{ ok: boolean }> {
    if (!orderId) return { ok: false };
    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true, paymentStatus: true, orderStatus: true, stripePaymentIntentId: true,
                fulfillments: { include: { items: { include: { orderItem: true } } } },
            },
        });
        if (!order || order.paymentStatus !== 'UNPAID' || order.orderStatus === 'CANCELLED') {
            return { ok: false };
        }

        // Never disturb a payment that actually went through in the meantime.
        if (order.stripePaymentIntentId) {
            let pi: Stripe.PaymentIntent | null = null;
            try {
                pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
            } catch {
                pi = null; // unknown/deleted PI — treat as cancelable
            }
            if (pi && (pi.status === 'succeeded' || pi.status === 'processing')) return { ok: false };
            if (pi && pi.status !== 'canceled') {
                await stripe.paymentIntents.cancel(pi.id, { cancellation_reason: 'abandoned' }).catch(() => undefined);
            }
        }

        // Atomic guarded flip — release stock only if WE won the flip.
        const flipped = await prisma.order.updateMany({
            where: { id: order.id, paymentStatus: 'UNPAID', orderStatus: { not: 'CANCELLED' } },
            data: { orderStatus: 'CANCELLED', paymentStatus: 'FAILED', reservationExpiresAt: null },
        });
        if (flipped.count === 0) return { ok: false };
        await prisma.orderFulfillment.updateMany({ where: { orderId: order.id }, data: { status: 'CANCELLED' } });

        const reservationItems = order.fulfillments.flatMap(f =>
            f.items.map(it => ({ productId: it.orderItem.productId, locationId: f.locationId, quantity: it.quantity })),
        );
        await releaseStock(reservationItems);
        return { ok: true };
    } catch (e) {
        // Best-effort: the reservation cron is the backstop if this fails.
        console.error('[checkout] abandonCheckoutOrder failed for', orderId, ':', e instanceof Error ? e.message : e);
        return { ok: false };
    }
}

export async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
    /* ─── 1. Basic input validation ────────────────────────────────────── */

    if (!input.items?.length) {
        return { ok: false, error: 'Your cart is empty.' };
    }
    // One OrderItem per product per order is a real invariant, not a client
    // courtesy: duplicate product references make the Stripe Tax calculation
    // throw wholesale (unique-reference rule), which the $0-tax fallback would
    // swallow. Merge duplicates server-side — the cart is client-controlled.
    {
        const merged = new Map<string, number>();
        for (const it of input.items) {
            merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);
        }
        if (merged.size !== input.items.length) {
            input = { ...input, items: [...merged].map(([productId, quantity]) => ({ productId, quantity })) };
        }
    }
    if (!input.contact?.email || !input.contact?.phone || !input.contact?.name) {
        return { ok: false, error: 'Please fill in your contact details.' };
    }

    // Card-testing protection — the #1 launch-week attack on new stores:
    // criminals validate stolen cards against an unprotected checkout, and
    // every attempt costs real dispute fees. Each call here creates a
    // PaymentIntent, so cap creation per IP and per email. Limits are far
    // above any real customer's behavior.
    const ip = await callerIp();
    for (const [key, max] of [
        [`checkout:ip:${ip}`, 10],
        [`checkout:email:${input.contact.email.trim().toLowerCase()}`, 6],
    ] as const) {
        const rl = await rateLimit(key, max, 600);
        if (!rl.ok) return { ok: false, error: rateLimitMessage(rl) };
    }
    // Normalize + validate US phone server-side (client-side hint is best-effort).
    // Dispatch APIs (DoorDash / Uber Direct) reject non-US-E.164 formats; we want
    // the canonical "+1XXXXXXXXXX" form persisted so all downstream callers can
    // trust the value without re-parsing.
    const normalizedPhone = normalizeUSPhone(input.contact.phone);
    if (!normalizedPhone) {
        return { ok: false, error: 'Please provide a valid US phone number.' };
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
        select: { id: true, name: true, priceB2c: true, isCartOrderable: true },
    });
    const productMap = new Map(products.map(p => [p.id, p]));
    for (const item of input.items) {
        const p = productMap.get(item.productId);
        if (!p) {
            return { ok: false, error: 'A product in your cart is no longer available.', failingItem: { productId: item.productId } };
        }
        // Phase 10: wholesale-only products are listed publicly but not cart-orderable.
        // This is the server-side enforcement; the PDP / card already hides the
        // Add-to-cart UI when isCartOrderable=false, so reaching here means someone
        // bypassed the UI (stale tab, direct API hit, etc.). Reject loud.
        if (!p.isCartOrderable) {
            return { ok: false, error: `"${p.name}" is wholesale-only and can't be ordered through checkout. Please request a quote from /wholesale.`, failingItem: { productId: item.productId } };
        }
    }
    const subtotal = input.items.reduce((sum, item) => {
        const p = productMap.get(item.productId)!;
        return sum + parseFloat(p.priceB2c) * item.quantity;
    }, 0);

    /* ─── 3. Re-plan fulfillment with the chosen address ───────────────── */

    // Pass full context (address text + components + phone) so server-side
    // re-validation produces the same live carrier quotes the cart showed.
    // Without these args we'd silently fall back to flatFee on the server,
    // charging a different price than the customer saw at cart time.
    const plan = await planFulfillment(
        input.items,
        addr.lat,
        addr.lng,
        addr.formatted,
        {
            line1: addr.line1,
            line2: addr.line2,
            city: addr.city,
            state: addr.state,
            postalCode: addr.postalCode,
            country: addr.country,
        },
        normalizedPhone,
    );
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
        const quote = group.availableChannels.find(c => c.deliveryMethod === sel.deliveryMethod);
        if (!quote) {
            return {
                ok: false,
                error: `"${sel.deliveryMethod.replace(/_/g, ' ')}" is no longer available for ${group.locationName}. Please pick another method.`,
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
        // Phase 9: enforce User.phone @unique — friendly error if this phone is
        // already on a DIFFERENT user. Without this check the backfill below
        // would throw a raw Prisma constraint error.
        const phoneConflict = await prisma.user.findFirst({
            where: { phone: normalizedPhone, id: { not: userId } },
            select: { id: true },
        });
        if (phoneConflict) {
            return { ok: false, error: 'This phone number is already registered to another account.' };
        }
        // Backfill phone if logged-in user has none yet — they just entered one.
        // updateMany silently skips if phone is already set (idempotent, one DB call).
        await prisma.user.updateMany({
            where: { id: userId, phone: null },
            data: { phone: normalizedPhone },
        });
    } else {
        isGuest = true;
        // Phase 11: guest D2C checkout — scope to retail accounts so a same-
        // email B2B identity isn't accidentally picked up as the order's User.
        const existing = await prisma.user.findFirst({
            where: { email: input.contact.email, role: "B2C_CUSTOMER" },
        });
        if (existing) {
            userId = existing.id;
            // Phase 9: phone uniqueness — input phone must not belong to a
            // DIFFERENT user than the one we just matched by email.
            const phoneConflict = await prisma.user.findFirst({
                where: { phone: normalizedPhone, id: { not: existing.id } },
                select: { id: true },
            });
            if (phoneConflict) {
                return { ok: false, error: 'This phone number is registered to another account. Please log in or use a different phone.' };
            }
            // Existing email — attach order to that User (may or may not have a password).
            // We don't overwrite passwordHash/name here — that would let strangers mutate
            // other people's accounts via guest checkout. Phone is an exception: if the
            // user has none recorded yet, we backfill it from this checkout so future
            // orders + carrier dispatch have it.
            await prisma.user.updateMany({
                where: { id: existing.id, phone: null },
                data: { phone: normalizedPhone },
            });
        } else {
            // Phase 9: don't auto-attach by phone alone (security — would let a
            // stranger who knows someone's phone place orders under their name).
            // If phone matches an existing account, refuse + suggest login.
            const phoneOwner = await prisma.user.findFirst({
                where: { phone: normalizedPhone },
                select: { id: true },
            });
            if (phoneOwner) {
                return { ok: false, error: 'This phone number is already registered. Please log in to continue, or use a different phone.' };
            }
            const newUser = await prisma.user.create({
                data: {
                    email: input.contact.email,
                    name: input.contact.name,
                    phone: normalizedPhone,
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
                    // Always snapshot contact phone on the order, regardless of guest/logged-in
                    // status — dispatch needs it and User.phone may be stale or null.
                    guestPhone: normalizedPhone,
                    paymentStatus: 'UNPAID',
                    orderStatus: 'PROCESSING',
                    shippingAddress: addr.formatted,
                    shippingLat: addr.lat,
                    shippingLng: addr.lng,
                    // Phase 9c: structured components — carriers + admin displays
                    // prefer these over parsing the free-text shippingAddress.
                    shippingLine1:      addr.line1      || null,
                    shippingCity:       addr.city       || null,
                    shippingState:      addr.state      || null,
                    shippingPostalCode: addr.postalCode || null,
                    // Phase B: snapshot extended delivery details onto the order.
                    shippingAddressLine2:  addr.line2         || null,
                    shippingAccessCode:    addr.accessCode    || null,
                    shippingBuildingName:  addr.buildingName  || null,
                    shippingDeliveryNotes: addr.deliveryNotes || null,
                    reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
                },
            });

            // OrderItem rows batched into ONE statement (createManyAndReturn gives
            // the ids back for fulfillment wiring) — fewer round-trips inside the
            // transaction = less exposure to cold-Neon latency.
            const orderItems = await tx.orderItem.createManyAndReturn({
                data: input.items.map(item => ({
                    orderId: newOrder.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: productMap.get(item.productId)!.priceB2c,
                })),
            });
            const orderItemByProductId = new Map(orderItems.map(oi => [oi.productId, oi.id]));

            // OrderFulfillment per group (needs its id), items batched per fulfillment.
            for (const group of plan.groups) {
                const quote = finalQuotes.find(q => q.locationId === group.locationId)!;
                const fulfillment = await tx.orderFulfillment.create({
                    data: {
                        orderId: newOrder.id,
                        locationId: group.locationId,
                        deliveryMethod: quote.deliveryMethod,
                        status: 'PENDING',
                        shippingCost: quote.shippingCost.toFixed(2),
                        packagingType: quote.packagingType,
                    },
                });
                const fulfillmentItems = group.items
                    .map(item => ({ orderItemId: orderItemByProductId.get(item.productId), quantity: item.quantity }))
                    .filter((fi): fi is { orderItemId: string; quantity: number } => !!fi.orderItemId);
                if (fulfillmentItems.length > 0) {
                    await tx.orderFulfillmentItem.createMany({
                        data: fulfillmentItems.map(fi => ({ fulfillmentId: fulfillment.id, ...fi })),
                    });
                }
            }

            return { id: newOrder.id };
        }, {
            timeout: 30_000, // cold-Neon-safe: default 5s isn't enough for multi-item orders
            // Prisma's DEFAULT maxWait is 2s — the time allowed to ACQUIRE the tx
            // connection. On a cold Vercel lambda the pooler handshake alone can
            // exceed that, throwing before the transaction even starts ("Could not
            // create your order" with nothing wrong in the order itself).
            maxWait: 10_000,
        });
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
    const taxCentsByProductId = new Map<string, number>();
    try {
        const calculation = await stripe.tax.calculations.create({
            currency: 'usd',
            // Phase 2: per-line amounts feed OrderItem.taxCents so modification
            // refunds are exact instead of pro-rated.
            expand: ['line_items'],
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
            ],
            // Shipping must ride the dedicated shipping_cost param — Stripe
            // REJECTS tax_code txcd_92010001 on a plain line item (this
            // rejection silently zeroed tax on every order until Phase 2's
            // verification caught it; the $0 fallback + ops alert masked it).
            shipping_cost: {
                amount: Math.round(shippingTotal * 100),
                tax_behavior: 'exclusive' as const,
                tax_code: 'txcd_92010001',
            },
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
        // Per-line tax keyed by our own reference ('product:<id>'). The
        // shipping-fee line stays order-level only — shipping is never
        // refunded on modification. Small carts fit one page; if Stripe ever
        // paginates (has_more) the tail lines just keep taxCents null and the
        // refund math falls back to pro-rating for them.
        for (const line of calculation.line_items?.data ?? []) {
            if (!line.reference?.startsWith('product:')) continue;
            taxCentsByProductId.set(line.reference.slice('product:'.length), line.amount_tax);
        }
        if (calculation.line_items?.has_more) {
            console.warn('[checkout] tax calculation line_items paginated — tail lines fall back to pro-rate on Order', order.id);
        }
    } catch (e) {
        // Don't fail the customer for a Stripe Tax hiccup — but collecting $0 tax
        // on real orders is a compliance problem the owner must hear about NOW,
        // not discover at filing time. Alert ops on every occurrence (rare by
        // design; a burst means Stripe Tax isn't registered for the state).
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[checkout] Stripe Tax calculation failed — falling back to tax=$0:', msg);
        void sendOpsAlertEmail({
            subject: 'Stripe Tax calculation FAILED — order charged $0 tax',
            orderId: order.id,
            lines: [
                `Tax calculation failed for this checkout and the order proceeded with $0 tax: ${msg}`,
                'If this repeats, Stripe Tax is misconfigured (check Dashboard → Tax → Registrations for your state).',
                'Sales tax for this order must be handled manually at filing time.',
            ],
        }).catch(() => undefined);
    }

    const totalWithTax = subtotal + shippingTotal + taxAmount;

    /* ─── 10. Create the Stripe PaymentIntent ──────────────────────────── */

    // Phase 4 (4c) — Stripe Connect routing. If the order's destination
    // location(s) have a complete connected account on file, settle the
    // charge to that account via destination charges (transfer_data).
    // Per Phase 1g, carts are single-location, so this is almost always
    // one location → one Connect account.
    //
    // Multi-location carts (edge case, legacy) with mixed Connect status
    // fall back to a platform charge with a warning logged — splitting one
    // PaymentIntent across multiple destinations isn't supported by Stripe;
    // doing so would need separate charges + transfers (deferred).
    const uniqueLocationIds = Array.from(new Set(plan.groups.map(g => g.locationId)));
    const connectLookup = await prisma.location.findMany({
        where: { id: { in: uniqueLocationIds } },
        select: { id: true, stripeConnectAccountId: true, stripeOnboardingStatus: true, stripeAccountLivemode: true },
    });
    // Launch hardening — Connect accounts are MODE-SCOPED: a test-mode acct_ id
    // does not exist in live mode, and routing a live PaymentIntent at one
    // throws "No such destination" (hard-failing the checkout). Only route to
    // accounts created in the CURRENT key mode; mismatches fall back to a
    // platform charge until the location is re-onboarded in live mode.
    const modeMismatched = connectLookup.filter(
        l => l.stripeConnectAccountId && l.stripeOnboardingStatus === 'complete' && (l.stripeAccountLivemode ?? false) !== isStripeLiveMode(),
    );
    if (modeMismatched.length > 0) {
        console.error(
            '[checkout] STRIPE MODE MISMATCH — Connect account(s) created in a different mode than the current key; falling back to platform charge. Re-run Connect onboarding for:',
            modeMismatched.map(l => l.id),
        );
    }
    const completeAccounts = connectLookup
        .filter(l =>
            l.stripeConnectAccountId &&
            l.stripeOnboardingStatus === 'complete' &&
            (l.stripeAccountLivemode ?? false) === isStripeLiveMode(),
        )
        .map(l => l.stripeConnectAccountId!);
    const allOnSingleConnectAccount =
        completeAccounts.length === connectLookup.length &&
        new Set(completeAccounts).size === 1;
    const destinationAccountId = allOnSingleConnectAccount ? completeAccounts[0] : null;
    if (uniqueLocationIds.length > 1 && !allOnSingleConnectAccount && completeAccounts.length > 0) {
        console.warn(
            '[checkout] Mixed-Connect cart — some locations have a complete Connect account, others do not. Falling back to platform charge.',
            { orderId: order.id, locationIds: uniqueLocationIds },
        );
    }

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
        if (destinationAccountId) metadata.connect_account_id = destinationAccountId;

        const intentParams: Stripe.PaymentIntentCreateParams = {
            amount: Math.round(totalWithTax * 100),
            currency: 'usd',
            shipping: {
                name: input.contact.name,
                phone: normalizedPhone,
                address: stripeAddress,
            },
            metadata,
            receipt_email: input.contact.email,
            automatic_payment_methods: { enabled: true },
        };
        if (destinationAccountId) {
            intentParams.transfer_data = { destination: destinationAccountId };
        }
        paymentIntent = await stripe.paymentIntents.create(intentParams);
    } catch (e) {
        await releaseStock(reservationItems);
        // The order row is deleted (customer retries cleanly) — so this log line
        // is the ONLY debugging trace. Include everything.
        console.error('[checkout] PaymentIntent creation failed:', {
            orderId: order.id,
            locationIds: uniqueLocationIds,
            destinationAccountId,
            liveMode: isStripeLiveMode(),
            amountCents: Math.round(totalWithTax * 100),
            error: e instanceof Error ? e.message : e,
        });
        await prisma.order.delete({ where: { id: order.id } }).catch(() => { /* best effort */ });
        const msg = e instanceof Error ? e.message : 'Unknown Stripe error';
        return { ok: false, error: `Payment system error: ${msg}` };
    }

    if (!paymentIntent.client_secret) {
        await releaseStock(reservationItems);
        await prisma.order.delete({ where: { id: order.id } }).catch(() => { /* best effort */ });
        return { ok: false, error: 'Payment system returned no client secret. Please try again.' };
    }

    /* ─── 11. Persist totals + PaymentIntent id + tax calc id on Order ──── */

    await prisma.$transaction([
        prisma.order.update({
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
        }),
        // Phase 2: exact per-line tax (cents) for modification refunds. Keyed
        // by productId — one OrderItem per product per order by construction.
        ...[...taxCentsByProductId].map(([productId, cents]) =>
            prisma.orderItem.updateMany({
                where: { orderId: order.id, productId },
                data: { taxCents: cents },
            }),
        ),
    ]);

    return {
        ok: true,
        clientSecret: paymentIntent.client_secret,
        orderId: order.id,
        totals: {
            subtotal: subtotal.toFixed(2),
            shipping: shippingTotal.toFixed(2),
            tax: taxAmount.toFixed(2),
            total: totalWithTax.toFixed(2),
        },
    };
}
