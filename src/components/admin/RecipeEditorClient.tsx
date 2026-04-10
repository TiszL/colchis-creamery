'use client';

import { useState, useCallback } from 'react';
import { Plus, Save, Trash2, Eye, EyeOff, BookOpen, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import ContentBlockEditor, { ContentBlock } from './ContentBlockEditor';
import MediaUploadZone from './MediaUploadZone';

interface Recipe {
    id: string;
    title: string;
    slug: string;
    description: string;
    content: string;
    contentBlocks: string | null;
    prepTime: string | null;
    cookTime: string | null;
    servings: string | null;
    difficulty: string | null;
    imageUrl: string | null;
    isPublished: boolean;
    createdAt: string;
}

// Convert blocks to plain text for legacy content field
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

// Auto-generate slug from title
function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function RecipeEditorClient({ recipes: initialRecipes, locale }: { recipes: Recipe[]; locale: string }) {
    const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [prepTime, setPrepTime] = useState('');
    const [cookTime, setCookTime] = useState('');
    const [servings, setServings] = useState('');
    const [difficulty, setDifficulty] = useState('Easy');
    const [imageUrl, setImageUrl] = useState('');
    const [isPublished, setIsPublished] = useState(true);
    const [blocks, setBlocks] = useState<ContentBlock[]>([]);

    const resetForm = useCallback(() => {
        setTitle('');
        setSlug('');
        setDescription('');
        setPrepTime('');
        setCookTime('');
        setServings('');
        setDifficulty('Easy');
        setImageUrl('');
        setIsPublished(true);
        setBlocks([]);
    }, []);

    const loadRecipe = useCallback((recipe: Recipe) => {
        setTitle(recipe.title);
        setSlug(recipe.slug);
        setDescription(recipe.description);
        setPrepTime(recipe.prepTime || '');
        setCookTime(recipe.cookTime || '');
        setServings(recipe.servings || '');
        setDifficulty(recipe.difficulty || 'Easy');
        setImageUrl(recipe.imageUrl || '');
        setIsPublished(recipe.isPublished);

        // Parse blocks or create from legacy content
        if (recipe.contentBlocks) {
            try {
                setBlocks(JSON.parse(recipe.contentBlocks));
            } catch {
                setBlocks([{ id: 'legacy', type: 'paragraph', data: { text: recipe.content } }]);
            }
        } else {
            setBlocks([{ id: 'legacy', type: 'paragraph', data: { text: recipe.content } }]);
        }

        setEditingId(recipe.id);
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
            description,
            content,
            contentBlocks,
            prepTime: prepTime || null,
            cookTime: cookTime || null,
            servings: servings || null,
            difficulty: difficulty || null,
            imageUrl: imageUrl || null,
            isPublished,
        };

        try {
            const res = await fetch('/api/admin/recipes', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error('Save failed');

            const saved = await res.json();

            if (editingId) {
                setRecipes(prev => prev.map(r => r.id === editingId ? { ...r, ...body, id: editingId, createdAt: r.createdAt } : r));
            } else {
                setRecipes(prev => [{ ...body, id: saved.id, createdAt: new Date().toISOString() } as Recipe, ...prev]);
                setEditingId(saved.id);
                setIsCreating(false);
            }
        } catch (err) {
            console.error('Save error:', err);
        } finally {
            setSaving(false);
        }
    }, [editingId, title, slug, description, blocks, prepTime, cookTime, servings, difficulty, imageUrl, isPublished]);

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm('Delete this recipe permanently?')) return;
        try {
            await fetch('/api/admin/recipes', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            setRecipes(prev => prev.filter(r => r.id !== id));
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

    // ─── LIST VIEW ───────────────────────────────────────────────────────────────
    if (!isEditing) {
        return (
            <div className="space-y-4">
                <button
                    onClick={handleCreate}
                    className="w-full flex items-center justify-center gap-2 bg-[#CBA153] text-black px-6 py-4 rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-white transition-all"
                >
                    <Plus className="w-4 h-4" /> Create New Recipe
                </button>

                {recipes.length === 0 ? (
                    <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-12 text-center text-gray-500">
                        No recipes yet. Create your first recipe above.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {recipes.map((recipe) => (
                            <div
                                key={recipe.id}
                                className="bg-[#1A1A1A] rounded-xl border border-white/5 hover:border-[#CBA153]/20 transition-all overflow-hidden"
                            >
                                <div className="p-3 sm:p-4">
                                    {/* Top row: thumbnail + title + mobile actions */}
                                    <div className="flex items-start gap-3">
                                        {/* Thumbnail */}
                                        <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[#0D0D0D] border border-white/10 flex-shrink-0">
                                            {recipe.imageUrl ? (
                                                <img src={recipe.imageUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-white font-bold text-sm sm:text-base truncate">{recipe.title}</h3>
                                            <p className="text-[11px] sm:text-xs text-gray-500 truncate mt-0.5">{recipe.description}</p>
                                        </div>
                                    </div>

                                    {/* Bottom row: status + actions */}
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                        {recipe.isPublished ? (
                                            <span className="text-[11px] sm:text-xs bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded-full flex items-center gap-1">
                                                <Eye className="w-3 h-3" /> Published
                                            </span>
                                        ) : (
                                            <span className="text-[11px] sm:text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full flex items-center gap-1">
                                                <EyeOff className="w-3 h-3" /> Draft
                                            </span>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => loadRecipe(recipe)}
                                                className="flex items-center gap-1 text-xs text-[#CBA153] hover:text-white transition-colors px-2 py-1.5"
                                            >
                                                Edit <ChevronRight className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(recipe.id)}
                                                className="text-red-400/40 hover:text-red-400 transition-colors p-1.5"
                                            >
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

    // ─── EDITOR VIEW ─────────────────────────────────────────────────────────────
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
                    value={imageUrl ? [imageUrl] : []}
                    onChange={(urls) => setImageUrl(urls[0] || '')}
                    type="image"
                    label="Cover Image (16:9 landscape)"
                    multiple={false}
                    maxFiles={1}
                />
            </div>

            {/* Title + Slug */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-6 space-y-4">
                <div>
                    <input
                        value={title}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            if (isCreating) setSlug(slugify(e.target.value));
                        }}
                        placeholder="Recipe Title"
                        className={`${inputClass} text-2xl font-serif`}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 font-mono">/recipes/</span>
                    <input
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="recipe-slug"
                        className="flex-1 bg-[#0D0D0D] border border-white/10 text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm font-mono"
                    />
                </div>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description / excerpt for preview cards..."
                    rows={2}
                    className={`${inputClass} resize-none text-sm`}
                />
            </div>

            {/* Metadata bar */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Prep Time</label>
                        <input value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="20 min" className={`${inputClass} !py-2 text-sm`} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Cook Time</label>
                        <input value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="30 min" className={`${inputClass} !py-2 text-sm`} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Servings</label>
                        <input value={servings} onChange={(e) => setServings(e.target.value)} placeholder="4" className={`${inputClass} !py-2 text-sm`} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Difficulty</label>
                        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={`${inputClass} !py-2 text-sm`}>
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Content block editor */}
            <div>
                <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[#CBA153]" />
                    Recipe Content
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
