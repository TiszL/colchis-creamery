-- QR table ordering: voluntary tips + server accounts/claiming.
ALTER TYPE "LocationRole" ADD VALUE IF NOT EXISTS 'SERVER';
ALTER TABLE "Order" ADD COLUMN "tipCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderFulfillment" ADD COLUMN "serverId" TEXT;
ALTER TABLE "OrderFulfillment" ADD COLUMN "serverName" TEXT;
