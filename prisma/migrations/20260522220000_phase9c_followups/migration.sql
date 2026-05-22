-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9c — follow-up cleanups
--
-- Two additive changes that unblock several real-world flows:
--
--   1. Stock.isEnabled — per-location menu toggle. Defaults to TRUE so existing
--      stock rows stay visible; location managers can hide a SKU at their
--      location without losing the stock count via /location-portal/[id]/menu.
--
--   2. Order.shipping{Line1,City,State,PostalCode} — structured address
--      snapshot at order time. Replaces the fragile free-text parser in
--      lib/shipping/uber-direct address-info derivation. Old orders keep
--      shippingAddress only; readers prefer the new columns when present.
--
-- Both columns are additive + nullable (or default-true) → safe to deploy
-- ahead of the application code, which reads with COALESCE-style fallbacks.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Stock" ADD COLUMN IF NOT EXISTS "isEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingLine1"      TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingCity"       TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingState"      TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingPostalCode" TEXT;
