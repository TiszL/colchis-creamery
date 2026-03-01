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
        }
    });

    revalidatePath('/admin/analytics-control');
    revalidatePath('/analytics');
}
