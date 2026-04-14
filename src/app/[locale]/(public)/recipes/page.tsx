import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/db';
import { getOgImage, buildOgImages } from '@/lib/seo';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const canonicalPath = locale === 'en' ? '/recipes' : `/${locale}/recipes`;
    const ogImage = await getOgImage('recipes');

    return {
        title: 'Recipes & Pairings | Colchis Creamery',
        description: 'Discover gourmet recipes and perfect pairings using authentic artisanal Georgian cheese. From khachapuri to modern fusion dishes.',
        keywords: ['Georgian cheese recipes', 'Sulguni recipes', 'khachapuri', 'cheese pairings', 'artisanal cheese cooking', 'Colchis Creamery recipes'],
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: {
                'en': `${SITE_URL}/recipes`,
                'ka': `${SITE_URL}/ka/recipes`,
                'ru': `${SITE_URL}/ru/recipes`,
                'es': `${SITE_URL}/es/recipes`,
            },
        },
        openGraph: {
            type: 'website',
            title: 'Recipes & Pairings | Colchis Creamery',
            description: 'Discover gourmet recipes and perfect pairings using authentic artisanal Georgian cheese.',
            url: `${SITE_URL}${canonicalPath}`,
            siteName: 'Colchis Creamery',
            ...(ogImage ? { images: buildOgImages(ogImage, 'Recipes & Pairings') } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title: 'Recipes & Pairings | Colchis Creamery',
            description: 'Discover gourmet recipes and perfect pairings using authentic artisanal Georgian cheese.',
            ...(ogImage ? { images: [ogImage] } : {}),
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

    // JSON-LD: ItemList for recipe collection
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Recipes & Pairings',
        description: 'Gourmet recipes and perfect pairings using authentic artisanal Georgian cheese.',
        url: `${SITE_URL}${prefix}/recipes`,
        isPartOf: { '@type': 'WebSite', name: 'Colchis Creamery', url: SITE_URL },
        mainEntity: {
            '@type': 'ItemList',
            numberOfItems: recipes.length,
            itemListElement: recipes.map((recipe, idx) => ({
                '@type': 'ListItem',
                position: idx + 1,
                url: `${SITE_URL}${prefix}/recipes/${recipe.slug}`,
                name: recipe.title,
                description: recipe.description,
                ...(recipe.imageUrl ? { image: recipe.imageUrl } : {}),
            })),
        },
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <div className="min-h-screen bg-[#FDFBF7] py-20 px-4">
                <div className="max-w-7xl mx-auto">

                    {/* Header Section */}
                    <div className="text-center mb-16 max-w-3xl mx-auto">
                        <h1 className="text-5xl font-serif text-[#2C2A29] mb-4">
                            Recipes &amp; Pairings
                        </h1>
                        <p className="text-xl text-[#2C2A29] leading-relaxed opacity-80">
                            Culinary inspiration tailored for our premium cheeses. From gourmet sandwiches to elegant cheeseboards, explore the versatility of Colchis Creamery.
                        </p>
                    </div>

                    {recipes.length === 0 ? (
                        <div className="text-center py-20 text-[#2C2A29]/50">
                            <p className="text-lg">No recipes published yet. Check back soon!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            {recipes.map((recipe) => (
                                <Link
                                    href={`${prefix}/recipes/${recipe.slug}`}
                                    key={recipe.id}
                                    className="group flex flex-col items-center bg-white rounded-lg shadow-sm hover:shadow-xl transition overflow-hidden border border-[#FDFBF7]"
                                >
                                    {recipe.imageUrl && (
                                        <div className="relative w-full aspect-[16/9] overflow-hidden">
                                            <Image
                                                src={recipe.imageUrl}
                                                alt={recipe.title}
                                                fill
                                                sizes="(max-width: 768px) 100vw, 50vw"
                                                className="object-cover group-hover:scale-105 transition duration-500 ease-in-out"
                                            />
                                        </div>
                                    )}
                                    <div className="p-8 w-full">
                                        <h3 className="text-2xl font-serif text-[#2C2A29] mb-3 group-hover:text-[#A6812F] transition">
                                            {recipe.title}
                                        </h3>
                                        <p className="text-[#2C2A29] opacity-75 mb-4 line-clamp-2">
                                            {recipe.description}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center text-sm font-medium text-[#A6812F] uppercase tracking-wide">
                                                Read Recipe
                                                <span className="ml-2 transform group-hover:translate-x-1 transition">→</span>
                                            </div>
                                            <div className="flex gap-3 text-xs text-[#2C2A29]/40">
                                                {recipe.prepTime && <span>Prep: {recipe.prepTime}</span>}
                                                {recipe.cookTime && <span>Cook: {recipe.cookTime}</span>}
                                                {recipe.difficulty && <span>{recipe.difficulty}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                </div>
            </div>
        </>
    );
}
