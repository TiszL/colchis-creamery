'use client';

import { useState, useTransition } from 'react';
import { Save, Loader2, Image as ImageIcon } from 'lucide-react';
import MediaUploadZone from './MediaUploadZone';

const LOCALES = [
    { code: 'en', flag: '🇺🇸', label: 'English' },
    { code: 'ka', flag: '🇬🇪', label: 'ქართული' },
    { code: 'ru', flag: '🇷🇺', label: 'Русский' },
    { code: 'es', flag: '🇪🇸', label: 'Español' },
] as const;

interface LocaleStrings { en: string; ka: string; ru: string; es: string; }

function emptyLocale(en = ''): LocaleStrings { return { en, ka: '', ru: '', es: '' }; }

function parseLocaleField(raw: string, fallback: string): LocaleStrings {
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed.en !== undefined) return parsed;
    } catch { /* ignore */ }
    return emptyLocale(raw || fallback);
}

function getVal(configs: { key: string; value: string }[], key: string, fallback = ''): string {
    return configs.find(c => c.key === key)?.value || fallback;
}

interface Props {
    configs: { key: string; value: string }[];
}

export default function HomeHeritageTeaserEditor({ configs }: Props) {
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);

    const [title, setTitle] = useState<LocaleStrings>(
        parseLocaleField(getVal(configs, 'homeHeritage.title'), 'A Tradition Spanning Millennia')
    );
    const [text, setText] = useState<LocaleStrings>(
        parseLocaleField(getVal(configs, 'homeHeritage.text'), 'From the ancient land of Colchis to the heartland of Ohio, we bring you authentic Georgian cheese crafted with passion and heritage.')
    );
    const [cta, setCta] = useState<LocaleStrings>(
        parseLocaleField(getVal(configs, 'homeHeritage.cta'), 'Discover Our Story')
    );
    const [imageUrl, setImageUrl] = useState<string[]>(() => {
        const val = getVal(configs, 'homeHeritage.imageUrl');
        return val ? [val] : [];
    });

    async function handleSave() {
        startTransition(async () => {
            const entries = [
                { key: 'homeHeritage.title', value: JSON.stringify(title) },
                { key: 'homeHeritage.text', value: JSON.stringify(text) },
                { key: 'homeHeritage.cta', value: JSON.stringify(cta) },
                { key: 'homeHeritage.imageUrl', value: imageUrl[0] || '' },
            ];
            const fd = new FormData();
            fd.set('entries', JSON.stringify(entries));
            const { batchUpsertSiteConfigAction } = await import('@/app/actions/cms');
            await batchUpsertSiteConfigAction(fd);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        });
    }

    function LocaleField({ label, value, onChange, multiline = false }: {
        label: string; value: LocaleStrings; onChange: (v: LocaleStrings) => void; multiline?: boolean;
    }) {
        return (
            <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">{label}</label>
                <div className="space-y-2">
                    {LOCALES.map(loc => (
                        <div key={loc.code} className="flex items-start gap-2">
                            <span className="text-sm mt-2.5 w-7 flex-shrink-0">{loc.flag}</span>
                            {multiline ? (
                                <textarea
                                    value={value[loc.code]}
                                    onChange={e => onChange({ ...value, [loc.code]: e.target.value })}
                                    rows={2}
                                    placeholder={loc.code === 'en' ? 'English (required)' : `${loc.label} (optional)`}
                                    className={`flex-1 bg-[#0D0D0D] border ${loc.code === 'en' ? 'border-[#CBA153]/30' : 'border-white/10'} text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm resize-none`}
                                />
                            ) : (
                                <input
                                    value={value[loc.code]}
                                    onChange={e => onChange({ ...value, [loc.code]: e.target.value })}
                                    placeholder={loc.code === 'en' ? 'English (required)' : `${loc.label} (optional)`}
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
        <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <ImageIcon className="w-5 h-5 text-amber-400" />
                    <div>
                        <h2 className="text-white font-bold">Homepage — Heritage Teaser</h2>
                        <p className="text-gray-500 text-xs mt-0.5">The &quot;Tradition Spanning Millennia&quot; section below products</p>
                    </div>
                    {saved && <span className="text-xs text-emerald-400 animate-pulse ml-3">✓ Saved</span>}
                </div>
                <button onClick={handleSave} disabled={isPending}
                    className="flex items-center gap-2 bg-[#CBA153] text-black px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50">
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isPending ? 'Saving...' : 'Save'}
                </button>
            </div>
            <div className="p-6 space-y-5">
                <LocaleField label="Heading" value={title} onChange={setTitle} />
                <LocaleField label="Description" value={text} onChange={setText} multiline />
                <LocaleField label="Button Text" value={cta} onChange={setCta} />
                <MediaUploadZone
                    value={imageUrl}
                    onChange={setImageUrl}
                    type="image"
                    label="Section Image (any size — fits automatically)"
                    multiple={false}
                    maxFiles={1}
                    aspectRatio="free"
                />
            </div>
        </div>
    );
}
