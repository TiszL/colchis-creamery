-- Phase 6 (6a) — B2B platform schema.

CREATE TYPE "B2bPaymentMethod" AS ENUM (
    'STRIPE_CARD',
    'STRIPE_ACH',
    'RESOLVE_NET_7',
    'RESOLVE_NET_15',
    'RESOLVE_NET_30',
    'RESOLVE_NET_45'
);

CREATE TYPE "B2bInvoiceStatus" AS ENUM (
    'PENDING',
    'PAID',
    'OVERDUE',
    'WRITTEN_OFF'
);

CREATE TABLE "B2bPartner" (
    "id"                            TEXT NOT NULL,
    "userId"                        TEXT NOT NULL,
    "companyName"                   TEXT NOT NULL,
    "businessAddress"               TEXT,
    "ein"                           TEXT,
    "resolveCustomerId"             TEXT,
    "resolveCreditLimitCents"       INTEGER,
    "resolveCreditApproved"         BOOLEAN NOT NULL DEFAULT false,
    "resolveStatusUpdatedAt"        TIMESTAMP(3),
    "assignedSalesUserId"           TEXT,
    "defaultFulfillmentLocationId"  TEXT,
    "notes"                         TEXT,
    "createdAt"                     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "B2bPartner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "B2bPartner_userId_key" ON "B2bPartner"("userId");
CREATE INDEX        "B2bPartner_assignedSalesUserId_idx" ON "B2bPartner"("assignedSalesUserId");

ALTER TABLE "B2bPartner" ADD CONSTRAINT "B2bPartner_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "B2bPartner" ADD CONSTRAINT "B2bPartner_assignedSalesUserId_fkey"
    FOREIGN KEY ("assignedSalesUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "B2bPartner" ADD CONSTRAINT "B2bPartner_defaultFulfillmentLocationId_fkey"
    FOREIGN KEY ("defaultFulfillmentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "B2bInvoice" (
    "id"                  TEXT NOT NULL,
    "orderId"             TEXT NOT NULL,
    "partnerId"           TEXT NOT NULL,
    "amountCents"         INTEGER NOT NULL,
    "paymentMethod"       "B2bPaymentMethod" NOT NULL,
    "resolveInvoiceId"    TEXT,
    "resolveStatus"       TEXT,
    "issuedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt"               TIMESTAMP(3),
    "paidAt"              TIMESTAMP(3),
    "status"              "B2bInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "notes"               TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "B2bInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "B2bInvoice_orderId_key" ON "B2bInvoice"("orderId");
CREATE INDEX        "B2bInvoice_partnerId_status_idx" ON "B2bInvoice"("partnerId", "status");
CREATE INDEX        "B2bInvoice_status_dueAt_idx" ON "B2bInvoice"("status", "dueAt");

ALTER TABLE "B2bInvoice" ADD CONSTRAINT "B2bInvoice_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "B2bInvoice" ADD CONSTRAINT "B2bInvoice_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "B2bPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RecurringOrderSchedule" (
    "id"                    TEXT NOT NULL,
    "partnerId"             TEXT NOT NULL,
    "name"                  TEXT NOT NULL,
    "active"                BOOLEAN NOT NULL DEFAULT true,
    "intervalDays"          INTEGER NOT NULL,
    "nextFireAt"            TIMESTAMP(3) NOT NULL,
    "itemsJson"             TEXT NOT NULL,
    "paymentMethod"         "B2bPaymentMethod" NOT NULL,
    "fulfillmentLocationId" TEXT,
    "lastFiredAt"           TIMESTAMP(3),
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecurringOrderSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecurringOrderSchedule_active_nextFireAt_idx"
    ON "RecurringOrderSchedule"("active", "nextFireAt");
CREATE INDEX "RecurringOrderSchedule_partnerId_idx"
    ON "RecurringOrderSchedule"("partnerId");

ALTER TABLE "RecurringOrderSchedule" ADD CONSTRAINT "RecurringOrderSchedule_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "B2bPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringOrderSchedule" ADD CONSTRAINT "RecurringOrderSchedule_fulfillmentLocationId_fkey"
    FOREIGN KEY ("fulfillmentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
