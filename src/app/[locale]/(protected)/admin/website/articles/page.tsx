import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { FileText, ArrowLeft, Save, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function saveArticleAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const isPublished = formData.get('isPublished') === 'on';
    const data = {
        title: formData.get('title') as string,
        slug: formData.get('slug') as string,
        excerpt: (formData.get('excerpt') as string) || null,
        content: formData.get('content') as string,
        coverImage: (formData.get('coverImage') as string) || null,
        tags: (formData.get('tags') as string) || null,
        isPublished,
    };

    if (id) {
        const existing = await prisma.article.findUnique({ where: { id } });
        await prisma.article.update({
            where: { id },
            data: {
                ...data,
                publishedAt: !existing?.isPublished && isPublished ? new Date() : existing?.publishedAt,
            },
        });
    } else {
        await prisma.article.create({
            data: {
                ...data,
                publishedAt: isPublished ? new Date() : null,
            },
        });
    }

    revalidatePath('/admin/website/articles');
}

async function deleteArticleAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    if (id) {
        await prisma.article.delete({ where: { id } });
        revalidatePath('/admin/website/articles');
    }
}

export default async function AdminArticlesPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const articles = await prisma.article.findMany({ orderBy: { createdAt: 'desc' } });

    return (
        <div className="space-y-8">
            <div>
                <Link href={`/${locale}/admin/website`} className="text-xs text-[#CBA153] hover:text-white transition-colors flex items-center gap-1 mb-3">
                    <ArrowLeft className="w-3 h-3" /> Back to Website Content
                </Link>
                <h1 className="text-3xl font-serif text-white mb-2">Article Manager</h1>
                <p className="text-gray-500 font-light">Create and manage blog articles and news posts.</p>
            </div>

            {/* New Article Form */}
            <form action={saveArticleAction} className="bg-[#1A1A1A] rounded-xl border border-[#CBA153]/20 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Plus className="w-5 h-5 text-[#CBA153]" />
                        <h2 className="text-white font-bold">Create New Article</h2>
                    </div>
                    <button type="submit" className="flex items-center gap-2 bg-[#CBA153] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all">
                        <Save className="w-3.5 h-3.5" /> Create
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Title</label>
                            <input name="title" required placeholder="The Art of Georgian Cheesemaking"
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Slug</label>
                            <input name="slug" required placeholder="art-of-georgian-cheesemaking"
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Excerpt</label>
                        <textarea name="excerpt" rows={2} placeholder="A brief summary for previews..."
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-none placeholder-gray-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Content (Markdown)</label>
                        <textarea name="content" rows={8} required placeholder="Write your article content here..."
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-y font-mono text-sm placeholder-gray-600" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Cover Image URL</label>
                            <input name="coverImage" placeholder="https://images.unsplash.com/..."
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Tags (comma-separated)</label>
                            <input name="tags" placeholder="cheese, heritage, recipes"
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600" />
                        </div>
                        <div className="flex items-end pb-1">
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input type="checkbox" name="isPublished" className="accent-[#CBA153] w-4 h-4" />
                                Publish Immediately
                            </label>
                        </div>
                    </div>
                </div>
            </form>

            {/* Existing Articles */}
            {articles.map((article: any) => (
                <form key={article.id} action={saveArticleAction} className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-purple-400" />
                            <div>
                                <h3 className="text-white font-bold">{article.title}</h3>
                                <span className="text-xs text-gray-500">{new Date(article.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {article.isPublished ? (
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
                        <input type="hidden" name="id" value={article.id} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Title</label>
                                <input name="title" defaultValue={article.title} required
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Slug</label>
                                <input name="slug" defaultValue={article.slug} required
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Excerpt</label>
                            <textarea name="excerpt" rows={2} defaultValue={article.excerpt || ''}
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Content (Markdown)</label>
                            <textarea name="content" rows={6} defaultValue={article.content}
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-y font-mono text-sm" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Cover Image URL</label>
                                <input name="coverImage" defaultValue={article.coverImage || ''}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Tags</label>
                                <input name="tags" defaultValue={article.tags || ''}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                    <input type="checkbox" name="isPublished" defaultChecked={article.isPublished} className="accent-[#CBA153] w-4 h-4" />
                                    Published
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-3 bg-[#0D0D0D] border-t border-white/5 flex justify-end">
                        <form action={deleteArticleAction}>
                            <input type="hidden" name="id" value={article.id} />
                            <button type="submit" className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors" onClick={(e) => { if (!confirm('Delete this article?')) e.preventDefault(); }}>
                                <Trash2 className="w-3 h-3" /> Delete
                            </button>
                        </form>
                    </div>
                </form>
            ))}

            {articles.length === 0 && (
                <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-12 text-center text-gray-500">
                    No articles yet. Create your first article above.
                </div>
            )}
        </div>
    );
}
