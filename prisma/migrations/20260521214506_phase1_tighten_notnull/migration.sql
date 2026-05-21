/*
  Warnings:

  - Made the column `productFamilyId` on table `Product` required. This step will fail if there are existing NULL values in that column.
  - Made the column `salesChannel` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_productFamilyId_fkey";

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "productFamilyId" SET NOT NULL,
ALTER COLUMN "salesChannel" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productFamilyId_fkey" FOREIGN KEY ("productFamilyId") REFERENCES "ProductFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
