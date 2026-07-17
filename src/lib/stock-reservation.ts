// Stock reservation primitives used by checkout.
//
// Three operations, all atomic via prisma.$transaction:
//   reserveStock  — increment Stock.reservedQuantity (verifies availability)
//   releaseStock  — decrement Stock.reservedQuantity (cancel / timeout)
//   commitStock   — decrement BOTH Stock.quantity AND Stock.reservedQuantity (payment success)
//
// Made-to-order products bypass quantity checks entirely (they have no inventory limit).

import { BUSINESS_TIMEZONE } from '@/lib/timezone';
import { prisma } from './db';
import { Prisma } from '@prisma/client';

// Prisma's default interactive transaction timeout is 5s. With cold Neon and a
// few cart items doing sequential findUnique + update, that can exceed budget.
// 15s is conservative — actual happy-path latency is sub-second once warm.
const TX_TIMEOUT_MS = 15_000;
// Prisma's default maxWait (time to ACQUIRE the tx connection) is only 2s — a
// cold Vercel lambda's pooler handshake can exceed that and fail the checkout
// before the transaction even starts. Shared by all transactions below.
const TX_MAX_WAIT_MS = 10_000;

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

/** Business-day stamp (store timezone) for the MTO daily-cap counters. */
function businessDayStamp(now: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

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

                // MTO products: capacity-bound. When a dailyCap is set, enforce
                // it against the rolled business-day counter; otherwise MTO
                // stays unlimited. reservedQuantity still counts for analytics.
                if (stock.product.isMadeToOrder) {
                    if (stock.dailyCap !== null) {
                        const today = businessDayStamp();
                        const counted = stock.dailyCountDate && businessDayStamp(stock.dailyCountDate) === today
                            ? stock.dailySold
                            : 0;
                        if (counted + item.quantity > stock.dailyCap) {
                            throw new ReservationError(
                                `${stock.product.name}: today's batch is sold out (daily limit ${stock.dailyCap})`,
                                { productId: item.productId, locationId: item.locationId, available: Math.max(0, stock.dailyCap - counted), requested: item.quantity },
                            );
                        }
                    }
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
            // Serializable isolation makes the read-then-increment atomic across
            // concurrent checkouts so two shoppers can't both pass the availability
            // check and oversell. Postgres aborts the loser with P2034 (handled below).
        }, { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return { ok: true };
    } catch (e) {
        if (e instanceof ReservationError) {
            return { ok: false, error: e.message, failingItem: e.failingItem };
        }
        // P2034: serialization failure under contention — a concurrent order
        // touched the same Stock row. Surface as a retryable soft failure.
        if ((e as { code?: string })?.code === 'P2034') {
            return { ok: false, error: 'That item was just updated by another order — please try again.' };
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
    }, { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS });
}

/**
 * Commit a reservation — payment succeeded. Decrement BOTH on-hand quantity and reserved quantity.
 * For made-to-order products, only the reserved counter decreases (no quantity to deduct).
 *
 * Phase 3 (3d): also FIFO-consume the matching ProductBatch rows and write
 * SALE entries to the StockMovement audit log inside the same transaction
 * so the per-lot books and the cached Stock aggregate can't drift.
 *
 * @param items   the reservation items being committed (per-location, per-product, qty)
 * @param opts.orderId  threaded into every SALE movement for traceability
 */
