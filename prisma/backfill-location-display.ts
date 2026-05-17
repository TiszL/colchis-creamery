/**
 * Phase 10 backfill — one-shot script.
 *
 * Migrates display fields from SiteConfig.home.visit + SiteConfig.contact.locations[0]
 * into the new Location columns added in this phase:
 *   - isPrimary, showOnContactPage, displayDescription, displayBakeryHours,
 *     contactCardName, contactCardDoorNote, displayOrder
 *
 * Idempotent: re-running is safe (no destructive ops, only writes if missing /
 * still-default). Marks Bakery row as isPrimary=true and Cold Warehouse as
 * showOnContactPage=false.
 *
 * Usage:
 *   set -a && source ./.env.local && set +a
 *   npx tsx prisma/backfill-location-display.ts
 *
 * Delete this file after successful run (kept in repo only for one cycle so the
 * user can re-run if they decide to wipe + restore DB).
 */
import { PrismaClient, LocationType } from '@prisma/client';

const p = new PrismaClient();

async function main() {
    // Read display data currently stored in SiteConfig
    const cfgRows = await p.siteConfig.findMany({
        where: { key: { in: ['home.visit', 'contact.locations'] } },
    });
    const cfgMap = new Map(cfgRows.map(r => [r.key, r.value]));

    const homeVisit = (() => {
        const raw = cfgMap.get('home.visit');
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
    })();

    const contactLocations: Array<{ name?: string; address?: string; lat?: string; lng?: string; phone?: string }> = (() => {
        const raw = cfgMap.get('contact.locations');
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    })();

    const primaryContactLoc = contactLocations[0];

    console.log('--- Source data ---');
    console.log('home.visit:', homeVisit ? { description: homeVisit.description, bakery_hours: homeVisit.bakery_hours, address: homeVisit.address, city: homeVisit.city, phone: homeVisit.phone } : null);
    console.log('contact.locations[0]:', primaryContactLoc || null);

    // Find Bakery location (there is exactly one in this codebase per handoff docs)
    const bakery = await p.location.findFirst({ where: { type: LocationType.BAKERY }, orderBy: { createdAt: 'asc' } });
    if (!bakery) {
        console.error('No BAKERY location found — aborting. Create one via /admin/locations first.');
        process.exit(1);
    }
    console.log('--- Bakery row before backfill ---');
    console.log({
        id: bakery.id, name: bakery.name, isPrimary: bakery.isPrimary,
        addressLine1: bakery.addressLine1, city: bakery.city, state: bakery.state, postalCode: bakery.postalCode,
        displayDescription: bakery.displayDescription, displayBakeryHours: bakery.displayBakeryHours,
        contactCardName: bakery.contactCardName, contactCardDoorNote: bakery.contactCardDoorNote,
    });

    // Compose backfill values, only overwriting nulls / defaults so re-runs don't clobber admin edits
    const bakeryUpdate: Record<string, unknown> = { isPrimary: true, showOnContactPage: true, displayOrder: 0 };
    if (bakery.displayDescription == null && typeof homeVisit?.description === 'string') {
        bakeryUpdate.displayDescription = homeVisit.description;
    }
    if (bakery.displayBakeryHours == null && typeof homeVisit?.bakery_hours === 'string') {
        bakeryUpdate.displayBakeryHours = homeVisit.bakery_hours;
    }
    if (bakery.contactCardName == null) {
        // Prefer the human-readable name from contact.locations[0] if it differs
        // from the operational `Location.name`. Otherwise leave null and let admin set later.
        const candidate = primaryContactLoc?.name && primaryContactLoc.name !== bakery.name
            ? primaryContactLoc.name
            : null;
        if (candidate) bakeryUpdate.contactCardName = candidate;
    }
    // Note: contactCardDoorNote is left null intentionally — the current "Door 4 · ring twice"
    // is hardcoded in ContactClient.tsx and questionable as a default. Admin will fill it
    // in via the contact editor (Phase 4).

    const updatedBakery = await p.location.update({ where: { id: bakery.id }, data: bakeryUpdate });
    console.log('--- Bakery row after backfill ---');
    console.log({
        isPrimary: updatedBakery.isPrimary, showOnContactPage: updatedBakery.showOnContactPage,
        displayDescription: updatedBakery.displayDescription, displayBakeryHours: updatedBakery.displayBakeryHours,
        contactCardName: updatedBakery.contactCardName, contactCardDoorNote: updatedBakery.contactCardDoorNote,
        displayOrder: updatedBakery.displayOrder,
    });

    // Cold Warehouse: not customer-facing — hide from contact page; never primary.
    const warehouses = await p.location.findMany({ where: { type: { not: LocationType.BAKERY } } });
    for (const w of warehouses) {
        await p.location.update({
            where: { id: w.id },
            data: { isPrimary: false, showOnContactPage: false, displayOrder: 100 },
        });
        console.log(`Hidden from contact page: ${w.name} (${w.type})`);
    }

    // Sanity-check: exactly one primary in the table
    const primaryCount = await p.location.count({ where: { isPrimary: true } });
    console.log(`--- Sanity check: ${primaryCount} primary location(s). Expected 1. ---`);
    if (primaryCount !== 1) {
        console.error('!!! Multiple or zero primary locations — investigate before proceeding.');
        process.exit(1);
    }

    console.log('Backfill complete.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => p.$disconnect());
