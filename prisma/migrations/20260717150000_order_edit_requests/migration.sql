-- Phase 2b: order-edit request→approve workflow + upcharge amendments.

CREATE TABLE "OrderEditRequest" (
    "id" TEXT NOT NULL,
    "fulfillmentId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "customerContactedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedByName" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderEditRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderEditRequest_fulfillmentId_idx" ON "OrderEditRequest"("fulfillmentId");
CREATE INDEX "OrderEditRequest_locationId_status_idx" ON "OrderEditRequest"("locationId", "status");
ALTER TABLE "OrderEditRequest" ADD CONSTRAINT "OrderEditRequest_fulfillmentId_fkey"
    FOREIGN KEY ("fulfillmentId") REFERENCES "OrderFulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OrderEditRequestLine" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "orderItemId" TEXT,
    "removeQuantity" INTEGER,
    "addProductId" TEXT,
    "addQuantity" INTEGER,
    "addUnitPrice" TEXT,
    CONSTRAINT "OrderEditRequestLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderEditRequestLine_requestId_idx" ON "OrderEditRequestLine"("requestId");
ALTER TABLE "OrderEditRequestLine" ADD CONSTRAINT "OrderEditRequestLine_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "OrderEditRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OrderAmendment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "requestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "itemsCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeTaxCalculationId" TEXT,
    "paymentUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderAmendment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderAmendment_requestId_key" ON "OrderAmendment"("requestId");
CREATE UNIQUE INDEX "OrderAmendment_stripeCheckoutSessionId_key" ON "OrderAmendment"("stripeCheckoutSessionId");
CREATE INDEX "OrderAmendment_orderId_status_idx" ON "OrderAmendment"("orderId", "status");
ALTER TABLE "OrderAmendment" ADD CONSTRAINT "OrderAmendment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderAmendment" ADD CONSTRAINT "OrderAmendment_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "OrderEditRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD COLUMN "amendmentId" TEXT;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_amendmentId_fkey"
    FOREIGN KEY ("amendmentId") REFERENCES "OrderAmendment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
