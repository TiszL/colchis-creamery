'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export async function updateSiteSettings(formData: FormData) {
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') {
        throw new Error('Unauthorized');
    }

    // Convert FormData to object safely
    const entries = Array.from(formData.entries());
    
    // Batch upsert settings using a transaction
    const ops = entries.map(([key, value]) => {
        return prisma.siteConfig.upsert({
            where: { key },
            update: { value: value as string },
            create: { key, value: value as string },
        });
    });

    await prisma.$transaction(ops);

    // Revalidate paths that use these settings
    revalidatePath('/', 'layout');
}
