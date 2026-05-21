'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Search, Plus, Save, Trash2, X, Eye, EyeOff, Package, AlertTriangle, Image as ImageIcon, Film, ChevronDown, MapPin, Boxes, Zap } from 'lucide-react';
import MediaUploadZone from './MediaUploadZone';
import type { ProductKind, FulfillmentChannel, LocationType, SalesChannel } from '@prisma/client';

interface ProductFamilyOption {
    id: string;
    slug: string;
    name: string;
}

interface ProductLineOption {
    id: string;
    slug: string;
    name: string;
    badgeColor: string | null;
    categories: { id: string; slug: string; name: string }[];
}

interface StockRow {
    locationId: string;
    locationName: string;
    locationType: LocationType;
    quantity: number | null;
}

interface Product {
    id: string;
    sku: string;
    name: string;
    nameKa: string | null;
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
    kind: ProductKind;
    isMadeToOrder: boolean;
    tag: string | null;
    productLineId: string | null;
    categoryId: string | null;
    status: string;
    isActive: boolean;
    isB2cVisible: boolean;
    isB2bVisible: boolean;
    isCartOrderable: boolean;
    productFamilyId: string;
    salesChannel: SalesChannel;
    packagingType: string | null;
    unitCost: string | null;
    channels: FulfillmentChannel[];
    stocks: StockRow[];
}

interface LocationOption {
    id: string;
    name: string;
    type: LocationType;
    /** Active channels this location offers. Used to surface "offered by" hints + flag misconfig. */
    channels: FulfillmentChannel[];
}

interface InventoryClientProps {
    products: Product[];
    productLines: ProductLineOption[];
    productFamilies: ProductFamilyOption[];
    locations: LocationOption[];
    productKinds: ProductKind[];
    fulfillmentChannels: FulfillmentChannel[];
    salesChannels: SalesChannel[];
    locale: string;
    saveAction: (formData: FormData) => Promise<void>;
    deleteAction: (formData: FormData) => Promise<void>;
    quickStockAction: (formData: FormData) => Promise<void>;
}

function salesChannelLabel(c: SalesChannel): string {
    return c.replace(/_/g, ' ');
}

type KindFilter = 'ALL' | 'CREAMERY' | 'BAKERY';

function kindLabel(k: ProductKind): string {
    return k.replace(/_/g, ' ');
}

function channelLabel(c: FulfillmentChannel): string {
    return c.replace(/_/g, ' ');
}

