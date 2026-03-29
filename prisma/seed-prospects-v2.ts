/**
 * Seed script v2: Smart import from colchis_creamery_prospects_v3-6.json
 *
 * Features:
 *   - Handles TWO data formats: CC-XXXX (standard) and CLHS-XXX (alternate)
 *   - Normalizes categories, tiers, and priority scores for CLHS entries
 *   - Deduplicates by prospectId + location name (upsert, not delete-all)
 *   - Fills revenue model from categoryTaxonomy for entries missing it
 *   - Generates updated colchis_map_pins.json for consistency
 *
 * Usage:
 *   npx tsx prisma/seed-prospects-v2.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ─── Category normalization ─────────────────────────────────────────────────

const CATEGORY_NORMALIZE: Record<string, string> = {
  'EEMARKET': 'EE_MARKET',
  'EE_MARKET': 'EE_MARKET',
  'UZBREST': 'UZB_REST',
  'UZB_REST': 'UZB_REST',
  'RUSREST': 'RUS_REST',
  'RUS_REST': 'RUS_REST',
  'CAUCREST': 'CAUC_REST',
  'CAUC_REST': 'CAUC_REST',
  'ARMREST': 'ARM_REST',
  'ARM_REST': 'ARM_REST',
  'GEOREST': 'GEO_REST',
  'GEO_REST': 'GEO_REST',
  'GEOBAKERY': 'GEO_BAKERY',
  'GEO_BAKERY': 'GEO_BAKERY',
  'GEOMARKET': 'GEO_MARKET',
  'GEO_MARKET': 'GEO_MARKET',
  'CAMARKET': 'CA_MARKET',
  'CA_MARKET': 'CA_MARKET',
  'CHEESESHOP': 'CHEESE_SHOP',
  'CHEESE_SHOP': 'CHEESE_SHOP',
  'ARTISANPIZZA': 'ARTISAN_PIZZA',
  'ARTISAN_PIZZA': 'ARTISAN_PIZZA',
  'INTLMARKET': 'INTL_MARKET',
  'INTL_MARKET': 'INTL_MARKET',
  'MEDITERRANEANREST': 'MEDITERRANEAN_REST',
  'MEDITERRANEAN_REST': 'MEDITERRANEAN_REST',
  'BRUNCHUPSCALE': 'BRUNCH_UPSCALE',
  'BRUNCH_UPSCALE': 'BRUNCH_UPSCALE',
  'DISTRIBUTOR': 'DISTRIBUTOR',
  'CATERING': 'CATERING',
  'MEAL_KIT': 'MEAL_KIT',
  'MEALKIT': 'MEAL_KIT',
};

// ─── Category taxonomy for revenue model fill-in ────────────────────────────

const CATEGORY_TAXONOMY: Record<string, {
  label: string;
  tier: number;
  tierLabel: string;
  lbsLow: number;
  lbsHigh: number;
  price: number;
  defaultPriorityWeight: number;
}> = {
  GEO_REST: { label: 'Georgian Restaurant', tier: 1, tierLabel: 'CORE', lbsLow: 200, lbsHigh: 600, price: 9.5, defaultPriorityWeight: 95 },
  GEO_BAKERY: { label: 'Georgian Bakery', tier: 1, tierLabel: 'CORE', lbsLow: 400, lbsHigh: 1200, price: 8.5, defaultPriorityWeight: 98 },
  GEO_MARKET: { label: 'Georgian Specialty Market', tier: 1, tierLabel: 'CORE', lbsLow: 150, lbsHigh: 500, price: 9.0, defaultPriorityWeight: 90 },
  CAUC_REST: { label: 'Caucasian/Eurasian Restaurant', tier: 2, tierLabel: 'ADJACENT', lbsLow: 80, lbsHigh: 300, price: 9.5, defaultPriorityWeight: 75 },
  RUS_REST: { label: 'Russian/Slavic Restaurant', tier: 2, tierLabel: 'ADJACENT', lbsLow: 40, lbsHigh: 150, price: 9.5, defaultPriorityWeight: 60 },
  UZB_REST: { label: 'Uzbek/Central Asian Restaurant', tier: 2, tierLabel: 'ADJACENT', lbsLow: 30, lbsHigh: 120, price: 9.0, defaultPriorityWeight: 55 },
  ARM_REST: { label: 'Armenian Restaurant', tier: 2, tierLabel: 'ADJACENT', lbsLow: 30, lbsHigh: 100, price: 9.5, defaultPriorityWeight: 50 },
  EE_MARKET: { label: 'Eastern European / Russian Grocery', tier: 2, tierLabel: 'ADJACENT', lbsLow: 100, lbsHigh: 400, price: 9.0, defaultPriorityWeight: 65 },
  CA_MARKET: { label: 'Central Asian Grocery / Market', tier: 2, tierLabel: 'ADJACENT', lbsLow: 50, lbsHigh: 200, price: 9.0, defaultPriorityWeight: 50 },
  DISTRIBUTOR: { label: 'Specialty Food / Cheese Distributor', tier: 3, tierLabel: 'STRATEGIC', lbsLow: 2000, lbsHigh: 10000, price: 7.5, defaultPriorityWeight: 92 },
  ARTISAN_PIZZA: { label: 'Artisan / Neapolitan Pizzeria', tier: 4, tierLabel: 'GROWTH', lbsLow: 20, lbsHigh: 80, price: 10.0, defaultPriorityWeight: 40 },
  INTL_MARKET: { label: 'International / Gourmet Food Market', tier: 4, tierLabel: 'GROWTH', lbsLow: 30, lbsHigh: 150, price: 10.0, defaultPriorityWeight: 35 },
  CHEESE_SHOP: { label: 'Artisan Cheese Shop / Monger', tier: 5, tierLabel: 'EXPERIMENTAL', lbsLow: 20, lbsHigh: 80, price: 11.0, defaultPriorityWeight: 35 },
  MEDITERRANEAN_REST: { label: 'Mediterranean / Turkish Restaurant', tier: 5, tierLabel: 'EXPERIMENTAL', lbsLow: 30, lbsHigh: 100, price: 10.0, defaultPriorityWeight: 25 },
  BRUNCH_UPSCALE: { label: 'Upscale Brunch / Farm-to-Table', tier: 5, tierLabel: 'EXPERIMENTAL', lbsLow: 20, lbsHigh: 60, price: 11.0, defaultPriorityWeight: 20 },
  CATERING: { label: 'Catering Company', tier: 5, tierLabel: 'EXPERIMENTAL', lbsLow: 40, lbsHigh: 200, price: 9.5, defaultPriorityWeight: 20 },
  MEAL_KIT: { label: 'Meal Kit / Food Subscription', tier: 5, tierLabel: 'EXPERIMENTAL', lbsLow: 500, lbsHigh: 5000, price: 7.0, defaultPriorityWeight: 15 },
};

// ─── Tier letter-to-number mapping for CLHS entries ─────────────────────────

function normalizeTier(tier: any): number {
  if (typeof tier === 'number') return tier;
  const map: Record<string, number> = {
    'A': 1, 'A+': 1, 'A-': 1,
    'B': 2, 'B+': 2, 'B-': 2,
    'C': 3, 'C+': 3, 'C-': 3,
    'D': 4, 'D+': 4, 'D-': 4,
    'E': 5, 'F': 5,
  };
  return map[String(tier).toUpperCase()] || 3;
}

function getTierLabel(tier: number): string {
  const labels: Record<number, string> = {
    1: 'CORE', 2: 'ADJACENT', 3: 'STRATEGIC', 4: 'GROWTH', 5: 'EXPERIMENTAL',
  };
  return labels[tier] || 'EXPERIMENTAL';
}

function getPriorityLabel(score: number): string {
  if (score >= 70) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  if (score >= 20) return 'LOW';
  return 'EXPLORATORY';
}

// ─── Haversine formula for distance from Columbus ───────────────────────────

function distanceFromColumbus(lat: number, lng: number): number {
  const R = 3959; // Earth radius in miles
  const cLat = 39.9612, cLng = -82.9988;
  const dLat = (lat - cLat) * Math.PI / 180;
  const dLng = (lng - cLng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(cLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Pin record type ────────────────────────────────────────────────────────

interface PinRecord {
  name: string;
  latitude: number | null;
  longitude: number | null;
  pinType: string;
  status: string;
  category: string;
  categoryLabel: string;
  tier: number;
  tierLabel: string;
  priorityRank: string;
  priorityScore: number;
  revenueMonthlyLow: number;
  revenueMonthlyHigh: number;
  cheeseLbsLow: number;
  cheeseLbsHigh: number;
  contactInfo: string;
  phone: string;
  website: string;
  googleRating: number | null;
  address: string;
  city: string;
  state: string;
  distanceMiles: number | null;
  driveHours: number | null;
  brandName: string;
  prospectId: string;
  notes: string;
}

// ─── Parse a single prospect (handles both formats) ─────────────────────────

function parseProspect(prospect: any, categoryTaxonomy: any): PinRecord[] {
  const prospectId = prospect.prospectId;
  const brandName = prospect.brandName;
  const locations = prospect.locations || [];

  // Detect format:
  const isStandardFormat = !!prospect.classification;

  let categoryCode: string;
  let tier: number;
  let tierLabel: string;
  let categoryLabel: string;
  let priorityScore: number;
  let priorityRank: string;
  let lbsLow: number;
  let lbsHigh: number;
  let revLow: number;
  let revHigh: number;
  let notes: string;

  if (isStandardFormat) {
    // CC-XXXX standard format
    categoryCode = CATEGORY_NORMALIZE[prospect.classification.categoryCode] || prospect.classification.categoryCode;
    tier = prospect.classification.tier;
    tierLabel = prospect.classification.tierLabel;
    categoryLabel = prospect.classification.categoryLabel;
    priorityScore = prospect.priority?.score || 0;
    priorityRank = prospect.priority?.label || getPriorityLabel(priorityScore);

    const revenue = prospect.revenueEstimate;
    if (revenue?.perLocationMonthly) {
      lbsLow = revenue.perLocationMonthly.cheeseLbsLow || 0;
      lbsHigh = revenue.perLocationMonthly.cheeseLbsHigh || 0;
      revLow = revenue.perLocationMonthly.lowUSD || 0;
      revHigh = revenue.perLocationMonthly.highUSD || 0;
    } else {
      // Fall back to taxonomy
      const tax = CATEGORY_TAXONOMY[categoryCode];
      lbsLow = tax?.lbsLow || 0;
      lbsHigh = tax?.lbsHigh || 0;
      revLow = tax ? tax.lbsLow * tax.price : 0;
      revHigh = tax ? tax.lbsHigh * tax.price : 0;
    }

    notes = prospect.prospectReason || '';
  } else {
    // CLHS-XXX alternate format
    const rawCat = prospect.categoryCode || '';
    categoryCode = CATEGORY_NORMALIZE[rawCat] || rawCat;
    tier = normalizeTier(prospect.tier);
    tierLabel = getTierLabel(tier);

    // Use taxonomy for category label
    const tax = CATEGORY_TAXONOMY[categoryCode];
    categoryLabel = tax?.label || rawCat;

    // Priority from fitScore or engagementPriority
    const fitScore = prospect.colchisProductFit?.fitScore || 0;
    const rankStr = prospect.engagementPriority?.rank || '';
    // Convert rank letter grades to score if fitScore is missing
    if (fitScore > 0) {
      priorityScore = fitScore;
    } else {
      const rankMap: Record<string, number> = { 'A+': 90, 'A': 85, 'A-': 80, 'B+': 70, 'B': 60, 'B-': 55, 'C+': 45, 'C': 40, 'C-': 35, 'D': 25 };
      priorityScore = rankMap[rankStr] || 40;
    }
    priorityRank = getPriorityLabel(priorityScore);

    // Revenue from taxonomy
    lbsLow = tax?.lbsLow || 0;
    lbsHigh = tax?.lbsHigh || 0;
    revLow = tax ? Math.round(tax.lbsLow * tax.price) : 0;
    revHigh = tax ? Math.round(tax.lbsHigh * tax.price) : 0;

    // Notes
    const reasoning = prospect.colchisProductFit?.reasoning || '';
    const rawNotes = prospect.notes?.rawNotes || '';
    notes = reasoning || rawNotes;
  }

  // Parse each location
  const pins: PinRecord[] = [];
  for (const loc of locations) {
    // Get coordinates — handles both formats
    let lat: number | null = null;
    let lng: number | null = null;

    if (loc.latitude != null && loc.longitude != null) {
      lat = loc.latitude;
      lng = loc.longitude;
    } else if (loc.coordinates) {
      lat = loc.coordinates.lat || null;
      lng = loc.coordinates.lng || null;
    }

    // Get name
    const locName = loc.locationName || loc.name || brandName;

    // Get contact info
    const phone = loc.phone || prospect.contactInfo?.phone || '';
    const website = loc.website || prospect.contactInfo?.website || '';

    // Get address
    let address = loc.address || '';
    if (!address && loc.city && loc.state) {
      address = `${loc.city}, ${loc.state}`;
    }

    // Google rating
    let googleRating: number | null = loc.googleRating || null;
    if (!googleRating && prospect.ratingsAndReviews?.googleRating) {
      googleRating = prospect.ratingsAndReviews.googleRating;
    }

    // Distance from Columbus
    let distanceMiles: number | null = loc.distanceFromColumbusMiles || null;
    let driveHours: number | null = loc.estimatedDriveHours || null;
    if (!distanceMiles && lat && lng) {
      distanceMiles = Math.round(distanceFromColumbus(lat, lng) * 10) / 10;
      driveHours = Math.round(distanceMiles / 55 * 10) / 10;
    }

    // Contact info string
    const contactParts = [phone, website].filter(Boolean);
    const contactInfo = contactParts.join(' | ');

    // Status
    const status = loc.status || 'ACTIVE';

    pins.push({
      name: locName,
      latitude: lat,
      longitude: lng,
      pinType: 'PROSPECT',
      status,
      category: categoryCode,
      categoryLabel,
      tier,
      tierLabel,
      priorityRank,
      priorityScore,
      revenueMonthlyLow: revLow,
      revenueMonthlyHigh: revHigh,
      cheeseLbsLow: lbsLow,
      cheeseLbsHigh: lbsHigh,
      contactInfo,
      phone,
      website,
      googleRating,
      address,
      city: loc.city || '',
      state: loc.state || '',
      distanceMiles,
      driveHours,
      brandName,
      prospectId,
      notes: notes.slice(0, 500), // Truncate long notes
    });
  }

  return pins;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧀 Colchis Creamery — Prospect Data Seeder v2\n');
  console.log('📋 Strategy: Upsert (deduplicate by prospectId + name)\n');

  // 1. Read the v3-6 JSON file
  const filePath = path.join(__dirname, '..', 'Prospectdatajson', 'colchis_creamery_prospects_v3-6.json');

  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found:', filePath);
    process.exit(1);
  }

  const rawData = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(rawData);
  const prospects = data.prospects || [];
  console.log(`📄 Loaded ${prospects.length} prospects from colchis_creamery_prospects_v3-6.json`);

  // 2. Parse all prospects into pin records
  const allPins: PinRecord[] = [];
  let standardCount = 0;
  let clhsCount = 0;

  for (const prospect of prospects) {
    const pins = parseProspect(prospect, data.categoryTaxonomy);
    allPins.push(...pins);
    if (prospect.prospectId.startsWith('CLHS')) clhsCount++;
    else standardCount++;
  }

  console.log(`\n📊 Parsed ${allPins.length} total location records:`);
  console.log(`   Standard (CC-XXXX): ${standardCount} prospects`);
  console.log(`   Alternate (CLHS-XXX): ${clhsCount} prospects`);

  // 3. Filter out records with null coordinates (log them)
  const validPins = allPins.filter(p => p.latitude != null && p.longitude != null);
  const noCoordPins = allPins.filter(p => p.latitude == null || p.longitude == null);
  console.log(`\n✅ ${validPins.length} records have valid coordinates`);
  if (noCoordPins.length > 0) {
    console.log(`⚠️  ${noCoordPins.length} records WITHOUT coordinates (will be inserted but not visible on map):`);
    for (const p of noCoordPins) {
      console.log(`   → ${p.prospectId}: ${p.name} (${p.city}, ${p.state})`);
    }
  }

  // 4. Check existing DB records for deduplication
  const existingPins = await prisma.analyticsPin.findMany({
    select: { id: true, name: true, prospectId: true },
  });
  console.log(`\n📦 Existing DB records: ${existingPins.length}`);

  // Build lookup: key = prospectId + name
  const existingLookup = new Map<string, string>();
  for (const ep of existingPins) {
    const key = `${ep.prospectId || ''}::${ep.name}`;
    existingLookup.set(key, ep.id);
  }

  // 5. Upsert all records
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const pin of allPins) {
    const key = `${pin.prospectId}::${pin.name}`;
    const existingId = existingLookup.get(key);

    const pinData = {
      name: pin.name,
      latitude: pin.latitude || 0,
      longitude: pin.longitude || 0,
      pinType: pin.pinType,
      status: pin.status,
      notes: pin.notes || null,
      contactInfo: pin.contactInfo || null,
      revenue: pin.revenueMonthlyHigh ? `$${pin.revenueMonthlyHigh.toLocaleString()}/mo` : null,
      prospectId: pin.prospectId || null,
      brandName: pin.brandName || null,
      category: pin.category || null,
      categoryLabel: pin.categoryLabel || null,
      tier: pin.tier || null,
      tierLabel: pin.tierLabel || null,
      priorityScore: pin.priorityScore || null,
      priorityRank: pin.priorityRank || null,
      phone: pin.phone || null,
      website: pin.website || null,
      address: pin.address || null,
      city: pin.city || null,
      state: pin.state || null,
      googleRating: pin.googleRating || null,
      revenueMonthlyLow: pin.revenueMonthlyLow || null,
      revenueMonthlyHigh: pin.revenueMonthlyHigh || null,
      cheeseLbsLow: pin.cheeseLbsLow || null,
      cheeseLbsHigh: pin.cheeseLbsHigh || null,
      distanceMiles: pin.distanceMiles || null,
      driveHours: pin.driveHours || null,
    };

    try {
      if (existingId) {
        await prisma.analyticsPin.update({
          where: { id: existingId },
          data: pinData,
        });
        updated++;
      } else {
        await prisma.analyticsPin.create({ data: pinData });
        created++;
      }
    } catch (err: any) {
      console.error(`   ⚠️ Error for ${pin.name} (${pin.prospectId}): ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n🎯 Results:`);
  console.log(`   ✅ Created: ${created} new records`);
  console.log(`   🔄 Updated: ${updated} existing records`);
  console.log(`   ⏭️  Skipped: ${skipped} (errors)`);

  // 6. Print summary
  const totalCount = await prisma.analyticsPin.count();
  console.log(`\n📊 Total DB records now: ${totalCount}`);

  const byTier = await prisma.analyticsPin.groupBy({
    by: ['tierLabel'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('\n📊 Summary by Tier:');
  for (const t of byTier) {
    console.log(`   ${(t.tierLabel || 'UNKNOWN').padEnd(15)} ${t._count.id} locations`);
  }

  const byPriority = await prisma.analyticsPin.groupBy({
    by: ['priorityRank'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('\n📊 Summary by Priority:');
  for (const p of byPriority) {
    console.log(`   ${(p.priorityRank || 'UNKNOWN').padEnd(15)} ${p._count.id} locations`);
  }

  const totalRevHigh = await prisma.analyticsPin.aggregate({
    _sum: { revenueMonthlyHigh: true },
  });
  console.log(`\n💰 Total Monthly TAM (High): $${(totalRevHigh._sum.revenueMonthlyHigh || 0).toLocaleString()}`);

  const stateCount = await prisma.analyticsPin.groupBy({
    by: ['state'],
    _count: { id: true },
  });
  console.log(`🌎 States covered: ${stateCount.length}`);

  // 7. Generate updated colchis_map_pins.json
  const allDbPins = await prisma.analyticsPin.findMany({
    orderBy: { priorityScore: 'desc' },
  });

  const mapPinsArr = allDbPins.map(p => ({
    name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    pinType: p.pinType,
    status: p.status,
    category: p.category,
    categoryLabel: p.categoryLabel,
    tier: p.tier,
    tierLabel: p.tierLabel,
    priorityRank: p.priorityRank,
    priorityScore: p.priorityScore,
    revenue: p.revenueMonthlyHigh,
    revenueMonthlyLow: p.revenueMonthlyLow,
    revenueMonthlyHigh: p.revenueMonthlyHigh,
    cheeseLbsMonthlyLow: p.cheeseLbsLow,
    cheeseLbsMonthlyHigh: p.cheeseLbsHigh,
    contactInfo: p.contactInfo,
    phone: p.phone,
    website: p.website,
    googleRating: p.googleRating,
    address: p.address,
    city: p.city,
    state: p.state,
    distanceMiles: p.distanceMiles,
    driveHours: p.driveHours,
    brandName: p.brandName,
    prospectId: p.prospectId,
    notes: p.notes,
  }));

  const outputPath = path.join(__dirname, '..', 'Prospectdatajson', 'colchis_map_pins.json');
  fs.writeFileSync(outputPath, JSON.stringify(mapPinsArr, null, 2));
  console.log(`\n📝 Updated colchis_map_pins.json with ${mapPinsArr.length} records`);
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
