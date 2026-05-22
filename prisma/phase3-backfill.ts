/**
 * Phase 3 (3b) backfill — one-shot script.
 *
 * For every existing Stock row with a positive quantity, create one
 * ProductBatch row representing that quantity as a single "unknown lot"
 * (no manufacturedAt / expiresAt / lotNumber). Also write a StockMovement
 * row of type RECEIVE so the audit timeline starts from a known reference.
 *
 * MTO rows (Stock.quantity = null) are skipped — they aren't tracked as
 * inventory.
 *
 * Idempotent: re-running is safe. Skips any (productId, locationId) that
 * already has a ProductBatch row.
 *
 * Usage:
 *   set -a && source ./.env.local && set +a
 *   npx tsx prisma/phase3-backfill.ts
 *
 * Safe to delete after Phase 3 ships and a fresh seed has run.
 */
import { PrismaClient, StockMovementType } from '@prisma/client';

const p = new PrismaClient();

async function main() {
    console.log('--- Phase 3 (3b) backfill — Stock → ProductBatch + StockMovement ---');

    const stocks = await p.stock.findMany({
        where: { quantity: { not: null, gt: 0 } },
        select: { id: true, productId: true, locationId: true, quantity: true, product: { select: { sku: true, name: true } } },
    });
    console.log(`Found ${stocks.length} Stock row(s) with positive quantity.`);

    let createdBatches = 0;
    let skippedExisting = 0;
    let writtenMovements = 0;

    for (const s of stocks) {
        const qty = s.quantity!;
        // Skip if a batch already exists for this (product, location) pair.
        const existing = await p.productBatch.findFirst({
            where: { productId: s.productId, locationId: s.locationId },
            select: { id: true },
        });
        if (existing) {
            skippedExisting += 1;
            continue;
        }

        // Single transaction: create batch + write RECEIVE movement.
        await p.$transaction(async tx => {
            const batch = await tx.productBatch.create({
                data: {
                    productId: s.productId,
                    locationId: s.locationId,
                    quantity: qty,
                    initialQuantity: qty,
                    notes: 'Phase 3 backfill — pre-existing stock with no known lot/expiry',
                },
            });
            await tx.stockMovement.create({
                data: {
                    batchId: batch.id,
                    productId: s.productId,
                    locationId: s.locationId,
                    type: StockMovementType.RECEIVE,
                    quantityDelta: qty,
                    reason: 'Phase 3 backfill: opening balance',
                },
            });
        });
        createdBatches += 1;
        writtenMovements += 1;
        console.log(`  ${s.product.sku} ${s.product.name}  qty=${qty}  → batch + RECEIVE movement`);
    }

    console.log(`✓ ${createdBatches} batch(es) created, ${writtenMovements} movement(s) written, ${skippedExisting} row(s) skipped (already had a batch).`);

    // Sanity check: every positive-quantity Stock row should now have at least one batch.
    const stillBare = await p.stock.count({
        where: {
            quantity: { not: null, gt: 0 },
            product: { batches: { none: {} } },
        },
    });
    if (stillBare > 0) {
        console.error(`⚠️  ${stillBare} positive-quantity Stock row(s) still have no associated batch.`);
        process.exit(1);
    }
    console.log('✓ All positive-quantity Stock rows have at least one batch.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => p.$disconnect());
