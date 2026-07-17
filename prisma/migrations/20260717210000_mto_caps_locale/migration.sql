-- Phase 4b: MTO daily caps, order cutoff before close, order locale for emails.
ALTER TABLE "Stock" ADD COLUMN "dailyCap" INTEGER;
ALTER TABLE "Stock" ADD COLUMN "dailySold" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Stock" ADD COLUMN "dailyCountDate" TIMESTAMP(3);
ALTER TABLE "Location" ADD COLUMN "mtoCutoffMinutes" INTEGER;
ALTER TABLE "Order" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
