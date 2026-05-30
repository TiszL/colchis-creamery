-- Tier 2 — wholesale order constraints on Product.
-- All nullable: null preserves the current simple each-unit ordering with no
-- minimum. caseSize forces whole-case multiples, minOrderQty sets a per-line
-- floor, unitLabel names one unit for display.
ALTER TABLE "Product" ADD COLUMN "b2bCaseSize" INTEGER;
ALTER TABLE "Product" ADD COLUMN "b2bMinOrderQty" INTEGER;
ALTER TABLE "Product" ADD COLUMN "b2bUnitLabel" TEXT;
