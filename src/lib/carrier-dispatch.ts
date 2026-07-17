// Kitchen-driven courier dispatch (KDS).
//
// One entry point — dispatchCourierForFulfillment — used by:
//   • the location-portal Accept action (primary: staff accept → courier booked
//     with pickup_ready = now + Location.prepMinutes)
//   • the Retry button when a dispatch attempt failed
//   • (future) re-dispatch after a courier-side cancellation
//
// Extracted from the Stripe webhook's payment-time dispatchers: couriers are no
// longer requested at payment (a dasher would race a kitchen that hasn't seen
// the order). The webhook keeps EasyPost/UPS label buying — that's warehouse
// flow, not kitchen flow.
//
// Courier lifecycle lives in OrderFulfillment.courierStatus, SEPARATE from the
// kitchen's `status`, so carrier webhooks never fight staff updates:
//   null → REQUESTED → CONFIRMED (driver assigned) → OUT_FOR_DELIVERY
//        → DELIVERED | CANCELLED;  DISPATCH_FAILED = create-call failed.

import { prisma } from '@/lib/db';
import { doordashCreateDelivery, isDoorDashConfigured } from '@/lib/doordash';
import { uberCreateDelivery, isUberDirectConfigured } from '@/lib/uber-direct';
import { sendCourierIssueOpsEmail } from '@/lib/email';

export type DispatchResult =
    | { ok: true; trackingUrl: string | null; alreadyDispatched?: boolean }
    | { ok: false; error: string };

/** Best-effort split of "line1, city, ST zip" formatted strings into components
 *  (legacy pre-9c orders that only have the free-text snapshot). */
export function parseShippingAddress(formatted: string | null): {
    line1: string; city: string; state: string; postalCode: string; country: string;
} | null {
    if (!formatted) return null;
    const m = formatted.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
    if (!m) return null;
    return { line1: m[1].trim(), city: m[2].trim(), state: m[3].trim(), postalCode: m[4].trim(), country: 'US' };
}

/** Compose driver-facing dropoff instructions from the order's snapshot fields. */
export function combineDropoffInstructions(order: {
    shippingAddressLine2: string | null;
    shippingAccessCode: string | null;
    shippingBuildingName: string | null;
    shippingDeliveryNotes: string | null;
}): string | undefined {
    const parts: string[] = [];
    if (order.shippingAddressLine2) parts.push(`Apt/Suite: ${order.shippingAddressLine2}`);
    if (order.shippingBuildingName) parts.push(`Building: ${order.shippingBuildingName}`);
    if (order.shippingAccessCode) parts.push(`Access code: ${order.shippingAccessCode}`);
    if (order.shippingDeliveryNotes) parts.push(order.shippingDeliveryNotes);
    return parts.length > 0 ? parts.join(' · ') : undefined;
}

/**
 * Request a courier for one fulfillment. Idempotent: an already-dispatched
 * fulfillment (externalOrderId set) returns ok without a second driver.
 *
 * @param opts.pickupReadyAt when the kitchen will have the order handoff-ready;
 *        callers compute it as acceptTime + Location.prepMinutes.
 * @param opts.force skip the idempotency early-return and book a FRESH delivery
 *        (overwrites externalOrderId/trackingNumber) — used to re-dispatch after
 *        a courier-side cancellation. Callers must cancel the old delivery first.
 */
