'use server';

// Server-only wrappers for the DB-touching shipping primitives.
// Pure helpers (applyFreeShippingRule, freeShippingProgress) + all types stay in
// src/lib/shipping.ts so client components can import them without pulling prisma.

import { getShippingQuote as _getShippingQuote, planFulfillment as _planFulfillment } from '@/lib/shipping';
import type { ChannelQuote, FulfillmentPlan, CartItemForShipping, CustomerAddressInfo } from '@/lib/shipping';
import type { FulfillmentChannel, ProductKind } from '@prisma/client';

export async function getShippingQuote(opts: {
    locationId: string;
    channel: FulfillmentChannel;
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
    return _planFulfillment(items, customerLat, customerLng, customerAddress, customerAddressInfo);
}
