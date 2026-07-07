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
import { assertLocationRole } from '@/lib/location-rbac';
import { dispatchCourierForFulfillment } from '@/lib/carrier-dispatch';

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
    courierStatus: string | null;
    dispatchError: string | null;
    deliveryMethod: string;
    trackingUrl: string | null;
    scheduledFor: string | null;
    acceptedAt: string | null;
    readyAt: string | null;
    createdAt: string;
    customerName: string;
    customerPhone: string | null;
    items: { quantity: number; name: string; sku: string }[];
    deliveryNotes: string | null;
};

export type QueueSnapshot = { items: QueueItem[]; fetchedAt: string };

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];

export async function fetchLocationQueue(
    locationId: string,
    view: 'active' | 'done' | 'all' = 'active',
): Promise<QueueSnapshot> {
    await assertLocationRole(locationId, ['LOCATION_MANAGER', 'LOCATION_FULFILLMENT']);

    const where =
        view === 'active' ? { locationId, status: { in: ACTIVE_STATUSES } }
        : view === 'done' ? { locationId, status: { in: ['DELIVERED', 'CANCELLED'] } }
        : { locationId };

    const rows = await prisma.orderFulfillment.findMany({
        where,
        include: {
            order: {
                select: {
                    id: true, guestEmail: true, guestPhone: true, shippingDeliveryNotes: true,
                    user: { select: { email: true, name: true, phone: true } },
                },
            },
            items: { include: { orderItem: { include: { product: { select: { name: true, sku: true } } } } } },
        },
        orderBy: [{ createdAt: 'asc' }],
        take: view === 'active' ? 100 : 50,
    });

    return {
        fetchedAt: new Date().toISOString(),
        items: rows.map(f => ({
            id: f.id,
            orderId: f.order.id,
            orderShort: f.order.id.slice(0, 8).toUpperCase(),
            status: f.status,
            courierStatus: f.courierStatus,
            dispatchError: f.dispatchError,
            deliveryMethod: f.deliveryMethod,
            trackingUrl: f.trackingNumber,
            scheduledFor: f.scheduledFor ? f.scheduledFor.toISOString() : null,
            acceptedAt: f.acceptedAt ? f.acceptedAt.toISOString() : null,
            readyAt: f.readyAt ? f.readyAt.toISOString() : null,
            createdAt: f.createdAt.toISOString(),
            customerName: f.order.user?.name ?? f.order.user?.email ?? f.order.guestEmail ?? 'Guest',
            customerPhone: f.order.guestPhone ?? f.order.user?.phone ?? null,
            items: f.items.map(i => ({ quantity: i.quantity, name: i.orderItem.product.name, sku: i.orderItem.product.sku })),
            deliveryNotes: f.order.shippingDeliveryNotes,
        })),
    };
}

export type MutationResult = { ok: true; courierError?: string } | { ok: false; error: string };

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
            select: { status: true, locationId: true, deliveryMethod: true, externalOrderId: true, location: { select: { prepMinutes: true } } },
        });
        if (!f || f.locationId !== locationId) return { ok: false, error: 'Not found' };
        if (f.status !== 'PENDING') return { ok: false, error: `Already ${f.status.toLowerCase()}` };

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
