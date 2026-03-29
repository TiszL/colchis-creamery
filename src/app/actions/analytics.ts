'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function addAnalyticsPin(data: {
    name: string;
    latitude: number;
    longitude: number;
    pinType?: string;
    status?: string;
    contactInfo?: string | null;
    revenue?: string | null;
    notes?: string | null;
    // Prospect Intelligence fields
    category?: string;
    categoryLabel?: string;
    tier?: number;
    tierLabel?: string;
    priorityScore?: number;
    priorityRank?: string;
    phone?: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    googleRating?: number;
    revenueMonthlyLow?: number;
    revenueMonthlyHigh?: number;
    cheeseLbsLow?: number;
    cheeseLbsHigh?: number;
    distanceMiles?: number;
    driveHours?: number;
    brandName?: string;
}) {
    if (!data.name || isNaN(data.latitude) || isNaN(data.longitude)) {
        throw new Error("Invalid pin data");
    }

    await prisma.analyticsPin.create({
        data: {
            name: data.name,
            latitude: data.latitude,
            longitude: data.longitude,
            pinType: data.pinType || 'PROSPECT',
            status: data.status || 'ACTIVE',
            contactInfo: data.contactInfo || null,
            revenue: data.revenue || null,
            notes: data.notes || null,
            // Intelligence fields
            category: data.category || null,
            categoryLabel: data.categoryLabel || null,
            tier: data.tier || null,
            tierLabel: data.tierLabel || null,
            priorityScore: data.priorityScore || null,
            priorityRank: data.priorityRank || null,
            phone: data.phone || null,
            website: data.website || null,
            address: data.address || null,
            city: data.city || null,
            state: data.state || null,
            googleRating: data.googleRating || null,
            revenueMonthlyLow: data.revenueMonthlyLow || null,
            revenueMonthlyHigh: data.revenueMonthlyHigh || null,
            cheeseLbsLow: data.cheeseLbsLow || null,
            cheeseLbsHigh: data.cheeseLbsHigh || null,
            distanceMiles: data.distanceMiles || null,
            driveHours: data.driveHours || null,
            brandName: data.brandName || null,
        }
    });

    revalidatePath('/admin/analytics-control');
    revalidatePath('/analytics');
}