export async function commitStock(
    items: ReservationItem[],
    opts: { orderId?: string | null; onCommitted?: (tx: Prisma.TransactionClient) => Promise<void> } = {},
): Promise<void> {
    if (items.length === 0 && !opts.onCommitted) return;
    const { fifoConsumeStock } = await import('@/app/actions/inventory');
    await prisma.$transaction(async (tx) => {
        for (const item of items) {
            const stock = await tx.stock.findUnique({
                where: { locationId_productId: { locationId: item.locationId, productId: item.productId } },
                include: { product: { select: { isMadeToOrder: true } } },
            });
            if (!stock) continue;

            const data: {
                reservedQuantity: { decrement: number };
                quantity?: { decrement: number };
                dailySold?: number | { increment: number };
                dailyCountDate?: Date;
            } = {
                reservedQuantity: { decrement: Math.min(item.quantity, stock.reservedQuantity) },
            };
            if (!stock.product.isMadeToOrder && stock.quantity !== null) {
                data.quantity = { decrement: item.quantity };
            }
            // Phase 4b — MTO daily-cap counter: roll at the business-day
            // boundary, then count this sale.
            if (stock.product.isMadeToOrder && stock.dailyCap !== null) {
                const today = businessDayStamp();
                const sameDay = stock.dailyCountDate && businessDayStamp(stock.dailyCountDate) === today;
                data.dailySold = sameDay ? { increment: item.quantity } : item.quantity;
                data.dailyCountDate = new Date();
            }
            await tx.stock.update({ where: { id: stock.id }, data });

            // Phase 3: drain batches in FIFO order and write SALE audit
            // entries. MTO products have no batches — skip them. Unattributed
            // remainders are logged as a warning, not thrown, so a stock
            // mismatch never fails a paid order.
            if (!stock.product.isMadeToOrder && stock.quantity !== null) {
                await fifoConsumeStock(tx, item.productId, item.locationId, item.quantity, opts.orderId ?? null);
            }
        }
        // Run the caller's follow-up writes in the SAME transaction so e.g. the
        // order's PAID flip commits atomically with the stock decrement — closing
        // the window where a crash leaves stock committed but the order UNPAID
        // (a Stripe retry would then double-decrement).
        if (opts.onCommitted) await opts.onCommitted(tx);
    }, { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS });
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
 * Build ReservationItems from an order's fulfillment legs, net of units the
 * kitchen already removed + restored (OrderItem.refundedQuantity). Full-refund
 * restore paths that rebuild their list from OrderFulfillmentItem rows must
 * use this — raw leg quantities double-credit stock after a partial item
 * removal (kitchenRemoveItemsCore restores those units immediately).
 *
 * refundedQuantity lives on the OrderItem (order-level) while legs are
 * per-location, so it's subtracted greedily across the item's legs (capped at
 * each leg's own quantity). Item-removal edits are only possible on
 * single-location orders, so the greedy distribution is exact in practice.
 */
export function effectiveReservationItems(
    fulfillments: ReadonlyArray<{
        locationId: string;
        items: ReadonlyArray<{
            orderItemId: string;
            quantity: number;
            orderItem: { productId: string; refundedQuantity: number };
        }>;
    }>,
): ReservationItem[] {
    const remainingByOrderItem = new Map<string, number>();
    const result: ReservationItem[] = [];
    for (const f of fulfillments) {
        for (const it of f.items) {
            if (!remainingByOrderItem.has(it.orderItemId)) {
                remainingByOrderItem.set(it.orderItemId, it.orderItem.refundedQuantity);
            }
            const remaining = remainingByOrderItem.get(it.orderItemId)!;
            const subtract = Math.min(it.quantity, remaining);
            remainingByOrderItem.set(it.orderItemId, remaining - subtract);
            const quantity = it.quantity - subtract;
            if (quantity > 0) {
                result.push({ productId: it.orderItem.productId, locationId: f.locationId, quantity });
            }
        }
    }
    return result;
}

/**
 * Restore previously-committed stock back to inventory.
 *
 * Inverse of `commitStock` for the customer-cancel and admin-refund paths
 * (Phase 7b.5+). Only increments Stock.quantity — reservedQuantity is already
 * at zero (commit decremented it) so we leave it alone. MTO products are
 * skipped because they don't track quantity in the first place.
 *
 * Phase 9c: writes a StockMovement ADJUSTMENT row per restored line so the
 * audit log mirrors the SALE rows that commitStock wrote on the original
 * sale. Batch-level restoration (un-consuming the FIFO'd ProductBatch rows)
 * is deliberately NOT attempted — once a lot was picked + shipped, we treat
 * the inventory accounting as cash-basis and only resurrect the aggregate
 * count. A later phase can revisit if expiry-aware batch restoration matters.
 *
 * Idempotency: not enforced here. Callers must check Order.paymentStatus
 * before invoking, so we never restore stock twice for the same Order.
 *
 * @param items per-(location, product) quantities to credit back
 * @param opts.orderId  threaded into every ADJUSTMENT movement for traceability
 * @param opts.initiatedByUserId  the admin issuing the refund (optional;
 *                                null for system-driven restores like cron)
 */
export async function restoreStock(
    items: ReservationItem[],
    opts: { orderId?: string | null; initiatedByUserId?: string | null } = {},
): Promise<void> {
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

            // Phase 9c: audit row. ADJUSTMENT keeps the StockMovement.type
            // surface honest — we're not "receiving" a new shipment, we're
            // adjusting the count back up after a sale was undone.
            await tx.stockMovement.create({
                data: {
                    type: 'ADJUSTMENT',
                    productId: item.productId,
                    locationId: item.locationId,
                    quantityDelta: item.quantity,
                    orderId: opts.orderId ?? null,
                    initiatedByUserId: opts.initiatedByUserId ?? null,
                    reason: 'REFUND_RESTORE',
                },
            });
        }
    }, { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS });
}
