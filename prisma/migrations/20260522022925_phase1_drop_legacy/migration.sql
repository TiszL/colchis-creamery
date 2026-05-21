-- Phase 1 (1i) — drop the Product.house legacy column.
--
-- Product.house was a legacy classification column ('CREAMERY' default)
-- fully superseded by Product.kind (ProductKind enum) since the
-- introduction of multi-channel inventory. No code path reads it after the
-- Phase 1 channel model lands.
--
-- ProductChannel removal is deferred to a follow-up — the catalog UI still
-- reads it for "offered channels" chips (e.g. dine-in only). Once the UI
-- derives chips from Location.allowsChannels + LocationDeliveryMethod
-- instead, ProductChannel can go via a second migration.

ALTER TABLE "Product" DROP COLUMN "house";
