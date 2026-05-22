-- Phase 4 (4a) — Stripe Connect routing fields on Location.
--
-- All nullable / additive. When stripeConnectAccountId is null, payments
-- stay on the platform account (current behavior). When set + status is
-- 'complete', checkout creates the PaymentIntent with transfer_data.destination
-- so the charge settles to the location's connected account.

ALTER TABLE "Location"
    ADD COLUMN "stripeConnectAccountId"    TEXT,
    ADD COLUMN "stripeOnboardingStatus"    TEXT,
    ADD COLUMN "stripeOnboardingUpdatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Location_stripeConnectAccountId_key"
    ON "Location"("stripeConnectAccountId")
    WHERE "stripeConnectAccountId" IS NOT NULL;
