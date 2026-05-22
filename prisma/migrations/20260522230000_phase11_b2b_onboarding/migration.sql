-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 11 — B2B onboarding hardening
--
-- Two changes, applied together:
--
-- 1. Email-per-role uniqueness on User
--    Drops the old @unique on User.email and replaces it with a compound
--    @@unique([email, role]). The business case: a real person who shops
--    retail AND runs a wholesale account at the same restaurant/shop should
--    be able to keep ONE email across both — currently blocked because the
--    User table treats every row as a separate identity. After this:
--      - (john@x.com, B2C_CUSTOMER) ✓
--      - (john@x.com, B2B_PARTNER)  ✓  ← coexists with the row above
--      - two B2C rows with same email ✗ (still blocked)
--      - two B2B rows with same email ✗ (still blocked)
--    Login flows scope by role so the right account is picked at /login vs
--    /b2b/login.
--
-- 2. AccessCode pending-email-change fields
--    When a B2B invite was sent to one address but the partner wants to
--    register from a different one (e.g. employee applied, owner signs up),
--    we no longer reject the mismatch. Instead the registration triggers a
--    confirmation email to the ORIGINAL invitee with a one-click approve
--    link — clicking that link updates AccessCode.email and unlocks
--    registration for the new address. Adds three nullable columns + an
--    index on the token.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. Drop the single-column unique constraint on User.email.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";

-- 1b. Add the compound uniqueness on (email, role). Prisma name format.
CREATE UNIQUE INDEX "User_email_role_key" ON "User"("email", "role");

-- 2a. AccessCode: staged email-change fields. All nullable; populated only
--     while a change request is pending confirmation.
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "pendingEmail"           TEXT;
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "pendingEmailToken"      TEXT;
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "pendingEmailExpiresAt"  TIMESTAMP(3);
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "pendingEmailRequestedAt" TIMESTAMP(3);

-- 2b. Token must be unique so lookups by token can't collide. Partial index
--     would be tighter but Prisma compatibility favors a plain unique here.
CREATE UNIQUE INDEX IF NOT EXISTS "AccessCode_pendingEmailToken_key"
  ON "AccessCode"("pendingEmailToken");
