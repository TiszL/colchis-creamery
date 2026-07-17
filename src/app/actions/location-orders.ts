'use server';

// KDS — location-portal order-queue actions.
//
// The realtime queue client polls fetchLocationQueue and calls the mutation
// actions below. All are gated by assertLocationRole (LOCATION_MANAGER or
// LOCATION_FULFILLMENT at THIS location) + a belongs-to-location check.
//
// Kitchen status flow (OrderFulfillment.status — staff-driven):
//   PENDING (new, unaccepted) → CONFIRMED (accepted; couriers get booked here)
//   → PREPARING → READY → [method-dependent tail]
//     • courier legs (DoorDash/Uber): READY is the kitchen's last step — the
//       courier lifecycle continues in courierStatus via carrier webhooks.
//     • OWN_DELIVERY: READY → OUT_FOR_DELIVERY → DELIVERED (our driver).
//     • IN_STORE_PICKUP / DINE_IN: READY → DELIVERED (handed to customer).
//
// Courier status (OrderFulfillment.courierStatus — carrier-driven) is written
// by dispatchCourierForFulfillment + the DD/Uber webhooks, never by staff.

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { assertLocationRole } from '@/lib/location-rbac';
import { dispatchCourierForFulfillment } from '@/lib/carrier-dispatch';
import { refundOrderFullCore, kitchenRemoveItemsCore, cancelActiveCarrierDeliveries } from '@/lib/order-refund';
import { sendOrderCancelledCustomerEmail, sendOrderItemsRemovedCustomerEmail, sendCancelRequestManagerEmail } from '@/lib/email';
import { BUSINESS_TIMEZONE } from '@/lib/timezone';

const COURIER_METHODS = ['DOORDASH_DRIVE', 'UBER_DIRECT'] as const;

function nextStatusFor(method: string, current: string): string | null {
    const base: Record<string, string> = { PENDING: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'READY' };
    if (base[current]) return base[current];
    if (current === 'READY') {
        if ((COURIER_METHODS as readonly string[]).includes(method)) return null; // courier takes over
        if (method === 'OWN_DELIVERY') return 'OUT_FOR_DELIVERY';
        return 'DELIVERED'; // pickup / dine-in / other: handed over
    }
    if (current === 'OUT_FOR_DELIVERY' && method === 'OWN_DELIVERY') return 'DELIVERED';
    return null;
}

export type QueueItem = {
    id: string;
    orderId: string;
    orderShort: string;
    status: string;
    paymentStatus: string;
    courierStatus: string | null;
    dispatchError: string | null;
    deliveryMethod: string;
    // Packaging requirement persisted at checkout (e.g. "INSULATED_COLD_CHAIN")
    // — packers pick the box from this. Null = no special packaging.
    packagingType: string | null;
    trackingUrl: string | null;
    scheduledFor: string | null;
    acceptedAt: string | null;
    readyAt: string | null;
    createdAt: string;
    customerName: string;
    customerPhone: string | null;
    // Lines with effective (quantity - refundedQuantity) <= 0 are excluded.
    items: {
        orderItemId: string;
        quantity: number;
        refundedQuantity: number;
        name: string;
        sku: string;
        imageUrl: string | null;
        unitPrice: string;
    }[];
    deliveryNotes: string | null;
    orderTotal: string;
    // totalAmount minus all refunds (cents math, floored at $0) — after a
    // kitchen edit the original total is stale money on other tablets.
    orderEffectiveTotal: string;
    hasModifications: boolean;
    orderSubtotal: string | null;
    orderTax: string | null;
    orderNotes: string | null;
    deliveryAddress: string | null;
    accessNote: string | null;
    courierName: string | null;
    courierPhone: string | null;
    courierPickupEtaAt: string | null;
    courierDropoffEtaAt: string | null;
    courierSubstate: string | null;
    // Latest kitchen cancel/refund request (null = none). PENDING renders the
    // manager's approve/decline banner + the requester's "waiting" state.
    cancelRequest: {
        id: string;
        status: string; // PENDING|APPROVED|DECLINED
        reason: string;
        requestedByName: string;
        resolutionNote: string | null;
        createdAt: string;
    } | null;
};

