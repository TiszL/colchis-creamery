-- Persist the Resolve hosted pay link on the invoice so the partner billing page
-- can re-expose a "Pay invoice" action for any open invoice (not just at order time).
-- Additive / non-destructive.

ALTER TABLE "B2bInvoice" ADD COLUMN "resolvePayUrl" TEXT;
