-- Phase 2 (order modification): exact per-line tax captured at checkout from
-- the Stripe Tax calculation. Null on legacy orders (refund math pro-rates).
ALTER TABLE "OrderItem" ADD COLUMN "taxCents" INTEGER;
