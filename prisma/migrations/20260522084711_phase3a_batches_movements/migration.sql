-- Phase 3 (3a) — Inventory: lot/batch tracking + movement audit log.
--
-- Stock (Phase 1) stays as the per-(location, product) aggregate. ProductBatch
-- decomposes it into individual lots so we can track expiry per food safety.
-- StockMovement is the append-only audit log.

CREATE TYPE "StockMovementType" AS ENUM (
    'RECEIVE',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'SALE',
    'RESERVE',
    'RELEASE',
    'ADJUSTMENT',
    'WASTE'
);

CREATE TABLE "ProductBatch" (
    "id"              TEXT NOT NULL,
    "productId"       TEXT NOT NULL,
    "locationId"      TEXT NOT NULL,
    "lotNumber"       TEXT,
    "manufacturedAt"  TIMESTAMP(3),
    "expiresAt"       TIMESTAMP(3),
    "quantity"        INTEGER NOT NULL,
    "initialQuantity" INTEGER NOT NULL,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductBatch_productId_locationId_idx" ON "ProductBatch"("productId", "locationId");
CREATE INDEX "ProductBatch_locationId_expiresAt_idx" ON "ProductBatch"("locationId", "expiresAt");

ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StockMovement" (
    "id"                 TEXT NOT NULL,
    "batchId"            TEXT,
    "productId"          TEXT NOT NULL,
    "locationId"         TEXT NOT NULL,
    "type"               "StockMovementType" NOT NULL,
    "quantityDelta"      INTEGER NOT NULL,
    "fromLocationId"     TEXT,
    "toLocationId"       TEXT,
    "orderId"            TEXT,
    "initiatedByUserId"  TEXT,
    "reason"             TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockMovement_productId_locationId_createdAt_idx"
    ON "StockMovement"("productId", "locationId", "createdAt");
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");
CREATE INDEX "StockMovement_type_createdAt_idx" ON "StockMovement"("type", "createdAt");

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "ProductBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_initiatedByUserId_fkey"
    FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
