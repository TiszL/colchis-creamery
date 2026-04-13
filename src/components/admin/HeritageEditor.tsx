'use client';

import { useState, useTransition } from 'react';
import { Save, Plus, Trash2, GripVertical, Loader2, ArrowLeft, ArrowRight, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import MediaUploadZone from './MediaUploadZone';

// ─── Types ───────────────────────────────────────────────────────────────────
interface LocaleStrings {
    en: string;
    ka: string;
    ru: string;
    es: string;
}

interface HeritageSection {
    id: string;
    heading: LocaleStrings;
    text: LocaleStrings;
    images: string[];
    videos: string[];
    layout: 'image-left' | 'image-right';
}

interface HeritageEditorProps {
    configs: { key: string; value: string }[];
}

const LOCALES = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ka', label: 'ქართული', flag: '🇬🇪' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
] as const;

type LocaleCode = 'en' | 'ka' | 'ru' | 'es';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function emptyLocale(enVal = ''): LocaleStrings {
    return { en: enVal, ka: '', ru: '', es: '' };
}

function getVal(configs: { key: string; value: string }[], key: string, fallback = ''): string {
    return configs.find(c => c.key === key)?.value || fallback;
}

function parseLocaleField(raw: string, fallback: string): LocaleStrings {
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed.en !== undefined) return parsed;
    } catch { /* ignore */ }
    return emptyLocale(raw || fallback);
}

function parseSections(raw: string): HeritageSection[] {
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
    return [];
}

