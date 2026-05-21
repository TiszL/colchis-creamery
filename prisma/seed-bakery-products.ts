// Phase 4 — migrate the hardcoded BakeryClient DEFAULT_HOT and DEFAULT_FROZEN arrays
// into real Product rows tied to the Bakery location, with proper channel eligibility
// and Stock rows.
//
// Channel rules (from business model):
//   - Hot Adjaruli: IN_STORE only (no delivery — too fragile / signature dine-in dish)
//   - Other hot items: OWN_DELIVERY + DOORDASH_DRIVE + UBER_DIRECT + IN_STORE_*
//   - Frozen items: DOORDASH_DRIVE + UBER_DIRECT + IN_STORE_PICKUP (NO nationwide UPS)
//
// Idempotent: upserts by Product.sku.
// Lossy: the original constants had `ka` (Georgian name) and `tag` ("Vegan", "Bestseller", etc.)
// fields. Product schema has no equivalents, so these are dropped here. A future i18n / tags
// phase can restore them.

import { PrismaClient, ProductKind, DeliveryMethod, LocationType } from "@prisma/client";

const prisma = new PrismaClient();

const HOT_DELIVERABLE_CHANNELS: DeliveryMethod[] = [
    DeliveryMethod.OWN_DELIVERY,
    DeliveryMethod.DOORDASH_DRIVE,
    DeliveryMethod.UBER_DIRECT,
    DeliveryMethod.IN_STORE_PICKUP,
    DeliveryMethod.IN_STORE_DINE_IN,
];

const HOT_IN_STORE_ONLY_CHANNELS: DeliveryMethod[] = [
    DeliveryMethod.IN_STORE_DINE_IN,
    DeliveryMethod.IN_STORE_PICKUP,
];

const FROZEN_CHANNELS: DeliveryMethod[] = [
    DeliveryMethod.DOORDASH_DRIVE,
    DeliveryMethod.UBER_DIRECT,
    DeliveryMethod.IN_STORE_PICKUP,
];

type BakeryItem = {
    sku: string;
    name: string;
    nameKa: string;
    slug: string;
    description: string;
    weight: string;
    priceB2c: string;
    priceB2b: string;
    kind: ProductKind;
    isMadeToOrder: boolean;
    tag: string | null;
    channels: DeliveryMethod[];
    initialStock: number | null; // null = made-to-order (no stock tracked)
    imageUrl: string;
};

const HOT_ITEMS: BakeryItem[] = [
    {
        sku: "BK-ADJ-HOT-001",
        name: "Adjaruli (Hot)",
        nameKa: "აჭარული",
        slug: "adjaruli-hot",
        description: "Boat-shaped, egg yolk, melted butter, sulguni & imeruli inside. Signature dine-in dish — best eaten the moment it leaves our oven.",
        weight: "520g",
        priceB2c: "16.00",
        priceB2b: "12.00",
        kind: ProductKind.BAKERY_HOT,
        isMadeToOrder: true,
        tag: "Bestseller",
        channels: HOT_IN_STORE_ONLY_CHANNELS,
        initialStock: null,
        imageUrl: "/images/bakery/adjaruli.jpg",
    },
    {
        sku: "BK-IMR-HOT-002",
        name: "Imeruli (Hot)",
        nameKa: "იმერული",
        slug: "imeruli-hot",
        description: "Round, sulguni-stuffed, blistered top.",
        weight: "480g",
        priceB2c: "14.00",
        priceB2b: "10.00",
        kind: ProductKind.BAKERY_HOT,
        isMadeToOrder: true,
        tag: null,
        channels: HOT_DELIVERABLE_CHANNELS,
        initialStock: null,
        imageUrl: "/images/bakery/imeruli.jpg",
    },
    {
        sku: "BK-MGR-HOT-003",
        name: "Megruli (Hot)",
        nameKa: "მეგრული",
        slug: "megruli-hot",
        description: "Imeruli with a second layer of sulguni baked over the crust.",
        weight: "560g",
        priceB2c: "17.00",
        priceB2b: "13.00",
        kind: ProductKind.BAKERY_HOT,
        isMadeToOrder: true,
        tag: null,
        channels: HOT_DELIVERABLE_CHANNELS,
        initialStock: null,
        imageUrl: "/images/bakery/megruli.jpg",
    },
    {
        sku: "BK-LOB-HOT-004",
        name: "Lobiani (Hot)",
        nameKa: "ლობიანი",
        slug: "lobiani-hot",
        description: "Filled with spiced kidney beans — the day-after-the-feast classic. Vegan.",
        weight: "440g",
        priceB2c: "13.00",
        priceB2b: "9.00",
        kind: ProductKind.BAKERY_HOT,
        isMadeToOrder: true,
        tag: "Vegan",
        channels: HOT_DELIVERABLE_CHANNELS,
        initialStock: null,
        imageUrl: "/images/bakery/lobiani.jpg",
    },
    {
        sku: "BK-PEN-HOT-005",
        name: "Penovani (Hot)",
        nameKa: "ფენოვანი",
        slug: "penovani-hot",
        description: "Layered, flaky pastry version with sulguni.",
        weight: "380g",
        priceB2c: "12.00",
        priceB2b: "8.00",
        kind: ProductKind.BAKERY_HOT,
        isMadeToOrder: true,
        tag: null,
        channels: HOT_DELIVERABLE_CHANNELS,
        initialStock: null,
        imageUrl: "/images/bakery/penovani.jpg",
    },
    {
        sku: "BK-ACH-HOT-006",
        name: "Achma (Hot)",
        nameKa: "აჩმა",
        slug: "achma-hot",
        description: "Many-layered baked pasta-meets-cheese tray slice.",
        weight: "420g",
        priceB2c: "15.00",
        priceB2b: "11.00",
        kind: ProductKind.BAKERY_HOT,
        isMadeToOrder: true,
        tag: "Limited",
        channels: HOT_DELIVERABLE_CHANNELS,
        initialStock: null,
        imageUrl: "/images/bakery/achma.jpg",
    },
];

