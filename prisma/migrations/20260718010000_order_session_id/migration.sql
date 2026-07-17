-- QR table ordering: persist the Checkout Session id for webhook-independent rescue.
ALTER TABLE "Order" ADD COLUMN "stripeCheckoutSessionId" TEXT;
CREATE UNIQUE INDEX "Order_stripeCheckoutSessionId_key" ON "Order"("stripeCheckoutSessionId");
