'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Search, Plus, Save, Trash2, X, Eye, EyeOff, Package, AlertTriangle, Image as ImageIcon, Film, ChevronDown } from 'lucide-react';
import MediaUploadZone from './MediaUploadZone';

interface ProductLineOption {
    id: string;
    slug: string;
    name: string;
    badgeColor: string | null;
    categories: { id: string; slug: string; name: string }[];
}

interface Product {
    id: string;
    sku: string;
    name: string;
    slug: string;
    description: string;
    flavorProfile: string | null;
    pairsWith: string | null;
    weight: string | null;
    ingredients: string | null;
    imageUrl: string;
    images: string[];
    videoUrls: string[];
    priceB2c: string;
    priceB2b: string;
    stockQuantity: number;
    category: string | null;
    productLineId: string | null;
    categoryId: string | null;
    status: string;
    isActive: boolean;
    isB2cVisible: boolean;
    isB2bVisible: boolean;
}

interface InventoryClientProps {
    products: Product[];
    productLines: ProductLineOption[];
    locale: string;
    saveAction: (formData: FormData) => Promise<void>;
    deleteAction: (formData: FormData) => Promise<void>;
    quickStockAction: (formData: FormData) => Promise<void>;
}

// Helper: YouTube ID extractor
function getYouTubeId(url: string) {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

// Helper: derive thumbnail URL from full image URL
function getThumbUrl(url: string): string {
    if (!url) return url;
    // For uploaded files (local or Vercel Blob): xxx.webp → xxx-thumb.webp
    if (url.endsWith('.webp')) {
        return url.replace(/\.webp$/, '-thumb.webp');
    }
    return url; // External URLs: use as-is
}

export default function InventoryClient({ products, productLines, locale, saveAction, deleteAction, quickStockAction }: InventoryClientProps) {
    const [selectedLineId, setSelectedLineId] = useState<string>('');
    const [search, setSearch] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editProduct, setEditProduct] = useState<Product | null>(null);
    const [isCreateMode, setIsCreateMode] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [toast, setToast] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const drawerRef = useRef<HTMLDivElement>(null);

    // Media state for drawer
    const [primaryImageUrl, setPrimaryImageUrl] = useState<string>('');
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [videoLinks, setVideoLinks] = useState<string[]>([]);

    // Filter products
    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
    );

    // Open drawer for editing
    const openEdit = (product: Product) => {
        setEditProduct(product);
        setIsCreateMode(false);
        setPrimaryImageUrl(product.imageUrl || '');
        setGalleryImages(product.images || []);
        setVideoLinks(product.videoUrls || []);
        setSelectedLineId(product.productLineId || '');
        setDrawerOpen(true);
        setDeleteConfirm(null);
    };

    // Open drawer for creating
    const openCreate = () => {
        setEditProduct(null);
        setIsCreateMode(true);
        setPrimaryImageUrl('');
        setGalleryImages([]);
        setVideoLinks([]);
        setSelectedLineId('');
        setDrawerOpen(true);
        setDeleteConfirm(null);
    };

    // Get categories for selected line
    const categoriesForLine = productLines.find(l => l.id === selectedLineId)?.categories || [];

    // Helper: get line name by ID
    const getLineName = (id: string | null) => productLines.find(l => l.id === id)?.name || null;
    const getLineColor = (id: string | null) => productLines.find(l => l.id === id)?.badgeColor || '#CBA153';

    const closeDrawer = () => {
        setDrawerOpen(false);
        setTimeout(() => {
            setEditProduct(null);
            setIsCreateMode(false);
            setDeleteConfirm(null);
        }, 300);
    };

    // Show toast
    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    // Handle form submit (save)
    const handleSave = (formData: FormData) => {
        // Inject media URLs from state (managed by MediaUploadZone)
        if (primaryImageUrl.trim()) formData.set('imageUrl', primaryImageUrl.trim());
        galleryImages.filter(u => u.trim()).forEach(url => formData.append('images[]', url));
        videoLinks.filter(u => u.trim()).forEach(url => formData.append('videoUrls[]', url));

        startTransition(async () => {
            await saveAction(formData);
            showToast(isCreateMode ? 'Product created successfully' : 'Product updated successfully');
            closeDrawer();
        });
    };

    // Handle delete
    const handleDelete = (id: string) => {
        const fd = new FormData();
        fd.set('id', id);
        startTransition(async () => {
            await deleteAction(fd);
            showToast('Product deleted');
            closeDrawer();
        });
    };

    // Handle quick stock update
    const handleQuickStock = (formData: FormData) => {
        startTransition(async () => {
            await quickStockAction(formData);
            showToast('Stock updated');
        });
    };

    // Stock level badge
    const stockBadge = (qty: number) => {
        if (qty <= 0) return <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Out</span>;
        if (qty < 10) return <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded-full font-medium">{qty} Low</span>;
        return <span className="text-xs bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded-full font-medium">{qty}</span>;
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
                        <Package className="w-8 h-8 text-[#CBA153]" />
                        Product Inventory
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">{products.length} products · Manage stock, pricing, and content</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-[#CBA153] text-black px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all shadow-lg shadow-[#CBA153]/20"
                >
                    <Plus className="w-4 h-4" /> Add Product
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name or SKU..."
                    className="w-full bg-[#1A1A1A] border border-white/10 text-white py-3 pl-11 pr-4 rounded-xl focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm"
                />
            </div>

            {/* Product Table */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#0D0D0D] text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                            <tr>
                                <th className="px-5 py-4">Product</th>
                                <th className="px-5 py-4">SKU</th>
                                <th className="px-5 py-4 text-center">Stock</th>
                                <th className="px-5 py-4">Line</th>
                                <th className="px-5 py-4 text-right">B2C Price</th>
                                <th className="px-5 py-4 text-right">B2B Price</th>
                                <th className="px-5 py-4 text-center">Status</th>
                                <th className="px-5 py-4 text-center">Visibility</th>
                                <th className="px-5 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.map(product => (
                                <tr key={product.id} className="hover:bg-white/[0.02] transition-colors">
                                    {/* Product */}
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#2C2A29] flex-shrink-0 border border-white/10">
                                                <img src={getThumbUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-white font-medium truncate max-w-[200px]">{product.name}</p>
                                                <p className="text-gray-600 text-xs truncate max-w-[200px]">{product.description.slice(0, 50)}...</p>
                                            </div>
                                        </div>
                                    </td>
                                    {/* SKU */}
                                    <td className="px-5 py-4">
                                        <span className="font-mono text-xs text-gray-400">{product.sku}</span>
                                    </td>
                                    {/* Stock — Quick Edit */}
                                    <td className="px-5 py-4">
                                        <form action={handleQuickStock} className="flex items-center justify-center gap-1.5">
                                            <input type="hidden" name="id" value={product.id} />
                                            <input
                                                type="number"
                                                name="stock"
                                                defaultValue={product.stockQuantity}
                                                className="w-16 text-center text-white bg-[#0D0D0D] border border-white/10 rounded-md py-1 text-xs focus:outline-none focus:border-[#CBA153]"
                                            />
                                            <button type="submit" className="text-gray-600 hover:text-[#CBA153] transition-colors" title="Quick update stock">
                                                <Save className="w-3 h-3" />
                                            </button>
                                        </form>
                                    </td>
                                    {/* Product Line Badge */}
                                    <td className="px-5 py-4">
                                        {getLineName(product.productLineId) ? (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${getLineColor(product.productLineId)}20`, color: getLineColor(product.productLineId) }}>
                                                {getLineName(product.productLineId)}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-700">—</span>
                                        )}
                                    </td>
                                    {/* B2C Price */}
                                    <td className="px-5 py-4 text-right text-gray-300 text-xs">${product.priceB2c}</td>
                                    {/* B2B Price */}
                                    <td className="px-5 py-4 text-right text-gray-300 text-xs">${product.priceB2b}</td>
                                    {/* Status */}
                                    <td className="px-5 py-4 text-center">
                                        {product.status === 'ACTIVE' ? (
                                            <span className="text-xs bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded-full flex items-center justify-center gap-1 w-fit mx-auto"><Eye className="w-3 h-3" /> Active</span>
                                        ) : product.status === 'COMING_SOON' ? (
                                            <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded-full flex items-center justify-center gap-1 w-fit mx-auto"><AlertTriangle className="w-3 h-3" /> Coming Soon</span>
                                        ) : (
                                            <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full flex items-center justify-center gap-1 w-fit mx-auto"><EyeOff className="w-3 h-3" /> Inactive</span>
                                        )}
                                    </td>
                                    {/* Visibility */}
                                    <td className="px-5 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            {product.isB2cVisible && <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-bold">B2C</span>}
                                            {product.isB2bVisible && <span className="text-[10px] bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded font-bold">B2B</span>}
                                        </div>
                                    </td>
                                    {/* Actions */}
                                    <td className="px-5 py-4 text-center">
                                        <button
                                            onClick={() => openEdit(product)}
                                            className="text-xs text-[#CBA153] hover:text-white transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-[#CBA153]/10"
                                        >
                                            Edit Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && (
                    <div className="p-12 text-center text-gray-600">
                        {search ? 'No products match your search.' : 'No products found. Add your first product.'}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* SLIDE-OVER DRAWER                                                  */}
            {/* ═══════════════════════════════════════════════════════════════════ */}

            {/* Backdrop */}
            {drawerOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 transition-opacity"
                    onClick={closeDrawer}
                />
            )}

            {/* Drawer */}
            <div
                ref={drawerRef}
                className={`fixed top-0 right-0 h-full w-full sm:w-[520px] bg-[#111111] border-l border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${drawerOpen ? 'translate-x-0' : 'translate-x-full'
                    } flex flex-col`}
            >
                {/* Drawer Header */}
                <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {editProduct && !isCreateMode ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#2C2A29] border border-white/10 flex-shrink-0">
                                <img src={getThumbUrl(editProduct.imageUrl)} alt="" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-lg bg-[#CBA153]/20 flex items-center justify-center flex-shrink-0">
                                <Plus className="w-5 h-5 text-[#CBA153]" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-white font-bold text-lg">
                                {isCreateMode ? 'Add New Product' : 'Edit Product'}
                            </h2>
                            {editProduct && !isCreateMode && (
                                <span className="text-xs text-gray-500 font-mono">{editProduct.sku}</span>
                            )}
                        </div>
                    </div>
                    <button onClick={closeDrawer} className="text-gray-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Drawer Body — Scrollable Form */}
                <form
                    key={editProduct?.id || 'create'}
                    action={handleSave}
                    className="flex-1 overflow-y-auto"
                >
                    <div className="p-6 space-y-5">
                        {editProduct && !isCreateMode && (
                            <input type="hidden" name="id" value={editProduct.id} />
                        )}

                        {/* ── Core Info ── */}
                        <div className="space-y-1">
                            <h3 className="text-xs font-bold text-[#CBA153] uppercase tracking-widest">Core Information</h3>
                            <div className="h-px bg-[#CBA153]/20" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Product Name</label>
                                <input name="name" defaultValue={editProduct?.name || ''} required
                                    placeholder="Artisanal Sulguni"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Slug</label>
                                <input name="slug" defaultValue={editProduct?.slug || ''} required
                                    placeholder="artisanal-sulguni"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">SKU</label>
                                <input name="sku" defaultValue={editProduct?.sku || ''} required
                                    placeholder="SUL-001"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm font-mono" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Description</label>
                            <textarea name="description" rows={3} defaultValue={editProduct?.description || ''} required
                                placeholder="Product description..."
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-none placeholder-gray-700 text-sm" />
                        </div>

                        {/* ── Pricing & Stock ── */}
                        <div className="space-y-1 pt-2">
                            <h3 className="text-xs font-bold text-[#CBA153] uppercase tracking-widest">Pricing & Stock</h3>
                            <div className="h-px bg-[#CBA153]/20" />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">B2C Price</label>
                                <input name="priceB2c" defaultValue={editProduct?.priceB2c || ''} required
                                    placeholder="24.99"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">B2B Price</label>
                                <input name="priceB2b" defaultValue={editProduct?.priceB2b || ''} required
                                    placeholder="18.99"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Stock Qty</label>
                                <input name="stockQuantity" type="number" defaultValue={editProduct?.stockQuantity ?? 0}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm" />
                            </div>
                        </div>

                        {/* ── Product Details ── */}
                        <div className="space-y-1 pt-2">
                            <h3 className="text-xs font-bold text-[#CBA153] uppercase tracking-widest">Product Details</h3>
                            <div className="h-px bg-[#CBA153]/20" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Flavor Profile</label>
                                <input name="flavorProfile" defaultValue={editProduct?.flavorProfile || ''}
                                    placeholder="Mild, tangy, buttery"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Pairs With</label>
                                <input name="pairsWith" defaultValue={editProduct?.pairsWith || ''}
                                    placeholder="Red wine, nuts"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Weight</label>
                                <input name="weight" defaultValue={editProduct?.weight || ''}
                                    placeholder="8 oz"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Product Line</label>
                                <select name="productLineId" value={selectedLineId} onChange={e => setSelectedLineId(e.target.value)}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm">
                                    <option value="">— None —</option>
                                    {productLines.map(l => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Category</label>
                                <select name="categoryId" defaultValue={editProduct?.categoryId || ''}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm">
                                    <option value="">— None —</option>
                                    {categoriesForLine.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Ingredients</label>
                            <input name="ingredients" defaultValue={editProduct?.ingredients || ''}
                                placeholder="Pasteurized milk, salt, cultures"
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm" />
                        </div>

                        {/* ── Media ── */}
                        <div className="space-y-1 pt-2">
                            <h3 className="text-xs font-bold text-[#CBA153] uppercase tracking-widest">Media</h3>
                            <div className="h-px bg-[#CBA153]/20" />
                        </div>

                        {/* Primary Image Upload */}
                        <MediaUploadZone
                            value={primaryImageUrl ? [primaryImageUrl] : []}
                            onChange={(urls) => setPrimaryImageUrl(urls[0] || '')}
                            type="image"
                            label="Primary Product Image"
                            multiple={false}
                            maxFiles={1}
                        />

                        {/* Gallery Images Upload */}
                        <MediaUploadZone
                            value={galleryImages}
                            onChange={setGalleryImages}
                            type="image"
                            label="Gallery Images"
                            multiple={true}
                            maxFiles={8}
                        />

                        {/* Video / YouTube Links */}
                        <MediaUploadZone
                            value={videoLinks}
                            onChange={setVideoLinks}
                            type="video"
                            label="Videos / YouTube"
                            multiple={true}
                            maxFiles={5}
                        />

                        {/* ── Visibility ── */}
                        <div className="space-y-1 pt-2">
                            <h3 className="text-xs font-bold text-[#CBA153] uppercase tracking-widest">Visibility & Status</h3>
                            <div className="h-px bg-[#CBA153]/20" />
                        </div>

                        <div className="flex flex-wrap gap-5">
                            <div className="flex-1 min-w-[160px]">
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Status</label>
                                <select name="status" defaultValue={editProduct?.status || 'ACTIVE'}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm">
                                    <option value="ACTIVE">✅ Active — Visible & purchasable</option>
                                    <option value="COMING_SOON">🔜 Coming Soon — Visible but not purchasable</option>
                                    <option value="INACTIVE">🚫 Inactive — Hidden from shop</option>
                                </select>
                            </div>
                            <label className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer">
                                <input type="checkbox" name="isB2cVisible" defaultChecked={editProduct?.isB2cVisible ?? true} className="accent-[#CBA153] w-4 h-4" />
                                B2C Shop
                            </label>
                            <label className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer">
                                <input type="checkbox" name="isB2bVisible" defaultChecked={editProduct?.isB2bVisible ?? true} className="accent-[#CBA153] w-4 h-4" />
                                B2B Portal
                            </label>
                        </div>
                    </div>

                    {/* Drawer Footer */}
                    <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between flex-shrink-0 bg-[#0A0A0A]">
                        {/* Delete */}
                        {editProduct && !isCreateMode ? (
                            <div>
                                {deleteConfirm === editProduct.id ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-red-400">Confirm?</span>
                                        <button type="button" onClick={() => handleDelete(editProduct.id)}
                                            className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-500 transition-colors font-medium">
                                            Delete
                                        </button>
                                        <button type="button" onClick={() => setDeleteConfirm(null)}
                                            className="text-xs text-gray-500 hover:text-white transition-colors">
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => setDeleteConfirm(editProduct.id)}
                                        className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors">
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div />
                        )}

                        {/* Save */}
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex items-center gap-2 bg-[#CBA153] text-black px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-3.5 h-3.5" />
                            {isPending ? 'Saving...' : isCreateMode ? 'Create Product' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
