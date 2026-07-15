-- Launch hardening: escalation stamp for paid orders sitting unaccepted in
-- the kitchen queue (asleep tablet = silent dead order without this).
ALTER TABLE "OrderFulfillment" ADD COLUMN "unacceptedAlertAt" TIMESTAMP(3);
