'use server';

// Server-only wrappers for the DB-touching shipping primitives.
// Pure helpers (applyFreeShippingRule, freeShippingProgress) + all types stay in
// src/lib/shipping.ts so client components can import them without pulling prisma.

import { getShippingQuote as _getShippingQuote, planFulfillment as _planFulfillment } from '@/lib/shipping';
import type { ChannelQuote, FulfillmentPlan, CartItemForShipping, CustomerAddressInfo } from '@/lib/shipping';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import type { DeliveryMethod } from '@prisma/client';
import { normalizeUSPhone } from '@/lib/phone';

export async function getShippingQuote(opts: {
    locationId: string;
    deliveryMethod: DeliveryMethod;
    customerLat: number;
    customerLng: number;
    // Phase 9b: packaging mode from Category.packagingMode (was ProductKind).
    packagingMode: string | null;
}): Promise<ChannelQuote | null> {
    return _getShippingQuote(opts);
}

export async function planFulfillment(
    items: CartItemForShipping[],
    customerLat: number,
    customerLng: number,
    customerAddress?: string,
    customerAddressInfo?: CustomerAddressInfo,
    guestPhone?: string,
): Promise<FulfillmentPlan> {
    // Live carrier quotes (DoorDash/Uber) require a real dropoff phone —
    // without one they fall back to LocationChannel.flatFee, which is exactly
    // the "every delivery shows $7.00" bug: GUESTS (no session) never got live
    // quotes even after typing their phone at checkout. Session phone wins;
    // otherwise the guest's typed phone is normalized server-side and used for
    // THEIR OWN cart's quote only.
    let customerPhone: string | undefined;
    const session = await getSession();
    if (session?.userId) {
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { phone: true },
        });
        customerPhone = user?.phone ?? undefined;
    }
    if (!customerPhone && guestPhone) {
        customerPhone = normalizeUSPhone(guestPhone) ?? undefined;
    }
    return _planFulfillment(items, customerLat, customerLng, customerAddress, customerAddressInfo, customerPhone);
}
