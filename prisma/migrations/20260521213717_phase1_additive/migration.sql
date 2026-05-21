-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('LOCAL_HOT', 'LOCAL_COLD', 'NATIONAL_SHIP', 'B2B_WHOLESALE', 'B2B_FROZEN');

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "allowsChannels" "SalesChannel"[] DEFAULT ARRAY[]::"SalesChannel"[];

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "packagingType" TEXT,
ADD COLUMN     "productFamilyId" TEXT,
ADD COLUMN     "salesChannel" "SalesChannel",
ADD COLUMN     "unitCost" TEXT;

-- CreateTable
CREATE TABLE "ProductFamily" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFamily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductFamily_slug_key" ON "ProductFamily"("slug");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productFamilyId_fkey" FOREIGN KEY ("productFamilyId") REFERENCES "ProductFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;
