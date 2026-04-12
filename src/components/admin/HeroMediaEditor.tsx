'use client';

import { useState, useCallback } from 'react';
import { Globe, Save, Loader2, ImageIcon, Film, Eye, Timer, Sparkles, Type, AlignLeft, AlignCenter, AlignRight, RotateCcw } from 'lucide-react';
import MediaUploadZone from './MediaUploadZone';
import HeroPreview from './HeroPreview';

// ─── Default values ──────────────────────────────────────────────────────────
const DEFAULTS: Record<string, string> = {
    'hero.title': 'Ancient Heritage, Fresh Taste',
    'hero.subtitle': 'Authentic Georgian artisanal cheese, handcrafted in Ohio with premium local milk',
    'hero.shopCta': 'Shop Artisanal Cheese',
    'hero.wholesaleCta': 'Wholesale Partners',
    'hero.badgeText': 'Premium Artisanal Dairy',
    'hero.showBadge': 'true',
    'hero.showTitle': 'true',
    'hero.showSubtitle': 'true',
    'hero.showBtnPrimary': 'true',
    'hero.showBtnSecondary': 'true',
    'hero.textSize': 'lg',
    'hero.posX': '50',
    'hero.posY': '50',
    'hero.badgeAlign': 'center',
    'hero.titleAlign': 'center',
    'hero.subtitleAlign': 'center',
    'hero.btnAlign': 'center',
    'hero.overlayEnabled': 'true',
    'hero.overlayOpacity': '50',
    'hero.overlayColor': '#FDFBF7',
    'hero.gradientEnabled': 'true',
    'hero.gradientOpacity': '90',
    'hero.carouselInterval': '6',
    'hero.carouselTransition': 'fade',
    'hero.carouselTransitionDuration': '1500',
    'hero.videoUrl': '',
};

interface HeroMediaEditorProps {
    configs: { key: string; value: string }[];
}

function getVal(configs: { key: string; value: string }[], key: string, fallback = ""): string {
    return configs.find(c => c.key === key)?.value || fallback;
}

function d(key: string) { return DEFAULTS[key] || ''; }

// ─── Reusable Toggle Component ───────────────────────────────────────────────
function Toggle({ value, onChange, size = 'md' }: { value: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md' }) {
    const w = size === 'sm' ? 'w-8 h-[18px]' : 'w-11 h-6';
    const dot = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
    const on = size === 'sm' ? 'left-[15px]' : 'left-[22px]';
    return (
        <button type="button" onClick={() => onChange(!value)}
            className={`relative ${w} rounded-full transition-colors ${value ? 'bg-[#CBA153]' : 'bg-white/10'}`}>
            <span className={`absolute top-0.5 ${dot} bg-white rounded-full shadow transition-transform ${value ? on : 'left-0.5'}`} />
        </button>
    );
}

// ─── Alignment Picker Component ──────────────────────────────────────────────
function AlignPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex bg-[#0D0D0D] rounded-md border border-white/10 overflow-hidden">
            {[{ v: 'left', Icon: AlignLeft }, { v: 'center', Icon: AlignCenter }, { v: 'right', Icon: AlignRight }].map(a => (
                <button key={a.v} type="button" onClick={() => onChange(a.v)}
                    className={`px-2 py-1 transition-colors ${value === a.v ? 'bg-[#CBA153] text-black' : 'text-gray-500 hover:text-white'}`}>
                    <a.Icon className="w-3 h-3" />
                </button>
            ))}
        </div>
    );
}