export async function dispatchCourierForFulfillment(
    fulfillmentId: string,
    opts: { pickupReadyAt?: Date; force?: boolean } = {},
): Promise<DispatchResult> {
    const f = await prisma.orderFulfillment.findUnique({
        where: { id: fulfillmentId },
        include: {
            location: true,
            order: { include: { user: { select: { name: true, email: true, phone: true } } } },
            items: { include: { orderItem: { include: { product: { select: { name: true } } } } } },
        },
    });
    if (!f) return { ok: false, error: 'Fulfillment not found' };
    if (f.deliveryMethod !== 'DOORDASH_DRIVE' && f.deliveryMethod !== 'UBER_DIRECT') {
        return { ok: false, error: `Not a courier fulfillment (${f.deliveryMethod})` };
    }
    if (f.externalOrderId && !opts.force) {
        return { ok: true, trackingUrl: f.trackingNumber, alreadyDispatched: true };
    }

    const order = f.order;
    const loc = f.location;

    // Fail-loud on missing phones — carrier validators reject placeholders, and
    // a doomed create call just wastes the API hit.
    const recipientPhone = order.guestPhone || order.user.phone || '';
    if (!loc.phone) {
        return await failDispatch(f, `Pickup location "${loc.name}" has no phone configured — set it in /admin/locations.`);
    }
    if (!recipientPhone) {
        return await failDispatch(f, 'Order has no customer phone (checkout should have required one).');
    }

    const recipientEmail = order.guestEmail || order.user.email || undefined;
    const fullName = (order.user.name || '').trim();
    const firstName = fullName.split(/\s+/)[0] || 'Customer';
    const lastName = fullName.split(/\s+/).slice(1).join(' ') || undefined;
    const instructions = combineDropoffInstructions(order);

    // Per-fulfillment manifest + value in cents (items in this leg only), net of
    // units the kitchen already removed (OrderItem.refundedQuantity) — an order
    // edited before Accept must not book the courier with the removed items or
    // their declared value. refundedQuantity is order-level, but item removal is
    // only possible on single-location orders, so subtracting it here is exact.
    const effectiveLines = f.items
        .map(it => ({ orderItem: it.orderItem, quantity: Math.max(0, it.quantity - it.orderItem.refundedQuantity) }))
        .filter(it => it.quantity > 0);
    const orderValueCents = effectiveLines.reduce((sum, it) => {
        const unit = parseFloat(it.orderItem.unitPrice);
        return isNaN(unit) ? sum : sum + Math.round(unit * 100) * it.quantity;
    }, 0);
    const items = effectiveLines.map(it => ({ name: it.orderItem.product.name, quantity: it.quantity }));

    if (f.deliveryMethod === 'DOORDASH_DRIVE') {
        if (!isDoorDashConfigured()) return await failDispatch(f, 'DoorDash is not configured (missing credentials).');

        const structured = [order.shippingLine1, order.shippingCity, order.shippingState, order.shippingPostalCode];
        const dropoffAddress = structured.every(Boolean) ? structured.join(', ') : (order.shippingAddress || '');
        if (!dropoffAddress) return await failDispatch(f, 'Order has no shipping address.');
        const pickupAddress = [loc.addressLine1, loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ');

        const result = await doordashCreateDelivery({
            externalOrderId: order.id,
            pickup: { address: pickupAddress, phone: loc.phone, businessName: loc.name, instructions: loc.notes || undefined },
            dropoff: { address: dropoffAddress, phone: recipientPhone, firstName, lastName, email: recipientEmail, instructions },
            orderValueCents,
            items,
            pickupReadyAt: opts.pickupReadyAt,
            contactlessDropoff: true, // platform decision: leave at door
        });
        if (!result) return await failDispatch(f, 'DoorDash rejected the delivery request — see server logs.');
        await prisma.orderFulfillment.update({
            where: { id: f.id },
            data: { externalOrderId: result.externalDeliveryId, trackingNumber: result.trackingUrl || null, courierStatus: 'REQUESTED', dispatchError: null },
        });
        return { ok: true, trackingUrl: result.trackingUrl || null };
    }

    // UBER_DIRECT
    if (!isUberDirectConfigured()) return await failDispatch(f, 'Uber Direct is not configured (missing credentials).');
    if (!loc.addressLine1 || !loc.city || !loc.state || !loc.postalCode) {
        return await failDispatch(f, `Pickup location "${loc.name}" is missing address components.`);
    }
    const parsed = order.shippingLine1 && order.shippingCity && order.shippingState && order.shippingPostalCode
        ? { line1: order.shippingLine1, city: order.shippingCity, state: order.shippingState, postalCode: order.shippingPostalCode, country: 'US' }
        : parseShippingAddress(order.shippingAddress);
    if (!parsed) return await failDispatch(f, 'Could not derive a structured shipping address for this order.');

    const result = await uberCreateDelivery({
        externalOrderId: order.id,
        pickup: {
            name: loc.name,
            businessName: loc.name,
            address: { line1: loc.addressLine1, line2: loc.addressLine2 || undefined, city: loc.city, state: loc.state, postalCode: loc.postalCode, country: loc.country || 'US' },
            phone: loc.phone,
            instructions: loc.notes || undefined,
        },
        dropoff: { firstName, lastName, address: parsed, phone: recipientPhone, email: recipientEmail, instructions },
        orderValueCents,
        items,
        pickupReadyAt: opts.pickupReadyAt,
        undeliverableAction: 'leave_at_door', // platform decision
    });
    if (!result) return await failDispatch(f, 'Uber Direct rejected the delivery request — see server logs.');
    await prisma.orderFulfillment.update({
        where: { id: f.id },
        data: { externalOrderId: result.deliveryId, trackingNumber: result.trackingUrl || null, courierStatus: 'REQUESTED', dispatchError: null },
    });
    return { ok: true, trackingUrl: result.trackingUrl || null };
}

/** Record a failed attempt so the portal can show it + offer Retry, then
 *  best-effort alert the location's ops inbox (fallback: global bakery inbox). */
async function failDispatch(
    f: {
        id: string;
        orderId: string;
        deliveryMethod: string;
        location: { id: string; name: string; notificationEmail: string | null };
    },
    error: string,
): Promise<DispatchResult> {
    console.error('[carrier-dispatch]', f.id, '—', error);
    await prisma.orderFulfillment.update({
        where: { id: f.id },
        data: { courierStatus: 'DISPATCH_FAILED', dispatchError: error },
    }).catch(() => undefined);

    const to = f.location.notificationEmail ?? process.env.BAKERY_NOTIFICATION_EMAIL;
    if (to) {
        await sendCourierIssueOpsEmail({
            to,
            orderId: f.orderId,
            locationId: f.location.id,
            locationName: f.location.name,
            carrier: f.deliveryMethod === 'DOORDASH_DRIVE' ? 'DoorDash' : 'Uber Direct',
            issue: error,
            kind: 'DISPATCH_FAILED',
        }).catch((e) => console.warn('[carrier-dispatch] Ops email failed:', e instanceof Error ? e.message : e));
    }
    return { ok: false, error };
}
