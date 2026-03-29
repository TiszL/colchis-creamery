/**
 * Seed script: Import prospect data from colchis_map_pins.json into AnalyticsPin table.
 *
 * Usage:
 *   npx tsx prisma/seed-prospects.ts
 *
 * This script:
 *   1. Deletes ALL existing AnalyticsPin records (prospects only)
 *   2. Reads colchis_map_pins.json (287 location records)
 *   3. Filters out records without coordinates
 *   4. Inserts all valid records into the database
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface MapPin {
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
  revenue: number;
  revenueMonthlyLow: number;
  revenueMonthlyHigh: number;
  cheeseLbsMonthlyLow: number;
  cheeseLbsMonthlyHigh: number;
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

async function main() {
  console.log('🧀 Colchis Creamery — Prospect Data Seeder\n');

  // 1. Read the JSON file
  const filePath = path.join(__dirname, '..', 'Prospectdatajson', 'colchis_map_pins.json');
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found:', filePath);
    process.exit(1);
  }

  const rawData = fs.readFileSync(filePath, 'utf-8');
  const pins: MapPin[] = JSON.parse(rawData);
  console.log(`📄 Loaded ${pins.length} location records from colchis_map_pins.json`);

  // 2. Filter out records with null coordinates
  const validPins = pins.filter(p => p.latitude != null && p.longitude != null);
  const skipped = pins.length - validPins.length;
  console.log(`✅ ${validPins.length} records have valid coordinates`);
  if (skipped > 0) {
    console.log(`⏭️  ${skipped} records skipped (no coordinates)`);
  }

  // 3. Delete existing AnalyticsPin records
  const deleteCount = await prisma.analyticsPin.deleteMany({});
  console.log(`🗑️  Deleted ${deleteCount.count} existing pin records`);

  // 4. Insert all valid records
  const data = validPins.map(pin => ({
    name: pin.name,
    latitude: pin.latitude!,
    longitude: pin.longitude!,
    pinType: pin.pinType || 'PROSPECT',
    status: pin.status || 'ACTIVE',
    notes: pin.notes || null,
    contactInfo: pin.contactInfo || null,
    revenue: pin.revenueMonthlyHigh ? `$${pin.revenueMonthlyHigh.toLocaleString()}/mo` : null,
    // Prospect Intelligence Fields
    prospectId: pin.prospectId || null,
    brandName: pin.brandName || null,
    category: pin.category || null,
    categoryLabel: pin.categoryLabel || null,
    tier: pin.tier || null,
    tierLabel: pin.tierLabel || null,
    priorityScore: pin.priorityScore || null,
    priorityRank: pin.priorityRank || null,
    // Contact & Location
    phone: pin.phone || null,
    website: pin.website || null,
    address: pin.address || null,
    city: pin.city || null,
    state: pin.state || null,
    googleRating: pin.googleRating || null,
    // Revenue Model
    revenueMonthlyLow: pin.revenueMonthlyLow || null,
    revenueMonthlyHigh: pin.revenueMonthlyHigh || null,
    cheeseLbsLow: pin.cheeseLbsMonthlyLow || null,
    cheeseLbsHigh: pin.cheeseLbsMonthlyHigh || null,
    // Logistics
    distanceMiles: pin.distanceMiles || null,
    driveHours: pin.driveHours || null,
  }));

  const result = await prisma.analyticsPin.createMany({ data });
  console.log(`\n🎯 Successfully inserted ${result.count} prospect locations!\n`);

  // 5. Print summary
  const byTier = await prisma.analyticsPin.groupBy({
    by: ['tierLabel'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('📊 Summary by Tier:');
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
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