export type QueueSnapshot = { items: QueueItem[]; fetchedAt: string; prepMinutes: number };

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];

export async function fetchLocationQueue(
    locationId: string,
    view: 'active' | 'done' | 'all' = 'active',
): Promise<QueueSnapshot> {
    await assertLocationRole(locationId, ['LOCATION_MANAGER', 'LOCATION_FULFILLMENT']);

    // Kitchen must only ever see orders whose money is settled: fulfillments are
    // created (PENDING) BEFORE payment confirms, and delayed-settlement (ACH)
    // orders can sit unsettled for days — without this filter staff could
    // Accept, cook, and dispatch an order whose payment later bounces.
    const where =
        view === 'active' ? { locationId, status: { in: ACTIVE_STATUSES }, order: { paymentStatus: 'PAID' } }
        : view === 'done' ? { locationId, status: { in: ['DELIVERED', 'CANCELLED'] }, order: { paymentStatus: { in: ['PAID', 'REFUNDED'] } } }
        : { locationId };

    const [rows, location] = await Promise.all([
        prisma.orderFulfillment.findMany({
            where,
            include: {
                order: {
                    select: {
                        id: true, paymentStatus: true, guestEmail: true, guestPhone: true, shippingDeliveryNotes: true,
                        totalAmount: true, subtotalAmount: true, taxAmount: true, notes: true,
                        shippingAddress: true, shippingLine1: true, shippingAddressLine2: true,
                        shippingCity: true, shippingState: true, shippingPostalCode: true,
                        shippingBuildingName: true, shippingAccessCode: true,
                        user: { select: { email: true, name: true, phone: true } },
                        refunds: { select: { amountCents: true } },
                    },
                },
                items: { include: { orderItem: { include: { product: { select: { name: true, sku: true, imageUrl: true } } } } } },
                cancelRequests: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        id: true, status: true, reason: true, requestedByName: true,
                        resolutionNote: true, createdAt: true,
                    },
                },
            },
            orderBy: [{ createdAt: 'desc' }],
            take: view === 'active' ? 100 : 50,
        }),
        prisma.location.findUnique({ where: { id: locationId }, select: { prepMinutes: true } }),
    ]);

    return {
        fetchedAt: new Date().toISOString(),
        prepMinutes: location?.prepMinutes || 25,
        items: rows.map(f => ({
            id: f.id,
            orderId: f.order.id,
            orderShort: f.order.id.slice(0, 8).toUpperCase(),
            status: f.status,
            paymentStatus: f.order.paymentStatus,
            courierStatus: f.courierStatus,
            dispatchError: f.dispatchError,
            deliveryMethod: f.deliveryMethod,
            packagingType: f.packagingType,
            trackingUrl: f.trackingNumber,
            scheduledFor: f.scheduledFor ? f.scheduledFor.toISOString() : null,
            acceptedAt: f.acceptedAt ? f.acceptedAt.toISOString() : null,
            readyAt: f.readyAt ? f.readyAt.toISOString() : null,
            createdAt: f.createdAt.toISOString(),
            customerName: f.order.user?.name ?? f.order.user?.email ?? f.order.guestEmail ?? 'Guest',
            customerPhone: f.order.guestPhone ?? f.order.user?.phone ?? null,
            items: f.items
                .filter(i => i.quantity - i.orderItem.refundedQuantity > 0)
                .map(i => ({
                    orderItemId: i.orderItemId,
                    quantity: i.quantity,
                    refundedQuantity: i.orderItem.refundedQuantity,
                    name: i.orderItem.product.name,
                    sku: i.orderItem.product.sku,
                    imageUrl: i.orderItem.product.imageUrl || null,
                    unitPrice: i.orderItem.unitPrice,
                })),
            deliveryNotes: f.order.shippingDeliveryNotes,
            orderTotal: f.order.totalAmount,
            orderEffectiveTotal: (Math.max(0, toCents(f.order.totalAmount) - f.order.refunds.reduce((s, r) => s + r.amountCents, 0)) / 100).toFixed(2),
            hasModifications: f.order.refunds.length > 0 || f.items.some(i => i.orderItem.refundedQuantity > 0),
            orderSubtotal: f.order.subtotalAmount,
            orderTax: f.order.taxAmount,
            orderNotes: f.order.notes,
            deliveryAddress: composeDeliveryAddress(f.order),
            accessNote: [f.order.shippingBuildingName, f.order.shippingAccessCode ? `Access code: ${f.order.shippingAccessCode}` : null]
                .filter(Boolean).join(' · ') || null,
            courierName: f.courierName,
            courierPhone: f.courierPhone,
            courierPickupEtaAt: f.courierPickupEtaAt ? f.courierPickupEtaAt.toISOString() : null,
            courierDropoffEtaAt: f.courierDropoffEtaAt ? f.courierDropoffEtaAt.toISOString() : null,
            courierSubstate: f.courierSubstate,
            cancelRequest: f.cancelRequests[0]
                ? {
                      id: f.cancelRequests[0].id,
                      status: f.cancelRequests[0].status,
                      reason: f.cancelRequests[0].reason,
                      requestedByName: f.cancelRequests[0].requestedByName,
                      resolutionNote: f.cancelRequests[0].resolutionNote,
                      createdAt: f.cancelRequests[0].createdAt.toISOString(),
                  }
                : null,
        })),
    };
}

