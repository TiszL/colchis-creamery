import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { getOgImage, buildOgImages } from '@/lib/seo';
import { RecipesClient } from '@/components/recipes/RecipesClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const canonicalPath = locale === 'en' ? '/recipes' : `/${locale}/recipes`;
    const ogImage = await getOgImage('recipes');

    return {
        title: 'Recipes & Pairings | Colchis Food',
        description: 'Traditional Georgian and easy modern recipes. Filter by what you have time for, what you have in the fridge, and who you are feeding.',
        keywords: ['Georgian cheese recipes', 'sulguni recipes', 'khachapuri', 'cheese pairings', 'Georgian cooking'],
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: {
                'en': `${SITE_URL}/recipes`,
                'ka': `${SITE_URL}/ka/recipes`,
                'ru': `${SITE_URL}/ru/recipes`,
                'es': `${SITE_URL}/es/recipes`,
                'x-default': `${SITE_URL}/recipes`,
            },
        },
        openGraph: {
            type: 'website',
            title: 'Recipes & Pairings | Colchis Food',
            description: 'Traditional Georgian and easy modern recipes.',
            url: `${SITE_URL}${canonicalPath}`,
            siteName: 'Colchis Food',
            ...(ogImage ? { images: buildOgImages(ogImage, 'Recipes & Pairings') } : {}),
        },
    };
}

export const dynamic = 'force-dynamic';

export default async function RecipesPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const prefix = locale === 'en' ? '' : `/${locale}`;

    const recipes = await prisma.recipe.findMany({
        where: { isPublished: true },
        orderBy: { createdAt: 'desc' },
    });

    // JSON-LD
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Recipes & Pairings — Colchis Food',
        description: 'Traditional Georgian and easy modern recipes using artisanal cheese.',
        url: `${SITE_URL}${prefix}/recipes`,
        isPartOf: { '@type': 'WebSite', name: 'Colchis Food', url: SITE_URL },
        mainEntity: {
            '@type': 'ItemList',
            numberOfItems: recipes.length,
            itemListElement: recipes.map((r, idx) => ({
                '@type': 'ListItem',
                position: idx + 1,
                url: `${SITE_URL}${prefix}/recipes/${r.slug}`,
                name: r.title,
            })),
        },
    };

    const serialized = recipes.map(r => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description,
        prepTime: r.prepTime,
        cookTime: r.cookTime,
        servings: r.servings,
        difficulty: r.difficulty,
        imageUrl: r.imageUrl,
        contentBlocks: r.contentBlocks,
    }));

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

            {/* Hero */}
            <section className="ch-section" style={{ background: "#EAE2D2", padding: "100px 56px 72px" }}>
                <div className="ch-rec-hero" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 64, alignItems: "end" }}>
                    <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 24 }}>
                            № 10 — The Kitchen · სამზარეულო
                        </div>
                        <h1 className="ch-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 112, lineHeight: 0.92, letterSpacing: "-0.025em", margin: 0, color: "#1F3026" }}>
                            Cook with us, <em style={{ color: "#B96A3D", fontWeight: 300 }}>tonight.</em>
                        </h1>
                    </div>
                    <p className="ch-lede" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, lineHeight: 1.55, color: "#2C3D33", margin: 0, paddingBottom: 12 }}>
                        Traditional Georgian and easy modern. Filter by what you have time for, what you have in the fridge, and who you are feeding.
                    </p>
                </div>
            </section>

            <RecipesClient recipes={serialized} locale={locale} />
        </>
    );
}
