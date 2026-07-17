-- Phase 4a: structured dietary/allergen badges on products.
ALTER TABLE "Product" ADD COLUMN "dietaryTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
