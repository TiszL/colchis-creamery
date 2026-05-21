-- Phase 2 (2a) — Per-location operator roles.
--
-- A user can hold multiple roles at one location and roles across multiple
-- locations. Additive to User.role (global role unchanged). MASTER_ADMIN
-- bypasses this table entirely (sees + does everything via global role).

CREATE TYPE "LocationRole" AS ENUM ('LOCATION_MANAGER', 'LOCATION_FULFILLMENT', 'B2B_SALES_MANAGER');

CREATE TABLE "UserLocation" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "role"       "LocationRole" NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserLocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserLocation_userId_idx" ON "UserLocation"("userId");
CREATE INDEX "UserLocation_locationId_idx" ON "UserLocation"("locationId");
CREATE UNIQUE INDEX "UserLocation_userId_locationId_role_key"
    ON "UserLocation"("userId", "locationId", "role");

ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
