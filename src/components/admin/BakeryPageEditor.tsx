'use client';

import { useState, useTransition } from 'react';
import { Save, CheckCircle, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { saveContentBlock } from '@/app/actions/content';

const mono = { fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' as const };
const inputCls = 'w-full bg-[#0C0C0C] border border-[#B96A3D22] text-[#F5F0E6] py-3 px-4 focus:outline-none focus:border-[#B96A3D] transition-colors text-sm';
const labelCls = 'block text-[9px] text-[#D9A876] mb-2';

function Section({ title, subtitle, children, defaultOpen = false }: { title: string; subtitle: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-[#161616] border border-[#B96A3D22] overflow-hidden">
            <button type="button" onClick={() => setOpen(!open)} className="w-full px-6 py-4 flex items-center gap-3 hover:bg-[#1C1C1C] transition-colors">
                {open ? <ChevronDown className="w-4 h-4 text-[#B96A3D]" /> : <ChevronRight className="w-4 h-4 text-[#5A6158]" />}
                <div className="text-left flex-1">
                    <h3 className="text-[#F5F0E6] font-medium text-sm" style={{ fontFamily: 'var(--font-serif)' }}>{title}</h3>
                    <p className="text-[#5A6158] text-[10px] mt-0.5" style={mono}>{subtitle}</p>
                </div>
            </button>
            {open && <div className="px-6 py-5 border-t border-[#B96A3D22] space-y-4">{children}</div>}
        </div>
    );
}

interface BakeryPageEditorProps {
    initialData: {
        hero: any;
        menu: any;
        delivery: any;
    };
}

export default function BakeryPageEditor({ initialData }: BakeryPageEditorProps) {
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState<string | null>(null);

    // ─── Hero State ──────────────────────────────────────────────────
    const [hero, setHero] = useState(initialData.hero || {
        eyebrow: 'The Bakery · საცხობი · Open until 9 PM',
        headline: 'Hot from',
        headline_accent: 'the oven',
        headline_suffix: 'in Dublin, Ohio.',
        today_items: 'Adjaruli · Imeruli\nMegruli · Lobiani',
        delivery_time: 'Hot delivery · 25 min',
        pickup_time: 'Pickup · 15 min',
        delivery_platforms: 'Doordash · Uber Eats',
        pickup_address: '5340 Tuller Rd',
    });

    // ─── Menu State ──────────────────────────────────────────────────
    const [menu, setMenu] = useState(initialData.menu || {
        eyebrow: '№ 01 — The Menu',
        heading: 'Six khachapuri,',
        heading_accent: 'two ways.',
        hot_tab_label: '◐ Hot · Dublin',
        frozen_tab_label: '▸ Frozen · 50 states',
        hot_items: [
            { name: 'Adjaruli', ka: 'აჭარული', desc: 'Boat-shaped, egg yolk, melted butter, sulguni & imeruli inside.', weight: '520g', price: '$16', tag: 'Bestseller' },
            { name: 'Imeruli', ka: 'იმერული', desc: 'Round, sulguni-stuffed, blistered top.', weight: '480g', price: '$14', tag: '' },
            { name: 'Megruli', ka: 'მეგრული', desc: 'Imeruli with a second layer of sulguni baked over the crust.', weight: '560g', price: '$17', tag: '' },
            { name: 'Lobiani', ka: 'ლობიანი', desc: 'Filled with spiced kidney beans — the day after-the-feast classic.', weight: '440g', price: '$13', tag: 'Vegan' },
            { name: 'Penovani', ka: 'ფენოვანი', desc: 'Layered, flaky pastry version with sulguni.', weight: '380g', price: '$12', tag: '' },
            { name: 'Achma', ka: 'აჩმა', desc: 'Many-layered baked pasta-meets-cheese tray slice.', weight: '420g', price: '$15', tag: 'Limited' },
        ],
        frozen_items: [
            { name: 'Adjaruli · 2-pk', ka: 'აჭარული', desc: 'Frozen at peak, ships nationwide. Bake from frozen in 18 min.', weight: '520g × 2', price: '$24', tag: 'Ships' },
            { name: 'Imeruli · 2-pk', ka: 'იმერული', desc: 'The classic, frozen. UPS Ground anywhere in 50 states.', weight: '480g × 2', price: '$22', tag: 'Ships' },
            { name: 'Megruli · 2-pk', ka: 'მეგრული', desc: 'Cheese on cheese, frozen. Bake at 425°F.', weight: '560g × 2', price: '$26', tag: 'Ships' },
            { name: 'Lobiani · 2-pk', ka: 'ლობიანი', desc: 'Bean-filled, vegan, freezer-stable.', weight: '440g × 2', price: '$20', tag: 'Vegan' },
        ],
    });

    // ─── Delivery State ──────────────────────────────────────────────
    const [delivery, setDelivery] = useState(initialData.delivery || {
        eyebrow: '№ 02 — Two logistics, one tap',
        heading: 'Hot here,',
        heading_accent: 'frozen everywhere.',
        hot_zone: {
            label: '◐ Hot zone · 8 mi radius',
            cities: 'Dublin · Hilliard · Powell · Worthington',
            description: 'Doordash & Uber Eats. ETA 25 min until 9 PM. Adding new locations as we grow.',
        },
        ship_zone: {
            label: '▸ Ship zone · 50 states',
            cities: 'UPS Ground · 1–2 days',
            description: 'Frozen at peak, dry-ice insulated. Free shipping over $75. Bake from frozen at home.',
        },
    });

    const handleSave = (key: string, data: any) => {
        startTransition(async () => {
            const result = await saveContentBlock(key, data);
            if (result.success) {
                setSaved(key);
                setTimeout(() => setSaved(null), 2500);
            }
        });
    };

    const SaveBtn = ({ sectionKey, data }: { sectionKey: string; data: any }) => (
        <button onClick={() => handleSave(sectionKey, data)} disabled={isPending}
            className="flex items-center gap-2 bg-[#B96A3D] text-[#F5F0E6] px-4 py-2 text-[10px] hover:bg-[#F5F0E6] hover:text-[#1F3026] transition-all disabled:opacity-50" style={mono}>
            {saved === sectionKey ? <><CheckCircle className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save Section</>}
        </button>
    );

    // `renderMenuItems` helper removed: bakery menu items are now real Product rows managed
    // at /admin/inventory under the Bakery filter tab. See banner inside Menu section below.

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <span className="text-[9px] text-[#D9A876] block mb-1" style={mono}>Bakery Page Sections</span>
                    <h2 className="text-xl text-[#F5F0E6]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300 }}>Editable Content Blocks</h2>
                </div>
            </div>

            {/* Hero */}
            <Section title="Bakery Hero" subtitle="Headline, today's card" defaultOpen>
                <div className="space-y-4">
                    <div>
                        <label className={labelCls} style={mono}>Eyebrow Text</label>
                        <input value={hero.eyebrow} onChange={e => setHero({ ...hero, eyebrow: e.target.value })} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Headline</label>
                            <input value={hero.headline} onChange={e => setHero({ ...hero, headline: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Accent (copper)</label>
                            <input value={hero.headline_accent} onChange={e => setHero({ ...hero, headline_accent: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Suffix</label>
                            <input value={hero.headline_suffix} onChange={e => setHero({ ...hero, headline_suffix: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Today's Items (use \n for line breaks)</label>
                        <textarea value={hero.today_items} onChange={e => setHero({ ...hero, today_items: e.target.value })} rows={2} className={inputCls + ' resize-none'} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Delivery Time</label>
                            <input value={hero.delivery_time} onChange={e => setHero({ ...hero, delivery_time: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Pickup Time</label>
                            <input value={hero.pickup_time} onChange={e => setHero({ ...hero, pickup_time: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Delivery Platforms</label>
                            <input value={hero.delivery_platforms} onChange={e => setHero({ ...hero, delivery_platforms: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Pickup Address</label>
                            <input value={hero.pickup_address} onChange={e => setHero({ ...hero, pickup_address: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <SaveBtn sectionKey="bakery.hero" data={hero} />
                </div>
            </Section>

            {/* Menu */}
            <Section title="Menu Section" subtitle="Hot & frozen product cards">
                <div className="space-y-4">
                    <div>
                        <label className={labelCls} style={mono}>Eyebrow</label>
                        <input value={menu.eyebrow} onChange={e => setMenu({ ...menu, eyebrow: e.target.value })} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Heading</label>
                            <input value={menu.heading} onChange={e => setMenu({ ...menu, heading: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Accent</label>
                            <input value={menu.heading_accent} onChange={e => setMenu({ ...menu, heading_accent: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Hot Tab Label</label>
                            <input value={menu.hot_tab_label} onChange={e => setMenu({ ...menu, hot_tab_label: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Frozen Tab Label</label>
                            <input value={menu.frozen_tab_label} onChange={e => setMenu({ ...menu, frozen_tab_label: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    {/* Menu items moved to /admin/inventory (Phase 4 — DB-driven). This editor
                        now only manages the section's labels/headings. */}
                    <div className="bg-amber-900/15 border border-amber-700/30 text-amber-300 text-xs px-3 py-2.5">
                        <span className="font-bold uppercase tracking-wider">Menu items moved →</span>{' '}
                        Edit hot &amp; frozen products at{' '}
                        <a href="/admin/inventory" className="underline hover:text-amber-200">/admin/inventory</a>{' '}
                        under the <em>Bakery</em> tab.
                    </div>
                    <SaveBtn sectionKey="bakery.menu" data={menu} />
                </div>
            </Section>

            {/* Delivery Zones */}
            <Section title="Delivery Zones" subtitle="Hot zone & ship zone info">
                <div className="space-y-4">
                    <div>
                        <label className={labelCls} style={mono}>Eyebrow</label>
                        <input value={delivery.eyebrow} onChange={e => setDelivery({ ...delivery, eyebrow: e.target.value })} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Heading</label>
                            <input value={delivery.heading} onChange={e => setDelivery({ ...delivery, heading: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Accent</label>
                            <input value={delivery.heading_accent} onChange={e => setDelivery({ ...delivery, heading_accent: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <div className="bg-[#0C0C0C] border border-[#B96A3D22] p-4 space-y-3">
                        <label className={labelCls} style={mono}>Hot Zone</label>
                        <input value={delivery.hot_zone.label} onChange={e => setDelivery({ ...delivery, hot_zone: { ...delivery.hot_zone, label: e.target.value } })} className={inputCls} placeholder="Label" />
                        <input value={delivery.hot_zone.cities} onChange={e => setDelivery({ ...delivery, hot_zone: { ...delivery.hot_zone, cities: e.target.value } })} className={inputCls} placeholder="Cities" />
                        <textarea value={delivery.hot_zone.description} onChange={e => setDelivery({ ...delivery, hot_zone: { ...delivery.hot_zone, description: e.target.value } })} className={inputCls + ' resize-none'} rows={2} placeholder="Description" />
                    </div>
                    <div className="bg-[#0C0C0C] border border-[#B96A3D22] p-4 space-y-3">
                        <label className={labelCls} style={mono}>Ship Zone</label>
                        <input value={delivery.ship_zone.label} onChange={e => setDelivery({ ...delivery, ship_zone: { ...delivery.ship_zone, label: e.target.value } })} className={inputCls} placeholder="Label" />
                        <input value={delivery.ship_zone.cities} onChange={e => setDelivery({ ...delivery, ship_zone: { ...delivery.ship_zone, cities: e.target.value } })} className={inputCls} placeholder="Title" />
                        <textarea value={delivery.ship_zone.description} onChange={e => setDelivery({ ...delivery, ship_zone: { ...delivery.ship_zone, description: e.target.value } })} className={inputCls + ' resize-none'} rows={2} placeholder="Description" />
                    </div>
                    <SaveBtn sectionKey="bakery.delivery" data={delivery} />
                </div>
            </Section>
        </div>
    );
}
