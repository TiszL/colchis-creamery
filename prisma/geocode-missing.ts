/**
 * Geocode missing coordinates for prospect locations using Google Places API.
 *
 * Finds all AnalyticsPin records with latitude=0 and longitude=0,
 * geocodes them using the Google Maps Geocoding API, and updates the records.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=your_key npx tsx prisma/geocode-missing.ts
 *
 * Or set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const prisma = new PrismaClient();

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!API_KEY) {
    console.error('❌ No Google Maps API key found. Set GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
    return null;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }

    console.warn(`   ⚠️ No results for: "${query}" (status: ${data.status})`);
    return null;
  } catch (err: any) {
    console.error(`   ❌ Geocode error for "${query}": ${err.message}`);
    return null;
  }
}

// Haversine distance from Columbus, OH
function distanceFromColumbus(lat: number, lng: number): number {
  const R = 3959;
  const cLat = 39.9612, cLng = -82.9988;
  const dLat = (lat - cLat) * Math.PI / 180;
  const dLng = (lng - cLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(cLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  console.log('🌍 Geocoding missing coordinates...\n');

  if (!API_KEY) {
    console.error('❌ No API key found. Set GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in environment or .env.local');
    process.exit(1);
  }

  // Find records with zero coordinates
  const missing = await prisma.analyticsPin.findMany({
    where: {
      OR: [
        { latitude: 0, longitude: 0 },
        { latitude: 0 },
        { longitude: 0 },
      ],
    },
  });

  console.log(`📍 Found ${missing.length} records with missing coordinates\n`);

  let updated = 0;
  let failed = 0;

  for (const pin of missing) {
    // Build search query from available info
    const parts = [pin.name, pin.address, pin.city, pin.state].filter(Boolean);
    const query = parts.join(', ');

    console.log(`🔍 Geocoding: ${pin.name} (${pin.city || '?'}, ${pin.state || '?'})`);

    const result = await geocode(query);

    if (result) {
      const dist = distanceFromColumbus(result.lat, result.lng);
      const driveHrs = Math.round(dist / 55 * 10) / 10;

      await prisma.analyticsPin.update({
        where: { id: pin.id },
        data: {
          latitude: result.lat,
          longitude: result.lng,
          distanceMiles: Math.round(dist * 10) / 10,
          driveHours: driveHrs,
        },
      });

      console.log(`   ✅ ${result.lat.toFixed(6)}, ${result.lng.toFixed(6)} (${dist.toFixed(0)} mi)`);
      updated++;
    } else {
      failed++;
    }

    // Rate limit: 50ms between requests
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\n🎯 Results:`);
  console.log(`   ✅ Geocoded: ${updated}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total records: ${await prisma.analyticsPin.count()}`);
}

main()
  .catch(e => {
    console.error('❌ Geocode failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
