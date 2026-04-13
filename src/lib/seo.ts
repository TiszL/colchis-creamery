import { prisma } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';

/**
 * Returns the OG image URL for a given page key.
 * Falls back to the global default OG image if no page-specific image is set.
 * Returns undefined if no image is configured at all.
 */
export async function getOgImage(pageKey: string): Promise<string | undefined> {
    try {
        const rows = await prisma.siteConfig.findMany({
            where: { key: { in: [`seo.ogImage.${pageKey}`, 'seo.ogImage.default'] } },
        });
        const pageImage = rows.find(r => r.key === `seo.ogImage.${pageKey}`)?.value;
        if (pageImage) return pageImage;
        const defaultImage = rows.find(r => r.key === 'seo.ogImage.default')?.value;
        return defaultImage || undefined;
    } catch {
        return undefined;
    }
}

/**
 * Builds the OG images metadata array for Next.js Metadata.
 */
export function buildOgImages(imageUrl: string | undefined, alt: string) {
    if (!imageUrl) return undefined;
    return [{ url: imageUrl, width: 1200, height: 630, alt }];
}
