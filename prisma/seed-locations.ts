// Phase 1 seed — multi-location fulfillment foundation.
// - Creates 2 starter locations: Bakery (Dublin OH) + Cold Warehouse (Columbus OH placeholder).
// - Configures each location's supported FulfillmentChannels with radii / drive-hour caps.
// - Backfills: copies Product.house -> Product.kind for existing rows.
// - Backfills: creates a Stock row per existing creamery product at the Cold Warehouse,
//   using the legacy Product.stockQuantity as the per-location quantity.
// - Backfills: registers UPS_GROUND_2DAY as the eligible channel for each existing creamery product.
//
// Idempotent: safe to re-run. Find-or-create on locations by (type + addressLine1).

import { PrismaClient, LocationType, FulfillmentChannel, ProductKind } from "@prisma/client";

const prisma = new PrismaClient();

// Find an existing location of `type` (assumes one-per-type in Phase 1).
// If the existing row still has the seed placeholder address (starts with "TBD"),
// update its address fields. Otherwise leave it alone — assume admin has edited it.
async function upsertLocationByType(opts: {
  type: LocationType;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  latitude?: number | null;
  longitude?: number | null;
  hours?: Record<string, string> | null;
  notes?: string | null;
}) {
  const existing = await prisma.location.findFirst({ where: { type: opts.type } });
  if (existing) {
    const isPlaceholder = existing.addressLine1.startsWith("TBD") || existing.addressLine1.startsWith("PLACEHOLDER");
    const needsCoords = existing.latitude === null || existing.longitude === null;
    if (isPlaceholder) {
      const updated = await prisma.location.update({
        where: { id: existing.id },
        data: {
          name: opts.name,
          addressLine1: opts.addressLine1,
          city: opts.city,
          state: opts.state,
          postalCode: opts.postalCode,
          latitude: opts.latitude ?? null,
          longitude: opts.longitude ?? null,
          hours: opts.hours ?? undefined,
          notes: opts.notes ?? null,
        },
      });
      console.log(`  ~ location updated (was placeholder): ${updated.name} (${updated.id})`);
      return updated;
    }
    if (needsCoords && opts.latitude !== undefined && opts.longitude !== undefined) {
      const updated = await prisma.location.update({
        where: { id: existing.id },
        data: { latitude: opts.latitude, longitude: opts.longitude },
      });
      console.log(`  ~ location coords backfilled: ${updated.name} (${updated.latitude}, ${updated.longitude})`);
      return updated;
    }
    console.log(`  → location exists (admin-edited, leaving alone): ${existing.name} (${existing.id})`);
    return existing;
  }
  const created = await prisma.location.create({
    data: {
      name: opts.name,
      type: opts.type,
      addressLine1: opts.addressLine1,
      city: opts.city,
      state: opts.state,
      postalCode: opts.postalCode,
      country: "US",
      latitude: opts.latitude ?? null,
      longitude: opts.longitude ?? null,
      hours: opts.hours ?? undefined,
      notes: opts.notes ?? null,
    },
  });
  console.log(`  + location created: ${created.name} (${created.id})`);
  return created;
}

async function setChannel(
  locationId: string,
  channel: FulfillmentChannel,
  cfg: { radiusMiles?: number | null; maxDriveHours?: number | null; priceMultiplier?: number; flatFee?: string | null }
) {
  await prisma.locationChannel.upsert({
    where: { locationId_channel: { locationId, channel } },
    update: {
      radiusMiles: cfg.radiusMiles ?? null,
      maxDriveHours: cfg.maxDriveHours ?? null,
      priceMultiplier: cfg.priceMultiplier ?? 1.0,
      flatFee: cfg.flatFee ?? null,
    },
    create: {
      locationId,
      channel,
      radiusMiles: cfg.radiusMiles ?? null,
      maxDriveHours: cfg.maxDriveHours ?? null,
      priceMultiplier: cfg.priceMultiplier ?? 1.0,
      flatFee: cfg.flatFee ?? null,
    },
  });
  console.log(`    • channel: ${channel}  radius=${cfg.radiusMiles ?? "∅"}  drive=${cfg.maxDriveHours ?? "∅"}h`);
}

