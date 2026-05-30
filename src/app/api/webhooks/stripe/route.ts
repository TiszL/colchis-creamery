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
import { easypostBuyLabel, isEasyPostConfigured } from '@/lib/easypost';

/**
 * Phase 5 — best-effort parser for Order.shippingAddress (free-text snapshot).
 *
 * Expected format from checkout: "line1, city, state zip[, country]".
 * Returns null when the string doesn't conform. EasyPost label-buy then
 * skips this fulfillment with a warning (ops books manually). A follow-up
 * migration should add structured address columns to Order.
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

    // Event-level idempotency: claim the event id (PK = Stripe event.id). A
    // duplicate delivery / retry conflicts on insert and short-circuits, so side
    // effects can never apply twice. On processing failure we release the claim
    // (in the catch below) so Stripe's retry reprocesses cleanly.
    try {
        await prisma.processedStripeEvent.create({ data: { id: event.id, type: event.type } });
    } catch (e) {
        if ((e as { code?: string })?.code === 'P2002') {
            return new NextResponse('Already processed', { status: 200 });
        }
        throw e;
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
            // Phase 4 (4d) — Connect events. These fire on the same webhook
            // endpoint when the endpoint is configured to receive Connect
            // events in the Stripe dashboard. The connected-account ID is
            // available on `event.account` (or on event.data.object.id for
            // account.updated).
            case 'account.updated':
                await handleAccountUpdated(event.data.object as Stripe.Account);
                break;
            case 'payout.created':
            case 'payout.paid':
            case 'payout.failed':
                await handlePayoutEvent(event);
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
        // Release the idempotency claim so the retry can reprocess this event.
        await prisma.processedStripeEvent.delete({ where: { id: event.id } }).catch(() => undefined);
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
        // The reservation-cleanup cron cancelled this order (stock already
        // released) before the customer's payment confirmed. We can't fulfill it,
        // so refund the captured funds rather than charge-without-shipping.
        // Idempotent: refunding an already-refunded PI throws and is swallowed.
        console.warn('[stripe-webhook] Late success on CANCELLED order — auto-refunding:', order.id, 'PI:', pi.id);
        try {
            await stripe.refunds.create({ payment_intent: pi.id });
            await prisma.order.update({
                where: { id: order.id },
                data: { paymentStatus: 'REFUNDED' },
            });
        } catch (e) {
            console.error('[stripe-webhook] Auto-refund failed for late success on', order.id, ':', e instanceof Error ? e.message : e);
        }
        return;
    }

    const reservationItems = reservationItemsFromOrder(order);

    // Commit stock AND flip the order to PAID/CONFIRMED ATOMICALLY: the order +
    // fulfillment updates run inside commitStock's transaction via onCommitted.
    // Previously these were separate transactions, so a crash between them left
    // stock committed while the order stayed UNPAID — and a Stripe retry then
    // re-committed (double-decrement). Now a partial failure rolls the whole
    // thing back and the retry reprocesses cleanly.
    // Phase 3 (3d): pass orderId so batch SALE movements are traceable.
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
            await tx.orderFulfillment.updateMany({
                where: { orderId: order.id },
                data: { status: 'CONFIRMED' },
            });
        },
    });

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

    // Phase 5 (5c): buy UPS labels for any NATIONAL_SHIP fulfillments via
    // EasyPost. Same best-effort contract: a failed label-buy leaves the
    // fulfillment in CONFIRMED with no trackingNumber, and ops can re-run
    // (idempotency below skips already-bought labels). Skipped entirely if
    // EasyPost env unset.
    if (isEasyPostConfigured()) {
        try {
            await dispatchUpsLabels(order.id);
        } catch (e) {
            console.warn(
                '[stripe-webhook] UPS label dispatch failed for Order',
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

/** Phase B — compose driver-facing dropoff instructions from the order's
 *  optional snapshot fields. Returns undefined if none are set, in which case
 *  carriers receive no instructions field at all. */