// Prefer the structured 9c columns; fall back to the free-text snapshot.
function composeDeliveryAddress(o: {
    shippingLine1: string | null;
    shippingAddressLine2: string | null;
    shippingCity: string | null;
    shippingState: string | null;
    shippingPostalCode: string | null;
    shippingAddress: string | null;
}): string | null {
    if (o.shippingLine1) {
        const street = [o.shippingLine1, o.shippingAddressLine2].filter(Boolean).join(', ');
        const region = [o.shippingState, o.shippingPostalCode].filter(Boolean).join(' ');
        return [street, o.shippingCity, region].filter(Boolean).join(', ');
    }
    return o.shippingAddress;
}

// Dollar-string → integer cents. Order money fields are unprefixed dollar strings.
function toCents(s: string | null | undefined): number {
    return Math.round((parseFloat(s ?? '') || 0) * 100);
}

export type MutationResult =
    | { ok: true; courierError?: string; amountRefunded?: string }
    | { ok: false; error: string };

/**
 * Staff ACCEPT — the kitchen commits to the order. Sets CONFIRMED + acceptedAt,
 * and for courier legs books the driver with pickup_ready = now + prepMinutes
 * so courier arrival converges with food readiness.
 */
export async function acceptFulfillment(fulfillmentId: string, locationId: string): Promise<MutationResult> {
    try {
        await assertLocationRole(locationId, ['LOCATION_MANAGER', 'LOCATION_FULFILLMENT']);
        const f = await prisma.orderFulfillment.findUnique({
            where: { id: fulfillmentId },
            select: { status: true, locationId: true, deliveryMethod: true, externalOrderId: true, location: { select: { prepMinutes: true } }, order: { select: { paymentStatus: true } } },
        });
        if (!f || f.locationId !== locationId) return { ok: false, error: 'Not found' };
        if (f.status !== 'PENDING') return { ok: false, error: `Already ${f.status.toLowerCase()}` };
        // Defense in depth (the queue already filters unpaid orders out): never
        // let staff commit to cooking — or book a courier for — an order whose
        // payment hasn't settled.
        if (f.order.paymentStatus !== 'PAID') {
            return { ok: false, error: 'Payment not settled yet — the order will appear when it is' };
        }

        await prisma.orderFulfillment.update({
            where: { id: fulfillmentId },
            data: { status: 'CONFIRMED', acceptedAt: new Date() },
        });

        // Courier legs: book the driver now, timed to kitchen readiness.
        if ((COURIER_METHODS as readonly string[]).includes(f.deliveryMethod) && !f.externalOrderId) {
            const pickupReadyAt = new Date(Date.now() + (f.location.prepMinutes || 25) * 60 * 1000);
            const result = await dispatchCourierForFulfillment(fulfillmentId, { pickupReadyAt });
            if (!result.ok) {
                // Order stays accepted — kitchen should cook regardless; the queue
                // shows DISPATCH_FAILED with a Retry button.
                return { ok: true, courierError: result.error };
            }
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}

/** Staff advance — one step along the method-aware kitchen flow. */
export async function advanceFulfillment(fulfillmentId: string, locationId: string): Promise<MutationResult> {
    try {
        await assertLocationRole(locationId, ['LOCATION_MANAGER', 'LOCATION_FULFILLMENT']);
        const f = await prisma.orderFulfillment.findUnique({
            where: { id: fulfillmentId },
            select: { status: true, locationId: true, deliveryMethod: true },
        });
        if (!f || f.locationId !== locationId) return { ok: false, error: 'Not found' };
        // Accepting is its own action (it books the courier) — don't allow the
        // generic advance to skip it.
        if (f.status === 'PENDING') return { ok: false, error: 'Use Accept first' };

        const next = nextStatusFor(f.deliveryMethod, f.status);
        if (!next) return { ok: false, error: 'Nothing to advance' };

        await prisma.orderFulfillment.update({
            where: { id: fulfillmentId },
            data: { status: next, ...(next === 'READY' ? { readyAt: new Date() } : {}) },
        });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}

/** Retry a failed courier dispatch (DISPATCH_FAILED → new create attempt). */
export async function retryCourierDispatch(fulfillmentId: string, locationId: string): Promise<MutationResult> {
    try {
        await assertLocationRole(locationId, ['LOCATION_MANAGER', 'LOCATION_FULFILLMENT']);
        const f = await prisma.orderFulfillment.findUnique({
            where: { id: fulfillmentId },
            select: { locationId: true, location: { select: { prepMinutes: true } } },
        });
        if (!f || f.locationId !== locationId) return { ok: false, error: 'Not found' };

        const pickupReadyAt = new Date(Date.now() + (f.location.prepMinutes || 25) * 60 * 1000);
        const result = await dispatchCourierForFulfillment(fulfillmentId, { pickupReadyAt });
        return result.ok ? { ok: true } : { ok: false, error: result.error };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}

/**
 * Re-dispatch after the carrier cancelled (or dispatch failed) — books a FRESH
 * delivery via force:true (overwrites externalOrderId + trackingNumber).
 */
export async function redispatchCourier(fulfillmentId: string, locationId: string): Promise<MutationResult> {
    try {
        await assertLocationRole(locationId, ['LOCATION_MANAGER', 'LOCATION_FULFILLMENT']);
        const f = await prisma.orderFulfillment.findUnique({
            where: { id: fulfillmentId },
            select: { locationId: true, status: true, courierStatus: true, location: { select: { prepMinutes: true } } },
        });
        if (!f || f.locationId !== locationId) return { ok: false, error: 'Not found' };
        if (f.status === 'CANCELLED') return { ok: false, error: 'Order is cancelled — cannot re-dispatch' };
        if (f.courierStatus !== 'CANCELLED' && f.courierStatus !== 'DISPATCH_FAILED') {
            return { ok: false, error: 'Courier is not cancelled — nothing to re-dispatch' };
        }

        const pickupReadyAt = new Date(Date.now() + (f.location.prepMinutes || 25) * 60 * 1000);
        const result = await dispatchCourierForFulfillment(fulfillmentId, { pickupReadyAt, force: true });
        return result.ok ? { ok: true } : { ok: false, error: result.error };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}

// 'YYYY-MM-DD' in the business timezone — lexicographically comparable, so a
// wrong tablet-local TZ can't misjudge what "yesterday" means.
const businessDayFmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: BUSINESS_TIMEZONE,
});

/**
 * Queue hygiene — clear a STALE fulfillment (created before today in the
 * business timezone, not scheduled for the future) off the board. NO refund,
 * NO stock restore, NO customer email: this is for abandoned/test orders left
 * over from previous days. A real order that deserves money back goes through
 * kitchenCancelOrder instead. Any still-live courier is recalled best-effort
 * so a driver isn't sent for a dead order.
 */
export async function clearStaleFulfillment(fulfillmentId: string, locationId: string): Promise<MutationResult> {
    try {
        await assertLocationRole(locationId, ['LOCATION_MANAGER', 'LOCATION_FULFILLMENT']);
        const f = await prisma.orderFulfillment.findUnique({
            where: { id: fulfillmentId },
            select: {
                locationId: true, status: true, createdAt: true, scheduledFor: true,
                deliveryMethod: true, externalOrderId: true,
            },
        });
        if (!f || f.locationId !== locationId) return { ok: false, error: 'Not found' };
        if (!ACTIVE_STATUSES.includes(f.status)) return { ok: false, error: `Already ${f.status.toLowerCase()}` };
        if (f.scheduledFor && f.scheduledFor.getTime() > Date.now()) {
            return { ok: false, error: 'Scheduled for the future — not stale' };
        }
        if (businessDayFmt.format(f.createdAt) >= businessDayFmt.format(new Date())) {
            return { ok: false, error: 'Order is from today — use Accept, or Cancel & refund' };
        }

        try {
            await cancelActiveCarrierDeliveries(
                [{ id: fulfillmentId, deliveryMethod: f.deliveryMethod, externalOrderId: f.externalOrderId, status: f.status }],
                '[clearStaleFulfillment]',
            );
        } catch (e) {
            console.error('[clearStaleFulfillment] courier recall failed:', e);
        }
        await prisma.orderFulfillment.update({ where: { id: fulfillmentId }, data: { status: 'CANCELLED' } });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}

/**
 * "Edit order" — kitchen removes SOME items from a paid order (out of stock,
 * dropped the khachapuri, …): partial Stripe refund + stock restore via
 * kitchenRemoveItemsCore, then a best-effort item-removal email to the
 * customer. LOCATION_MANAGER only — fulfillment staff cannot move money.
 * Removing EVERYTHING is rejected — that's kitchenCancelOrder's job (it also
 * recalls the courier).
 */
export async function kitchenRemoveOrderItems(
    fulfillmentId: string,
    locationId: string,
    removals: { orderItemId: string; quantity: number }[],
    reason: string,
): Promise<MutationResult> {
    try {
        await assertLocationRole(locationId, ['LOCATION_MANAGER']);
        if (removals.length === 0) return { ok: false, error: 'Nothing selected to remove' };

        const f = await prisma.orderFulfillment.findUnique({
            where: { id: fulfillmentId },
            select: {
                locationId: true,
                status: true,
                items: { select: { orderItemId: true, quantity: true, orderItem: { select: { refundedQuantity: true } } } },
                order: {
                    select: {
                        id: true,
                        paymentStatus: true,
                        guestEmail: true,
                        user: { select: { name: true, email: true } },
                        fulfillments: { select: { locationId: true } },
                    },
                },
            },
        });
        if (!f || f.locationId !== locationId) return { ok: false, error: 'Not found' };
        if (f.order.paymentStatus !== 'PAID') {
            return { ok: false, error: 'Order is not paid — nothing to refund' };
        }
        if (f.order.fulfillments.some(x => x.locationId !== locationId)) {
            return { ok: false, error: 'Multi-location order — contact the admin to refund' };
        }
        if (!['PENDING', 'CONFIRMED', 'PREPARING'].includes(f.status)) {
            return { ok: false, error: 'Too late to edit — the order is already past preparing' };
        }

        // Full-removal detection: if the removals cover every remaining
        // effective unit, this is a cancellation in disguise — send the staff
        // to the cancel flow (which also recalls the courier).
        const removeByItem = new Map<string, number>();
        for (const r of removals) {
            removeByItem.set(r.orderItemId, (removeByItem.get(r.orderItemId) ?? 0) + r.quantity);
        }
        const coversEverything = f.items.every(i => {
            const effective = i.quantity - i.orderItem.refundedQuantity;
            return effective <= 0 || (removeByItem.get(i.orderItemId) ?? 0) >= effective;
        });
        if (coversEverything) {
            return { ok: false, error: 'This removes every item — use "Cancel & refund order" instead.' };
        }

        const session = await getSession();
        const result = await kitchenRemoveItemsCore(f.order.id, removals, {
            initiatedByUserId: session?.userId ?? null,
            reason: reason || 'Removed by kitchen',
        });
        if (!result.ok) return { ok: false, error: result.error };

        // Best-effort customer notification — never fail the refund over email.
        const to = f.order.guestEmail ?? f.order.user?.email;
        if (to) {
            try {
                await sendOrderItemsRemovedCustomerEmail({
                    to,
                    name: f.order.user?.name ?? null,
                    orderId: f.order.id,
                    removed: result.removed,
                    amountRefunded: result.amountRefunded,
                    reason: reason || null,
                });
            } catch (e) {
                console.error('[kitchenRemoveOrderItems] customer email failed:', e);
            }
        }
        return { ok: true, amountRefunded: result.amountRefunded };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}

// Shared cancel-&-refund core: full Stripe refund, stock restore, courier
// recall (all inside refundOrderFullCore), then a best-effort cancellation
// email to the customer. NOT exported — 'use server' exports become public
// endpoints; callers below gate the role first. Single-location orders only;
// anything spanning locations goes through the admin refund UI.
async function cancelOrderWithRefund(
    fulfillmentId: string,
    locationId: string,
    reason: string,
    initiatedByUserId: string | null,
): Promise<MutationResult> {
    const f = await prisma.orderFulfillment.findUnique({
        where: { id: fulfillmentId },
        select: {
            locationId: true,
            order: {
                select: {
                    id: true,
                    paymentStatus: true,
                    totalAmount: true,
                    guestEmail: true,
                    user: { select: { email: true, name: true } },
                    fulfillments: { select: { locationId: true } },
                },
            },
        },
    });
    if (!f || f.locationId !== locationId) return { ok: false, error: 'Not found' };
    if (f.order.paymentStatus !== 'PAID') {
        return { ok: false, error: 'Order is not paid — nothing to refund' };
    }
    if (f.order.fulfillments.some(x => x.locationId !== locationId)) {
        return { ok: false, error: 'Multi-location order — contact the admin to refund' };
    }

    const result = await refundOrderFullCore(f.order.id, {
        initiatedByUserId,
        restoreStock: true,
        reason: reason || 'Cancelled by kitchen',
    });
    if (!result.ok) return { ok: false, error: result.error };

    // Best-effort customer notification — never fail the refund over email.
    const to = f.order.guestEmail ?? f.order.user?.email;
    if (to) {
        try {
            await sendOrderCancelledCustomerEmail({
                to,
                name: f.order.user?.name ?? null,
                orderId: f.order.id,
                amount: result.amountRefunded,
                reason: reason || null,
            });
        } catch (e) {
            console.error('[cancelOrderWithRefund] customer email failed:', e);
        }
    }
    return { ok: true };
}

/**
 * "Problem with order" — the manager cancels the ENTIRE order (full refund via
 * cancelOrderWithRefund). LOCATION_MANAGER only — fulfillment staff cannot
 * move money; they file a request via requestCancelOrder instead.
 */
export async function kitchenCancelOrder(
    fulfillmentId: string,
    locationId: string,
    reason: string,
): Promise<MutationResult> {
    try {
        await assertLocationRole(locationId, ['LOCATION_MANAGER']);
        const session = await getSession();
        return await cancelOrderWithRefund(fulfillmentId, locationId, reason, session?.userId ?? null);
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}

/**
 * Kitchen staff can't refund — they ASK. Creates a PENDING OrderCancelRequest
 * (reason required) that managers see inline on the same order card; the
 * requester tracks its status there too. One pending request per fulfillment.
 */
export async function requestCancelOrder(
    fulfillmentId: string,
    locationId: string,
    reason: string,
): Promise<MutationResult> {
    try {
        await assertLocationRole(locationId, ['LOCATION_MANAGER', 'LOCATION_FULFILLMENT']);
        const why = reason.trim();
        if (!why) return { ok: false, error: 'Please write why this order should be cancelled' };

        const f = await prisma.orderFulfillment.findUnique({
            where: { id: fulfillmentId },
            select: {
                locationId: true,
                status: true,
                order: { select: { id: true, paymentStatus: true, totalAmount: true } },
                location: { select: { name: true } },
            },
        });
        if (!f || f.locationId !== locationId) return { ok: false, error: 'Not found' };
        if (f.status === 'DELIVERED' || f.status === 'CANCELLED') {
            return { ok: false, error: `Already ${f.status.toLowerCase()}` };
        }
        if (f.order.paymentStatus !== 'PAID') {
            return { ok: false, error: 'Order is not paid — nothing to refund' };
        }

        const pending = await prisma.orderCancelRequest.findFirst({
            where: { fulfillmentId, status: 'PENDING' },
            select: { id: true },
        });
        if (pending) return { ok: false, error: 'A cancel request is already waiting for a manager' };

        const session = await getSession();
        const requestedByName = session?.name || session?.email || 'Kitchen staff';
        await prisma.orderCancelRequest.create({
            data: {
                fulfillmentId,
                locationId,
                requestedById: session?.userId ?? '',
                requestedByName,
                reason: why,
            },
        });

        // Best-effort manager alert — if nobody with refund rights is watching
        // the queue the request sits while the cook-timer runs. Never fail the
        // request over email.
        try {
            const managers = await prisma.userLocation.findMany({
                where: { locationId, role: 'LOCATION_MANAGER' },
                select: { user: { select: { email: true } } },
            });
            const managerEmails = [...new Set(managers.map(m => m.user.email).filter(Boolean))];
            const fallback = process.env.BAKERY_NOTIFICATION_EMAIL;
            const to = managerEmails.length > 0 ? managerEmails : fallback ? [fallback] : [];
            if (to.length > 0) {
                await sendCancelRequestManagerEmail({
                    to,
                    orderId: f.order.id,
                    orderTotal: f.order.totalAmount,
                    locationId,
                    locationName: f.location.name,
                    requestedByName,
                    reason: why,
                });
            }
        } catch (e) {
            console.error('[requestCancelOrder] manager email failed:', e);
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}

/**
 * Manager resolves a kitchen cancel request. Approve = the SAME full
 * cancel-&-refund as "Problem with order?" (the request is only marked
 * APPROVED after the refund succeeds — a failed refund leaves it PENDING so
 * the manager can retry). Decline = mark DECLINED with an optional note the
 * kitchen sees on the card. LOCATION_MANAGER only.
 */
export async function resolveCancelRequest(
    requestId: string,
    locationId: string,
    approve: boolean,
    note: string,
): Promise<MutationResult> {
    try {
        await assertLocationRole(locationId, ['LOCATION_MANAGER']);
        const req = await prisma.orderCancelRequest.findUnique({
            where: { id: requestId },
            select: { locationId: true, status: true, fulfillmentId: true, reason: true },
        });
        if (!req || req.locationId !== locationId) return { ok: false, error: 'Not found' };
        if (req.status !== 'PENDING') return { ok: false, error: `Already ${req.status.toLowerCase()}` };

        const session = await getSession();
        const resolution = {
            resolvedById: session?.userId ?? null,
            resolvedByName: session?.name || session?.email || null,
            resolutionNote: note.trim() || null,
            resolvedAt: new Date(),
        };

        if (!approve) {
            await prisma.orderCancelRequest.update({
                where: { id: requestId },
                data: { status: 'DECLINED', ...resolution },
            });
            return { ok: true };
        }

        // The customer email prefers the manager's note; falls back to the
        // kitchen's reason so the customer always learns why.
        const result = await cancelOrderWithRefund(
            req.fulfillmentId,
            locationId,
            note.trim() || req.reason,
            session?.userId ?? null,
        );
        if (!result.ok) return result;

        await prisma.orderCancelRequest.update({
            where: { id: requestId },
            data: { status: 'APPROVED', ...resolution },
        });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}
