import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { BookOpen, ArrowLeft, Save, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function saveRecipeAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const data = {
        title: formData.get('title') as string,
        slug: formData.get('slug') as string,
        description: formData.get('description') as string,
        content: formData.get('content') as string,
        prepTime: (formData.get('prepTime') as string) || null,
        cookTime: (formData.get('cookTime') as string) || null,
        servings: (formData.get('servings') as string) || null,
        difficulty: (formData.get('difficulty') as string) || null,
        imageUrl: (formData.get('imageUrl') as string) || null,
        isPublished: formData.get('isPublished') === 'on',
    };

    if (id) {
        await prisma.recipe.update({ where: { id }, data });
    } else {
        await prisma.recipe.create({ data });
    }

    revalidatePath('/admin/website/recipes');
    revalidatePath('/recipes');
}

async function deleteRecipeAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    if (id) {
        await prisma.recipe.delete({ where: { id } });
        revalidatePath('/admin/website/recipes');
        revalidatePath('/recipes');
    }
}

export default async function AdminRecipesPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const recipes = await prisma.recipe.findMany({ orderBy: { createdAt: 'desc' } });

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <Link href={`/${locale}/admin/website`} className="text-xs text-[#CBA153] hover:text-white transition-colors flex items-center gap-1 mb-3">
                        <ArrowLeft className="w-3 h-3" /> Back to Website Content
                    </Link>
                    <h1 className="text-3xl font-serif text-white mb-2">Recipe Manager</h1>
                    <p className="text-gray-500 font-light">Create, edit, and publish recipes displayed on the public website.</p>
                </div>
            </div>

            {/* New Recipe Form */}
            <form action={saveRecipeAction} className="bg-[#1A1A1A] rounded-xl border border-[#CBA153]/20 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Plus className="w-5 h-5 text-[#CBA153]" />
                        <h2 className="text-white font-bold">Create New Recipe</h2>
                    </div>
                    <button type="submit" className="flex items-center gap-2 bg-[#CBA153] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all">
                        <Save className="w-3.5 h-3.5" /> Create
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Title</label>
                            <input name="title" required placeholder="Khachapuri with Sulguni"
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Slug</label>
                            <input name="slug" required placeholder="khachapuri-sulguni"
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Description / Excerpt</label>
                        <textarea name="description" rows={2} required placeholder="A brief description..."
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-none placeholder-gray-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Full Content (Markdown)</label>
                        <textarea name="content" rows={6} required placeholder="## Ingredients&#10;- 500g flour&#10;- 300g sulguni cheese..."
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-y font-mono text-sm placeholder-gray-600" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Prep Time</label>
                            <input name="prepTime" placeholder="20 min" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Cook Time</label>
                            <input name="cookTime" placeholder="30 min" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Servings</label>
                            <input name="servings" placeholder="4" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Difficulty</label>
                            <select name="difficulty" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]">
                                <option value="Easy">Easy</option>
                                <option value="Medium">Medium</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Image URL</label>
                            <input name="imageUrl" placeholder="https://images.unsplash.com/..."
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600" />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer mt-6">
                            <input type="checkbox" name="isPublished" defaultChecked className="accent-[#CBA153] w-4 h-4" />
                            Published
                        </label>
                    </div>
                </div>
            </form>

            {/* Existing Recipes */}
            {recipes.map((recipe: any) => (
                <form key={recipe.id} action={saveRecipeAction} className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <BookOpen className="w-5 h-5 text-blue-400" />
                            <div>
                                <h3 className="text-white font-bold">{recipe.title}</h3>
                                <span className="text-xs text-gray-500">{new Date(recipe.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {recipe.isPublished ? (
                                <span className="text-xs bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded-full flex items-center gap-1"><Eye className="w-3 h-3" /> Published</span>
                            ) : (
                                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full flex items-center gap-1"><EyeOff className="w-3 h-3" /> Draft</span>
                            )}
                            <button type="submit" className="flex items-center gap-2 bg-[#CBA153] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all">
                                <Save className="w-3.5 h-3.5" /> Save
                            </button>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <input type="hidden" name="id" value={recipe.id} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Title</label>
                                <input name="title" defaultValue={recipe.title} required
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Slug</label>
                                <input name="slug" defaultValue={recipe.slug} required
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Description</label>
                            <textarea name="description" rows={2} defaultValue={recipe.description}
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Content (Markdown)</label>
                            <textarea name="content" rows={6} defaultValue={recipe.content}
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-y font-mono text-sm" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Prep Time</label>
                                <input name="prepTime" defaultValue={recipe.prepTime || ''} className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Cook Time</label>
                                <input name="cookTime" defaultValue={recipe.cookTime || ''} className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Servings</label>
                                <input name="servings" defaultValue={recipe.servings || ''} className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Difficulty</label>
                                <select name="difficulty" defaultValue={recipe.difficulty || 'Easy'} className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]">
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Image URL</label>
                                <input name="imageUrl" defaultValue={recipe.imageUrl || ''} className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer mt-6">
                                <input type="checkbox" name="isPublished" defaultChecked={recipe.isPublished} className="accent-[#CBA153] w-4 h-4" />
                                Published
                            </label>
                        </div>
                    </div>
                    <div className="px-6 py-3 bg-[#0D0D0D] border-t border-white/5 flex justify-end">
                        <form action={deleteRecipeAction}>
                            <input type="hidden" name="id" value={recipe.id} />
                            <button type="submit" className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors" onClick={(e) => { if (!confirm('Delete this recipe?')) e.preventDefault(); }}>
                                <Trash2 className="w-3 h-3" /> Delete
                            </button>
                        </form>
                    </div>
                </form>
            ))}

            {recipes.length === 0 && (
                <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-12 text-center text-gray-500">
                    No recipes yet. Create your first recipe above.
                </div>
            )}
        </div>
    );
}
