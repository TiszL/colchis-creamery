-- ─────────────────────────────────────────────────────────────────────────────
-- Session versioning + B2B resale-certificate storage
--
-- All additive / non-destructive:
--   1. User.sessionVersion — bump to invalidate a user's existing JWT sessions
--      (role change / forced logout). getSession() rejects stale-version tokens.
--   2. B2bPartner resale-certificate fields — store the tax-exemption record so
--      the tax-exempt B2B pricing can be justified (wholesale-for-resale).
-- ─────────────────────────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "B2bPartner" ADD COLUMN "taxExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "B2bPartner" ADD COLUMN "resaleCertificateNumber" TEXT;
ALTER TABLE "B2bPartner" ADD COLUMN "resaleCertificateState" TEXT;
ALTER TABLE "B2bPartner" ADD COLUMN "resaleCertificateExpiresAt" TIMESTAMP(3);
ALTER TABLE "B2bPartner" ADD COLUMN "resaleCertificateUrl" TEXT;
