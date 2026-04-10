'use client';

import { useState, useCallback } from 'react';
import { Globe, Save, Loader2, ImageIcon, Film } from 'lucide-react';
import MediaUploadZone from './MediaUploadZone';

interface HeroMediaEditorProps {
    configs: { key: string; value: string }[];
}

function getVal(configs: { key: string; value: string }[], key: string, fallback = ""): string {
    return configs.find(c => c.key === key)?.value || fallback;
}

export default function HeroMediaEditor({ configs }: HeroMediaEditorProps) {
    const [title, setTitle] = useState(getVal(configs, "hero.title", "Ancient Heritage, Fresh Taste"));
    const [subtitle, setSubtitle] = useState(getVal(configs, "hero.subtitle", "Authentic Georgian artisanal cheese, handcrafted in Ohio with premium local milk"));
    const [shopCta, setShopCta] = useState(getVal(configs, "hero.shopCta", "Shop Artisanal Cheese"));
    const [wholesaleCta, setWholesaleCta] = useState(getVal(configs, "hero.wholesaleCta", "Wholesale Partners"));
    const [videoUrl, setVideoUrl] = useState(getVal(configs, "hero.videoUrl", ""));

    // Parse hero images from comma-separated string
    const initialImages = getVal(configs, "hero.images", "")
        .split(',')
        .map(u => u.trim())
        .filter(Boolean);
    const singleImage = getVal(configs, "hero.imageUrl", "");
    const [heroImages, setHeroImages] = useState<string[]>(
        initialImages.length > 0 ? initialImages : (singleImage ? [singleImage] : [])
    );

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = useCallback(async () => {
        setSaving(true);
        setSaved(false);

        const entries = [
            { key: 'hero.title', value: title },
            { key: 'hero.subtitle', value: subtitle },
            { key: 'hero.shopCta', value: shopCta },
            { key: 'hero.wholesaleCta', value: wholesaleCta },
            { key: 'hero.imageUrl', value: heroImages[0] || '' },
            { key: 'hero.images', value: heroImages.join(',') },
            { key: 'hero.videoUrl', value: videoUrl },
        ];

        try {
            const fd = new FormData();
            fd.set('entries', JSON.stringify(entries));

            const res = await fetch('/api/admin/site-config', {
                method: 'POST',
                body: fd,
            });

            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch (err) {
            console.error('Save error:', err);
        } finally {
            setSaving(false);
        }
    }, [title, subtitle, shopCta, wholesaleCta, heroImages, videoUrl]);

    const inputClass = "w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600";

    return (
        <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-[#CBA153]" />
                    <h2 className="text-white font-bold">Hero Section</h2>
                </div>
                <div className="flex items-center gap-3">
                    {saved && (
                        <span className="text-xs text-emerald-400 animate-fade-in">✓ Saved</span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-[#CBA153] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                    </button>
                </div>
            </div>

            <div className="p-6 space-y-5">
                {/* Text fields */}
                <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Hero Title</label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={inputClass}
                    />
                    <p className="text-[10px] text-gray-600 mt-1">Use a comma to split into two lines (e.g., "Ancient Heritage, Fresh Taste")</p>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Hero Subtitle</label>
                    <textarea
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        rows={2}
                        className={`${inputClass} resize-none`}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Shop CTA Text</label>
                        <input value={shopCta} onChange={(e) => setShopCta(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Wholesale CTA Text</label>
                        <input value={wholesaleCta} onChange={(e) => setWholesaleCta(e.target.value)} className={inputClass} />
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-white/5 pt-5">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-[#CBA153]" />
                        Hero Background Images
                    </h3>
                    <p className="text-[10px] text-gray-600 mb-3">Upload multiple images for an auto-rotating carousel effect. Landscape 16:9 recommended. Images are auto-optimized.</p>
                    <MediaUploadZone
                        value={heroImages}
                        onChange={setHeroImages}
                        type="image"
                        label="Hero Images (carousel)"
                        multiple={true}
                        maxFiles={5}
                    />
                </div>

                {/* Video */}
                <div className="border-t border-white/5 pt-5">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Film className="w-4 h-4 text-[#CBA153]" />
                        Background Video (overrides images)
                    </h3>
                    <p className="text-[10px] text-gray-600 mb-3">Optional. If set, video will play instead of image carousel. MP4 recommended.</p>
                    <input
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="Video URL (MP4) or leave empty for image carousel"
                        className={inputClass}
                    />
                </div>
            </div>
        </div>
    );
}
