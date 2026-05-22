"use server";

/**
 * Phase 3 (3c) — Inventory mutations: receive, FIFO consume, expire.
 *
 * All mutations are transactional: every change to Stock.quantity is
 * accompanied by a ProductBatch row and a StockMovement audit row in the
 * same Prisma $transaction so the audit log can't drift from reality.
 */
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { StockMovementType } from "@prisma/client";
import { assertLocationRole } from "@/lib/location-rbac";

interface ReceiveStockInput {
    locationId: string;
    productId: string;
    quantity: number;            // positive int
    lotNumber?: string | null;
    manufacturedAt?: Date | null;
    expiresAt?: Date | null;
    notes?: string | null;
}

/**
 * Receive a new batch at a location.
 *
 * Caller must be MASTER_ADMIN or hold LOCATION_MANAGER role at the target
 * location (enforced by assertLocationRole, which throws on failure).
 *
 * Side effects (single transaction):
 *   1. Create ProductBatch (quantity = initialQuantity = input qty)
 *   2. Write StockMovement type=RECEIVE with quantityDelta = +qty
 *   3. Upsert Stock row at (location, product), incrementing quantity by qty
 *      (creates the row with quantity=qty if it didn't exist)
 */
export async function receiveStockAction(formData: FormData): Promise<{ ok: true; batchId: string } | { ok: false; error: string }> {
    try {
        const locationId = formData.get("locationId") as string;
        const productId  = formData.get("productId") as string;
        const qtyRaw     = formData.get("quantity") as string;
        const lotNumber  = (formData.get("lotNumber") as string | null) || null;
        const mfgRaw     = (formData.get("manufacturedAt") as string | null) || null;
        const expRaw     = (formData.get("expiresAt") as string | null) || null;
        const notes      = (formData.get("notes") as string | null) || null;

        if (!locationId || !productId) return { ok: false, error: "locationId and productId are required" };
        const quantity = parseInt(qtyRaw, 10);
        if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: "quantity must be a positive integer" };

        // RBAC — master admin bypasses inside assertLocationRole.
        const { userId } = await assertLocationRole(locationId, ["LOCATION_MANAGER"]);

        // Parse dates only if present; HTML date inputs return YYYY-MM-DD.
        const manufacturedAt = mfgRaw ? new Date(mfgRaw) : null;
        const expiresAt      = expRaw ? new Date(expRaw) : null;

        const result = await prisma.$transaction(async tx => {
            // Verify product + location pair makes sense (catches typos).
            const [product, location] = await Promise.all([
                tx.product.findUnique({ where: { id: productId }, select: { id: true, isMadeToOrder: true, name: true } }),
                tx.location.findUnique({ where: { id: locationId }, select: { id: true } }),
            ]);
            if (!product) throw new Error("Product not found");
            if (!location) throw new Error("Location not found");
            if (product.isMadeToOrder) throw new Error(`${product.name} is made-to-order; it does not track stock at locations.`);

            const batch = await tx.productBatch.create({
                data: {
                    productId,
                    locationId,
                    lotNumber,
                    manufacturedAt,
                    expiresAt,
                    quantity,
                    initialQuantity: quantity,
                    notes,
                },
            });

            await tx.stockMovement.create({
                data: {
                    batchId: batch.id,
                    productId,
                    locationId,
                    type: StockMovementType.RECEIVE,
                    quantityDelta: quantity,
                    initiatedByUserId: userId,
                    reason: lotNumber ? `Received lot ${lotNumber}` : "Received shipment",
                },
            });

            await tx.stock.upsert({
                where: { locationId_productId: { locationId, productId } },
                update: { quantity: { increment: quantity } },
                create: { locationId, productId, quantity },
            });

            return batch;
        });

        revalidatePath(`/[locale]/location-portal/${locationId}/inventory`, "page");
        revalidatePath(`/[locale]/location-portal/${locationId}`, "page");
        revalidatePath(`/[locale]/admin/inventory`, "page");
        return { ok: true, batchId: result.id };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

/**
 * FIFO-consume `quantity` units of `productId` at `locationId` from the
 * earliest-expiring active batches. Used by the payment webhook (3d) to
 * decrement stock atomically when an order is paid.
 *
 * Writes one StockMovement type=SALE per batch touched, decrements each
 * batch's quantity, and decrements Stock.quantity by the total taken.
 *
 * Returns the per-batch consumption breakdown for traceability. If
 * insufficient stock, throws (caller should treat this as a payment-time
 * failure — the customer was charged but we can't fulfill).
 *
 * The transaction is the responsibility of the caller; this helper accepts
 * a Prisma transaction client so the webhook can include it in a larger
 * atomic block.
 */
export async function fifoConsumeStock(
    tx: Parameters<Parameters<typeof prisma["$transaction"]>[0]>[0],
    productId: string,
    locationId: string,
    quantity: number,
    orderId: string,
): Promise<Array<{ batchId: string; consumed: number }>> {
    if (quantity <= 0) return [];

    // Order by expiresAt ASC NULLS FIRST so legacy unknown-lot stock (from
    // the 3b backfill) drains before dated batches, then by createdAt to
    // tiebreak deterministically within the same expiry.
    const batches = await tx.productBatch.findMany({
        where: { productId, locationId, quantity: { gt: 0 } },
        orderBy: [{ expiresAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
        select: { id: true, quantity: true },
    });

    let remaining = quantity;
    const consumption: Array<{ batchId: string; consumed: number }> = [];

    for (const b of batches) {
        if (remaining <= 0) break;
        const take = Math.min(b.quantity, remaining);
        await tx.productBatch.update({
            where: { id: b.id },
            data: { quantity: { decrement: take } },
        });
        await tx.stockMovement.create({
            data: {
                batchId: b.id,
                productId,
                locationId,
                type: StockMovementType.SALE,
                quantityDelta: -take,
                orderId,
                reason: "Customer order paid",
            },
        });
        consumption.push({ batchId: b.id, consumed: take });
        remaining -= take;
    }

    if (remaining > 0) {
        throw new Error(
            `Insufficient batch stock for product ${productId} at location ${locationId}: ` +
            `needed ${quantity}, only ${quantity - remaining} available in batches.`
        );
    }

    // Decrement the cached Stock aggregate (kept in sync with sum of batches).
    await tx.stock.update({
        where: { locationId_productId: { locationId, productId } },
        data: { quantity: { decrement: quantity } },
    });

    return consumption;
}
