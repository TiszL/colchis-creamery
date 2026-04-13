'use client';

import { useState, useTransition } from 'react';
import { Save, Loader2, Building2 } from 'lucide-react';
import MediaUploadZone from './MediaUploadZone';

interface Props {
    configs: { key: string; value: string }[];
}

function getVal(configs: { key: string; value: string }[], key: string, fallback = ''): string {
    return configs.find(c => c.key === key)?.value || fallback;
}

export default function WholesalePageEditor({ configs }: Props) {
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);

    const [subtitle, setSubtitle] = useState(getVal(configs, 'wholesale.subtitle', 'Supply & Distribution'));
    const [headingLine1, setHeadingLine1] = useState(getVal(configs, 'wholesale.headingLine1', 'Wholesale'));
    const [headingLine2, setHeadingLine2] = useState(getVal(configs, 'wholesale.headingLine2', 'Partnership.'));
    const [description, setDescription] = useState(getVal(configs, 'wholesale.description', 'Elevate your culinary offerings with the finest authentic Georgian cheese. We empower premium retailers and fine-dining restaurants across Ohio and the Midwest with steady, high-quality artisanal cheese supply.'));
    const [feature1Title, setFeature1Title] = useState(getVal(configs, 'wholesale.feature1Title', 'Cold Chain Logistics'));
    const [feature1Desc, setFeature1Desc] = useState(getVal(configs, 'wholesale.feature1Desc', 'Fresh from our facility to your inventory.'));
    const [feature2Title, setFeature2Title] = useState(getVal(configs, 'wholesale.feature2Title', 'Paperless Contracting'));
    const [feature2Desc, setFeature2Desc] = useState(getVal(configs, 'wholesale.feature2Desc', 'Fully integrated Adobe Sign agreements.'));
    const [buttonText, setButtonText] = useState(getVal(configs, 'wholesale.buttonText', 'Partner Portal Login'));
    const [buttonLink, setButtonLink] = useState(getVal(configs, 'wholesale.buttonLink', '/b2b/login'));
    const [formHeading, setFormHeading] = useState(getVal(configs, 'wholesale.formHeading', 'Apply for Distribution'));
    const [imageUrl, setImageUrl] = useState<string[]>(() => {
        const val = getVal(configs, 'wholesale.imageUrl');
        return val ? [val] : [];
    });

    async function handleSave() {
        startTransition(async () => {
            const entries = [
                { key: 'wholesale.subtitle', value: subtitle },
                { key: 'wholesale.headingLine1', value: headingLine1 },
                { key: 'wholesale.headingLine2', value: headingLine2 },
                { key: 'wholesale.description', value: description },
                { key: 'wholesale.feature1Title', value: feature1Title },
                { key: 'wholesale.feature1Desc', value: feature1Desc },
                { key: 'wholesale.feature2Title', value: feature2Title },
                { key: 'wholesale.feature2Desc', value: feature2Desc },
                { key: 'wholesale.buttonText', value: buttonText },
                { key: 'wholesale.buttonLink', value: buttonLink },
                { key: 'wholesale.formHeading', value: formHeading },
                { key: 'wholesale.imageUrl', value: imageUrl[0] || '' },
            ];
            const fd = new FormData();
            fd.set('entries', JSON.stringify(entries));
            const { batchUpsertSiteConfigAction } = await import('@/app/actions/cms');
            await batchUpsertSiteConfigAction(fd);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        });
    }

    function Field({ label, value, onChange, multiline = false, placeholder = '' }: {
        label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string;
    }) {
        return (
            <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{label}</label>
                {multiline ? (
                    <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} placeholder={placeholder}
                        className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm resize-none" />
                ) : (
                    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                        className="w-full bg-[#0D0D0D] border border-white/10 text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm" />
                )}
            </div>
        );
    }

    return (
        <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-violet-400" />
                    <div>
                        <h2 className="text-white font-bold">Wholesale Page</h2>
                        <p className="text-gray-500 text-xs mt-0.5">Hero section, features, button &amp; image</p>
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
                {/* Hero Text */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Subtitle" value={subtitle} onChange={setSubtitle} placeholder="Supply & Distribution" />
                    <Field label="Form Section Heading" value={formHeading} onChange={setFormHeading} placeholder="Apply for Distribution" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Heading Line 1" value={headingLine1} onChange={setHeadingLine1} placeholder="Wholesale" />
                    <Field label="Heading Line 2 (gold text)" value={headingLine2} onChange={setHeadingLine2} placeholder="Partnership." />
                </div>
                <Field label="Description" value={description} onChange={setDescription} multiline placeholder="Elevate your culinary offerings..." />

                {/* Features */}
                <div className="border-t border-white/5 pt-5">
                    <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Feature Items</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#0D0D0D] rounded-lg border border-white/5 p-4 space-y-2">
                            <Field label="Feature 1 — Title" value={feature1Title} onChange={setFeature1Title} placeholder="Cold Chain Logistics" />
                            <Field label="Feature 1 — Description" value={feature1Desc} onChange={setFeature1Desc} placeholder="Fresh from our facility..." />
                        </div>
                        <div className="bg-[#0D0D0D] rounded-lg border border-white/5 p-4 space-y-2">
                            <Field label="Feature 2 — Title" value={feature2Title} onChange={setFeature2Title} placeholder="Paperless Contracting" />
                            <Field label="Feature 2 — Description" value={feature2Desc} onChange={setFeature2Desc} placeholder="Fully integrated Adobe Sign..." />
                        </div>
                    </div>
                </div>

                {/* Button */}
                <div className="border-t border-white/5 pt-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Button Text" value={buttonText} onChange={setButtonText} placeholder="Partner Portal Login" />
                        <Field label="Button Link" value={buttonLink} onChange={setButtonLink} placeholder="/b2b/login" />
                    </div>
                </div>

                {/* Image */}
                <div className="border-t border-white/5 pt-5">
                    <MediaUploadZone
                        value={imageUrl}
                        onChange={setImageUrl}
                        type="image"
                        label="Hero Image (any size — fits automatically)"
                        multiple={false}
                        maxFiles={1}
                        aspectRatio="free"
                    />
                </div>
            </div>
        </div>
    );
}
