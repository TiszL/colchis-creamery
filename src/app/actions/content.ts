'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

/**
 * Save a JSON content block to siteConfig.
 * Key format: "home.hero", "home.story", "footer.columns", etc.
 */
export async function saveContentBlock(key: string, data: Record<string, any>) {
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') {
        return { error: 'Unauthorized' };
    }

    try {
        await prisma.siteConfig.upsert({
            where: { key },
            update: { value: JSON.stringify(data) },
            create: { key, value: JSON.stringify(data) },
        });

        revalidatePath('/', 'layout');
        return { success: true };
    } catch (error) {
        console.error(`[saveContentBlock] ${key}:`, error);
        return { error: 'Failed to save.' };
    }
}

/**
 * Read a JSON content block from siteConfig.
 * Returns parsed JSON or null if not found.
 */
export async function getContentBlock<T = Record<string, any>>(key: string): Promise<T | null> {
    try {
        const row = await prisma.siteConfig.findUnique({ where: { key } });
        if (!row?.value) return null;
        return JSON.parse(row.value) as T;
    } catch {
        return null;
    }
}

/**
 * Read multiple content blocks at once.
 */
export async function getContentBlocks(keys: string[]): Promise<Record<string, any>> {
    try {
        const rows = await prisma.siteConfig.findMany({
            where: { key: { in: keys } },
        });
        const result: Record<string, any> = {};
        for (const row of rows) {
            try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
        }
        return result;
    } catch {
        return {};
    }
}
