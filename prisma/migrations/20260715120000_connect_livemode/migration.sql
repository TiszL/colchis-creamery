-- Launch hardening: record which Stripe mode (test vs live) each Connect
-- account was created in. Test-mode acct_ ids don't exist in live mode —
-- injecting one into a live PaymentIntent throws "No such destination" and
-- hard-fails checkout. Existing accounts were all created with test keys.

ALTER TABLE "Location" ADD COLUMN "stripeAccountLivemode" BOOLEAN;

UPDATE "Location"
SET "stripeAccountLivemode" = false
WHERE "stripeConnectAccountId" IS NOT NULL;
