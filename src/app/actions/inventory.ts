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
 * earliest-expiring active batches. Used by the Stripe webhook (3d) via
 * commitStock to write SALE audit rows when an order is paid.
 *
 * Writes one StockMovement type=SALE per batch touched and decrements
 * each batch's quantity. Does NOT update Stock.quantity — the caller
 * (commitStock) handles that on the cached aggregate, so this helper can
 * be reused for non-sale consumption paths (waste, adjustment) without
 * always touching Stock.
 *
 * Graceful degradation: if there isn't enough batch stock to cover the
 * request (e.g. SKU never had batches backfilled and Stock.quantity drifted
 * from sum-of-batches), the remainder is written as a single unattributed
 * SALE movement (batchId=null) with a WARNING reason so reconciliation can
 * find and fix it. The webhook never fails on this — the customer's order
 * goes through and the warning is logged for human follow-up.
 *
 * Caller must supply the Prisma transaction client; helper does not open
 * its own.
 */
export async function fifoConsumeStock(
    tx: Parameters<Parameters<typeof prisma["$transaction"]>[0]>[0],
    productId: string,
    locationId: string,
    quantity: number,
    orderId: string | null,
): Promise<{ consumed: Array<{ batchId: string; consumed: number }>; unattributed: number }> {
    if (quantity <= 0) return { consumed: [], unattributed: 0 };

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
        // No batches available — write an unattributed SALE so the audit log
        // captures the consumption anyway. Caller (commitStock) still
        // decrements Stock.quantity from the cached aggregate.
        await tx.stockMovement.create({
            data: {
                batchId: null,
                productId,
                locationId,
                type: StockMovementType.SALE,
                quantityDelta: -remaining,
                orderId,
                reason: `WARNING: ${remaining} unit(s) consumed without batch backing — reconcile (Stock.quantity vs sum(ProductBatch.quantity))`,
            },
        });
        console.warn(
            `[fifoConsumeStock] Unattributed consumption: product=${productId} location=${locationId} remaining=${remaining} orderId=${orderId ?? "(none)"}`,
        );
    }

    return { consumed: consumption, unattributed: remaining };
}
