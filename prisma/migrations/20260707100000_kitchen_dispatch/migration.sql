-- Kitchen dispatch (KDS) — bakery-driven courier dispatch.
-- Hand-written per project convention (migrate dev is non-interactive here).

-- Per-location kitchen settings.
ALTER TABLE "Location" ADD COLUMN "prepMinutes" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "Location" ADD COLUMN "notificationEmail" TEXT;

-- Courier lifecycle tracked separately from the kitchen's status so carrier
-- webhooks never fight staff updates + kitchen timing metrics.
ALTER TABLE "OrderFulfillment" ADD COLUMN "courierStatus" TEXT;
ALTER TABLE "OrderFulfillment" ADD COLUMN "dispatchError" TEXT;
ALTER TABLE "OrderFulfillment" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "OrderFulfillment" ADD COLUMN "readyAt" TIMESTAMP(3);
