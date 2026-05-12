// Stock reservation primitives used by checkout.
//
// Three operations, all atomic via prisma.$transaction:
//   reserveStock  — increment Stock.reservedQuantity (verifies availability)
//   releaseStock  — decrement Stock.reservedQuantity (cancel / timeout)
//   commitStock   — decrement BOTH Stock.quantity AND Stock.reservedQuantity (payment success)
//
// Made-to-order products bypass quantity checks entirely (they have no inventory limit).

import { prisma } from './db';

// Prisma's default interactive transaction timeout is 5s. With cold Neon and a
// few cart items doing sequential findUnique + update, that can exceed budget.
// 15s is conservative — actual happy-path latency is sub-second once warm.
const TX_TIMEOUT_MS = 15_000;

export type ReservationItem = {
    productId: string;
    locationId: string;
    quantity: number;
};

export type ReserveResult =
    | { ok: true }
    | { ok: false; error: string; failingItem?: { productId: string; locationId: string; available: number; requested: number } };

/**
 * Atomically reserve stock for the given items. Either ALL items reserve or none do.
 * Made-to-order products skip the quantity check (they're capacity-bound, not stock-bound).
 */
export async function reserveStock(items: ReservationItem[]): Promise<ReserveResult> {
    if (items.length === 0) return { ok: true };

    try {
        await prisma.$transaction(async (tx) => {
            for (const item of items) {
                // Lookup Stock row + product MTO flag in a single query
                const stock = await tx.stock.findUnique({
                    where: { locationId_productId: { locationId: item.locationId, productId: item.productId } },
                    include: { product: { select: { isMadeToOrder: true, name: true } } },
                });

                if (!stock) {
                    throw new ReservationError(
                        `Product not stocked at the requested location`,
                        { productId: item.productId, locationId: item.locationId, available: 0, requested: item.quantity },
                    );
                }

                // MTO products: no quantity gate, just record the reservation count for analytics
                if (stock.product.isMadeToOrder) {
                    await tx.stock.update({
                        where: { id: stock.id },
                        data: { reservedQuantity: { increment: item.quantity } },
                    });
                    continue;
                }

                // Tracked products: verify available stock is enough
                const onHand = stock.quantity ?? 0;
                const reserved = stock.reservedQuantity;
                const available = onHand - reserved;
                if (available < item.quantity) {
                    throw new ReservationError(
                        `${stock.product.name}: only ${available} left (you requested ${item.quantity})`,
                        { productId: item.productId, locationId: item.locationId, available, requested: item.quantity },
                    );
                }

                await tx.stock.update({
                    where: { id: stock.id },
                    data: { reservedQuantity: { increment: item.quantity } },
                });
            }
        }, { timeout: TX_TIMEOUT_MS });
        return { ok: true };
    } catch (e) {
        if (e instanceof ReservationError) {
            return { ok: false, error: e.message, failingItem: e.failingItem };
        }
        throw e;
    }
}

/**
 * Release a previous reservation (decrement reservedQuantity).
 * Idempotent-ish: if reservedQuantity would go below 0 it's clamped to 0 by Prisma's
 * runtime, but we still log the discrepancy via a console.warn for visibility.
 */
export async function releaseStock(items: ReservationItem[]): Promise<void> {
    if (items.length === 0) return;
    await prisma.$transaction(async (tx) => {
        for (const item of items) {
            const stock = await tx.stock.findUnique({
                where: { locationId_productId: { locationId: item.locationId, productId: item.productId } },
                select: { id: true, reservedQuantity: true },
            });
            if (!stock) continue;
            const newReserved = Math.max(0, stock.reservedQuantity - item.quantity);
            if (newReserved !== stock.reservedQuantity - item.quantity) {
                console.warn('[stock-reservation] Released more than reserved — clamped to 0', {
                    productId: item.productId, locationId: item.locationId, requested: item.quantity, was: stock.reservedQuantity,
                });
            }
            await tx.stock.update({ where: { id: stock.id }, data: { reservedQuantity: newReserved } });
        }
    }, { timeout: TX_TIMEOUT_MS });
}

/**
 * Commit a reservation — payment succeeded. Decrement BOTH on-hand quantity and reserved quantity.
 * For made-to-order products, only the reserved counter decreases (no quantity to deduct).
 */
export async function commitStock(items: ReservationItem[]): Promise<void> {
    if (items.length === 0) return;
    await prisma.$transaction(async (tx) => {
        for (const item of items) {
            const stock = await tx.stock.findUnique({
                where: { locationId_productId: { locationId: item.locationId, productId: item.productId } },
                include: { product: { select: { isMadeToOrder: true } } },
            });
            if (!stock) continue;

            const data: { reservedQuantity: { decrement: number }; quantity?: { decrement: number } } = {
                reservedQuantity: { decrement: Math.min(item.quantity, stock.reservedQuantity) },
            };
            if (!stock.product.isMadeToOrder && stock.quantity !== null) {
                data.quantity = { decrement: item.quantity };
            }
            await tx.stock.update({ where: { id: stock.id }, data });
        }
    }, { timeout: TX_TIMEOUT_MS });
}

class ReservationError extends Error {
    failingItem: { productId: string; locationId: string; available: number; requested: number };
    constructor(message: string, failingItem: ReservationError['failingItem']) {
        super(message);
        this.name = 'ReservationError';
        this.failingItem = failingItem;
    }
}

/**
 * Restore previously-committed stock back to inventory.
 *
 * Inverse of `commitStock` for the customer-cancel and admin-refund paths
 * (Phase 7b.5+). Only increments Stock.quantity — reservedQuantity is already
 * at zero (commit decremented it) so we leave it alone. MTO products are
 * skipped because they don't track quantity in the first place.
 *
 * Idempotency: not enforced here. Callers must check Order.paymentStatus
 * before invoking, so we never restore stock twice for the same Order.
 */
export async function restoreStock(items: ReservationItem[]): Promise<void> {
    if (items.length === 0) return;
    await prisma.$transaction(async (tx) => {
        for (const item of items) {
            const stock = await tx.stock.findUnique({
                where: { locationId_productId: { locationId: item.locationId, productId: item.productId } },
                include: { product: { select: { isMadeToOrder: true } } },
            });
            if (!stock) continue;
            // MTO products have no quantity counter — nothing to restore.
            if (stock.product.isMadeToOrder || stock.quantity === null) continue;
            await tx.stock.update({
                where: { id: stock.id },
                data: { quantity: { increment: item.quantity } },
            });
        }
    }, { timeout: TX_TIMEOUT_MS });
}
