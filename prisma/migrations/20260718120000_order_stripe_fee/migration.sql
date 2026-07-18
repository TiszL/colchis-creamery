-- Actual Stripe processing fee per charge — powers the tips report card-fee deduction.
ALTER TABLE "Order" ADD COLUMN "stripeFeeCents" INTEGER;
