-- ─────────────────────────────────────────────────────────────────────────────
-- Perf indexes + Stripe webhook event-idempotency (post-audit P3)
--
-- All additive / non-destructive:
--   1. Indexes on Order (userId FK + orderStatus/paymentStatus hot filters) and
--      OrderItem (orderId/productId FKs) — the audit flagged these as missing.
--   2. ProcessedStripeEvent table — event-level idempotency for the Stripe
--      webhook (PK = Stripe event.id). Belt-and-suspenders on top of the atomic
--      commit + PAID-flip already in place.
-- Index names match Prisma's @@index defaults so `migrate status` stays clean.
-- ─────────────────────────────────────────────────────────────────────────────

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_orderStatus_idx" ON "Order"("orderStatus");
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateTable
CREATE TABLE "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);
