import { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';
const LOCALES = ['en', 'ka', 'ru', 'es'];

function localizedUrls(path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'] = 'weekly') {
    return LOCALES.map(locale => ({
        url: locale === 'en' ? `${SITE_URL}${path}` : `${SITE_URL}/${locale}${path}`,
        lastModified: new Date(),
        changeFrequency,
        priority,
        alternates: {
            languages: Object.fromEntries(
                LOCALES.map(l => [l, l === 'en' ? `${SITE_URL}${path}` : `${SITE_URL}/${l}${path}`])
            ),
        },
    }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // --- Static pages ---
    const staticPages = [
        ...localizedUrls('', 1.0, 'daily'),           // Homepage
        ...localizedUrls('/shop', 0.9, 'daily'),       // Shop
        ...localizedUrls('/heritage', 0.8, 'monthly'),  // Heritage
        ...localizedUrls('/recipes', 0.8, 'weekly'),    // Recipes listing
        ...localizedUrls('/journal', 0.8, 'weekly'),    // Journal listing
        ...localizedUrls('/wholesale', 0.7, 'monthly'), // Wholesale
        ...localizedUrls('/contact', 0.7, 'monthly'),   // Contact
        ...localizedUrls('/faq', 0.6, 'monthly'),       // FAQ
        ...localizedUrls('/legal/privacy', 0.3, 'yearly'),  // Privacy
        ...localizedUrls('/legal/terms', 0.3, 'yearly'),    // Terms
        ...localizedUrls('/legal/returns', 0.3, 'yearly'),  // Returns
    ];

    // --- Dynamic: Products ---
    const products = await prisma.product.findMany({
        select: { id: true, updatedAt: true },
    });
    const productPages = products.flatMap(p =>
        LOCALES.map(locale => ({
            url: locale === 'en' ? `${SITE_URL}/shop/${p.id}` : `${SITE_URL}/${locale}/shop/${p.id}`,
            lastModified: p.updatedAt,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
            alternates: {
                languages: Object.fromEntries(
                    LOCALES.map(l => [l, l === 'en' ? `${SITE_URL}/shop/${p.id}` : `${SITE_URL}/${l}/shop/${p.id}`])
                ),
            },
        }))
    );

    // --- Dynamic: Recipes ---
    const recipes = await prisma.recipe.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
    });
    const recipePages = recipes.flatMap(r =>
        LOCALES.map(locale => ({
            url: locale === 'en' ? `${SITE_URL}/recipes/${r.slug}` : `${SITE_URL}/${locale}/recipes/${r.slug}`,
            lastModified: r.updatedAt,
            changeFrequency: 'monthly' as const,
            priority: 0.7,
            alternates: {
                languages: Object.fromEntries(
                    LOCALES.map(l => [l, l === 'en' ? `${SITE_URL}/recipes/${r.slug}` : `${SITE_URL}/${l}/recipes/${r.slug}`])
                ),
            },
        }))
    );

    // --- Dynamic: Journal Articles ---
    const articles = await prisma.article.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
    });
    const articlePages = articles.flatMap(a =>
        LOCALES.map(locale => ({
            url: locale === 'en' ? `${SITE_URL}/journal/${a.slug}` : `${SITE_URL}/${locale}/journal/${a.slug}`,
            lastModified: a.updatedAt,
            changeFrequency: 'monthly' as const,
            priority: 0.7,
            alternates: {
                languages: Object.fromEntries(
                    LOCALES.map(l => [l, l === 'en' ? `${SITE_URL}/journal/${a.slug}` : `${SITE_URL}/${l}/journal/${a.slug}`])
                ),
            },
        }))
    );

    return [...staticPages, ...productPages, ...recipePages, ...articlePages];
}
