-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9a — Decouple Category from ProductLine + add Category.sections
--
-- Background: the existing taxonomy is split across SIX fields on Product
-- (category String, kind ProductKind, productLineId, categoryId,
-- productFamilyId, salesChannel). Going forward the canonical user-facing
-- taxonomy is salesChannel + Category. ProductLine stays as an optional
-- marketing-tier flag (Reserve / Classic) but Category no longer requires
-- one — that lets us add things like "Drinks" without inventing a parent
-- line first.
--
-- This migration is ADDITIVE only. It:
--   1. Adds Category.sections (array driving which storefront section the
--      category appears on: 'creamery' | 'bakery' | 'shop' | 'wholesale').
--   2. Makes Category.productLineId nullable (was required).
--   3. Seeds the 8 canonical categories matching the existing ProductKind
--      values, tagged with appropriate sections.
--   4. Backfills Product.categoryId where NULL by mapping from Product.kind.
--
-- ProductKind, Product.category (legacy String), and the eventual NOT NULL
-- on Product.categoryId are left for Phase 9b — that's where storefront
-- filters, shipping packaging logic, and admin form get migrated.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Decouple Category from ProductLine ──────────────────────────────────────
ALTER TABLE "Category" ALTER COLUMN "productLineId" DROP NOT NULL;

-- 2. Add sections array ──────────────────────────────────────────────────────
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "sections" TEXT[] NOT NULL DEFAULT '{}';

-- 3. Seed canonical categories (idempotent — UPSERT on slug) ─────────────────
-- These match the existing ProductKind enum values 1:1 so backfill can map
-- old kind → new category cleanly. Sections drive storefront routing.
INSERT INTO "Category" ("id", "slug", "name", "description", "sections", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'cheese',          'Cheese',          'Aged, fresh, pulled-curd, and brined Georgian cheeses.', ARRAY['creamery']::TEXT[], 10, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'butter',          'Butter',          'Cultured and clarified butters.',                        ARRAY['creamery']::TEXT[], 20, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'spreads',         'Spreads',         'Whey spreads and fresh cheese spreads.',                 ARRAY['creamery']::TEXT[], 30, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'other-dairy',     'Other Dairy',     'Yogurt, kefir, and other cultured dairy.',               ARRAY['creamery']::TEXT[], 40, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'hot-pastries',    'Hot Pastries',    'Khachapuri and other hot baked goods, made fresh daily.', ARRAY['bakery']::TEXT[],  50, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'frozen-bake-off', 'Frozen Bake-Off', 'Frozen ready-to-bake goods for finishing at home.',      ARRAY['bakery']::TEXT[],  60, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'pastries',        'Pastries',        'Sweet and savory pastries.',                             ARRAY['bakery']::TEXT[],  70, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'breads',          'Breads',          'Traditional Georgian and European breads.',              ARRAY['bakery']::TEXT[],  80, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "sections" = EXCLUDED."sections",
  "description" = COALESCE("Category"."description", EXCLUDED."description"),
  "updatedAt" = NOW();

-- 4. Backfill Product.categoryId where NULL ──────────────────────────────────
-- Preserves any existing categoryId. Only fills the gaps using the kind enum.
UPDATE "Product" p SET "categoryId" = c."id"
FROM "Category" c
WHERE p."categoryId" IS NULL AND p."kind"::TEXT = 'CREAMERY_CHEESE'  AND c."slug" = 'cheese';

UPDATE "Product" p SET "categoryId" = c."id"
FROM "Category" c
WHERE p."categoryId" IS NULL AND p."kind"::TEXT = 'CREAMERY_BUTTER'  AND c."slug" = 'butter';

UPDATE "Product" p SET "categoryId" = c."id"
FROM "Category" c
WHERE p."categoryId" IS NULL AND p."kind"::TEXT = 'CREAMERY_SPREAD'  AND c."slug" = 'spreads';

UPDATE "Product" p SET "categoryId" = c."id"
FROM "Category" c
WHERE p."categoryId" IS NULL AND p."kind"::TEXT = 'CREAMERY_OTHER'   AND c."slug" = 'other-dairy';

UPDATE "Product" p SET "categoryId" = c."id"
FROM "Category" c
WHERE p."categoryId" IS NULL AND p."kind"::TEXT = 'BAKERY_HOT'       AND c."slug" = 'hot-pastries';

UPDATE "Product" p SET "categoryId" = c."id"
FROM "Category" c
WHERE p."categoryId" IS NULL AND p."kind"::TEXT = 'BAKERY_FROZEN'    AND c."slug" = 'frozen-bake-off';

UPDATE "Product" p SET "categoryId" = c."id"
FROM "Category" c
WHERE p."categoryId" IS NULL AND p."kind"::TEXT = 'BAKERY_PASTRY'    AND c."slug" = 'pastries';

UPDATE "Product" p SET "categoryId" = c."id"
FROM "Category" c
WHERE p."categoryId" IS NULL AND p."kind"::TEXT = 'BAKERY_BREAD'     AND c."slug" = 'breads';