function uuid() {
    return crypto.randomUUID();
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function HeritageEditor({ configs }: HeritageEditorProps) {
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);

    // ── Page-level fields ──
    const [pageTitle, setPageTitle] = useState<LocaleStrings>(
        parseLocaleField(getVal(configs, 'heritage.pageTitle'), 'Our Heritage')
    );
    const [pageIntro, setPageIntro] = useState<LocaleStrings>(
        parseLocaleField(getVal(configs, 'heritage.pageIntro'), 'In the ancient land of Colchis, where the Golden Fleece was sought, a tradition of cheesemaking has flourished for millennia. We bring that tradition to Ohio.')
    );
    const [processTitle, setProcessTitle] = useState<LocaleStrings>(
        parseLocaleField(getVal(configs, 'heritage.processTitle'), 'Our Process')
    );
    const [processText, setProcessText] = useState<LocaleStrings>(
        parseLocaleField(getVal(configs, 'heritage.processText'), 'Every batch of Colchis Creamery cheese is handcrafted in small quantities, ensuring meticulous attention to detail. From stretching and brining to aging — each step follows time-honored methods.')
    );

    // ── Sections ──
    const [sections, setSections] = useState<HeritageSection[]>(() => {
        const raw = getVal(configs, 'heritage.sections');
        const parsed = parseSections(raw);
        if (parsed.length > 0) return parsed;
        // Default sections from existing page
        return [
            {
                id: uuid(),
                heading: emptyLocale('Georgian Cheesemaking Tradition'),
                text: emptyLocale('Georgia is one of the oldest cheesemaking regions in the world. For over 8,000 years, Georgian cheesemakers have perfected the art of crafting unique cheeses that are unlike anything found elsewhere.'),
                images: [],
                videos: [],
                layout: 'image-right',
            },
            {
                id: uuid(),
                heading: emptyLocale('Crafted in Ohio'),
                text: emptyLocale('We source the finest local milk from Ohio\'s premium dairy farms, combining ancient Georgian techniques with modern food safety standards to create cheese that honors tradition while meeting the highest quality benchmarks.'),
                images: [],
                videos: [],
                layout: 'image-left',
            },
        ];
    });

    // ── Active locale tab ──
    const [activeLangTab, setActiveLangTab] = useState<LocaleCode>('en');
    // ── Collapsed sections ──
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    // ── Section manipulation ──
    function addSection() {
        setSections(prev => [...prev, {
            id: uuid(),
            heading: emptyLocale(''),
            text: emptyLocale(''),
            images: [],
            videos: [],
            layout: prev.length % 2 === 0 ? 'image-right' : 'image-left', // Auto-alternate
        }]);
    }

    function removeSection(id: string) {
        setSections(prev => prev.filter(s => s.id !== id));
    }

    function moveSection(id: string, direction: 'up' | 'down') {
        setSections(prev => {
            const idx = prev.findIndex(s => s.id === id);
            if (idx < 0) return prev;
            const newIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= prev.length) return prev;
            const copy = [...prev];
            [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
            return copy;
        });
    }

    function updateSection(id: string, field: keyof HeritageSection, value: any) {
        setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    }

    function updateSectionLocaleField(id: string, field: 'heading' | 'text', locale: LocaleCode, value: string) {
        setSections(prev => prev.map(s =>
            s.id === id ? { ...s, [field]: { ...s[field], [locale]: value } } : s
        ));
    }

    function toggleCollapsed(id: string) {
        setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
    }

    // ── Save ──
    async function handleSave() {
        startTransition(async () => {
            const entries = [
                { key: 'heritage.pageTitle', value: JSON.stringify(pageTitle) },
                { key: 'heritage.pageIntro', value: JSON.stringify(pageIntro) },
                { key: 'heritage.processTitle', value: JSON.stringify(processTitle) },
                { key: 'heritage.processText', value: JSON.stringify(processText) },
                { key: 'heritage.sections', value: JSON.stringify(sections) },
            ];

            const fd = new FormData();
            fd.set('entries', JSON.stringify(entries));

            const { batchUpsertSiteConfigAction } = await import('@/app/actions/cms');
            await batchUpsertSiteConfigAction(fd);

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        });
    }

    // ── Locale text input helper ──
    function LocaleInput({ label, value, onChange, multiline = false }: {
        label: string;
        value: LocaleStrings;
        onChange: (v: LocaleStrings) => void;
        multiline?: boolean;
    }) {
        return (
            <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">{label}</label>
                <div className="space-y-2">
                    {LOCALES.map(loc => (
                        <div key={loc.code} className="flex items-start gap-2">
                            <span className="text-sm mt-2.5 w-7 flex-shrink-0" title={loc.label}>{loc.flag}</span>
                            {multiline ? (
                                <textarea
                                    value={value[loc.code]}
                                    onChange={e => onChange({ ...value, [loc.code]: e.target.value })}
                                    rows={2}
                                    placeholder={loc.code === 'en' ? 'English (required)' : `${loc.label} (optional — falls back to English)`}
                                    className={`flex-1 bg-[#0D0D0D] border ${loc.code === 'en' ? 'border-[#CBA153]/30' : 'border-white/10'} text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm resize-none`}
                                />
                            ) : (
                                <input
                                    value={value[loc.code]}
                                    onChange={e => onChange({ ...value, [loc.code]: e.target.value })}
                                    placeholder={loc.code === 'en' ? 'English (required)' : `${loc.label} (optional — falls back to English)`}
                                    className={`flex-1 bg-[#0D0D0D] border ${loc.code === 'en' ? 'border-[#CBA153]/30' : 'border-white/10'} text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm`}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ══════════════════════════════════════════════════════════════════ */}
            {/*  SAVE BAR                                                        */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            <div className="sticky top-0 z-30 bg-[#111111]/95 backdrop-blur-sm border-b border-white/5 -mx-4 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-emerald-400" />
                    <span className="text-white font-bold">Heritage Page</span>
                    {saved && <span className="text-xs text-emerald-400 animate-pulse">✓ Saved successfully</span>}
                </div>
                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="flex items-center gap-2 bg-[#CBA153] text-black px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50"
                >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isPending ? 'Saving...' : 'Save All Changes'}
                </button>
            </div>

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/*  PAGE HEADER                                                     */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5">
                    <h2 className="text-white font-bold">Page Header</h2>
                    <p className="text-gray-500 text-xs mt-1">The hero section at the top of the Heritage page</p>
                </div>
                <div className="p-6 space-y-5">
                    <LocaleInput label="Page Title" value={pageTitle} onChange={setPageTitle} />
                    <LocaleInput label="Introduction Text" value={pageIntro} onChange={setPageIntro} multiline />
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/*  CONTENT SECTIONS                                                */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-white font-bold text-lg">Content Sections</h2>
                        <p className="text-gray-500 text-xs mt-1">Each section shows text on one side and media on the other</p>
                    </div>
                    <button
                        onClick={addSection}
                        className="flex items-center gap-2 bg-[#CBA153]/10 text-[#CBA153] px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#CBA153]/20 transition-all border border-[#CBA153]/20"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add Section
                    </button>
                </div>

                {sections.map((section, idx) => (
                    <div key={section.id} className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                        {/* Section Header — always visible */}
                        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                            <GripVertical className="w-4 h-4 text-gray-600 flex-shrink-0" />
                            <span className="text-xs text-gray-500 font-mono w-6">#{idx + 1}</span>
                            <span className="text-white font-medium text-sm flex-1 truncate">
                                {section.heading.en || 'Untitled Section'}
                            </span>

                            {/* Layout indicator */}
                            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400">
                                {section.layout === 'image-left' ? '◀ IMG | TXT ▶' : '◀ TXT | IMG ▶'}
                            </span>

                            {/* Reorder */}
                            <button onClick={() => moveSection(section.id, 'up')} disabled={idx === 0}
                                className="text-gray-500 hover:text-white disabled:opacity-20 transition-colors p-1">
                                <ChevronUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => moveSection(section.id, 'down')} disabled={idx === sections.length - 1}
                                className="text-gray-500 hover:text-white disabled:opacity-20 transition-colors p-1">
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {/* Collapse toggle */}
                            <button onClick={() => toggleCollapsed(section.id)}
                                className="text-gray-500 hover:text-[#CBA153] transition-colors text-xs px-2 py-1 rounded hover:bg-white/5">
                                {collapsed[section.id] ? 'Expand' : 'Collapse'}
                            </button>

                            {/* Delete */}
                            <button onClick={() => removeSection(section.id)}
                                className="text-red-400/50 hover:text-red-400 transition-colors p-1">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Section Body — collapsible */}
                        {!collapsed[section.id] && (
                            <div className="p-6 space-y-5">
                                {/* Layout Toggle */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Layout Direction</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => updateSection(section.id, 'layout', 'image-right')}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all border ${section.layout === 'image-right'
                                                    ? 'bg-[#CBA153]/20 text-[#CBA153] border-[#CBA153]/30'
                                                    : 'bg-[#0D0D0D] text-gray-400 border-white/10 hover:border-white/20'
                                                }`}
                                        >
                                            <ArrowRight className="w-3.5 h-3.5" /> Text Left · Image Right
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateSection(section.id, 'layout', 'image-left')}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all border ${section.layout === 'image-left'
                                                    ? 'bg-[#CBA153]/20 text-[#CBA153] border-[#CBA153]/30'
                                                    : 'bg-[#0D0D0D] text-gray-400 border-white/10 hover:border-white/20'
                                                }`}
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" /> Image Left · Text Right
                                        </button>
                                    </div>
                                </div>

                                {/* Heading — all locales */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Section Heading</label>
                                    <div className="space-y-2">
                                        {LOCALES.map(loc => (
                                            <div key={loc.code} className="flex items-center gap-2">
                                                <span className="text-sm w-7 flex-shrink-0" title={loc.label}>{loc.flag}</span>
                                                <input
                                                    value={section.heading[loc.code]}
                                                    onChange={e => updateSectionLocaleField(section.id, 'heading', loc.code, e.target.value)}
                                                    placeholder={loc.code === 'en' ? 'English heading (required)' : `${loc.label} (optional)`}
                                                    className={`flex-1 bg-[#0D0D0D] border ${loc.code === 'en' ? 'border-[#CBA153]/30' : 'border-white/10'} text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Body Text — all locales */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Section Text</label>
                                    <div className="space-y-2">
                                        {LOCALES.map(loc => (
                                            <div key={loc.code} className="flex items-start gap-2">
                                                <span className="text-sm mt-2.5 w-7 flex-shrink-0" title={loc.label}>{loc.flag}</span>
                                                <textarea
                                                    value={section.text[loc.code]}
                                                    onChange={e => updateSectionLocaleField(section.id, 'text', loc.code, e.target.value)}
                                                    rows={3}
                                                    placeholder={loc.code === 'en' ? 'English body text (required)' : `${loc.label} (optional)`}
                                                    className={`flex-1 bg-[#0D0D0D] border ${loc.code === 'en' ? 'border-[#CBA153]/30' : 'border-white/10'} text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm resize-none`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Media — Images */}
                                <MediaUploadZone
                                    value={section.images}
                                    onChange={(urls) => updateSection(section.id, 'images', urls)}
                                    type="image"
                                    label="Section Images"
                                    multiple={true}
                                    maxFiles={8}
                                    aspectRatio="free"
                                    landscapeThumbs={true}
                                />

                                {/* Media — Videos / YouTube */}
                                <MediaUploadZone
                                    value={section.videos}
                                    onChange={(urls) => updateSection(section.id, 'videos', urls)}
                                    type="video"
                                    label="Videos / YouTube"
                                    multiple={true}
                                    maxFiles={3}
                                />
                            </div>
                        )}
                    </div>
                ))}

                {sections.length === 0 && (
                    <div className="bg-[#1A1A1A] rounded-xl border border-dashed border-white/10 p-12 text-center">
                        <p className="text-gray-500 mb-4">No content sections yet.</p>
                        <button onClick={addSection}
                            className="text-[#CBA153] text-sm font-bold hover:underline">
                            + Add your first section
                        </button>
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/*  PROCESS SECTION (CLOSING)                                       */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5">
                    <h2 className="text-white font-bold">Closing Section — "Our Process"</h2>
                    <p className="text-gray-500 text-xs mt-1">Centered text section at the bottom of the page</p>
                </div>
                <div className="p-6 space-y-5">
                    <LocaleInput label="Process Title" value={processTitle} onChange={setProcessTitle} />
                    <LocaleInput label="Process Text" value={processText} onChange={setProcessText} multiline />
                </div>
            </div>
        </div>
    );
}
