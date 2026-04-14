'use client';

import { useState, useTransition } from 'react';
import { Plus, Save, Trash2, X, ChevronDown, ChevronRight, Layers, Tag, GripVertical, Palette } from 'lucide-react';

interface ProductLineData {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string | null;
    badgeColor: string | null;
    sortOrder: number;
    isActive: boolean;
    categories: CategoryData[];
    _count: { products: number };
}

interface CategoryData {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    productLineId: string;
    sortOrder: number;
    isActive: boolean;
    _count?: { products: number };
}

interface ProductForAssign {
    id: string;
    name: string;
    sku: string;
    productLineId: string | null;
    categoryId: string | null;
}

interface CategoryManagerProps {
    productLines: ProductLineData[];
    allProducts: ProductForAssign[];
    saveLineAction: (formData: FormData) => Promise<void>;
    deleteLineAction: (formData: FormData) => Promise<void>;
    saveCategoryAction: (formData: FormData) => Promise<void>;
    deleteCategoryAction: (formData: FormData) => Promise<void>;
    assignAction: (formData: FormData) => Promise<void>;
}

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function CategoryManager({
    productLines,
    allProducts,
    saveLineAction,
    deleteLineAction,
    saveCategoryAction,
    deleteCategoryAction,
    assignAction,
}: CategoryManagerProps) {
    const [isPending, startTransition] = useTransition();
    const [toast, setToast] = useState<string | null>(null);
    const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set(productLines.map(l => l.id)));
    const [showLineForm, setShowLineForm] = useState(false);
    const [editingLine, setEditingLine] = useState<ProductLineData | null>(null);
    const [showCategoryForm, setShowCategoryForm] = useState<string | null>(null); // productLineId
    const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [assignModal, setAssignModal] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [assignLineId, setAssignLineId] = useState('');
    const [assignCatId, setAssignCatId] = useState('');

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const toggleLine = (id: string) => {
        const next = new Set(expandedLines);
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpandedLines(next);
    };

    const handleSaveLine = (formData: FormData) => {
        startTransition(async () => {
            await saveLineAction(formData);
            showToast(editingLine ? 'Product line updated' : 'Product line created');
            setShowLineForm(false);
            setEditingLine(null);
        });
    };

    const handleDeleteLine = (id: string) => {
        const fd = new FormData();
        fd.set('id', id);
        startTransition(async () => {
            try {
                await deleteLineAction(fd);
                showToast('Product line deleted');
            } catch (e: any) {
                showToast(e.message || 'Cannot delete');
            }
            setDeleteConfirm(null);
        });
    };

    const handleSaveCategory = (formData: FormData) => {
        startTransition(async () => {
            await saveCategoryAction(formData);
            showToast(editingCategory ? 'Category updated' : 'Category created');
            setShowCategoryForm(null);
            setEditingCategory(null);
        });
    };

    const handleDeleteCategory = (id: string) => {
        const fd = new FormData();
        fd.set('id', id);
        startTransition(async () => {
            try {
                await deleteCategoryAction(fd);
                showToast('Category deleted');
            } catch (e: any) {
                showToast(e.message || 'Cannot delete');
            }
            setDeleteConfirm(null);
        });
    };

    const handleBulkAssign = () => {
        if (!selectedProducts.size) return;
        const fd = new FormData();
        fd.set('productIds', JSON.stringify(Array.from(selectedProducts)));
        fd.set('productLineId', assignLineId);
        fd.set('categoryId', assignCatId);
        startTransition(async () => {
            // Assign one by one (using the single assign action)
            for (const pid of selectedProducts) {
                const singleFd = new FormData();
                singleFd.set('productId', pid);
                singleFd.set('productLineId', assignLineId);
                singleFd.set('categoryId', assignCatId);
                await assignAction(singleFd);
            }
            showToast(`${selectedProducts.size} products assigned`);
            setAssignModal(false);
            setSelectedProducts(new Set());
        });
    };

    const categoriesForLine = (lineId: string) => {
        const line = productLines.find(l => l.id === lineId);
        return line?.categories || [];
    };

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div className="fixed top-6 right-6 z-[100] bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-fade-in flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif text-white flex items-center gap-3">
                        <Layers className="w-8 h-8 text-[#CBA153]" />
                        Product Lines & Categories
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">
                        {productLines.length} product line{productLines.length !== 1 ? 's' : ''} · Manage your product architecture
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setAssignModal(true)}
                        className="flex items-center gap-2 bg-white/5 border border-white/10 text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-all"
                    >
                        <Tag className="w-4 h-4" /> Assign Products
                    </button>
                    <button
                        onClick={() => { setEditingLine(null); setShowLineForm(true); }}
                        className="flex items-center gap-2 bg-[#CBA153] text-black px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all shadow-lg shadow-[#CBA153]/20"
                    >
                        <Plus className="w-4 h-4" /> Add Product Line
                    </button>
                </div>
            </div>

            {/* ═══ Product Lines ═══ */}
            {productLines.map(line => (
                <div key={line.id} className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    {/* Line Header */}
                    <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
                        <button
                            onClick={() => toggleLine(line.id)}
                            className="flex items-center gap-3 text-left group"
                        >
                            {expandedLines.has(line.id) ? (
                                <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-[#CBA153] transition-colors" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-[#CBA153] transition-colors" />
                            )}
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: line.badgeColor || '#CBA153' }}
                            />
                            <div>
                                <h2 className="text-white font-bold text-lg">{line.name}</h2>
                                {line.tagline && (
                                    <p className="text-gray-500 text-xs mt-0.5">{line.tagline}</p>
                                )}
                            </div>
                        </button>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-600">
                                {line._count.products} product{line._count.products !== 1 ? 's' : ''} · {line.categories.length} categor{line.categories.length !== 1 ? 'ies' : 'y'}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${line.isActive ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                                {line.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <button
                                onClick={() => { setEditingLine(line); setShowLineForm(true); }}
                                className="text-xs text-[#CBA153] hover:text-white transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-[#CBA153]/10"
                            >
                                Edit
                            </button>
                        </div>
                    </div>

                    {/* Expanded: Categories */}
                    {expandedLines.has(line.id) && (
                        <div className="p-6 space-y-3">
                            {line.description && (
                                <p className="text-gray-400 text-sm mb-4 border-l-2 border-[#CBA153]/30 pl-4">{line.description}</p>
                            )}

                            {/* Category list */}
                            {line.categories.length > 0 ? (
                                <div className="space-y-2">
                                    {line.categories.map(cat => (
                                        <div
                                            key={cat.id}
                                            className="flex items-center justify-between bg-[#0D0D0D] rounded-lg px-4 py-3 border border-white/5 hover:border-[#CBA153]/20 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <GripVertical className="w-4 h-4 text-gray-700 group-hover:text-gray-500 cursor-grab" />
                                                <Tag className="w-4 h-4 text-[#CBA153]/60" />
                                                <div>
                                                    <span className="text-white text-sm font-medium">{cat.name}</span>
                                                    {cat.description && (
                                                        <p className="text-gray-600 text-xs mt-0.5">{cat.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-gray-600">
                                                    {cat._count?.products ?? 0} product{(cat._count?.products ?? 0) !== 1 ? 's' : ''}
                                                </span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cat.isActive ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                                                    {cat.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                                <button
                                                    onClick={() => { setEditingCategory(cat); setShowCategoryForm(line.id); }}
                                                    className="text-xs text-[#CBA153] hover:text-white transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                {deleteConfirm === cat.id ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            onClick={() => handleDeleteCategory(cat.id)}
                                                            className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-500 transition-colors"
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(null)}
                                                            className="text-xs text-gray-500 hover:text-white"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeleteConfirm(cat.id)}
                                                        className="text-xs text-red-400/40 hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-600 text-sm text-center py-4">No categories yet</p>
                            )}

                            {/* Add Category button */}
                            <button
                                onClick={() => { setEditingCategory(null); setShowCategoryForm(line.id); }}
                                className="flex items-center gap-2 text-xs text-[#CBA153] hover:text-white transition-colors mt-3 px-4 py-2 rounded-lg hover:bg-[#CBA153]/10"
                            >
                                <Plus className="w-3 h-3" /> Add Category
                            </button>
                        </div>
                    )}
                </div>
            ))}

            {productLines.length === 0 && (
                <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-12 text-center">
                    <Layers className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No product lines created yet</p>
                    <button
                        onClick={() => setShowLineForm(true)}
                        className="bg-[#CBA153] text-black px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all"
                    >
                        Create Your First Product Line
                    </button>
                </div>
            )}

            {/* ═══ Product Line Form Modal ═══ */}
            {showLineForm && (
                <>
                    <div className="fixed inset-0 bg-black/60 z-40" onClick={() => { setShowLineForm(false); setEditingLine(null); }} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[#111111] border border-white/10 rounded-2xl z-50 shadow-2xl">
                        <form action={handleSaveLine} className="p-6 space-y-5">
                            {editingLine && <input type="hidden" name="id" value={editingLine.id} />}
                            <div className="flex items-center justify-between">
                                <h2 className="text-white font-bold text-lg">
                                    {editingLine ? 'Edit Product Line' : 'Create Product Line'}
                                </h2>
                                <button type="button" onClick={() => { setShowLineForm(false); setEditingLine(null); }} className="text-gray-500 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Name</label>
                                    <input name="name" defaultValue={editingLine?.name || ''} required
                                        placeholder="Colchis Reserve™"
                                        className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Slug</label>
                                    <input name="slug" defaultValue={editingLine?.slug || ''} required
                                        placeholder="reserve"
                                        className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm font-mono" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                                        Badge Color <Palette className="w-3 h-3 text-gray-600" />
                                    </label>
                                    <input name="badgeColor" type="color" defaultValue={editingLine?.badgeColor || '#CBA153'}
                                        className="w-full h-10 bg-[#0D0D0D] border border-white/10 rounded-lg cursor-pointer" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Tagline</label>
                                <input name="tagline" defaultValue={editingLine?.tagline || ''}
                                    placeholder="Slow Pasteurized / LTLT / Premium Artisanal"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Description</label>
                                <textarea name="description" rows={3} defaultValue={editingLine?.description || ''}
                                    placeholder="The ultimate artisanal experience..."
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-none placeholder-gray-700 text-sm" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Sort Order</label>
                                    <input name="sortOrder" type="number" defaultValue={editingLine?.sortOrder ?? 0}
                                        className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm" />
                                </div>
                                <div className="flex items-end pb-1">
                                    <label className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer">
                                        <input type="checkbox" name="isActive" defaultChecked={editingLine?.isActive ?? true} className="accent-[#CBA153] w-4 h-4" />
                                        Active
                                    </label>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-white/10">
                                {editingLine ? (
                                    deleteConfirm === editingLine.id ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-red-400">Confirm delete?</span>
                                            <button type="button" onClick={() => handleDeleteLine(editingLine.id)}
                                                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-500 transition-colors font-medium">
                                                Delete
                                            </button>
                                            <button type="button" onClick={() => setDeleteConfirm(null)}
                                                className="text-xs text-gray-500 hover:text-white transition-colors">
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button type="button" onClick={() => setDeleteConfirm(editingLine.id)}
                                            className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors">
                                            <Trash2 className="w-3 h-3" /> Delete Line
                                        </button>
                                    )
                                ) : <div />}
                                <button type="submit" disabled={isPending}
                                    className="flex items-center gap-2 bg-[#CBA153] text-black px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50">
                                    <Save className="w-3.5 h-3.5" />
                                    {isPending ? 'Saving...' : editingLine ? 'Update Line' : 'Create Line'}
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}

            {/* ═══ Category Form Modal ═══ */}
            {showCategoryForm && (
                <>
                    <div className="fixed inset-0 bg-black/60 z-40" onClick={() => { setShowCategoryForm(null); setEditingCategory(null); }} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[#111111] border border-white/10 rounded-2xl z-50 shadow-2xl">
                        <form action={handleSaveCategory} className="p-6 space-y-5">
                            {editingCategory && <input type="hidden" name="id" value={editingCategory.id} />}
                            <input type="hidden" name="productLineId" value={showCategoryForm} />

                            <div className="flex items-center justify-between">
                                <h2 className="text-white font-bold text-lg">
                                    {editingCategory ? 'Edit Category' : 'Add Category'}
                                </h2>
                                <button type="button" onClick={() => { setShowCategoryForm(null); setEditingCategory(null); }} className="text-gray-500 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Category Name</label>
                                    <input name="name" defaultValue={editingCategory?.name || ''} required
                                        placeholder="Pulled-Curd Cheese"
                                        className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Slug</label>
                                    <input name="slug" defaultValue={editingCategory?.slug || ''} required
                                        placeholder="pulled-curd-cheese"
                                        className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm font-mono" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Sort Order</label>
                                    <input name="sortOrder" type="number" defaultValue={editingCategory?.sortOrder ?? 0}
                                        className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Description</label>
                                <textarea name="description" rows={2} defaultValue={editingCategory?.description || ''}
                                    placeholder="Optional description..."
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-none placeholder-gray-700 text-sm" />
                            </div>

                            <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer">
                                    <input type="checkbox" name="isActive" defaultChecked={editingCategory?.isActive ?? true} className="accent-[#CBA153] w-4 h-4" />
                                    Active
                                </label>
                            </div>

                            <div className="flex items-center justify-end pt-3 border-t border-white/10">
                                <button type="submit" disabled={isPending}
                                    className="flex items-center gap-2 bg-[#CBA153] text-black px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50">
                                    <Save className="w-3.5 h-3.5" />
                                    {isPending ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}

            {/* ═══ Assign Products Modal ═══ */}
            {assignModal && (
                <>
                    <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setAssignModal(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-[#111111] border border-white/10 rounded-2xl z-50 shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                            <h2 className="text-white font-bold text-lg">Assign Products to Line & Category</h2>
                            <button onClick={() => setAssignModal(false)} className="text-gray-500 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                            {/* Target line + category */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Product Line</label>
                                    <select
                                        value={assignLineId}
                                        onChange={e => { setAssignLineId(e.target.value); setAssignCatId(''); }}
                                        className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm"
                                    >
                                        <option value="">— None —</option>
                                        {productLines.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Category</label>
                                    <select
                                        value={assignCatId}
                                        onChange={e => setAssignCatId(e.target.value)}
                                        className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm"
                                    >
                                        <option value="">— None —</option>
                                        {categoriesForLine(assignLineId).map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Product checkboxes */}
                            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                                {allProducts.map(p => {
                                    const lineName = productLines.find(l => l.id === p.productLineId)?.name;
                                    return (
                                        <label
                                            key={p.id}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedProducts.has(p.id)}
                                                onChange={e => {
                                                    const next = new Set(selectedProducts);
                                                    if (e.target.checked) next.add(p.id); else next.delete(p.id);
                                                    setSelectedProducts(next);
                                                }}
                                                className="accent-[#CBA153] w-4 h-4"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm text-white">{p.name}</span>
                                                <span className="text-xs text-gray-600 ml-2 font-mono">{p.sku}</span>
                                            </div>
                                            {lineName && (
                                                <span className="text-[10px] text-[#CBA153] bg-[#CBA153]/10 px-2 py-0.5 rounded-full font-bold">
                                                    {lineName}
                                                </span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between flex-shrink-0 bg-[#0A0A0A]">
                            <span className="text-sm text-gray-500">{selectedProducts.size} selected</span>
                            <button
                                onClick={handleBulkAssign}
                                disabled={isPending || selectedProducts.size === 0}
                                className="flex items-center gap-2 bg-[#CBA153] text-black px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50"
                            >
                                <Save className="w-3.5 h-3.5" />
                                {isPending ? 'Assigning...' : 'Assign Selected'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
