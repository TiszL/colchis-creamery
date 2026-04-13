'use client';

import { useState, useTransition } from 'react';
import { Save, Loader2, Plus, Trash2, ChevronDown, ChevronUp, FileText, HelpCircle, Shield, RotateCcw } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface FaqItem { question: string; answer: string; }
interface LegalSection { heading: string; body: string; }

interface LegalPagesEditorProps {
    configs: { key: string; value: string }[];
}

function getVal(configs: { key: string; value: string }[], key: string): string {
    return configs.find(c => c.key === key)?.value || '';
}

function parseArray<T>(raw: string, fallback: T[]): T[] {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch { /* ignore */ }
    return fallback;
}

// ─── Default content (used as fallback if nothing stored yet) ────────────────
const DEFAULT_FAQ: FaqItem[] = [
    { question: 'Where is your cheese made?', answer: 'Our cheese is handcrafted in Ohio, USA, using premium local milk, while strictly following ancient Georgian cheese-making traditions.' },
    { question: 'How is the cheese shipped to ensure freshness?', answer: 'We ship our cheese in insulated packaging with ice packs via expedited shipping to ensure it arrives at your doorstep in perfect condition.' },
    { question: 'Are your cheeses pasteurized?', answer: 'Yes, all Colchis Creamery cheeses are made from pasteurized milk to comply with FDA regulations while maintaining authentic flavor profiles.' },
    { question: 'Do you offer wholesale pricing for restaurants?', answer: 'Absolutely. We partner with premium restaurants, grocery stores, and distributors. Please visit our Wholesale page to apply for a B2B account.' },
    { question: 'How long does Sulguni cheese last?', answer: 'Unopened, our Sulguni cheese will last up to 60 days in the refrigerator. Once opened, we recommend consuming it within 5-7 days for optimal taste.' },
];

const DEFAULT_PRIVACY: LegalSection[] = [
    { heading: '1. Information We Collect', body: 'We collect information you provide directly to us, such as when you create an account, make a purchase, sign up for our newsletter, or contact customer support. This may include your name, email address, shipping address, and payment information.' },
    { heading: '2. How We Use Your Information', body: 'We use the information we collect to process transactions, provide customer service, send logistical updates, and improve our services. We may also use your email to send marketing communications, from which you can opt out at any time.' },
    { heading: '3. Data Security', body: 'We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.' },
    { heading: '4. Sharing of Information', body: 'We do not sell or rent your personal information to third parties. We may share information with trusted service providers who assist us in operating our website and conducting our business.' },
    { heading: '5. Contact Us', body: 'If you have any questions about this Privacy Policy, please contact us at support@colchiscreamery.com.' },
];

const DEFAULT_TERMS: LegalSection[] = [
    { heading: '1. Acceptance of Terms', body: 'By accessing and using colchiscreamery.com, you accept and agree to be bound by the terms and provisions of this agreement.' },
    { heading: '2. B2B Wholesale Accounts', body: 'Wholesale accounts are subject to approval. By establishing a wholesale account, you agree to our Net-30 payment terms and acknowledge that pricing is confidential.' },
    { heading: '3. Product Information', body: 'We attempt to be as accurate as possible regarding product descriptions. However, because our cheeses are handmade artisan products, slight variations in weight and appearance may occur.' },
    { heading: '4. Intellectual Property', body: 'The Site and its original content, features, functionalities, and branding are owned by Colchis Creamery LLC and are protected by international copyright, trademark, and other intellectual property laws.' },
    { heading: '5. Modifications', body: 'We reserve the right to modify these terms at any time. Your continued use of the Site following any such modification constitutes your agreement to follow and be bound by the modified terms.' },
];