async function main() {
  console.log("\n=== Phase 1 seed: locations + backfills ===\n");

  // ─── 1) Cold Warehouse (D2C, UPS 2-day, ~20h drive radius) ────────────────
  // Fake nearby address for testing. Admin will replace with the real warehouse
  // address via /admin/locations once Phase 2 ships.
  console.log("Cold Warehouse (D2C cold-chain):");
  const coldWh = await upsertLocationByType({
    type: LocationType.D2C_COLD_WAREHOUSE,
    name: "Cold Warehouse — Dublin OH",
    addressLine1: "5300 Frantz Rd",
    city: "Dublin",
    state: "OH",
    postalCode: "43017",
    latitude: 40.0856,   // ~5300 Frantz Rd Dublin OH — refine via /admin/locations w/ Places API
    longitude: -83.1311,
    notes: "Fake testing address near the bakery. Replace with real cold-storage address via /admin/locations.",
  });
  await setChannel(coldWh.id, FulfillmentChannel.UPS_GROUND_2DAY, {
    radiusMiles: null,
    maxDriveHours: 20.0, // user-specified ~20h drive radius from Columbus
    priceMultiplier: 1.0,
  });

  // ─── 2) Bakery #1 — 84 N High St, Dublin OH ───────────────────────────────
  //
  // Radius rationale (suburban Ohio):
  //   - Hot food: 30-40 min order-to-door = ~20-30 min drive + 10 min prep.
  //     At ~15-20 mph effective speed → ~7-12 mi. Using 12 mi as max efficient hot zone.
  //   - DoorDash Drive / Uber Direct: platform delivers both hot and cold.
  //     20 mi covers most of metro Columbus. Per-product time gates (Phase 3+)
  //     will tighten this for hot items.
  //   - In-store: no radius (customer drives to us).
  //
  // PRODUCTION NOTE: static radius is an approximation. For accurate ETAs, swap to
  // Google Distance Matrix API at quote time (~$5/1000 calls).
  console.log("\nBakery #1 (Dublin OH):");
  const bakery = await upsertLocationByType({
    type: LocationType.BAKERY,
    name: "Bakery — Dublin OH",
    addressLine1: "84 N High St",
    city: "Dublin",
    state: "OH",
    postalCode: "43017",
    latitude: 40.0992,    // 84 N High St Dublin OH — approx; refine via /admin/locations w/ Places API
    longitude: -83.1141,
    hours: {
      mon: "07:00-21:00",
      tue: "07:00-21:00",
      wed: "07:00-21:00",
      thu: "07:00-21:00",
      fri: "07:00-22:00",
      sat: "08:00-22:00",
      sun: "08:00-20:00",
    },
    notes: "First bakery. Refine lat/lng via /admin/locations + Places autocomplete.",
  });

  await setChannel(bakery.id, FulfillmentChannel.HOT_DELIVERY_OWN, {
    radiusMiles: 12.0, // ~40 min delivery window for hot food in suburban traffic
    priceMultiplier: 1.0,
  });
  await setChannel(bakery.id, FulfillmentChannel.DOORDASH_DRIVE, {
    radiusMiles: 20.0, // covers hot + cold; hot will be gated per-product later
    priceMultiplier: 1.0, // own-platform pricing (API-only, lower fee)
  });
  await setChannel(bakery.id, FulfillmentChannel.UBER_DIRECT, {
    radiusMiles: 20.0,
    priceMultiplier: 1.0,
  });
  await setChannel(bakery.id, FulfillmentChannel.IN_STORE_PICKUP, {
    radiusMiles: null,
    priceMultiplier: 1.0,
  });
  await setChannel(bakery.id, FulfillmentChannel.IN_STORE_DINE_IN, {
    radiusMiles: null,
    priceMultiplier: 1.0,
  });

  // ─── 3) Backfill Product.kind from legacy Product.house ────────────────────
  // ONLY runs for products that still have the default kind (CREAMERY_CHEESE) — we
  // never overwrite a more specific kind that's already been set by a later seed.
  console.log("\nBackfilling Product.kind from legacy 'house' (default-only):");
  const allProducts = await prisma.product.findMany();
  let kindUpdated = 0;
  for (const p of allProducts) {
    if (p.kind !== ProductKind.CREAMERY_CHEESE) continue; // respect explicit kinds set elsewhere
    const house = (p.house || "CREAMERY").toUpperCase();
    if (house === "BAKERY") {
      await prisma.product.update({ where: { id: p.id }, data: { kind: ProductKind.BAKERY_PASTRY } });
      kindUpdated++;
    }
  }
  console.log(`  ${kindUpdated} product(s) updated.`);

  // ─── 4) Backfill Stock rows + ProductChannel for existing creamery products ──
  console.log("\nBackfilling Stock rows at Cold Warehouse + UPS_GROUND_2DAY channel:");
  let stockCreated = 0;
  let channelCreated = 0;
  for (const p of allProducts) {
    const isCreamery = p.kind.startsWith("CREAMERY");
    if (!isCreamery) continue;

    // Stock at Cold Warehouse — use legacy stockQuantity as initial value
    const existingStock = await prisma.stock.findUnique({
      where: { locationId_productId: { locationId: coldWh.id, productId: p.id } },
    });
    if (!existingStock) {
      await prisma.stock.create({
        data: {
          locationId: coldWh.id,
          productId: p.id,
          quantity: p.stockQuantity,
        },
      });
      stockCreated++;
    }

    // UPS_GROUND_2DAY channel for creamery products (D2C nationwide)
    const existingChan = await prisma.productChannel.findUnique({
      where: { productId_channel: { productId: p.id, channel: FulfillmentChannel.UPS_GROUND_2DAY } },
    });
    if (!existingChan) {
      await prisma.productChannel.create({
        data: { productId: p.id, channel: FulfillmentChannel.UPS_GROUND_2DAY },
      });
      channelCreated++;
    }
  }
  console.log(`  ${stockCreated} stock row(s) created, ${channelCreated} product-channel link(s) created.`);

  // ─── Summary ──────────────────────────────────────────────────────────────
  const locCount = await prisma.location.count();
  const chanCount = await prisma.locationChannel.count();
  const stockCount = await prisma.stock.count();
  const pcCount = await prisma.productChannel.count();
  console.log("\n=== Phase 1 seed summary ===");
  console.log(`  Locations:         ${locCount}`);
  console.log(`  LocationChannels:  ${chanCount}`);
  console.log(`  Stock rows:        ${stockCount}`);
  console.log(`  ProductChannels:   ${pcCount}`);
  console.log("\nDone.\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
