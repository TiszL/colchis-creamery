import { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { recipes } from '@/lib/recipe-data';
import { JsonLdRecipe } from '@/components/seo/JsonLdRecipe';
import Link from 'next/link';

interface RecipePageProps {
    params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: RecipePageProps): Promise<Metadata> {
    const { slug } = await params;
    const recipe = recipes.find(r => r.slug === slug);

    if (!recipe) return { title: 'Recipe Not Found | Colchis Creamery' };

    return {
        title: `${recipe.title} | Colchis Creamery`,
        description: recipe.excerpt,
        openGraph: {
            title: recipe.title,
            description: recipe.excerpt,
            images: [recipe.coverImage],
            type: 'article',
        },
    };
}

export default async function SingleRecipePage({ params }: RecipePageProps) {
    const { locale, slug } = await params;
    const prefix = locale === 'en' ? '' : `/${locale}`;
    const recipe = recipes.find(r => r.slug === slug);

    if (!recipe) {
        notFound();
    }

    return (
        <main className="min-h-screen bg-[#FAFAFA] py-16 px-4">
            {/* JSON-LD Schema explicitly passed for AI / Google SEO Bots */}
            <JsonLdRecipe recipe={recipe} />

            <article className="max-w-4xl mx-auto bg-white shadow-xl rounded-lg overflow-hidden flex flex-col">
                {/* Cover Photo */}
                <div className="relative w-full h-[400px]">
                    <img
                        src={recipe.coverImage}
                        alt={recipe.title}
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Recipe Content */}
                <div className="p-8 md:p-12">

                    <Link href={`${prefix}/recipes`} className="text-sm uppercase tracking-wider text-[#CBA153] font-medium hover:underline mb-6 inline-block">
                        ← Back to Recipes
                    </Link>

                    <h1 className="text-4xl md:text-5xl font-serif text-[#2C2A29] mb-6">
                        {recipe.title}
                    </h1>

                    <p className="text-xl text-[#2C2A29] opacity-80 mb-10 leading-relaxed font-serif italic border-l-4 border-[#CBA153] pl-6">
                        {recipe.excerpt}
                    </p>

                    <div className="flex flex-wrap gap-8 py-6 border-y border-[#FDFBF7] mb-12">
                        <div>
                            <span className="block text-xs uppercase text-gray-400 font-bold mb-1">Yield</span>
                            <span className="font-serif text-[#2C2A29] text-lg">{recipe.yield}</span>
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-gray-400 font-bold mb-1">Prep Time</span>
                            <span className="font-serif text-[#2C2A29] text-lg">{recipe.preparationTime.replace('PT', '').replace('M', ' min')}</span>
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-gray-400 font-bold mb-1">Cook Time</span>
                            <span className="font-serif text-[#2C2A29] text-lg">{recipe.cookingTime.replace('PT', '').replace('M', ' min')}</span>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-12">

                        {/* Ingredients */}
                        <div className="md:w-1/3">
                            <h3 className="text-2xl font-serif text-[#CBA153] mb-6">Ingredients</h3>
                            <ul className="space-y-4">
                                {recipe.ingredients.map((ingredient, idx) => (
                                    <li key={idx} className="flex items-start text-[#2C2A29]">
                                        <span className="inline-block w-2 h-2 rounded-full bg-[#CBA153] mt-2 mr-3 flex-shrink-0"></span>
                                        <span className="leading-relaxed">{ingredient}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Instructions */}
                        <div className="md:w-2/3">
                            <h3 className="text-2xl font-serif text-[#CBA153] mb-6">Instructions</h3>
                            <div className="space-y-8">
                                {recipe.instructions.map((step, idx) => (
                                    <div key={idx} className="flex">
                                        <div className="flex-shrink-0 mr-6">
                                            <span className="flex items-center justify-center w-8 h-8 rounded-full border border-[#CBA153] text-[#CBA153] font-serif bg-[#FDFBF7]">
                                                {idx + 1}
                                            </span>
                                        </div>
                                        <p className="text-[#2C2A29] leading-relaxed pt-1">
                                            {step}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                </div>
            </article>
        </main>
    );
}
