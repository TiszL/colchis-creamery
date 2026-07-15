-- KDS cancel/refund request workflow: kitchen staff (LOCATION_FULFILLMENT)
-- file a request; a LOCATION_MANAGER approves (full refund) or declines.
-- Requester/resolver names are denormalized (no FK to User) because kitchen
-- accounts can be deleted outright — the audit trail must survive them.
-- status: PENDING | APPROVED | DECLINED (plain text, matching
-- OrderFulfillment.status convention).

CREATE TABLE "OrderCancelRequest" (
    "id" TEXT NOT NULL,
    "fulfillmentId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedByName" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderCancelRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderCancelRequest_fulfillmentId_idx" ON "OrderCancelRequest"("fulfillmentId");

CREATE INDEX "OrderCancelRequest_locationId_status_idx" ON "OrderCancelRequest"("locationId", "status");

ALTER TABLE "OrderCancelRequest" ADD CONSTRAINT "OrderCancelRequest_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "OrderFulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