function kindGroupOf(k: ProductKind): 'CREAMERY' | 'BAKERY' {
    return k.startsWith('BAKERY') ? 'BAKERY' : 'CREAMERY';
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

export default function InventoryClient({ products, productLines, productFamilies, locations, productKinds, fulfillmentChannels, salesChannels, locale, saveAction, deleteAction, quickStockAction }: InventoryClientProps) {
    const [selectedLineId, setSelectedLineId] = useState<string>('');
    const [search, setSearch] = useState('');
    const [kindFilter, setKindFilter] = useState<KindFilter>('ALL');
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

    // Phase 3 state — kind, made-to-order, channels eligibility, per-location stock
    const [kind, setKind] = useState<ProductKind>('CREAMERY_CHEESE');
    const [isMadeToOrder, setIsMadeToOrder] = useState(false);
    const [channelsSet, setChannelsSet] = useState<Set<FulfillmentChannel>>(new Set());
    // Keyed by locationId. null = "made-to-order at this location" / "untracked"
    const [stockMap, setStockMap] = useState<Record<string, number | null>>({});

    // Filter products
    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
        const matchesKind = kindFilter === 'ALL' || kindGroupOf(p.kind) === kindFilter;
        return matchesSearch && matchesKind;
    });

    const counts = {
        ALL: products.length,
        CREAMERY: products.filter(p => kindGroupOf(p.kind) === 'CREAMERY').length,
        BAKERY: products.filter(p => kindGroupOf(p.kind) === 'BAKERY').length,
    };

    // Open drawer for editing
    const openEdit = (product: Product) => {
        setEditProduct(product);
        setIsCreateMode(false);
        setPrimaryImageUrl(product.imageUrl || '');
        setGalleryImages(product.images || []);
        setVideoLinks(product.videoUrls || []);
        setSelectedLineId(product.productLineId || '');
        setKind(product.kind);
        setIsMadeToOrder(product.isMadeToOrder);
        setChannelsSet(new Set(product.channels));
        // Pre-fill stockMap from product.stocks; locations without a row stay absent
        const map: Record<string, number | null> = {};
        for (const s of product.stocks) {
            map[s.locationId] = s.quantity;
        }
        setStockMap(map);
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
        // Sensible defaults: pick kind based on which filter is active (so "Bakery" tab → new bakery product)
        const defaultKind: ProductKind = kindFilter === 'BAKERY' ? 'BAKERY_HOT' : 'CREAMERY_CHEESE';
        setKind(defaultKind);
        setIsMadeToOrder(false);
        setChannelsSet(new Set());
        setStockMap({});
        setDrawerOpen(true);
        setDeleteConfirm(null);
    };

    const toggleChannel = (ch: FulfillmentChannel) => {
        setChannelsSet(prev => {
            const next = new Set(prev);
            if (next.has(ch)) next.delete(ch); else next.add(ch);
            return next;
        });
    };

    // Get categories for selected line
    const categoriesForLine = productLines.find(l => l.id === selectedLineId)?.categories || [];

    // Helper: get line name by ID
    const getLineName = (id: string | null) => productLines.find(l => l.id === id)?.name || null;
    const getLineColor = (id: string | null) => productLines.find(l => l.id === id)?.badgeColor || '#B96A3D';

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

        // Phase 3: kind, made-to-order, channels, per-location stock
        formData.set('kind', kind);
        if (isMadeToOrder) formData.set('isMadeToOrder', 'on');
        // Channels: append one entry per checked channel
        for (const ch of channelsSet) {
            formData.append('channels[]', ch);
        }
        // Per-location stock: only include locations the admin explicitly touched
        const stocksPayload = Object.entries(stockMap).map(([locationId, quantity]) => ({ locationId, quantity }));
        formData.set('stocksJson', JSON.stringify(stocksPayload));

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

    // Quick-stock inline edit removed — per-location stock must be edited via the drawer.
    // `quickStockAction` is still imported for backward compat but no longer wired to UI.
    void quickStockAction;

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
                <div className="fixed top-6 right-6 z-[100] bg-emerald-600 text-white px-5 py-3 text-sm font-medium animate-fade-in flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif text-white flex items-center gap-3">
                        <Package className="w-8 h-8 text-[#B96A3D]" />
                        Product Inventory
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">{products.length} products · Manage stock, pricing, and content</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-[#B96A3D] text-black px-5 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-white transition-all shadow-[#B96A3D]/20"
                >
                    <Plus className="w-4 h-4" /> Add Product
                </button>
            </div>

            {/* Kind Filter Tabs */}
            <div className="flex items-center gap-1 border-b border-[#ffffff0A]">
                {(['ALL', 'CREAMERY', 'BAKERY'] as KindFilter[]).map(f => (
                    <button
                        key={f}
                        onClick={() => setKindFilter(f)}
                        className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${kindFilter === f
                            ? 'text-[#B96A3D] border-[#B96A3D]'
                            : 'text-gray-500 border-transparent hover:text-gray-300'
                        }`}
                    >
                        {f === 'ALL' ? 'All' : f === 'CREAMERY' ? 'Creamery' : 'Bakery'}
                        <span className="ml-2 text-[10px] text-gray-600">{counts[f]}</span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name or SKU..."
                    className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-3 pl-11 pr-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-600 text-sm"
                />
            </div>

            {/* Product Table */}
            <div className="bg-[#161616] border border-[#ffffff0A] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#0C0C0C] text-gray-500 text-xs uppercase tracking-wider border-b border-[#ffffff0A]">
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
                                            <div className="w-10 h-10 overflow-hidden bg-[#2C2A29] flex-shrink-0 border border-[#B96A3D22]">
                                                <img src={getThumbUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-white font-medium truncate max-w-[200px]">{product.name}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className={`text-[9px] px-1.5 py-0.5 uppercase tracking-wider font-bold ${kindGroupOf(product.kind) === 'BAKERY' ? 'bg-amber-900/30 text-amber-400' : 'bg-blue-900/30 text-blue-400'}`}>
                                                        {kindLabel(product.kind)}
                                                    </span>
                                                    {product.isMadeToOrder && (
                                                        <span className="text-[9px] bg-purple-900/30 text-purple-400 px-1.5 py-0.5 uppercase tracking-wider font-bold flex items-center gap-0.5">
                                                            <Zap className="w-2.5 h-2.5" /> MTO
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-gray-600 text-xs truncate max-w-[200px] mt-1">{product.description.slice(0, 50)}...</p>
                                            </div>
                                        </div>
                                    </td>
                                    {/* SKU */}
                                    <td className="px-5 py-4">
                                        <span className="font-mono text-xs text-gray-400">{product.sku}</span>
                                    </td>
                                    {/* Stock — read-only summary (edit via drawer for accurate multi-location) */}
                                    <td className="px-5 py-4 text-center">
                                        {product.isMadeToOrder ? (
                                            <span className="text-[10px] text-purple-400 font-mono uppercase tracking-wider" title="Made to order — no stock tracking">MTO</span>
                                        ) : product.stocks.length === 0 ? (
                                            <span className="text-[10px] text-gray-600 italic">—</span>
                                        ) : (
                                            <div className="flex flex-col items-center gap-0.5" title={product.stocks.map(s => `${s.locationName}: ${s.quantity ?? 'MTO'}`).join(' · ')}>
                                                <span className="text-xs text-white font-mono">{product.stocks.reduce((sum, s) => sum + (s.quantity ?? 0), 0)}</span>
                                                <span className="text-[9px] text-gray-600">{product.stocks.length} loc</span>
                                            </div>
                                        )}
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
                                            {!product.isCartOrderable && <span className="text-[10px] bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded font-bold" title="Listed but not cart-orderable (wholesale-request CTA on PDP)">Q</span>}
                                        </div>
                                    </td>
                                    {/* Actions */}
                                    <td className="px-5 py-4 text-center">
                                        <button
                                            onClick={() => openEdit(product)}
                                            className="text-xs text-[#B96A3D] hover:text-white transition-colors font-medium px-3 py-1.5 hover:bg-[#B96A3D]/10"
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
                className={`fixed top-0 right-0 h-full w-full sm:w-[520px] bg-[#0F0F0F] border-l border-[#B96A3D22] z-50 transform transition-transform duration-300 ease-in-out ${drawerOpen ? 'translate-x-0' : 'translate-x-full'
                    } flex flex-col`}
            >
                {/* Drawer Header */}
                <div className="px-6 py-5 border-b border-[#B96A3D22] flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {editProduct && !isCreateMode ? (
                            <div className="w-10 h-10 overflow-hidden bg-[#2C2A29] border border-[#B96A3D22] flex-shrink-0">
                                <img src={getThumbUrl(editProduct.imageUrl)} alt="" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 bg-[#B96A3D]/20 flex items-center justify-center flex-shrink-0">
                                <Plus className="w-5 h-5 text-[#B96A3D]" />
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
                    <button onClick={closeDrawer} className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-[#ffffff08]">
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
                            <h3 className="text-xs font-bold text-[#B96A3D] uppercase tracking-widest">Core Information</h3>
                            <div className="h-px bg-[#B96A3D]/20" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Product Name</label>
                                <input name="name" defaultValue={editProduct?.name || ''} required
                                    placeholder="Artisanal Sulguni"
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Name · ქართული</label>
                                <input name="nameKa" defaultValue={editProduct?.nameKa || ''}
                                    placeholder="აჭარული"
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Slug</label>
                                <input name="slug" defaultValue={editProduct?.slug || ''} required
                                    placeholder="artisanal-sulguni"
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">SKU</label>
                                <input name="sku" defaultValue={editProduct?.sku || ''} required
                                    placeholder="SUL-001"
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Badge / Tag</label>
                                <input name="tag" defaultValue={editProduct?.tag || ''}
                                    placeholder="Bestseller · Vegan · Limited · Ships local"
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Description</label>
                            <textarea name="description" rows={3} defaultValue={editProduct?.description || ''} required
                                placeholder="Product description..."
                                className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] resize-none placeholder-gray-700 text-sm" />
                        </div>

                        {/* ── Pricing & Stock ── */}
                        <div className="space-y-1 pt-2">
                            <h3 className="text-xs font-bold text-[#B96A3D] uppercase tracking-widest">Pricing & Stock</h3>
                            <div className="h-px bg-[#B96A3D]/20" />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">B2C Price</label>
                                <input name="priceB2c" defaultValue={editProduct?.priceB2c || ''} required
                                    placeholder="24.99"
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">B2B Price</label>
                                <input name="priceB2b" defaultValue={editProduct?.priceB2b || ''} required
                                    placeholder="18.99"
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Stock Qty</label>
                                <input name="stockQuantity" type="number" defaultValue={editProduct?.stockQuantity ?? 0}
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] text-sm" />
                            </div>
                        </div>

                        {/* ── Channel & Packaging (Phase 1) ── */}
                        <div className="space-y-1 pt-2">
                            <h3 className="text-xs font-bold text-[#B96A3D] uppercase tracking-widest">Channel &amp; Packaging</h3>
                            <div className="h-px bg-[#B96A3D]/20" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Sales Channel *</label>
                                <select name="salesChannel" defaultValue={editProduct?.salesChannel || 'LOCAL_COLD'} required
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] text-sm">
                                    {salesChannels.map(c => (
                                        <option key={c} value={c}>{salesChannelLabel(c)}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-500 mt-1">Drives which locations can carry this SKU + how it ships.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Product Family</label>
                                <select name="productFamilyId" defaultValue={editProduct?.productFamilyId || ''}
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] text-sm">
                                    <option value="">— Auto-create from product name —</option>
                                    {productFamilies.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-500 mt-1">Group SKUs that are variants of the same product (e.g. Sulguni LOCAL_COLD + Sulguni NATIONAL_SHIP).</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Packaging Type</label>
                                <input name="packagingType" defaultValue={editProduct?.packagingType || ''}
                                    placeholder="retail-pouch · cold-pack-2day · wholesale-case · frozen-bulk · hot-bag"
                                    list="packaging-types"
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm font-mono" />
                                <datalist id="packaging-types">
                                    <option value="retail-pouch" />
                                    <option value="cold-pack-2day" />
                                    <option value="wholesale-case" />
                                    <option value="frozen-bulk" />
                                    <option value="hot-bag" />
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Unit Cost (COGS)</label>
                                <input name="unitCost" defaultValue={editProduct?.unitCost || ''}
                                    placeholder="8.50"
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm" />
                                <p className="text-[10px] text-gray-500 mt-1">Used by margin reporting (Phase 7). Leave blank if unknown.</p>
                            </div>
                        </div>

                        {/* ── Product Details ── */}
                        <div className="space-y-1 pt-2">
                            <h3 className="text-xs font-bold text-[#B96A3D] uppercase tracking-widest">Product Details</h3>
                            <div className="h-px bg-[#B96A3D]/20" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Flavor Profile</label>
                                <input name="flavorProfile" defaultValue={editProduct?.flavorProfile || ''}
                                    placeholder="Mild, tangy, buttery"
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Pairs With</label>
                                <input name="pairsWith" defaultValue={editProduct?.pairsWith || ''}
                                    placeholder="Red wine, nuts"
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Weight</label>
                                <input name="weight" defaultValue={editProduct?.weight || ''}
                                    placeholder="8 oz"
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Product Line</label>
                                <select name="productLineId" value={selectedLineId} onChange={e => setSelectedLineId(e.target.value)}
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] text-sm">
                                    <option value="">— None —</option>
                                    {productLines.map(l => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Category</label>
                                <select name="categoryId" defaultValue={editProduct?.categoryId || ''}
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] text-sm">
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
                                className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm" />
                        </div>

                        {/* ── Media ── */}
                        <div className="space-y-1 pt-2">
                            <h3 className="text-xs font-bold text-[#B96A3D] uppercase tracking-widest">Media</h3>
                            <div className="h-px bg-[#B96A3D]/20" />
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

                        {/* ── Classification & Behavior ── */}
                        <div className="space-y-1 pt-2">
                            <h3 className="text-xs font-bold text-[#B96A3D] uppercase tracking-widest">Classification & Behavior</h3>
                            <div className="h-px bg-[#B96A3D]/20" />
                        </div>

                        <div className="grid grid-cols-2 gap-4 items-end">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Kind</label>
                                <select value={kind} onChange={e => setKind(e.target.value as ProductKind)}
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] text-sm">
                                    {productKinds.map(k => (
                                        <option key={k} value={k}>{kindLabel(k)}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-600 mt-1">Used for admin/UI grouping. Routing is driven by channels below.</p>
                            </div>
                            <label className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer pb-3">
                                <input type="checkbox" checked={isMadeToOrder} onChange={e => setIsMadeToOrder(e.target.checked)}
                                    className="accent-[#B96A3D] w-4 h-4" />
                                <span className="flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-purple-400" /> Made to order
                                </span>
                            </label>
                        </div>
                        {isMadeToOrder && (
                            <p className="text-[11px] text-purple-400/80 -mt-2 bg-purple-900/10 border-l-2 border-purple-400/30 px-3 py-2">
                                Made-to-order — inventory is not tracked. Availability gated by location hours + product status.
                            </p>
                        )}

                        {/* ── Fulfillment Channels ── */}
                        <div className="space-y-1 pt-2">
                            <h3 className="text-xs font-bold text-[#B96A3D] uppercase tracking-widest">Fulfillment Channels</h3>
                            <div className="h-px bg-[#B96A3D]/20" />
                        </div>
                        <p className="text-[11px] text-gray-500 -mt-2">Which delivery methods can ship this product? Customer eligibility = product channels ∩ location channels reaching customer.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {fulfillmentChannels.map(ch => {
                                const checked = channelsSet.has(ch);
                                // Which active locations offer this channel? Surfaces the channel↔location mapping
                                // so the admin sees "UPS_GROUND_2DAY is offered by Cold Warehouse — stock it there"
                                const offeredBy = locations.filter(l => l.channels.includes(ch));
                                return (
                                    <label key={ch} className={`flex flex-col gap-1 px-3 py-2 border cursor-pointer transition-colors text-xs ${checked ? 'bg-[#B96A3D]/10 border-[#B96A3D]/40 text-white' : 'bg-[#0C0C0C] border-[#ffffff0A] text-gray-400 hover:border-[#B96A3D]/30'}`}>
                                        <div className="flex items-center gap-2.5">
                                            <input type="checkbox" checked={checked} onChange={() => toggleChannel(ch)} className="accent-[#B96A3D]" />
                                            <span className="font-mono">{channelLabel(ch)}</span>
                                        </div>
                                        <div className="text-[9px] text-gray-500 pl-6 leading-tight">
                                            {offeredBy.length === 0
                                                ? <span className="text-amber-500">Not offered by any active location — wire it in /admin/locations first</span>
                                                : <>Offered by: <span className="text-gray-300">{offeredBy.map(l => l.name).join(' · ')}</span></>}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>

                        {/* Misconfig warning: checked channels with no stocked & channel-offering location */}
                        {(() => {
                            const checkedChannels = Array.from(channelsSet);
                            const stockedLocationIds = new Set(Object.keys(stockMap));
                            const unactionable = checkedChannels.filter(ch => {
                                // Is there ANY location that (a) offers this channel AND (b) is in stockMap?
                                return !locations.some(l => l.channels.includes(ch) && stockedLocationIds.has(l.id));
                            });
                            if (unactionable.length === 0) return null;
                            // For each unactionable channel, suggest a location that offers it
                            const suggestions = unactionable.map(ch => {
                                const candidates = locations.filter(l => l.channels.includes(ch));
                                return { channel: ch, candidates };
                            });
                            return (
                                <div className="bg-amber-900/15 border border-amber-700/30 text-amber-300 text-[11px] px-3 py-2.5 leading-relaxed">
                                    <div className="font-bold uppercase tracking-wider mb-1.5">⚠ Configured but not actionable</div>
                                    {suggestions.map(s => (
                                        <div key={s.channel} className="mb-1">
                                            <span className="font-mono">{channelLabel(s.channel)}</span>
                                            {' is checked, but this product isn’t stocked at any location offering it. '}
                                            {s.candidates.length === 0
                                                ? <span className="text-amber-200">No active location offers this channel yet — set it up in /admin/locations.</span>
                                                : <>Stock this product at: <span className="text-amber-200">{s.candidates.map(c => c.name).join(' or ')}</span> in the Per-Location Stock section below.</>}
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}

                        {/* ── Per-Location Stock ── */}
                        <div className="space-y-1 pt-2">
                            <h3 className="text-xs font-bold text-[#B96A3D] uppercase tracking-widest flex items-center gap-2">
                                <Boxes className="w-3.5 h-3.5" /> Per-Location Stock
                            </h3>
                            <div className="h-px bg-[#B96A3D]/20" />
                        </div>
                        <p className="text-[11px] text-gray-500 -mt-2">
                            {isMadeToOrder
                                ? 'Made-to-order: quantity is ignored. Tick locations that offer this product.'
                                : 'Set quantity per location. Blank = not stocked at that location. The legacy "Stock Qty" above is auto-recomputed as the sum.'}
                        </p>

                        <div className="space-y-2">
                            {locations.length === 0 && (
                                <p className="text-xs text-gray-600 italic">No active locations. Add one in /admin/locations.</p>
                            )}
                            {locations.map(loc => {
                                const current = stockMap[loc.id];
                                const isStocked = current !== undefined;
                                return (
                                    <div key={loc.id} className={`flex items-center gap-3 px-3 py-2 border ${isStocked ? 'bg-[#B96A3D]/5 border-[#B96A3D]/30' : 'bg-[#0C0C0C] border-[#ffffff0A]'}`}>
                                        <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white truncate">{loc.name}</p>
                                            <p className="text-[9px] text-gray-600 uppercase tracking-wider">{loc.type.replace(/_/g, ' ')}</p>
                                        </div>
                                        {isMadeToOrder ? (
                                            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isStocked}
                                                    onChange={e => {
                                                        setStockMap(prev => {
                                                            const next = { ...prev };
                                                            if (e.target.checked) next[loc.id] = null;
                                                            else delete next[loc.id];
                                                            return next;
                                                        });
                                                    }}
                                                    className="accent-[#B96A3D]"
                                                />
                                                Offered
                                            </label>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="—"
                                                    value={current ?? ''}
                                                    onChange={e => {
                                                        const v = e.target.value;
                                                        setStockMap(prev => {
                                                            const next = { ...prev };
                                                            if (v === '') delete next[loc.id];
                                                            else next[loc.id] = parseInt(v, 10) || 0;
                                                            return next;
                                                        });
                                                    }}
                                                    className="w-24 text-center bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-2 text-xs focus:outline-none focus:border-[#B96A3D]"
                                                />
                                                {isStocked && (
                                                    <button type="button"
                                                        onClick={() => setStockMap(prev => { const n = { ...prev }; delete n[loc.id]; return n; })}
                                                        className="text-gray-600 hover:text-red-400 transition-colors"
                                                        title="Clear (not stocked here)"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── Visibility ── */}
                        <div className="space-y-1 pt-2">
                            <h3 className="text-xs font-bold text-[#B96A3D] uppercase tracking-widest">Visibility & Status</h3>
                            <div className="h-px bg-[#B96A3D]/20" />
                        </div>

                        <div className="flex flex-wrap gap-5">
                            <div className="flex-1 min-w-[160px]">
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Status</label>
                                <select name="status" defaultValue={editProduct?.status || 'ACTIVE'}
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-2.5 px-4 focus:outline-none focus:border-[#B96A3D] text-sm">
                                    <option value="ACTIVE">✅ Active — Visible & purchasable</option>
                                    <option value="COMING_SOON">🔜 Coming Soon — Visible but not purchasable</option>
                                    <option value="INACTIVE">🚫 Inactive — Hidden from shop</option>
                                </select>
                            </div>
                            <label className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer">
                                <input type="checkbox" name="isB2cVisible" defaultChecked={editProduct?.isB2cVisible ?? true} className="accent-[#B96A3D] w-4 h-4" />
                                B2C Shop
                            </label>
                            <label className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer">
                                <input type="checkbox" name="isB2bVisible" defaultChecked={editProduct?.isB2bVisible ?? true} className="accent-[#B96A3D] w-4 h-4" />
                                B2B Portal
                            </label>
                            <label className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer" title="When off: product is listed publicly with a 'Wholesale only — request a quote' CTA instead of an Add-to-cart button. Use for items you make for B2B but want customers to see (e.g. frozen-only-B2B SKUs).">
                                <input type="checkbox" name="isCartOrderable" defaultChecked={editProduct?.isCartOrderable ?? true} className="accent-[#B96A3D] w-4 h-4" />
                                D2C cart-orderable
                            </label>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2.5 leading-relaxed">
                            <span className="text-amber-400">D2C cart-orderable off</span> = product is listed on the public shop but Add-to-cart is replaced with a wholesale-quote CTA. Use this for B2B-exclusive products you still want customers to see.
                        </p>
                    </div>

                    {/* Drawer Footer */}
                    <div className="px-6 py-4 border-t border-[#B96A3D22] flex items-center justify-between flex-shrink-0 bg-[#0C0C0C]">
                        {/* Delete */}
                        {editProduct && !isCreateMode ? (
                            <div>
                                {deleteConfirm === editProduct.id ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-red-400">Confirm?</span>
                                        <button type="button" onClick={() => handleDelete(editProduct.id)}
                                            className="text-xs bg-red-600 text-white px-3 py-1.5 hover:bg-red-500 transition-colors font-medium">
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
                            className="flex items-center gap-2 bg-[#B96A3D] text-black px-6 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