const FROZEN_ITEMS: BakeryItem[] = [
    {
        sku: "BK-ADJ-FRZ-2PK-007",
        name: "Adjaruli · 2-pk (Frozen)",
        nameKa: "აჭარული",
        slug: "adjaruli-frozen-2pk",
        description: "Frozen at peak. Bake from frozen in 18 min at 425°F.",
        weight: "520g × 2",
        priceB2c: "24.00",
        priceB2b: "18.00",
        kind: ProductKind.BAKERY_FROZEN,
        isMadeToOrder: false,
        tag: "Ships local",
        channels: FROZEN_CHANNELS,
        initialStock: 20,
        imageUrl: "/images/bakery/adjaruli-frozen.jpg",
    },
    {
        sku: "BK-IMR-FRZ-2PK-008",
        name: "Imeruli · 2-pk (Frozen)",
        nameKa: "იმერული",
        slug: "imeruli-frozen-2pk",
        description: "The classic, frozen. Bake at 425°F.",
        weight: "480g × 2",
        priceB2c: "22.00",
        priceB2b: "16.00",
        kind: ProductKind.BAKERY_FROZEN,
        isMadeToOrder: false,
        tag: "Ships local",
        channels: FROZEN_CHANNELS,
        initialStock: 20,
        imageUrl: "/images/bakery/imeruli-frozen.jpg",
    },
    {
        sku: "BK-MGR-FRZ-2PK-009",
        name: "Megruli · 2-pk (Frozen)",
        nameKa: "მეგრული",
        slug: "megruli-frozen-2pk",
        description: "Cheese on cheese, frozen. Bake at 425°F.",
        weight: "560g × 2",
        priceB2c: "26.00",
        priceB2b: "20.00",
        kind: ProductKind.BAKERY_FROZEN,
        isMadeToOrder: false,
        tag: "Ships local",
        channels: FROZEN_CHANNELS,
        initialStock: 15,
        imageUrl: "/images/bakery/megruli-frozen.jpg",
    },
    {
        sku: "BK-LOB-FRZ-2PK-010",
        name: "Lobiani · 2-pk (Frozen)",
        nameKa: "ლობიანი",
        slug: "lobiani-frozen-2pk",
        description: "Bean-filled, vegan, freezer-stable.",
        weight: "440g × 2",
        priceB2c: "20.00",
        priceB2b: "14.00",
        kind: ProductKind.BAKERY_FROZEN,
        isMadeToOrder: false,
        tag: "Vegan",
        channels: FROZEN_CHANNELS,
        initialStock: 20,
        imageUrl: "/images/bakery/lobiani-frozen.jpg",
    },
];

