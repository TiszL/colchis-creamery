'use client';

import { useState, useCallback } from 'react';
import { Plus, Save, Trash2, Eye, EyeOff, FileText, ChevronRight, ArrowLeft, Loader2, Tag } from 'lucide-react';
import ContentBlockEditor, { ContentBlock } from './ContentBlockEditor';
import MediaUploadZone from './MediaUploadZone';

interface Article {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string;
    contentBlocks: string | null;
    coverImage: string | null;
    tags: string | null;
    isPublished: boolean;
    publishedAt: string | null;
    createdAt: string;
}

function blocksToPlainText(blocks: ContentBlock[]): string {
    return blocks.map(b => {
        switch (b.type) {
            case 'heading':
                return `${'#'.repeat(b.data.level || 2)} ${b.data.text}`;
            case 'paragraph':
                return b.data.text;
            case 'list':
                return (b.data.items || []).map((item: string) =>
                    b.data.style === 'ordered' ? `1. ${item}` : `- ${item}`
                ).join('\n');
            case 'quote':
                return `> ${b.data.text}${b.data.attribution ? `\n> — ${b.data.attribution}` : ''}`;
            case 'image':
                return `![${b.data.alt || ''}](${b.data.url})`;
            case 'divider':
                return '---';
            default:
                return '';
        }
    }).filter(Boolean).join('\n\n');
}

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function JournalEditorClient({ articles: initialArticles, locale }: { articles: Article[]; locale: string }) {
    const [articles, setArticles] = useState<Article[]>(initialArticles);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [coverImage, setCoverImage] = useState('');
    const [tags, setTags] = useState('');
    const [isPublished, setIsPublished] = useState(false);
    const [blocks, setBlocks] = useState<ContentBlock[]>([]);

    const resetForm = useCallback(() => {
        setTitle('');
        setSlug('');
        setExcerpt('');
        setCoverImage('');
        setTags('');
        setIsPublished(false);
        setBlocks([]);
    }, []);

    const loadArticle = useCallback((article: Article) => {
        setTitle(article.title);
        setSlug(article.slug);
        setExcerpt(article.excerpt || '');
        setCoverImage(article.coverImage || '');
        setTags(article.tags || '');
        setIsPublished(article.isPublished);

        if (article.contentBlocks) {
            try {
                setBlocks(JSON.parse(article.contentBlocks));
            } catch {
                setBlocks([{ id: 'legacy', type: 'paragraph', data: { text: article.content } }]);
            }
        } else {
            setBlocks([{ id: 'legacy', type: 'paragraph', data: { text: article.content } }]);
        }

        setEditingId(article.id);
        setIsCreating(false);
    }, []);

    const handleCreate = useCallback(() => {
        resetForm();
        setIsCreating(true);
        setEditingId(null);
    }, [resetForm]);

    const handleSave = useCallback(async () => {
        if (!title || !slug) return;
        setSaving(true);

        const contentBlocks = JSON.stringify(blocks);
        const content = blocksToPlainText(blocks);

        const body = {
            id: editingId,
            title,
            slug,
            excerpt: excerpt || null,
            content,
            contentBlocks,
            coverImage: coverImage || null,
            tags: tags || null,
            isPublished,
        };

        try {
            const res = await fetch('/api/admin/articles', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error('Save failed');
            const saved = await res.json();

            if (editingId) {
                setArticles(prev => prev.map(a => a.id === editingId ? { ...a, ...body, id: editingId, createdAt: a.createdAt, publishedAt: a.publishedAt } : a));
            } else {
                setArticles(prev => [{ ...body, id: saved.id, createdAt: new Date().toISOString(), publishedAt: isPublished ? new Date().toISOString() : null } as Article, ...prev]);
                setEditingId(saved.id);
                setIsCreating(false);
            }
        } catch (err) {
            console.error('Save error:', err);
        } finally {
            setSaving(false);
        }
    }, [editingId, title, slug, excerpt, blocks, coverImage, tags, isPublished]);

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm('Delete this article permanently?')) return;
        try {
            await fetch('/api/admin/articles', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            setArticles(prev => prev.filter(a => a.id !== id));
            if (editingId === id) {
                setEditingId(null);
                setIsCreating(false);
                resetForm();
            }
        } catch (err) {
            console.error('Delete error:', err);
        }
    }, [editingId, resetForm]);

    const isEditing = editingId || isCreating;

    // ─── LIST VIEW ───
    if (!isEditing) {
        return (
            <div className="space-y-4">
                <button
                    onClick={handleCreate}
                    className="w-full flex items-center justify-center gap-2 bg-[#CBA153] text-black px-6 py-4 rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-white transition-all"
                >
                    <Plus className="w-4 h-4" /> Create New Journal Entry
                </button>

                {articles.length === 0 ? (
                    <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-12 text-center text-gray-500">
                        No journal entries yet. Create your first article above.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {articles.map((article) => (
                            <div
                                key={article.id}
                                className="bg-[#1A1A1A] rounded-xl border border-white/5 hover:border-[#CBA153]/20 transition-all overflow-hidden"
                            >
                                <div className="p-3 sm:p-4">
                                    {/* Top row: thumbnail + title */}
                                    <div className="flex items-start gap-3">
                                        <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[#0D0D0D] border border-white/10 flex-shrink-0">
                                            {article.coverImage ? (
                                                <img src={article.coverImage} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-white font-bold text-sm sm:text-base truncate">{article.title}</h3>
                                            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-500 mt-0.5">
                                                <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                                                {article.tags && (
                                                    <>
                                                        <span>·</span>
                                                        <div className="flex items-center gap-1">
                                                            <Tag className="w-3 h-3" />
                                                            <span className="truncate max-w-[100px] sm:max-w-[150px]">{article.tags}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom row: status + actions */}
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                        {article.isPublished ? (
                                            <span className="text-[11px] sm:text-xs bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded-full flex items-center gap-1">
                                                <Eye className="w-3 h-3" /> Published
                                            </span>
                                        ) : (
                                            <span className="text-[11px] sm:text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full flex items-center gap-1">
                                                <EyeOff className="w-3 h-3" /> Draft
                                            </span>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => loadArticle(article)} className="flex items-center gap-1 text-xs text-[#CBA153] hover:text-white transition-colors px-2 py-1.5">
                                                Edit <ChevronRight className="w-3 h-3" />
                                            </button>
                                            <button onClick={() => handleDelete(article.id)} className="text-red-400/40 hover:text-red-400 transition-colors p-1.5">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ─── EDITOR VIEW ───
    const inputClass = "w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600";

    return (
        <div className="space-y-6">
            {/* Editor header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <button
                    onClick={() => { setEditingId(null); setIsCreating(false); resetForm(); }}
                    className="flex items-center gap-2 text-sm text-[#CBA153] hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to list
                </button>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isPublished}
                            onChange={(e) => setIsPublished(e.target.checked)}
                            className="accent-[#CBA153] w-4 h-4"
                        />
                        {isPublished ? 'Published' : 'Draft'}
                    </label>
                    <button
                        onClick={handleSave}
                        disabled={saving || !title || !slug}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#CBA153] text-black px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {isCreating ? 'Create' : 'Save'}
                    </button>
                </div>
            </div>

            {/* Cover image */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-6">
                <MediaUploadZone
                    value={coverImage ? [coverImage] : []}
                    onChange={(urls) => setCoverImage(urls[0] || '')}
                    type="image"
                    label="Cover Image (16:9 landscape)"
                    multiple={false}
                    maxFiles={1}
                />
            </div>

            {/* Title + Slug + Tags */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-6 space-y-4">
                <input
                    value={title}
                    onChange={(e) => {
                        setTitle(e.target.value);
                        if (isCreating) setSlug(slugify(e.target.value));
                    }}
                    placeholder="Article Title"
                    className={`${inputClass} text-2xl font-serif`}
                />
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 font-mono">/journal/</span>
                    <input
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="article-slug"
                        className="flex-1 bg-[#0D0D0D] border border-white/10 text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm font-mono"
                    />
                </div>
                <textarea
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    placeholder="Brief excerpt / summary for preview cards and SEO meta description..."
                    rows={2}
                    className={`${inputClass} resize-none text-sm`}
                />
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Tags (comma-separated)</label>
                    <input
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="cheese, heritage, recipes, georgian"
                        className={`${inputClass} text-sm`}
                    />
                </div>
            </div>

            {/* Content block editor */}
            <div>
                <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#CBA153]" />
                    Article Content
                </label>
                <ContentBlockEditor
                    key={editingId || 'create'}
                    initialBlocks={blocks}
                    onChange={setBlocks}
                />
            </div>
        </div>
    );
}
