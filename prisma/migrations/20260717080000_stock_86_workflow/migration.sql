-- 86 workflow (Phase 1 of the gap-fulfillment plan):
--  * Stock.disabledUntil — self-expiring day-of 86; orderability queries
--    compare against now(), no cron needed to re-enable.
--  * MenuAvailabilityEvent — audit trail for 86s + permanent menu toggles.
ALTER TABLE "Stock" ADD COLUMN "disabledUntil" TIMESTAMP(3);

CREATE TABLE "MenuAvailabilityEvent" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "until" TIMESTAMP(3),
    "byUserId" TEXT,
    "byName" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuAvailabilityEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MenuAvailabilityEvent" ADD CONSTRAINT "MenuAvailabilityEvent_stockId_fkey"
    FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "MenuAvailabilityEvent_locationId_createdAt_idx" ON "MenuAvailabilityEvent"("locationId", "createdAt");
CREATE INDEX "MenuAvailabilityEvent_stockId_idx" ON "MenuAvailabilityEvent"("stockId");
