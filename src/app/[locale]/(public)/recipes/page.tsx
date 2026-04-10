import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
    title: 'Recipes & Pairings | Colchis Creamery',
    description: 'Discover gourmet recipes and perfect pairings utilizing authentic artisanal Georgian cheese.',
};

export const dynamic = 'force-dynamic';

export default async function RecipesPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const prefix = locale === 'en' ? '' : `/${locale}`;

    const recipes = await prisma.recipe.findMany({
        where: { isPublished: true },
        orderBy: { createdAt: 'desc' },
    });

    return (
        <main className="min-h-screen bg-[#FDFBF7] py-20 px-4">
            <div className="max-w-7xl mx-auto">

                {/* Header Section */}
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <h1 className="text-5xl font-serif text-[#2C2A29] mb-4">
                        Recipes & Pairings
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
                                        <img
                                            src={recipe.imageUrl}
                                            alt={recipe.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500 ease-in-out"
                                        />
                                    </div>
                                )}
                                <div className="p-8 w-full">
                                    <h3 className="text-2xl font-serif text-[#2C2A29] mb-3 group-hover:text-[#CBA153] transition">
                                        {recipe.title}
                                    </h3>
                                    <p className="text-[#2C2A29] opacity-75 mb-4 line-clamp-2">
                                        {recipe.description}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center text-sm font-medium text-[#CBA153] uppercase tracking-wide">
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
        </main>
    );
}