async function upsertBakeryProduct(item: BakeryItem, bakeryLocationId: string) {
    // 0. Ensure ProductFamily exists (1:1 by slug for seeded items; admin can
    //    merge later via families UI). salesChannel defaults to LOCAL_COLD via
    //    schema @default; bakery items get LOCAL_HOT below.
    const family = await prisma.productFamily.upsert({
        where: { slug: item.slug },
        update: {},
        create: {
            slug: item.slug,
            name: item.name,
            description: item.description.slice(0, 500),
            imageUrl: item.imageUrl,
        },
    });
    const isBakeryHotKind = item.kind === "BAKERY_HOT" || item.kind === "BAKERY_PASTRY" || item.kind === "BAKERY_BREAD";
    const seedSalesChannel = item.kind === "BAKERY_FROZEN" ? "B2B_FROZEN" : (isBakeryHotKind ? "LOCAL_HOT" : "LOCAL_COLD");

    // 1. Upsert Product by sku
    const product = await prisma.product.upsert({
        where: { sku: item.sku },
        update: {
            name: item.name,
            nameKa: item.nameKa,
            slug: item.slug,
            description: item.description,
            weight: item.weight,
            priceB2c: item.priceB2c,
            priceB2b: item.priceB2b,
            kind: item.kind,
            isMadeToOrder: item.isMadeToOrder,
            tag: item.tag,
            imageUrl: item.imageUrl,
            stockQuantity: item.initialStock ?? 0,
            isB2cVisible: true,
            isB2bVisible: false, // bakery products are not B2B by default (per user: B2B handled separately)
            status: "ACTIVE",
            isActive: true,
        },
        create: {
            sku: item.sku,
            name: item.name,
            nameKa: item.nameKa,
            slug: item.slug,
            description: item.description,
            weight: item.weight,
            priceB2c: item.priceB2c,
            priceB2b: item.priceB2b,
            kind: item.kind,
            salesChannel: seedSalesChannel,
            isMadeToOrder: item.isMadeToOrder,
            tag: item.tag,
            imageUrl: item.imageUrl,
            stockQuantity: item.initialStock ?? 0,
            category: "bakery",
            isB2cVisible: true,
            isB2bVisible: false,
            status: "ACTIVE",
            isActive: true,
            productFamilyId: family.id,
        },
    });

    // 2. Replace ProductChannel set
    await prisma.productChannel.deleteMany({ where: { productId: product.id } });
    if (item.channels.length > 0) {
        await prisma.productChannel.createMany({
            data: item.channels.map(ch => ({ productId: product.id, channel: ch })),
            skipDuplicates: true,
        });
    }

    // 3. Upsert Stock at the bakery
    await prisma.stock.upsert({
        where: { locationId_productId: { locationId: bakeryLocationId, productId: product.id } },
        update: { quantity: item.initialStock },
        create: { locationId: bakeryLocationId, productId: product.id, quantity: item.initialStock },
    });

    return product;
}

async function main() {
    console.log("\n=== Phase 4 seed: bakery products → real DB rows ===\n");

    const bakery = await prisma.location.findFirst({ where: { type: LocationType.BAKERY } });
    if (!bakery) {
        console.error("✗ No Bakery location found. Run prisma/seed-locations.ts first.");
        process.exit(1);
    }
    console.log(`Bakery location: ${bakery.name} (${bakery.id})`);

    console.log(`\nHot items (${HOT_ITEMS.length}):`);
    for (const item of HOT_ITEMS) {
        const p = await upsertBakeryProduct(item, bakery.id);
        const chanCount = item.channels.length;
        const stockStr = item.initialStock === null ? "MTO" : `qty=${item.initialStock}`;
        console.log(`  ✓ ${p.name}  [${item.kind}]  ${stockStr}  channels=${chanCount}`);
    }

    console.log(`\nFrozen items (${FROZEN_ITEMS.length}):`);
    for (const item of FROZEN_ITEMS) {
        const p = await upsertBakeryProduct(item, bakery.id);
        const stockStr = item.initialStock === null ? "MTO" : `qty=${item.initialStock}`;
        console.log(`  ✓ ${p.name}  [${item.kind}]  ${stockStr}  channels=${item.channels.length}`);
    }

    // Summary
    const totalBakeryProducts = await prisma.product.count({
        where: { OR: [{ kind: ProductKind.BAKERY_HOT }, { kind: ProductKind.BAKERY_FROZEN }] },
    });
    const stockAtBakery = await prisma.stock.count({ where: { locationId: bakery.id } });
    console.log(`\n=== Summary ===`);
    console.log(`  Bakery products in DB: ${totalBakeryProducts}`);
    console.log(`  Stock rows at Bakery:  ${stockAtBakery}`);
    console.log("\nDone.\n");
}

main()
    .then(async () => { await prisma.$disconnect(); })
    .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
