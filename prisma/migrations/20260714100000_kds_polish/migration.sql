-- KDS production polish: partial item refunds + courier live-info capture.
-- Hand-written per project convention. All additive.

-- Item-level removals: preserve original quantity for history; track refunded.
ALTER TABLE "OrderItem" ADD COLUMN "refundedQuantity" INTEGER NOT NULL DEFAULT 0;

-- Courier live info (from DD/Uber webhook payloads we previously discarded).
ALTER TABLE "OrderFulfillment" ADD COLUMN "courierName" TEXT;
ALTER TABLE "OrderFulfillment" ADD COLUMN "courierPhone" TEXT;
ALTER TABLE "OrderFulfillment" ADD COLUMN "courierPickupEtaAt" TIMESTAMP(3);
ALTER TABLE "OrderFulfillment" ADD COLUMN "courierDropoffEtaAt" TIMESTAMP(3);
ALTER TABLE "OrderFulfillment" ADD COLUMN "courierSubstate" TEXT;