function combineDropoffInstructions(order: {
    shippingAddressLine2:  string | null;
    shippingAccessCode:    string | null;
    shippingBuildingName:  string | null;
    shippingDeliveryNotes: string | null;
}): string | undefined {
    const parts: string[] = [];
    if (order.shippingAddressLine2)  parts.push(`Apt/Suite: ${order.shippingAddressLine2}`);
    if (order.shippingBuildingName)  parts.push(`Building: ${order.shippingBuildingName}`);
    if (order.shippingAccessCode)    parts.push(`Access code: ${order.shippingAccessCode}`);
    if (order.shippingDeliveryNotes) parts.push(order.shippingDeliveryNotes);
    return parts.length > 0 ? parts.join(' · ') : undefined;
}

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
        if (f.deliveryMethod !== 'DOORDASH_DRIVE') continue;
        if (f.externalOrderId) continue; // idempotency — already dispatched

        const loc = f.location;

        // Fail-loud on missing phones. DD's validator rejects any placeholder
        // we'd substitute, and creating a doomed-to-fail delivery just wastes
        // an API call + leaves admin to clean up. Skip + log; admin reconciles.
        if (!loc.phone) {
            console.warn(
                '[doordash] Skipping dispatch for fulfillment', f.id,
                '— pickup location', loc.name, 'has no phone configured. Set Location.phone in /admin/locations.',
            );
            continue;
        }
        if (!recipientPhone) {
            console.warn(
                '[doordash] Skipping dispatch for fulfillment', f.id,
                '— Order', order.id, 'has no contact phone. (Should not happen — checkout validates.)',
            );
            continue;
        }

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
                phone: loc.phone,
                businessName: loc.name,
                instructions: loc.notes || undefined,
            },
            dropoff: {
                address: order.shippingAddress || '',
                phone: recipientPhone,
                firstName,
                lastName,
                email: recipientEmail || undefined,
                instructions: combineDropoffInstructions(order),
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

    // Phase 9c: prefer structured shipping columns when available; fall back
    // to parsing the free-text shippingAddress for legacy orders (pre-9c) that
    // only have the formatted snapshot. New orders always set the structured
    // columns at checkout — see actions/checkout.ts.
    const parsed =
        order.shippingLine1 && order.shippingCity && order.shippingState && order.shippingPostalCode
            ? {
                line1: order.shippingLine1,
                city: order.shippingCity,
                state: order.shippingState,
                postalCode: order.shippingPostalCode,
                country: 'US', // checkout enforces US-only; UberAddressInput requires country
            }
            : parseShippingAddress(order.shippingAddress);
    if (!parsed) {
        console.warn(
            '[uber-direct] Skipping dispatch — could not derive structured shipping address for Order',
            order.id,
        );
        return;
    }

    for (const f of order.fulfillments) {
        if (f.deliveryMethod !== 'UBER_DIRECT') continue;
        if (f.externalOrderId) continue; // idempotency

        const loc = f.location;
        if (!loc.addressLine1 || !loc.city || !loc.state || !loc.postalCode) {
            console.warn('[uber-direct] Location missing address components for fulfillment', f.id);
            continue;
        }

        // Same fail-loud contract as DD: don't substitute a fake phone if the
        // real one is missing. Skip + log; admin sets Location.phone in admin/UI.
        if (!loc.phone) {
            console.warn(
                '[uber-direct] Skipping dispatch for fulfillment', f.id,
                '— pickup location', loc.name, 'has no phone configured. Set Location.phone in /admin/locations.',
            );
            continue;
        }
        if (!recipientPhone) {
            console.warn(
                '[uber-direct] Skipping dispatch for fulfillment', f.id,
                '— Order', order.id, 'has no contact phone. (Should not happen — checkout validates.)',
            );
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
                phone: loc.phone,
                instructions: loc.notes || undefined,
            },
            dropoff: {
                firstName,
                lastName,
                address: parsed,
                phone: recipientPhone,
                email: recipientEmail || undefined,
                instructions: combineDropoffInstructions(order),
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

/* ─── UPS label dispatch (Phase 5 / 5c) ─────────────────────────────────── */

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

    // Parse the snapshot address into components for EasyPost's structured payload.
    // Order keeps shippingAddress as free text + line2 + delivery notes —
    // structured columns (city/state/zip) for label-buy are a follow-up.
    const parsed = parseFreeTextShippingAddress(order.shippingAddress);
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
            console.log(
                `[easypost] Label bought for fulfillment ${f.id}: ${bought.carrier} ${bought.service} ${bought.trackingCode} (label: ${bought.labelUrl})`,
            );
        } else {
            console.warn('[easypost] Label purchase failed for fulfillment', f.id, '— leaving for manual booking');
        }
    }
}

/* ─── Phase 4 (4d) — Connect event handlers ──────────────────────────────── */

/**
 * account.updated — Stripe pushes this whenever a connected account changes.
 * We mirror the derived status into Location.stripeOnboardingStatus so the
 * admin panel + checkout routing stay current without polling.
 *
 * Idempotent: re-running on the same payload is a no-op (just rewrites the
 * same status value + bumps the timestamp).
 */
async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
    const accountId = account.id;
    // Look up the Location attached to this connected account. Stripe also
    // sends account.updated for ad-hoc dashboard edits — if we don't track
    // this account, just ack.
    const location = await prisma.location.findUnique({
        where: { stripeConnectAccountId: accountId },
        select: { id: true, name: true, stripeOnboardingStatus: true },
    });
    if (!location) {
        console.log('[stripe-webhook] account.updated for untracked account:', accountId);
        return;
    }

    const { deriveOnboardingStatus } = await import('@/lib/stripe-connect');
    const nextStatus = deriveOnboardingStatus(account);

    if (location.stripeOnboardingStatus === nextStatus) {
        // No-op: status hasn't changed; still bump timestamp so admin sees freshness.
        await prisma.location.update({
            where: { id: location.id },
            data: { stripeOnboardingUpdatedAt: new Date() },
        });
        return;
    }

    await prisma.location.update({
        where: { id: location.id },
        data: {
            stripeOnboardingStatus: nextStatus,
            stripeOnboardingUpdatedAt: new Date(),
        },
    });
    console.log(
        `[stripe-webhook] account.updated: location="${location.name}" ${location.stripeOnboardingStatus ?? '(none)'} → ${nextStatus}`,
    );
}

/**
 * payout.created / payout.paid / payout.failed — log only for now. A
 * future iteration could surface payout history to the admin Connect
 * panel and email-notify on failed payouts.
 */
async function handlePayoutEvent(event: Stripe.Event): Promise<void> {
    const accountId = event.account;
    const payout = event.data.object as Stripe.Payout;
    console.log(
        `[stripe-webhook] ${event.type}: account=${accountId ?? '(platform)'} payoutId=${payout.id} amount=${payout.amount}¢ ${payout.currency} status=${payout.status}`,
    );
}

