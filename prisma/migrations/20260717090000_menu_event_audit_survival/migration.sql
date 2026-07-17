-- Review follow-up: a deleted Stock row must not erase its availability
-- audit history (locationId/productId are denormalized on the event for
-- exactly this). Cascade -> SetNull.
ALTER TABLE "MenuAvailabilityEvent" ALTER COLUMN "stockId" DROP NOT NULL;
ALTER TABLE "MenuAvailabilityEvent" DROP CONSTRAINT "MenuAvailabilityEvent_stockId_fkey";
ALTER TABLE "MenuAvailabilityEvent" ADD CONSTRAINT "MenuAvailabilityEvent_stockId_fkey"
    FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
