-- Tier 2 — B2B purchase-order reference.
-- Ship-to, requested-delivery-date, and order notes reuse existing Order
-- columns (shipping*, scheduledFor, notes); only the PO number is new.
ALTER TABLE "Order" ADD COLUMN "poNumber" TEXT;
