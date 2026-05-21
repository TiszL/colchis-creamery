'use server';

// Server-only wrappers for the DB-touching shipping primitives.
// Pure helpers (applyFreeShippingRule, freeShippingProgress) + all types stay in
// src/lib/shipping.ts so client components can import them without pulling prisma.

import { getShippingQuote as _getShippingQuote, planFulfillment as _planFulfillment } from '@/lib/shipping';
import type { ChannelQuote, FulfillmentPlan, CartItemForShipping, CustomerAddressInfo } from '@/lib/shipping';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import type { DeliveryMethod, ProductKind } from '@prisma/client';

export async function getShippingQuote(opts: {
    locationId: string;
    deliveryMethod: DeliveryMethod;
    customerLat: number;
    customerLng: number;
    productKind: ProductKind;
}): Promise<ChannelQuote | null> {
    return _getShippingQuote(opts);
}

export async function planFulfillment(
    items: CartItemForShipping[],
    customerLat: number,
    customerLng: number,
    customerAddress?: string,
    customerAddressInfo?: CustomerAddressInfo,
): Promise<FulfillmentPlan> {
    // Phase 9: look up the session user's phone so live carrier quotes can use
    // a real phone instead of a placeholder DD rejects. Guests have no
    // session → customerPhone stays undefined → DD/Uber quotes fall back to
    // LocationChannel.flatFee. Doesn't leak: we only ever pass the OWN user's
    // phone for THEIR cart's quote calls.
    let customerPhone: string | undefined;
    const session = await getSession();
    if (session?.userId) {
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { phone: true },
        });
        customerPhone = user?.phone ?? undefined;
    }
    return _planFulfillment(items, customerLat, customerLng, customerAddress, customerAddressInfo, customerPhone);
}
