-- Tier 2 — B2B Partner Org: multi-location + multi-user.
--
-- Hand-written (CLAUDE.md pattern): `prisma migrate diff` does NOT honor @@map
-- and would emit destructive drift (recreating the DeliveryMethod enum, dropping
-- LocationChannel/OrderFulfillment "channel" columns, User_email_key, etc.).
-- Only the additions below are intended.

-- New scalar FKs on existing tables.
ALTER TABLE "Order" ADD COLUMN "partnerLocationId" TEXT;
ALTER TABLE "RecurringOrderSchedule" ADD COLUMN "partnerLocationId" TEXT;
ALTER TABLE "B2bInvoice" ADD COLUMN "partnerLocationId" TEXT;

-- The partner's own shops (ship-to destinations + optional subcompany billing).
CREATE TABLE "B2bPartnerLocation" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "separateBilling" BOOLEAN NOT NULL DEFAULT false,
    "billingCompanyName" TEXT,
    "billingEin" TEXT,
    "billingEmail" TEXT,
    "billingAddress" TEXT,
    "resolveCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2bPartnerLocation_pkey" PRIMARY KEY ("id")
);

-- Additional human logins under a partner org (owner stays B2bPartner.userId).
CREATE TABLE "B2bPartnerMember" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT,
    "assignedLocationId" TEXT,
    "canViewBilling" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inviteToken" TEXT,
    "inviteExpiry" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2bPartnerMember_pkey" PRIMARY KEY ("id")
);

-- Indexes.
CREATE INDEX "B2bPartnerLocation_partnerId_idx" ON "B2bPartnerLocation"("partnerId");
CREATE UNIQUE INDEX "B2bPartnerMember_userId_key" ON "B2bPartnerMember"("userId");
CREATE UNIQUE INDEX "B2bPartnerMember_inviteToken_key" ON "B2bPartnerMember"("inviteToken");
CREATE INDEX "B2bPartnerMember_partnerId_idx" ON "B2bPartnerMember"("partnerId");
CREATE INDEX "B2bPartnerMember_assignedLocationId_idx" ON "B2bPartnerMember"("assignedLocationId");
CREATE INDEX "Order_partnerLocationId_idx" ON "Order"("partnerLocationId");
CREATE INDEX "B2bInvoice_partnerLocationId_idx" ON "B2bInvoice"("partnerLocationId");

-- Foreign keys.
ALTER TABLE "B2bPartnerLocation" ADD CONSTRAINT "B2bPartnerLocation_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "B2bPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "B2bPartnerMember" ADD CONSTRAINT "B2bPartnerMember_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "B2bPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "B2bPartnerMember" ADD CONSTRAINT "B2bPartnerMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "B2bPartnerMember" ADD CONSTRAINT "B2bPartnerMember_assignedLocationId_fkey" FOREIGN KEY ("assignedLocationId") REFERENCES "B2bPartnerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "B2bInvoice" ADD CONSTRAINT "B2bInvoice_partnerLocationId_fkey" FOREIGN KEY ("partnerLocationId") REFERENCES "B2bPartnerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringOrderSchedule" ADD CONSTRAINT "RecurringOrderSchedule_partnerLocationId_fkey" FOREIGN KEY ("partnerLocationId") REFERENCES "B2bPartnerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerLocationId_fkey" FOREIGN KEY ("partnerLocationId") REFERENCES "B2bPartnerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
