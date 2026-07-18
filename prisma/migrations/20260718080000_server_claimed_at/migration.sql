-- Audit stamp for table claims (tips steer payroll payouts).
ALTER TABLE "OrderFulfillment" ADD COLUMN "serverClaimedAt" TIMESTAMP(3);
