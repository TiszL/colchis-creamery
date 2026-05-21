import type { DeliveryMethod } from '@prisma/client';

/**
 * Returns true if a deliveryMethod can fulfill an online cart order.
 * IN_STORE_DINE_IN is a sit-down-only deliveryMethod — those products are eaten at the bakery,
 * not boxed up for pickup or delivery. They must not be addable to an online cart.
 *
 * All other channels (delivery + IN_STORE_PICKUP) result in goods leaving the bakery
 * for a customer who placed an online order, so they are cart-eligible.
 */
export function isCartEligibleChannel(deliveryMethod: DeliveryMethod): boolean {
    return deliveryMethod !== 'IN_STORE_DINE_IN';
}

/**
 * Given the channels a customer can reach for a product, return only those that
 * support an online cart order. Returns an empty array when the product is dine-in-only.
 */
export function cartEligibleChannels(channels: DeliveryMethod[]): DeliveryMethod[] {
    return channels.filter(isCartEligibleChannel);
}