// Grid preset positions (snap-to shortcuts)
const GRID_PRESETS = [
    { id: 'tl', x: 15, y: 20, label: '↖' }, { id: 'tc', x: 50, y: 20, label: '↑' }, { id: 'tr', x: 85, y: 20, label: '↗' },
    { id: 'cl', x: 15, y: 50, label: '←' }, { id: 'cc', x: 50, y: 50, label: '●' }, { id: 'cr', x: 85, y: 50, label: '→' },
    { id: 'bl', x: 15, y: 80, label: '↙' }, { id: 'bc', x: 50, y: 80, label: '↓' }, { id: 'br', x: 85, y: 80, label: '↘' },
];

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function HeroMediaEditor({ configs }: HeroMediaEditorProps) {
    // Text content
    const [title, setTitle] = useState(getVal(configs, "hero.title", d('hero.title')));
    const [subtitle, setSubtitle] = useState(getVal(configs, "hero.subtitle", d('hero.subtitle')));
    const [shopCta, setShopCta] = useState(getVal(configs, "hero.shopCta", d('hero.shopCta')));
    const [wholesaleCta, setWholesaleCta] = useState(getVal(configs, "hero.wholesaleCta", d('hero.wholesaleCta')));
    const [badgeText, setBadgeText] = useState(getVal(configs, "hero.badgeText", d('hero.badgeText')));
    const [videoUrl, setVideoUrl] = useState(getVal(configs, "hero.videoUrl", ""));

    // Visibility
    const [showBadge, setShowBadge] = useState(getVal(configs, "hero.showBadge", "true") === "true");
    const [showTitle, setShowTitle] = useState(getVal(configs, "hero.showTitle", "true") === "true");
    const [showSubtitle, setShowSubtitle] = useState(getVal(configs, "hero.showSubtitle", "true") === "true");
    const [showBtnPrimary, setShowBtnPrimary] = useState(getVal(configs, "hero.showBtnPrimary", "true") === "true");
    const [showBtnSecondary, setShowBtnSecondary] = useState(getVal(configs, "hero.showBtnSecondary", "true") === "true");

    // Layout
    const [textSize, setTextSize] = useState(getVal(configs, "hero.textSize", "lg"));
    const [posX, setPosX] = useState(parseInt(getVal(configs, "hero.posX", "50")));
    const [posY, setPosY] = useState(parseInt(getVal(configs, "hero.posY", "50")));
    const [badgeAlign, setBadgeAlign] = useState(getVal(configs, "hero.badgeAlign", "center"));
    const [titleAlign, setTitleAlign] = useState(getVal(configs, "hero.titleAlign", "center"));
    const [subtitleAlign, setSubtitleAlign] = useState(getVal(configs, "hero.subtitleAlign", "center"));
    const [btnAlign, setBtnAlign] = useState(getVal(configs, "hero.btnAlign", "center"));

    // Overlay
    const [overlayEnabled, setOverlayEnabled] = useState(getVal(configs, "hero.overlayEnabled", "true") === "true");
    const [overlayOpacity, setOverlayOpacity] = useState(parseInt(getVal(configs, "hero.overlayOpacity", "50")));
    const [overlayColor, setOverlayColor] = useState(getVal(configs, "hero.overlayColor", "#FDFBF7"));

    // Gradient
    const [gradientEnabled, setGradientEnabled] = useState(getVal(configs, "hero.gradientEnabled", "true") === "true");
    const [gradientOpacity, setGradientOpacity] = useState(parseInt(getVal(configs, "hero.gradientOpacity", "90")));

    // Carousel
    const [carouselInterval, setCarouselInterval] = useState(parseInt(getVal(configs, "hero.carouselInterval", "6")));
    const [carouselTransition, setCarouselTransition] = useState(getVal(configs, "hero.carouselTransition", "fade"));
    const [carouselTransitionDuration, setCarouselTransitionDuration] = useState(parseInt(getVal(configs, "hero.carouselTransitionDuration", "1500")));

    // Images
    const initialImages = getVal(configs, "hero.images", "").split(',').map(u => u.trim()).filter(Boolean);
    const singleImage = getVal(configs, "hero.imageUrl", "");
    const [heroImages, setHeroImages] = useState<string[]>(
        initialImages.length > 0 ? initialImages : (singleImage ? [singleImage] : [])
    );

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showReset, setShowReset] = useState(false);

    // ─── Reset to defaults ────────────────────────────────────────────────────
    const resetToDefaults = useCallback(() => {
        setTitle(d('hero.title'));
        setSubtitle(d('hero.subtitle'));
        setShopCta(d('hero.shopCta'));
        setWholesaleCta(d('hero.wholesaleCta'));
        setBadgeText(d('hero.badgeText'));
        setShowBadge(true);
        setShowTitle(true);
        setShowSubtitle(true);
        setShowBtnPrimary(true);
        setShowBtnSecondary(true);
        setTextSize('lg');
        setPosX(50);
        setPosY(50);
        setBadgeAlign('center');
        setTitleAlign('center');
        setSubtitleAlign('center');
        setBtnAlign('center');
        setOverlayEnabled(true);
        setOverlayOpacity(50);
        setOverlayColor('#FDFBF7');
        setGradientEnabled(true);
        setGradientOpacity(90);
        setCarouselInterval(6);
        setCarouselTransition('fade');
        setCarouselTransitionDuration(1500);
        setVideoUrl('');
        setShowReset(false);
    }, []);

    // ─── Save ─────────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        setSaving(true);
        setSaved(false);

        const entries = [
            { key: 'hero.title', value: title },
            { key: 'hero.subtitle', value: subtitle },
            { key: 'hero.shopCta', value: shopCta },
            { key: 'hero.wholesaleCta', value: wholesaleCta },
            { key: 'hero.badgeText', value: badgeText },
            { key: 'hero.imageUrl', value: heroImages[0] || '' },
            { key: 'hero.images', value: heroImages.join(',') },
            { key: 'hero.videoUrl', value: videoUrl },
            { key: 'hero.showBadge', value: showBadge ? 'true' : 'false' },
            { key: 'hero.showTitle', value: showTitle ? 'true' : 'false' },
            { key: 'hero.showSubtitle', value: showSubtitle ? 'true' : 'false' },
            { key: 'hero.showBtnPrimary', value: showBtnPrimary ? 'true' : 'false' },
            { key: 'hero.showBtnSecondary', value: showBtnSecondary ? 'true' : 'false' },
            { key: 'hero.textSize', value: textSize },
            { key: 'hero.posX', value: String(posX) },
            { key: 'hero.posY', value: String(posY) },
            { key: 'hero.badgeAlign', value: badgeAlign },
            { key: 'hero.titleAlign', value: titleAlign },
            { key: 'hero.subtitleAlign', value: subtitleAlign },
            { key: 'hero.btnAlign', value: btnAlign },
            { key: 'hero.overlayEnabled', value: overlayEnabled ? 'true' : 'false' },
            { key: 'hero.overlayOpacity', value: String(overlayOpacity) },
            { key: 'hero.overlayColor', value: overlayColor },
            { key: 'hero.gradientEnabled', value: gradientEnabled ? 'true' : 'false' },
            { key: 'hero.gradientOpacity', value: String(gradientOpacity) },
            { key: 'hero.carouselInterval', value: String(carouselInterval) },
            { key: 'hero.carouselTransition', value: carouselTransition },
            { key: 'hero.carouselTransitionDuration', value: String(carouselTransitionDuration) },
        ];

        try {
            const fd = new FormData();
            fd.set('entries', JSON.stringify(entries));
            const res = await fetch('/api/admin/site-config', { method: 'POST', body: fd });
            if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
        } catch (err) { console.error('Save error:', err); }
        finally { setSaving(false); }
    }, [title, subtitle, shopCta, wholesaleCta, badgeText, heroImages, videoUrl, showBadge, showTitle, showSubtitle, showBtnPrimary, showBtnSecondary, textSize, posX, posY, badgeAlign, titleAlign, subtitleAlign, btnAlign, overlayEnabled, overlayOpacity, overlayColor, gradientEnabled, gradientOpacity, carouselInterval, carouselTransition, carouselTransitionDuration]);

    const inp = "w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm";

    return (
        <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-[#CBA153]" />
                    <h2 className="text-white font-bold">Hero Section</h2>
                </div>
                <div className="flex items-center gap-2">
                    {saved && <span className="text-xs text-emerald-400 animate-fade-in">✓ Saved</span>}
                    <button type="button" onClick={() => setShowReset(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-[10px] text-gray-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-all uppercase tracking-wider font-bold">
                        <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 bg-[#CBA153] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                    </button>
                </div>
            </div>

            {/* Reset Confirmation */}
            {showReset && (
                <div className="px-6 py-3 bg-red-950/30 border-b border-red-500/20 flex items-center justify-between">
                    <p className="text-xs text-red-300">Reset all hero settings to defaults? Images will be kept.</p>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setShowReset(false)}
                            className="px-3 py-1.5 text-[10px] text-gray-400 border border-white/10 rounded-lg hover:bg-white/5 transition">Cancel</button>
                        <button type="button" onClick={resetToDefaults}
                            className="px-3 py-1.5 text-[10px] text-white bg-red-600 rounded-lg hover:bg-red-500 transition font-bold">Reset to Defaults</button>
                    </div>
                </div>
            )}

            <div className="p-6 space-y-6">

                {/* ═══════════════════════════════════════════════════════════════
                    VISUAL LAYOUT EDITOR — pixel-perfect scaled preview
                ═══════════════════════════════════════════════════════════════ */}
                <div>
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Type className="w-4 h-4 text-[#CBA153]" />
                        Visual Layout Editor
                    </h3>
                    <p className="text-[10px] text-gray-600 mb-4">Click on the preview to position content. What you see here is exactly what visitors see.</p>

                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_140px] gap-4">
                        {/* Pixel-perfect preview */}
                        <HeroPreview
                            title={title}
                            subtitle={subtitle}
                            badgeText={badgeText}
                            shopCta={shopCta}
                            wholesaleCta={wholesaleCta}
                            showBadge={showBadge}
                            showTitle={showTitle}
                            showSubtitle={showSubtitle}
                            showBtnPrimary={showBtnPrimary}
                            showBtnSecondary={showBtnSecondary}
                            textSize={textSize}
                            posX={posX}
                            posY={posY}
                            badgeAlign={badgeAlign}
                            titleAlign={titleAlign}
                            subtitleAlign={subtitleAlign}
                            btnAlign={btnAlign}
                            heroImage={heroImages[0] || ''}
                            overlayEnabled={overlayEnabled}
                            overlayOpacity={overlayOpacity}
                            overlayColor={overlayColor}
                            gradientEnabled={gradientEnabled}
                            gradientOpacity={gradientOpacity}
                            onPositionChange={(x, y) => { setPosX(x); setPosY(y); }}
                        />

                        {/* Position controls */}
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wider">Snap To</label>
                            <div className="grid grid-cols-3 gap-1 bg-[#0D0D0D] rounded-lg p-2 border border-white/10">
                                {GRID_PRESETS.map(p => {
                                    const isActive = Math.abs(posX - p.x) < 8 && Math.abs(posY - p.y) < 8;
                                    return (
                                        <button key={p.id} type="button" onClick={() => { setPosX(p.x); setPosY(p.y); }}
                                            className={`aspect-square rounded-md text-[10px] font-bold transition-all flex items-center justify-center ${isActive
                                                ? 'bg-[#CBA153] text-black shadow-lg shadow-[#CBA153]/20'
                                                : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'
                                            }`}>
                                            {p.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 mt-3 uppercase tracking-wider">X: {posX}%</label>
                            <input type="range" min="5" max="95" value={posX} onChange={e => setPosX(parseInt(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#CBA153]" />
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 mt-2 uppercase tracking-wider">Y: {posY}%</label>
                            <input type="range" min="8" max="92" value={posY} onChange={e => setPosY(parseInt(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#CBA153]" />
                            <label className="block text-[10px] font-bold text-gray-500 mb-2 mt-3 uppercase tracking-wider">Size</label>
                            <div className="flex bg-[#0D0D0D] rounded-lg border border-white/10 overflow-hidden">
                                {[{ v: 'sm', l: 'S' }, { v: 'md', l: 'M' }, { v: 'lg', l: 'L' }, { v: 'xl', l: 'XL' }].map(s => (
                                    <button key={s.v} type="button" onClick={() => setTextSize(s.v)}
                                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${textSize === s.v ? 'bg-[#CBA153] text-black' : 'text-gray-400 hover:text-white'}`}>
                                        {s.l}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════
                    ELEMENT CONTROLS — each independently toggleable & alignable
                ═══════════════════════════════════════════════════════════════ */}
                <div className="border-t border-white/5 pt-5 space-y-2">
                    <h3 className="text-sm font-bold text-white mb-3">Element Controls</h3>

                    {/* Badge */}
                    <ElementCard label="Badge" show={showBadge} onToggle={setShowBadge} align={badgeAlign} onAlign={setBadgeAlign}>
                        <input value={badgeText} onChange={e => setBadgeText(e.target.value)} className={inp} placeholder="Badge text" />
                    </ElementCard>

                    {/* Title */}
                    <ElementCard label="Title" show={showTitle} onToggle={setShowTitle} align={titleAlign} onAlign={setTitleAlign}>
                        <input value={title} onChange={e => setTitle(e.target.value)} className={inp} placeholder="Title (comma splits into 2 lines)" />
                        <p className="text-[9px] text-gray-600 mt-1">Comma splits into two lines — second part renders in gold italic</p>
                    </ElementCard>

                    {/* Subtitle */}
                    <ElementCard label="Subtitle" show={showSubtitle} onToggle={setShowSubtitle} align={subtitleAlign} onAlign={setSubtitleAlign}>
                        <textarea value={subtitle} onChange={e => setSubtitle(e.target.value)} rows={2} className={`${inp} resize-none`} placeholder="Subtitle text" />
                    </ElementCard>

                    {/* Primary Button */}
                    <ElementCard label="Primary Button" show={showBtnPrimary} onToggle={setShowBtnPrimary} align={btnAlign} onAlign={setBtnAlign}>
                        <input value={shopCta} onChange={e => setShopCta(e.target.value)} className={inp} placeholder="Button label" />
                    </ElementCard>

                    {/* Secondary Button */}
                    <ElementCard label="Secondary Button" show={showBtnSecondary} onToggle={setShowBtnSecondary} align={btnAlign} onAlign={setBtnAlign}>
                        <input value={wholesaleCta} onChange={e => setWholesaleCta(e.target.value)} className={inp} placeholder="Button label" />
                    </ElementCard>
                </div>

                {/* ═══════════════════════════════════════════════════════════════
                    IMAGES
                ═══════════════════════════════════════════════════════════════ */}
                <div className="border-t border-white/5 pt-5">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-[#CBA153]" />
                        Background Images
                    </h3>
                    <p className="text-[10px] text-gray-600 mb-3">Upload wide landscape images. Cropped to 16:9 ratio. Auto-optimized to WebP.</p>
                    <MediaUploadZone value={heroImages} onChange={setHeroImages} type="image" label="Hero Images" multiple maxFiles={5} aspectRatio="16:9" landscapeThumbs />
                </div>

                {/* ═══════════════════════════════════════════════════════════════
                    OVERLAY & GRADIENT
                ═══════════════════════════════════════════════════════════════ */}
                <div className="border-t border-white/5 pt-5">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-[#CBA153]" />
                        Image Effects
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Overlay */}
                        <div className="bg-[#0D0D0D] rounded-lg border border-white/10 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-300 font-bold">Color Overlay</span>
                                <Toggle value={overlayEnabled} onChange={setOverlayEnabled} />
                            </div>
                            {overlayEnabled && (
                                <>
                                    <div>
                                        <label className="block text-[9px] text-gray-500 mb-1">Opacity — {overlayOpacity}%</label>
                                        <input type="range" min="0" max="90" step="5" value={overlayOpacity} onChange={e => setOverlayOpacity(parseInt(e.target.value))}
                                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#CBA153]" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={overlayColor} onChange={e => setOverlayColor(e.target.value)} className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent" />
                                        {['#FDFBF7', '#000000', '#2C2A29', '#FFFFFF'].map(c => (
                                            <button key={c} type="button" onClick={() => setOverlayColor(c)}
                                                className={`w-6 h-6 rounded border-2 transition-all ${overlayColor === c ? 'border-[#CBA153] scale-110' : 'border-white/10'}`}
                                                style={{ backgroundColor: c }} />
                                        ))}
                                        <span className="text-[9px] text-gray-600 font-mono ml-1">{overlayColor}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Gradient */}
                        <div className="bg-[#0D0D0D] rounded-lg border border-white/10 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-300 font-bold">Bottom Gradient</span>
                                <Toggle value={gradientEnabled} onChange={setGradientEnabled} />
                            </div>
                            {gradientEnabled && (
                                <div>
                                    <label className="block text-[9px] text-gray-500 mb-1">Strength — {gradientOpacity}%</label>
                                    <input type="range" min="10" max="100" step="5" value={gradientOpacity} onChange={e => setGradientOpacity(parseInt(e.target.value))}
                                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#CBA153]" />
                                    <div className="flex justify-between text-[8px] text-gray-600 mt-1"><span>Subtle</span><span>Strong</span></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════
                    CAROUSEL
                ═══════════════════════════════════════════════════════════════ */}
                <div className="border-t border-white/5 pt-5">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#CBA153]" />
                        Carousel Settings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                                <Timer className="w-3 h-3" /> Duration — {carouselInterval}s
                            </label>
                            <input type="range" min="3" max="15" step="1" value={carouselInterval} onChange={e => setCarouselInterval(parseInt(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#CBA153]" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Effect</label>
                            <select value={carouselTransition} onChange={e => setCarouselTransition(e.target.value)}
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2 px-3 rounded-lg text-xs focus:outline-none focus:border-[#CBA153]">
                                <option value="fade">Crossfade</option>
                                <option value="slide">Slide</option>
                                <option value="zoom">Ken Burns</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Speed — {carouselTransitionDuration}ms</label>
                            <input type="range" min="500" max="3000" step="100" value={carouselTransitionDuration} onChange={e => setCarouselTransitionDuration(parseInt(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#CBA153]" />
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════
                    VIDEO OVERRIDE
                ═══════════════════════════════════════════════════════════════ */}
                <div className="border-t border-white/5 pt-5">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Film className="w-4 h-4 text-[#CBA153]" />
                        Background Video
                    </h3>
                    <p className="text-[10px] text-gray-600 mb-2">Optional. Overrides image carousel if set.</p>
                    <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="MP4 video URL or leave empty" className={inp} />
                </div>
            </div>
        </div>
    );
}

// ─── Element Card ─────────────────────────────────────────────────────────────
function ElementCard({
    label, show, onToggle, align, onAlign, children,
}: {
    label: string;
    show: boolean;
    onToggle: (v: boolean) => void;
    align: string;
    onAlign: (v: string) => void;
    children: React.ReactNode;
}) {
    return (
        <div className={`rounded-lg border transition-all ${show ? 'border-white/10 bg-[#0D0D0D]' : 'border-white/5 bg-[#0D0D0D]/40'}`}>
            <div className="flex items-center gap-3 px-4 py-2.5">
                <Toggle value={show} onChange={onToggle} size="sm" />
                <span className={`text-xs font-bold flex-1 transition-colors ${show ? 'text-gray-200' : 'text-gray-600'}`}>{label}</span>
                {show && <AlignPicker value={align} onChange={onAlign} />}
            </div>
            {show && <div className="px-4 pb-3 pt-1">{children}</div>}
        </div>
    );
}