const DEFAULT_RETURNS: LegalSection[] = [
    { heading: '1. Perishable Goods', body: 'Due to the perishable nature of our artisanal cheese, we cannot accept general returns. Once a product has left our facility and is in transit, the sale is considered final.' },
    { heading: '2. Quality Guarantee', body: 'We stand behind the quality of our craftsmanship. If you receive a product that is damaged, spoiled, or incorrect, please contact us within 24 hours of delivery with photographic evidence.' },
    { heading: '3. Refunds and Replacements', body: 'If a claim is approved under our Quality Guarantee, we will either ship a replacement product at our expense or issue a full refund to your original method of payment.' },
    { heading: '4. Wholesale Returns', body: 'B2B partners must report discrepancies or quality issues within 24 hours of receiving a pallet. Wholesale returns are subject to the specific terms in your signed Vendor Agreement.' },
    { heading: '5. Contact Information', body: 'To initiate a quality claim, please email our support team at support@colchiscreamery.com with your order number and photos of the problem.' },
];

// ─── Tab pages definition ────────────────────────────────────────────────────
const PAGES = [
    { id: 'faq', label: 'FAQ', icon: HelpCircle, color: 'text-blue-400' },
    { id: 'privacy', label: 'Privacy Policy', icon: Shield, color: 'text-emerald-400' },
    { id: 'terms', label: 'Terms of Service', icon: FileText, color: 'text-purple-400' },
    { id: 'returns', label: 'Return Policy', icon: RotateCcw, color: 'text-amber-400' },
] as const;

type PageId = typeof PAGES[number]['id'];

