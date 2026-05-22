-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9b — Drop ProductKind + legacy Product.category; tighten categoryId
--
-- Builds on 9a: now that every Product has a Category and admin can manage
-- categories with section tags, we can retire the legacy taxonomy:
--   - Drop Product.kind (and ProductKind enum)
--   - Drop Product.category (legacy "cheese" String)
--   - Tighten Product.categoryId to NOT NULL (9a backfill made this safe)
--   - Add Category.packagingMode for shipping logic that used to read .kind
--     (values: 'HOT' | 'COLD' | 'AMBIENT'; null treated as AMBIENT)
--
-- Safety:
--   - The categoryId NOT NULL is preceded by a safety-net fallback that
--     assigns the 'cheese' category to anything still NULL after 9a.
--   - Application code is updated in the same commit; nothing reads kind
--     after this lands.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Category packaging mode (additive; backfill from existing seed categories) ───
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "packagingMode" TEXT;

UPDATE "Category" SET "packagingMode" = 'COLD'    WHERE "slug" IN ('cheese', 'butter', 'spreads', 'other-dairy', 'frozen-bake-off');
UPDATE "Category" SET "packagingMode" = 'HOT'     WHERE "slug" = 'hot-pastries';
UPDATE "Category" SET "packagingMode" = 'AMBIENT' WHERE "slug" IN ('pastries', 'breads');

-- 2. Final safety-net: any Product without a categoryId gets 'cheese' (pre-overhaul default) ───
UPDATE "Product" p SET "categoryId" = (SELECT "id" FROM "Category" WHERE "slug" = 'cheese' LIMIT 1)
WHERE p."categoryId" IS NULL;

-- 3. Tighten categoryId to NOT NULL ──────────────────────────────────────────
ALTER TABLE "Product" ALTER COLUMN "categoryId" SET NOT NULL;

-- 4. Drop the legacy 'category' String column ────────────────────────────────
ALTER TABLE "Product" DROP COLUMN IF EXISTS "category";

-- 5. Drop the kind column ────────────────────────────────────────────────────
ALTER TABLE "Product" DROP COLUMN IF EXISTS "kind";

-- 6. Drop the ProductKind enum type ──────────────────────────────────────────
DROP TYPE IF EXISTS "ProductKind";
