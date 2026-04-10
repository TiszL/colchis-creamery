import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer';

interface RecipePageProps {
    params: Promise<{ locale: string; slug: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: RecipePageProps): Promise<Metadata> {
    const { slug } = await params;
    const recipe = await prisma.recipe.findFirst({ where: { slug, isPublished: true } });

    if (!recipe) return { title: 'Recipe Not Found | Colchis Creamery' };

    return {
        title: `${recipe.title} | Recipes & Pairings | Colchis Creamery`,
        description: recipe.description,
        openGraph: {
            title: recipe.title,
            description: recipe.description,
            images: recipe.imageUrl ? [recipe.imageUrl] : [],
            type: 'article',
            siteName: 'Colchis Creamery',
        },
        twitter: {
            card: 'summary_large_image',
            title: recipe.title,
            description: recipe.description,
            images: recipe.imageUrl ? [recipe.imageUrl] : [],
        },
        alternates: {
            canonical: `/recipes/${slug}`,
        },
    };
}

export default async function SingleRecipePage({ params }: RecipePageProps) {
    const { locale, slug } = await params;
    const prefix = locale === 'en' ? '' : `/${locale}`;
    const recipe = await prisma.recipe.findFirst({ where: { slug, isPublished: true } });

    if (!recipe) {
        notFound();
    }

    // JSON-LD structured data for Google recipe rich results
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: recipe.title,
        description: recipe.description,
        image: recipe.imageUrl || undefined,
        ...(recipe.prepTime && { prepTime: `PT${recipe.prepTime.replace(/\s/g, '').toUpperCase()}` }),
        ...(recipe.cookTime && { cookTime: `PT${recipe.cookTime.replace(/\s/g, '').toUpperCase()}` }),
        ...(recipe.servings && { recipeYield: recipe.servings }),
        recipeCategory: 'Georgian Cuisine',
        recipeCuisine: 'Georgian',
        author: {
            '@type': 'Organization',
            name: 'Colchis Creamery',
            url: 'https://colchiscreamery.com',
        },
        publisher: {
            '@type': 'Organization',
            name: 'Colchis Creamery',
            logo: {
                '@type': 'ImageObject',
                url: 'https://colchiscreamery.com/icon.png',
            },
        },
        datePublished: recipe.createdAt.toISOString(),
        dateModified: recipe.updatedAt.toISOString(),
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <main className="min-h-screen bg-[#FAFAFA] py-16 px-4">
                <article className="max-w-4xl mx-auto bg-white shadow-xl rounded-lg overflow-hidden flex flex-col" itemScope itemType="https://schema.org/Recipe">
                    {/* Cover Photo */}
                    {recipe.imageUrl && (
                        <div className="relative w-full h-[400px]">
                            <img
                                src={recipe.imageUrl}
                                alt={recipe.title}
                                className="w-full h-full object-cover"
                                itemProp="image"
                            />
                        </div>
                    )}

                    {/* Recipe Content */}
                    <div className="p-8 md:p-12">

                        <Link href={`${prefix}/recipes`} className="text-sm uppercase tracking-wider text-[#CBA153] font-medium hover:underline mb-6 inline-block">
                            ← Back to Recipes
                        </Link>

                        <h1 className="text-4xl md:text-5xl font-serif text-[#2C2A29] mb-6" itemProp="name">
                            {recipe.title}
                        </h1>

                        <p className="text-xl text-[#2C2A29] opacity-80 mb-10 leading-relaxed font-serif italic border-l-4 border-[#CBA153] pl-6" itemProp="description">
                            {recipe.description}
                        </p>

                        <div className="flex flex-wrap gap-8 py-6 border-y border-[#FDFBF7] mb-12">
                            {recipe.servings && (
                                <div>
                                    <span className="block text-xs uppercase text-gray-400 font-bold mb-1">Servings</span>
                                    <span className="font-serif text-[#2C2A29] text-lg" itemProp="recipeYield">{recipe.servings}</span>
                                </div>
                            )}
                            {recipe.prepTime && (
                                <div>
                                    <span className="block text-xs uppercase text-gray-400 font-bold mb-1">Prep Time</span>
                                    <span className="font-serif text-[#2C2A29] text-lg">{recipe.prepTime}</span>
                                </div>
                            )}
                            {recipe.cookTime && (
                                <div>
                                    <span className="block text-xs uppercase text-gray-400 font-bold mb-1">Cook Time</span>
                                    <span className="font-serif text-[#2C2A29] text-lg">{recipe.cookTime}</span>
                                </div>
                            )}
                            {recipe.difficulty && (
                                <div>
                                    <span className="block text-xs uppercase text-gray-400 font-bold mb-1">Difficulty</span>
                                    <span className="font-serif text-[#2C2A29] text-lg">{recipe.difficulty}</span>
                                </div>
                            )}
                        </div>

                        {/* Render content blocks (with legacy fallback) */}
                        <ContentBlockRenderer
                            blocks={recipe.contentBlocks}
                            legacyContent={recipe.content}
                        />
                    </div>
                </article>
            </main>
        </>
    );
}
