// QR table ordering — config + order engine.
//
// Lives in lib (NOT 'use server'): the actions layer and the Stripe webhook
// gate access before calling. The whole feature sits behind a master toggle
// (SiteConfig key 'qrOrdering') so the owner can switch it on/off from
// /admin/qr-ordering without a deploy.
//
// Flow: printed QR → /table/{locationId}/{n} → dine-in menu + inline cart →
// createTableOrder reserves stock + creates the Order (IN_STORE_DINE_IN,
// tableNumber) + a Stripe Checkout Session → on checkout.session.completed
// the order joins the standard paid pipeline (commit stock, tax transaction,
// confirmation email, KDS) via stripe-payment-sync.

import { prisma } from '@/lib/db';
import { stripe, isStripeLiveMode } from '@/lib/stripe';
import { sellableStockWhere } from '@/lib/stock-availability';
import { isOpenNow, isAcceptingMtoOrders, type LocationHours } from '@/lib/location-hours';
import { reserveStock, releaseStock, type ReservationItem } from '@/lib/stock-reservation';
import { signOrderToken } from '@/lib/order-token';
import { sendOpsAlertEmail } from '@/lib/email';

const CONFIG_KEY = 'qrOrdering';
const SESSION_TTL_MINUTES = 35; // Stripe Checkout minimum expiry is 30 min

export type QrOrderingConfig = {
    enabled: boolean;
    /** Tables per location id. Locations absent from the map have QR ordering off. */
    tablesByLocation: Record<string, number>;
};

const DEFAULT_CONFIG: QrOrderingConfig = { enabled: false, tablesByLocation: {} };

export async function getQrOrderingConfig(): Promise<QrOrderingConfig> {
    try {
        const row = await prisma.siteConfig.findFirst({ where: { key: CONFIG_KEY } });
        if (!row) return DEFAULT_CONFIG;
        const parsed = JSON.parse(row.value) as Partial<QrOrderingConfig>;
        return {
            enabled: parsed.enabled === true,
            tablesByLocation: parsed.tablesByLocation && typeof parsed.tablesByLocation === 'object'
                ? parsed.tablesByLocation
                : {},
        };
    } catch {
        return DEFAULT_CONFIG;
    }
}

export async function setQrOrderingConfig(config: QrOrderingConfig): Promise<void> {
    const value = JSON.stringify(config);
    const existing = await prisma.siteConfig.findFirst({ where: { key: CONFIG_KEY }, select: { id: true } });
    if (existing) {
        await prisma.siteConfig.update({ where: { id: existing.id }, data: { value } });
    } else {
        await prisma.siteConfig.create({ data: { key: CONFIG_KEY, value } });
    }
}

/** A table page is servable when: master toggle on, table within the
 *  location's configured count, location active + dine-in enabled. */
export async function validateTable(locationId: string, table: number): Promise<
    | { ok: true; location: { id: string; name: string; hours: LocationHours; allowsChannels: string[]; mtoCutoffMinutes: number | null; addressLine1: string; city: string; state: string; postalCode: string; country: string; stripeConnectAccountId: string | null; stripeOnboardingStatus: string | null; stripeAccountLivemode: boolean | null } }
    | { ok: false; reason: 'disabled' | 'unknown_table' | 'no_dine_in' }
> {
    const config = await getQrOrderingConfig();
    if (!config.enabled) return { ok: false, reason: 'disabled' };
    const tables = config.tablesByLocation[locationId] ?? 0;
    if (!Number.isInteger(table) || table < 1 || table > tables) return { ok: false, reason: 'unknown_table' };

    const location = await prisma.location.findFirst({
        where: {
            id: locationId,
            isActive: true,
            channels: { some: { deliveryMethod: 'IN_STORE_DINE_IN', isActive: true } },
        },
        select: {
            id: true, name: true, hours: true, allowsChannels: true, mtoCutoffMinutes: true,
            addressLine1: true, city: true, state: true, postalCode: true, country: true,
            stripeConnectAccountId: true, stripeOnboardingStatus: true, stripeAccountLivemode: true,
        },
    });
    if (!location) return { ok: false, reason: 'no_dine_in' };
    return { ok: true, location: { ...location, hours: location.hours as LocationHours } };
}

