-- Phase 2b review fixes: reversible amendment tax + DB-enforced single
-- pending edit request per fulfillment (the app check alone is racy).
ALTER TABLE "OrderAmendment" ADD COLUMN "stripeTaxTransactionId" TEXT;
CREATE UNIQUE INDEX "OrderEditRequest_one_pending_per_fulfillment"
    ON "OrderEditRequest"("fulfillmentId") WHERE "status" = 'PENDING';
