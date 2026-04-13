'use client';

import { useState, useTransition } from 'react';
import { Save, Loader2, Search, Image as ImageIcon, Globe, Info } from 'lucide-react';
import MediaUploadZone from './MediaUploadZone';

interface Props {
    configs: { key: string; value: string }[];
}

function getVal(configs: { key: string; value: string }[], key: string, fallback = ''): string {
    return configs.find(c => c.key === key)?.value || fallback;
}

// Pages that need OG image control
const PAGES = [
    { key: 'seo.ogImage.home', label: 'Homepage', desc: 'Main search result image — shown when people search "Colchis Creamery"', recommended: '1200×630px' },
    { key: 'seo.ogImage.shop', label: 'Shop / Collection', desc: 'Shown when shop page link is shared or appears in search', recommended: '1200×630px' },
    { key: 'seo.ogImage.heritage', label: 'Our Heritage', desc: 'Heritage page social sharing image', recommended: '1200×630px' },
    { key: 'seo.ogImage.recipes', label: 'Recipes & Pairings', desc: 'Recipes listing page', recommended: '1200×630px' },
    { key: 'seo.ogImage.journal', label: 'Journal', desc: 'Journal/blog listing page', recommended: '1200×630px' },
    { key: 'seo.ogImage.wholesale', label: 'Wholesale', desc: 'Wholesale partnership page', recommended: '1200×630px' },
    { key: 'seo.ogImage.contact', label: 'Contact', desc: 'Contact page', recommended: '1200×630px' },
    { key: 'seo.ogImage.faq', label: 'FAQ', desc: 'FAQ page', recommended: '1200×630px' },
] as const;

export default function SeoEditor({ configs }: Props) {
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);

    // Global default OG image (fallback for pages without a specific image)
    const [defaultOgImage, setDefaultOgImage] = useState<string[]>(() => {
        const val = getVal(configs, 'seo.ogImage.default');
        return val ? [val] : [];
    });

    // Global metadata overrides
    const [siteTitle, setSiteTitle] = useState(getVal(configs, 'seo.siteTitle', ''));
    const [siteDescription, setSiteDescription] = useState(getVal(configs, 'seo.siteDescription', ''));

    // Per-page OG images
    const [pageImages, setPageImages] = useState<Record<string, string[]>>(() => {
        const result: Record<string, string[]> = {};
        for (const page of PAGES) {
            const val = getVal(configs, page.key);
            result[page.key] = val ? [val] : [];
        }
        return result;
    });

    function setPageImage(key: string, urls: string[]) {
        setPageImages(prev => ({ ...prev, [key]: urls }));
    }

    async function handleSave() {
        startTransition(async () => {
            const entries: { key: string; value: string }[] = [
                { key: 'seo.ogImage.default', value: defaultOgImage[0] || '' },
                { key: 'seo.siteTitle', value: siteTitle },
                { key: 'seo.siteDescription', value: siteDescription },
            ];
            for (const page of PAGES) {
                entries.push({ key: page.key, value: pageImages[page.key]?.[0] || '' });
            }
            const fd = new FormData();
            fd.set('entries', JSON.stringify(entries));
            const { batchUpsertSiteConfigAction } = await import('@/app/actions/cms');
            await batchUpsertSiteConfigAction(fd);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        });
    }

    return (
        <div className="space-y-6">
            {/* Save bar */}
            <div className="sticky top-0 z-30 bg-[#111111]/95 backdrop-blur-sm border-b border-white/5 -mx-4 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-emerald-400" />
                    <span className="text-white font-bold">SEO & Social Sharing</span>
                    {saved && <span className="text-xs text-emerald-400 animate-pulse">✓ Saved</span>}
                </div>
                <button onClick={handleSave} disabled={isPending}
                    className="flex items-center gap-2 bg-[#CBA153] text-black px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50">
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isPending ? 'Saving...' : 'Save All'}
                </button>
            </div>

            {/* Info banner */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-sm text-gray-400">
                    <p className="text-white font-medium mb-1">How Google picks your images</p>
                    <p>Google shows the image from your <code className="text-emerald-400 text-xs">og:image</code> meta tag in search results and social shares (Facebook, Twitter, LinkedIn, iMessage). Upload a <strong className="text-white">1200×630px</strong> image for best results. If a page has no specific image, the global default is used.</p>
                </div>
            </div>

            {/* Global Default */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                    <Globe className="w-5 h-5 text-blue-400" />
                    <div>
                        <h2 className="text-white font-bold">Global Default Image</h2>
                        <p className="text-gray-500 text-xs mt-0.5">Fallback for any page that doesn&apos;t have its own OG image</p>
                    </div>
                </div>
                <div className="p-6">
                    <MediaUploadZone value={defaultOgImage} onChange={setDefaultOgImage} type="image"
                        label="Default OG Image (1200×630px recommended)" multiple={false} maxFiles={1} aspectRatio="16:9" landscapeThumbs />
                </div>
            </div>

            {/* Global Metadata Overrides */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                    <Search className="w-5 h-5 text-purple-400" />
                    <div>
                        <h2 className="text-white font-bold">Site-Wide Metadata (Optional)</h2>
                        <p className="text-gray-500 text-xs mt-0.5">Override the default title and description shown in search results for the homepage</p>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Site Title Override</label>
                        <input value={siteTitle} onChange={e => setSiteTitle(e.target.value)}
                            placeholder="Colchis Creamery | Ancient Heritage, Fresh Taste"
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm" />
                        <p className="text-xs text-gray-600 mt-1">Leave empty to use default</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Site Description Override</label>
                        <textarea value={siteDescription} onChange={e => setSiteDescription(e.target.value)}
                            placeholder="Authentic Georgian artisanal cheese, handcrafted in Ohio with premium local milk."
                            rows={2}
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm resize-none" />
                        <p className="text-xs text-gray-600 mt-1">Leave empty to use default</p>
                    </div>
                </div>
            </div>

            {/* Per-Page OG Images */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                    <ImageIcon className="w-5 h-5 text-amber-400" />
                    <div>
                        <h2 className="text-white font-bold">Per-Page Social Images</h2>
                        <p className="text-gray-500 text-xs mt-0.5">Set a specific image for each page. Pages without an image use the global default above.</p>
                    </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {PAGES.map(page => (
                        <div key={page.key} className="bg-[#0D0D0D] rounded-lg border border-white/5 p-4">
                            <div className="mb-3">
                                <h3 className="text-white text-sm font-bold">{page.label}</h3>
                                <p className="text-gray-600 text-xs">{page.desc}</p>
                            </div>
                            <MediaUploadZone
                                value={pageImages[page.key] || []}
                                onChange={(urls) => setPageImage(page.key, urls)}
                                type="image"
                                label={`${page.label} OG Image`}
                                multiple={false}
                                maxFiles={1}
                                aspectRatio="16:9"
                                landscapeThumbs
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