export type TableOrderInput = {
    locationId: string;
    table: number;
    items: { productId: string; quantity: number }[];
    contact: { name: string; email: string };
    /** Voluntary tip for the serving staff, in cents. Separately stated and
     *  NEVER fed to the tax calculation (voluntary tips are not taxable
     *  sales in OH; a mandatory or taxed "service charge" would be). It rides
     *  the SAME Checkout Session as the food, so no extra transaction fee. */
    tipCents?: number;
    locale?: string;
};

export type TableOrderResult =
    | { ok: true; paymentUrl: string; orderId: string }
    | { ok: false; error: string };

export async function createTableOrder(input: TableOrderInput): Promise<TableOrderResult> {
    if (!input.items?.length) return { ok: false, error: 'Nothing selected yet.' };
    if (!input.contact?.name?.trim() || !input.contact?.email?.trim()) {
        return { ok: false, error: 'Please add your name and email — the receipt goes there.' };
    }
    // Merge duplicate lines (same invariant as checkout — one OrderItem per product).
    const merged = new Map<string, number>();
    for (const it of input.items) {
        if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 20) {
            return { ok: false, error: 'Quantities must be between 1 and 20.' };
        }
        merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);
    }
    const items = [...merged].map(([productId, quantity]) => ({ productId, quantity }));
    // A table order is a meal, not a warehouse pull — bound the reservation
    // surface an unauthenticated caller can hold.
    if (items.length > 15) return { ok: false, error: 'That is a lot of dishes for one table — please split the order.' };
    if (items.reduce((n, i) => n + i.quantity, 0) > 40) return { ok: false, error: 'Too many items for one order — please split it.' };

    const valid = await validateTable(input.locationId, input.table);
    if (!valid.ok) return { ok: false, error: 'QR ordering is not available right now — please order at the counter.' };
    const loc = valid.location;
    // Dine-in needs an open kitchen — there is no "schedule for tomorrow" at a
    // table. The pre-close wind-down window counts as closed too (matches the
    // paid pipeline's isAcceptingMtoOrders, so a table ticket can never land
    // "scheduled for tomorrow" in front of a seated customer).
    if (!isAcceptingMtoOrders(loc.hours, loc.mtoCutoffMinutes)) {
        return { ok: false, error: 'The kitchen is closed right now — please order at the counter when we open.' };
    }

    /* Products must be genuinely sellable at THIS location (86s, caps and
       cutoffs enforce via sellableStockWhere + reserveStock). */
    const products = await prisma.product.findMany({
        where: {
            id: { in: items.map(i => i.productId) },
            isActive: true,
            isB2cVisible: true,
            isCartOrderable: true,
            status: 'ACTIVE',
            // Full availability invariant — the location must actually SELL
            // this product's channel, not merely warehouse it.
            salesChannel: { in: loc.allowsChannels as never },
            stocks: { some: { ...sellableStockWhere(), locationId: loc.id } },
        },
        select: { id: true, name: true, priceB2c: true },
    });
    for (const it of items) {
        if (!products.some(p => p.id === it.productId)) {
            return { ok: false, error: 'An item on your order just became unavailable — please refresh the menu.' };
        }
    }
    const productMap = new Map(products.map(p => [p.id, p]));
    const subtotalCents = items.reduce(
        (sum, it) => sum + Math.round(parseFloat(productMap.get(it.productId)!.priceB2c) * 100) * it.quantity, 0);
    if (subtotalCents <= 0) return { ok: false, error: 'Nothing to charge for.' };

    // Tip bounds: an unauthenticated caller must not be able to build an
    // absurd charge. 2× the food and $500 are both far above any real tip.
    const tipCents = Number.isInteger(input.tipCents) && input.tipCents! > 0 ? input.tipCents! : 0;
    if (tipCents > Math.min(subtotalCents * 2, 50_000)) {
        return { ok: false, error: 'That tip looks too large — please re-enter it.' };
    }

    /* Reserve stock (released by the reservation cron if the session expires
       unpaid, keyed off reservationExpiresAt — same machinery as checkout). */
    const reservationItems: ReservationItem[] = items.map(i => ({
        productId: i.productId, locationId: loc.id, quantity: i.quantity,
    }));
    const reserved = await reserveStock(reservationItems);
    if (!reserved.ok) return { ok: false, error: reserved.error };

    let orderId: string | null = null;
    try {
        /* Tax — dine-in is sold AT the store, so the location's address is the
           taxable situs. Fail-open to $0 with a loud log (matches checkout). */
        let taxCents = 0;
        let taxCalculationId: string | null = null;
        const lineTaxByProduct = new Map<string, number>();
        try {
            const calc = await stripe.tax.calculations.create({
                currency: 'usd',
                expand: ['line_items'],
                line_items: items.map(it => ({
                    amount: Math.round(parseFloat(productMap.get(it.productId)!.priceB2c) * 100) * it.quantity,
                    reference: `product:${it.productId}`,
                    quantity: it.quantity,
                    tax_behavior: 'exclusive' as const,
                })),
                customer_details: {
                    address: {
                        line1: loc.addressLine1, city: loc.city, state: loc.state,
                        postal_code: loc.postalCode, country: loc.country || 'US',
                    },
                    address_source: 'shipping',
                },
            });
            taxCents = calc.tax_amount_exclusive ?? 0;
            taxCalculationId = calc.id;
            for (const line of calc.line_items?.data ?? []) {
                if (line.reference?.startsWith('product:')) {
                    lineTaxByProduct.set(line.reference.slice('product:'.length), line.amount_tax);
                }
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('[table-order] Stripe Tax calculation failed — proceeding with $0 tax:', msg);
            void sendOpsAlertEmail({
                subject: 'Stripe Tax calculation FAILED — QR table order charged $0 tax',
                lines: [
                    `Tax calculation failed for a table order at location ${loc.id} (table ${input.table}): ${msg}`,
                    'If this repeats, Stripe Tax is misconfigured — sales tax for this order must be handled manually at filing time.',
                ],
            }).catch(() => undefined);
        }
        const totalCents = subtotalCents + taxCents + tipCents;

        /* Order + items + dine-in fulfillment. Guest User row pattern matches
           checkout: find-or-create by (email, B2C_CUSTOMER). */
        const email = input.contact.email.trim().toLowerCase();
        const name = input.contact.name.trim();
        const order = await prisma.$transaction(async (tx) => {
            let user = await tx.user.findFirst({ where: { email, role: 'B2C_CUSTOMER' }, select: { id: true } });
            if (!user) {
                user = await tx.user.create({
                    data: { email, name, role: 'B2C_CUSTOMER', passwordHash: null },
                    select: { id: true },
                });
            }
            const newOrder = await tx.order.create({
                data: {
                    userId: user.id,
                    orderType: 'B2C',
                    locale: ['en', 'ka', 'ru', 'es'].includes(input.locale ?? '') ? input.locale! : 'en',
                    guestEmail: email,
                    tableNumber: input.table,
                    tipCents,
                    subtotalAmount: (subtotalCents / 100).toFixed(2),
                    shippingAmount: '0.00',
                    taxAmount: (taxCents / 100).toFixed(2),
                    totalAmount: (totalCents / 100).toFixed(2),
                    stripeTaxCalculationId: taxCalculationId,
                    reservationExpiresAt: new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000),
                    notes: `QR table order — Table ${input.table}`,
                },
                select: { id: true },
            });
            const orderItems = await tx.orderItem.createManyAndReturn({
                data: items.map(it => ({
                    orderId: newOrder.id,
                    productId: it.productId,
                    quantity: it.quantity,
                    unitPrice: productMap.get(it.productId)!.priceB2c,
                    taxCents: lineTaxByProduct.get(it.productId) ?? null,
                })),
            });
            const fulfillment = await tx.orderFulfillment.create({
                data: {
                    orderId: newOrder.id,
                    locationId: loc.id,
                    deliveryMethod: 'IN_STORE_DINE_IN',
                    packagingType: 'AMBIENT',
                },
                select: { id: true },
            });
            await tx.orderFulfillmentItem.createMany({
                data: orderItems.map(oi => ({
                    fulfillmentId: fulfillment.id,
                    orderItemId: oi.id,
                    quantity: oi.quantity,
                })),
            });
            return newOrder;
        }, { timeout: 30_000, maxWait: 10_000 });
        orderId = order.id;

        /* Stripe Checkout Session — card-only (a table can't wait days for
           ACH), Connect-routed like every other charge for this location. */
        const destination =
            loc.stripeConnectAccountId &&
            loc.stripeOnboardingStatus === 'complete' &&
            (loc.stripeAccountLivemode ?? false) === isStripeLiveMode()
                ? loc.stripeConnectAccountId
                : null;
        const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const localePrefix = input.locale && input.locale !== 'en' && ['ka', 'ru', 'es'].includes(input.locale) ? `/${input.locale}` : '';
        const token = await signOrderToken(order.id);
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
                ...items.map(it => ({
                    price_data: {
                        currency: 'usd',
                        product_data: { name: productMap.get(it.productId)!.name },
                        unit_amount: Math.round(parseFloat(productMap.get(it.productId)!.priceB2c) * 100),
                    },
                    quantity: it.quantity,
                })),
                ...(taxCents > 0
                    ? [{ price_data: { currency: 'usd', product_data: { name: 'Sales tax' }, unit_amount: taxCents }, quantity: 1 }]
                    : []),
                // Separately-stated voluntary tip — deliberately NOT in the tax
                // calculation above (see TableOrderInput.tipCents).
                ...(tipCents > 0
                    ? [{ price_data: { currency: 'usd', product_data: { name: 'Tip for your server' }, unit_amount: tipCents }, quantity: 1 }]
                    : []),
            ],
            ...(destination ? { payment_intent_data: { transfer_data: { destination }, metadata: { orderId: order.id } } } : { payment_intent_data: { metadata: { orderId: order.id } } }),
            metadata: { kind: 'table_order', orderId: order.id, table: String(input.table) },
            customer_email: email,
            expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_MINUTES * 60,
            success_url: `${site}${localePrefix}/orders/${token}?table=paid`,
            cancel_url: `${site}${localePrefix}/table/${loc.id}/${input.table}`,
        });
        if (!session.url) throw new Error('Stripe returned no session URL');
        // Persisted so webhook-independent recovery (the reservation cron)
        // can ask Stripe about this order even before a PI exists.
        await prisma.order.update({
            where: { id: order.id },
            data: { stripeCheckoutSessionId: session.id },
        });
        return { ok: true, paymentUrl: session.url, orderId: order.id };
    } catch (e) {
        console.error('[table-order] creation failed:', e);
        // Same invariant as abandonCheckoutOrder: win the guarded CANCELLED
        // flip FIRST, release stock only when we won it. If the flip (or the
        // release after a won flip) fails, leave state for the reservation
        // cron — never release without the flip or vice versa.
        if (orderId) {
            try {
                const flipped = await prisma.order.updateMany({
                    where: { id: orderId, paymentStatus: 'UNPAID', orderStatus: { not: 'CANCELLED' } },
                    data: { orderStatus: 'CANCELLED' },
                });
                if (flipped.count === 1) await releaseStock(reservationItems);
            } catch (undoErr) {
                console.error('[table-order] failure-path cleanup failed — reservation cron will recover:', undoErr);
            }
        } else {
            // No order was created — the reservation is ours alone to release.
            await releaseStock(reservationItems).catch(err =>
                console.error('[table-order] reservation release failed (cron cannot see it — check stock):', err));
        }
        return { ok: false, error: 'Could not start the payment. Please try again or order at the counter.' };
    }
}

/** Webhook: the table order was paid. Wire the session's PaymentIntent onto
 *  the order, then hand off to the STANDARD paid pipeline (stock commit, tax
 *  transaction, confirmation email, kitchen alert, KDS visibility). */
export async function applyPaidTableOrder(orderId: string, paymentIntentId: string | null): Promise<void> {
    if (!paymentIntentId) {
        console.error('[table-order] completed session has no payment_intent — cannot process', orderId);
        return;
    }
    await prisma.order.updateMany({
        where: { id: orderId, stripePaymentIntentId: null },
        data: { stripePaymentIntentId: paymentIntentId },
    });
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    const { processPaymentSucceeded } = await import('@/lib/stripe-payment-sync');
    await processPaymentSucceeded(pi);
}
