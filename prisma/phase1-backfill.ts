/**
 * Phase 1 (1c) backfill — one-shot script. ALREADY RAN against prod once on
 * 2026-05-22; safe to re-run (idempotent) but no longer required after the
 * NOT NULL constraints landed.
 *
 * Populated the new columns added in 1b:
 *   - ProductFamily rows (1:1 with each existing Product as a starting point;
 *     admin can merge later via the families UI in 1d)
 *   - Product.productFamilyId    (now NOT NULL)
 *   - Product.salesChannel       (now NOT NULL, default LOCAL_COLD)
 *   - Product.packagingType      (derived from salesChannel, still nullable)
 *   - Location.allowsChannels    (derived from LocationType, default [])
 *
 * Idempotent: re-running is safe. Only writes to rows whose target columns
 * are still empty / unlinked.
 *
 * Usage:
 *   set -a && source ./.env.local && set +a
 *   npx tsx prisma/phase1-backfill.ts
 *
 * SAFE TO DELETE after Phase 1 ships (kept in repo for ~1 cycle so the user
 * can re-run if they wipe + restore the DB before fresh seeds replace it).
 */
import { PrismaClient, ProductKind, LocationType, SalesChannel } from '@prisma/client';

const p = new PrismaClient();

const KIND_TO_CHANNEL: Record<ProductKind, SalesChannel> = {
    CREAMERY_CHEESE: SalesChannel.LOCAL_COLD,
    CREAMERY_BUTTER: SalesChannel.LOCAL_COLD,
    CREAMERY_SPREAD: SalesChannel.LOCAL_COLD,
    CREAMERY_OTHER:  SalesChannel.LOCAL_COLD,
    BAKERY_HOT:      SalesChannel.LOCAL_HOT,
    BAKERY_PASTRY:   SalesChannel.LOCAL_HOT,
    BAKERY_BREAD:    SalesChannel.LOCAL_HOT,
    BAKERY_FROZEN:   SalesChannel.B2B_FROZEN,
};

const CHANNEL_TO_PACKAGING: Record<SalesChannel, string> = {
    LOCAL_HOT:      'hot-bag',
    LOCAL_COLD:     'retail-pouch',
    NATIONAL_SHIP:  'cold-pack-2day',
    B2B_WHOLESALE:  'wholesale-case',
    B2B_FROZEN:     'frozen-bulk',
};

const LOCATION_TYPE_TO_CHANNELS: Record<LocationType, SalesChannel[]> = {
    BAKERY:             [SalesChannel.LOCAL_HOT, SalesChannel.LOCAL_COLD],
    D2C_COLD_WAREHOUSE: [SalesChannel.NATIONAL_SHIP],
    B2B_3PL_WAREHOUSE:  [SalesChannel.B2B_WHOLESALE, SalesChannel.B2B_FROZEN],
};

async function main() {
    console.log('--- Phase 1 (1c) backfill ---');

    // 1) ProductFamily + Product.{productFamilyId, salesChannel, packagingType}
    //    After NOT NULL tightening: salesChannel + productFamilyId can never
    //    actually be null here, but we keep the script idempotent + readable.
    const products = await p.product.findMany({
        select: { id: true, slug: true, name: true, description: true, imageUrl: true,
                  kind: true, productFamilyId: true, salesChannel: true, packagingType: true },
        orderBy: { createdAt: 'asc' },
    });
    console.log(`Found ${products.length} Product(s).`);

    let createdFamilies = 0, setPackaging = 0;

    for (const prod of products) {
        const targetChannel = prod.salesChannel ?? KIND_TO_CHANNEL[prod.kind];
        const targetPackaging = prod.packagingType ?? CHANNEL_TO_PACKAGING[targetChannel];

        if (!prod.productFamilyId) {
            // Shouldn't happen post-tightening, but guard idempotency.
            const family = await p.productFamily.upsert({
                where: { slug: prod.slug },
                update: {},
                create: {
                    slug: prod.slug,
                    name: prod.name,
                    description: prod.description.slice(0, 500),
                    imageUrl: prod.imageUrl,
                },
            });
            await p.product.update({ where: { id: prod.id }, data: { productFamilyId: family.id } });
            createdFamilies += 1;
        }

        if (prod.packagingType === null) {
            await p.product.update({ where: { id: prod.id }, data: { packagingType: targetPackaging } });
            setPackaging += 1;
        }
    }

    console.log(`  ProductFamilies: created ${createdFamilies} (already linked otherwise).`);
    console.log(`  Product.packagingType set on ${setPackaging} row(s).`);

    // 2) Location.allowsChannels (only populate if empty)
    const locations = await p.location.findMany({
        select: { id: true, name: true, type: true, allowsChannels: true },
    });
    console.log(`Found ${locations.length} Location(s).`);

    let setAllowed = 0;
    for (const loc of locations) {
        if (loc.allowsChannels.length > 0) continue;
        const channels = LOCATION_TYPE_TO_CHANNELS[loc.type];
        await p.location.update({
            where: { id: loc.id },
            data: { allowsChannels: channels },
        });
        console.log(`  ${loc.name} (${loc.type}) → [${channels.join(', ')}]`);
        setAllowed += 1;
    }
    console.log(`  Location.allowsChannels set on ${setAllowed} row(s).`);

    console.log('✓ Backfill complete.');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => p.$disconnect());