// ─── Component ───────────────────────────────────────────────────────────────
export default function LegalPagesEditor({ configs }: LegalPagesEditorProps) {
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<PageId>('faq');

    // ── FAQ state ──
    const [faqItems, setFaqItems] = useState<FaqItem[]>(
        parseArray(getVal(configs, 'legal.faq'), DEFAULT_FAQ)
    );

    // ── Legal pages state ──
    const [privacySections, setPrivacySections] = useState<LegalSection[]>(
        parseArray(getVal(configs, 'legal.privacy'), DEFAULT_PRIVACY)
    );
    const [termsSections, setTermsSections] = useState<LegalSection[]>(
        parseArray(getVal(configs, 'legal.terms'), DEFAULT_TERMS)
    );
    const [returnsSections, setReturnsSections] = useState<LegalSection[]>(
        parseArray(getVal(configs, 'legal.returns'), DEFAULT_RETURNS)
    );

    // ── Save ──
    async function handleSave() {
        startTransition(async () => {
            const entries = [
                { key: 'legal.faq', value: JSON.stringify(faqItems) },
                { key: 'legal.privacy', value: JSON.stringify(privacySections) },
                { key: 'legal.terms', value: JSON.stringify(termsSections) },
                { key: 'legal.returns', value: JSON.stringify(returnsSections) },
            ];
            const fd = new FormData();
            fd.set('entries', JSON.stringify(entries));
            const { batchUpsertSiteConfigAction } = await import('@/app/actions/cms');
            await batchUpsertSiteConfigAction(fd);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        });
    }

    // ── Generic section list editor ──
    function SectionEditor({ items, setItems }: { items: LegalSection[]; setItems: (v: LegalSection[]) => void }) {
        return (
            <div className="space-y-3">
                {items.map((item, idx) => (
                    <div key={idx} className="bg-[#0D0D0D] rounded-lg border border-white/5 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-mono w-5">#{idx + 1}</span>
                            <input value={item.heading}
                                onChange={e => { const copy = [...items]; copy[idx] = { ...copy[idx], heading: e.target.value }; setItems(copy); }}
                                placeholder="Section Heading"
                                className="flex-1 bg-transparent border border-white/10 text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm font-medium" />
                            <button onClick={() => { const copy = [...items]; if (idx > 0) [copy[idx], copy[idx - 1]] = [copy[idx - 1], copy[idx]]; setItems(copy); }}
                                disabled={idx === 0} className="text-gray-500 hover:text-white disabled:opacity-20 p-1"><ChevronUp className="w-4 h-4" /></button>
                            <button onClick={() => { const copy = [...items]; if (idx < items.length - 1) [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]]; setItems(copy); }}
                                disabled={idx === items.length - 1} className="text-gray-500 hover:text-white disabled:opacity-20 p-1"><ChevronDown className="w-4 h-4" /></button>
                            <button onClick={() => setItems(items.filter((_, i) => i !== idx))}
                                className="text-red-400/50 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <textarea value={item.body}
                            onChange={e => { const copy = [...items]; copy[idx] = { ...copy[idx], body: e.target.value }; setItems(copy); }}
                            rows={3} placeholder="Section content..."
                            className="w-full bg-transparent border border-white/10 text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm resize-none" />
                    </div>
                ))}
                <button onClick={() => setItems([...items, { heading: '', body: '' }])}
                    className="flex items-center gap-2 text-[#CBA153] text-xs font-bold hover:underline mt-2">
                    <Plus className="w-3.5 h-3.5" /> Add Section
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Save bar */}
            <div className="sticky top-0 z-30 bg-[#111111]/95 backdrop-blur-sm border-b border-white/5 -mx-4 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-purple-400" />
                    <span className="text-white font-bold">Legal & FAQ Pages</span>
                    {saved && <span className="text-xs text-emerald-400 animate-pulse">✓ Saved successfully</span>}
                </div>
                <button onClick={handleSave} disabled={isPending}
                    className="flex items-center gap-2 bg-[#CBA153] text-black px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50">
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isPending ? 'Saving...' : 'Save All Changes'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto">
                {PAGES.map(p => (
                    <button key={p.id} onClick={() => setActiveTab(p.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all border whitespace-nowrap ${activeTab === p.id
                            ? 'bg-white/5 text-white border-white/10'
                            : 'bg-transparent text-gray-500 border-transparent hover:text-white hover:bg-white/5'}`}>
                        <p.icon className={`w-4 h-4 ${p.color}`} />
                        {p.label}
                    </button>
                ))}
            </div>

            {/* FAQ Tab */}
            {activeTab === 'faq' && (
                <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5">
                        <h2 className="text-white font-bold">FAQ Items</h2>
                        <p className="text-gray-500 text-xs mt-1">Each item shows as a question + answer card on the FAQ page</p>
                    </div>
                    <div className="p-6 space-y-3">
                        {faqItems.map((item, idx) => (
                            <div key={idx} className="bg-[#0D0D0D] rounded-lg border border-white/5 p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 font-mono w-5">Q{idx + 1}</span>
                                    <input value={item.question}
                                        onChange={e => { const copy = [...faqItems]; copy[idx] = { ...copy[idx], question: e.target.value }; setFaqItems(copy); }}
                                        placeholder="Question"
                                        className="flex-1 bg-transparent border border-[#CBA153]/30 text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm font-medium" />
                                    <button onClick={() => setFaqItems(faqItems.filter((_, i) => i !== idx))}
                                        className="text-red-400/50 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
                                </div>
                                <textarea value={item.answer}
                                    onChange={e => { const copy = [...faqItems]; copy[idx] = { ...copy[idx], answer: e.target.value }; setFaqItems(copy); }}
                                    rows={2} placeholder="Answer..."
                                    className="w-full bg-transparent border border-white/10 text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm resize-none" />
                            </div>
                        ))}
                        <button onClick={() => setFaqItems([...faqItems, { question: '', answer: '' }])}
                            className="flex items-center gap-2 text-[#CBA153] text-xs font-bold hover:underline mt-2">
                            <Plus className="w-3.5 h-3.5" /> Add FAQ Item
                        </button>
                    </div>
                </div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
                <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5">
                        <h2 className="text-white font-bold">Privacy Policy Sections</h2>
                    </div>
                    <div className="p-6">
                        <SectionEditor items={privacySections} setItems={setPrivacySections} />
                    </div>
                </div>
            )}

            {/* Terms Tab */}
            {activeTab === 'terms' && (
                <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5">
                        <h2 className="text-white font-bold">Terms of Service Sections</h2>
                    </div>
                    <div className="p-6">
                        <SectionEditor items={termsSections} setItems={setTermsSections} />
                    </div>
                </div>
            )}

            {/* Returns Tab */}
            {activeTab === 'returns' && (
                <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5">
                        <h2 className="text-white font-bold">Return Policy Sections</h2>
                    </div>
                    <div className="p-6">
                        <SectionEditor items={returnsSections} setItems={setReturnsSections} />
                    </div>
                </div>
            )}
        </div>
    );
}
