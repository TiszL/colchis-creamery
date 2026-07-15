'use client';

import { useState, useTransition } from 'react';
import { Save, CheckCircle, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { saveContentBlock } from '@/app/actions/content';
import MediaUploadZone from './MediaUploadZone';

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

interface CreameryPageEditorProps {
    initialData: {
        hero: any;
        method: any;
        delivery: any;
        subscription: any;
    };
}

export default function CreameryPageEditor({ initialData }: CreameryPageEditorProps) {
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState<string | null>(null);

    const [hero, setHero] = useState(initialData.hero || {
        eyebrow: 'House No 01 · The Creamery · ყველის სახლი',
        headline: 'Cheese made',
        headline_accent: 'this morning.',
        subheadline: 'Sulguni and Imeruli, hand-pulled in salted whey from the milk of three small Ohio dairies. The recipe is six thousand years old; the cheese is six hours old.',
        image: '',
        stats: [
            { num: '6h', text: 'From milk truck to brine bath. No cheese sits overnight.' },
            { num: '3', text: 'Family dairies in Ohio, within four hours of milking.' },
            { num: '100%', text: 'Cow milk. Pasteurized, microbial rennet, no shortcuts.' },
        ],
    });

    // ─── Method State ────────────────────────────────────────────────
    const [method, setMethod] = useState(initialData.method || {
        eyebrow: '№ 02 — The method · მეთოდი',
        heading: 'Eleven hours,',
        heading_accent: 'three pairs of hands,',
        heading_suffix: 'and a brine bath.',
        steps: [
            { n: '01', t: 'Milk arrives · 6 AM', d: 'Three Ohio dairies, within four hours of milking. We taste every churn — sweet, balanced, never sour.', time: '06:00–07:00' },
            { n: '02', t: 'Curds, cut by hand', d: 'Warmed to 86°F. We cut, pull, and knead in salted whey — the same motions for six thousand years.', time: '07:30–09:30' },
            { n: '03', t: 'Salt brine · 24 hours', d: 'Cold brine, just under 5% salinity. Fresh Sulguni ships at hour 24. Aged rests seven days with raw Ohio honey.', time: '09:30 → next day' },
            { n: '04', t: 'Out the door · 5 PM', d: 'Wheels weighed, packed cold, labelled with the batch number, off to UPS or onto a Doordash for Dublin.', time: '16:30–17:30' },
        ],
    });

    // ─── Delivery State ──────────────────────────────────────────────
    const [delivery, setDelivery] = useState(initialData.delivery || {
        eyebrow: '№ 03 — How it gets to you',
        heading: 'Cold all the way',
        heading_accent: "or it doesn't go.",
        cards: [
            { tag: 'Dublin OH', title: 'Same-day · Doordash', body: 'Order before 3 PM. A driver picks it up from the creamery cooler within the hour. $7 flat, free over $40.', price: '$7 flat' },
            { tag: 'Continental US', title: 'UPS · Cold ship · 1–2 days', body: 'Vacuum-packed, ice gel, insulated liner. We only ship Mon–Wed so nothing sleeps in a warehouse over a weekend.', price: '$12 → $18' },
            { tag: 'Pickup', title: 'Walk in · 9 AM–6 PM', body: "84 N High St, Dublin. Tasting plate on the counter every morning. Park out front; we'll carry it to the car.", price: 'Free' },
        ],
    });

    // ─── Subscription State ──────────────────────────────────────────
    const [subscription, setSubscription] = useState(initialData.subscription || {
        eyebrow: '№ 04 — The cheese club',
        heading: 'One box,',
        heading_accent: 'every month.',
        description: 'Three rotating cheeses, a printed recipe card, and a postcard from whichever dairy our milk came from this month. Pause anytime.',
        cta_primary: 'Start subscription',
        cta_secondary: 'One-time gift box',
        box_name: 'The Brine Box',
        box_price: '$48',
        box_period: '/mo',
        box_features: [
            'Three hand-cut cheeses · ~900g total',
            'One feature: aged Sulguni or seasonal',
            'Recipe card from our test kitchen',
            'Postcard from the dairy of the month',
            'Free cold shipping in the US',
            'Skip, pause, or cancel any month',
        ],
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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <span className="text-[9px] text-[#D9A876] block mb-1" style={mono}>Creamery / Shop Sections</span>
                    <h2 className="text-xl text-[#F5F0E6]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300 }}>Editable Content Blocks</h2>
                </div>
            </div>

            {/* Hero */}
            <Section title="Creamery Hero" subtitle="Headline, subheadline, stats" defaultOpen>
                <div className="space-y-4">
                    <div>
                        <label className={labelCls} style={mono}>Eyebrow Text</label>
                        <input value={hero.eyebrow} onChange={e => setHero({ ...hero, eyebrow: e.target.value })} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Headline</label>
                            <input value={hero.headline} onChange={e => setHero({ ...hero, headline: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Accent (copper italic)</label>
                            <input value={hero.headline_accent} onChange={e => setHero({ ...hero, headline_accent: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Subheadline</label>
                        <textarea value={hero.subheadline} onChange={e => setHero({ ...hero, subheadline: e.target.value })} rows={3} className={inputCls + ' resize-none'} />
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Stats (up to 3)</label>
                        {hero.stats.map((s: any, i: number) => (
                            <div key={i} className="flex gap-2 mb-2">
                                <input value={s.num} onChange={e => { const stats = [...hero.stats]; stats[i] = { ...s, num: e.target.value }; setHero({ ...hero, stats }); }} className={inputCls + ' w-20'} placeholder="Value" />
                                <input value={s.text} onChange={e => { const stats = [...hero.stats]; stats[i] = { ...s, text: e.target.value }; setHero({ ...hero, stats }); }} className={inputCls + ' flex-1'} placeholder="Description" />
                            </div>
                        ))}
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Hero Image (16:9)</label>
                        <MediaUploadZone
                            value={hero.image ? [hero.image] : []}
                            onChange={(urls) => setHero({ ...hero, image: urls[0] || '' })}
                            type="image"
                            label="Creamery Hero Image"
                            multiple={false}
                            maxFiles={1}
                            aspectRatio="16:9"
                            landscapeThumbs
                        />
                    </div>
                    <SaveBtn sectionKey="creamery.hero" data={hero} />
                </div>
            </Section>

            {/* Method */}
            <Section title="The Method" subtitle="4-step process grid">
                <div className="space-y-4">
                    <div>
                        <label className={labelCls} style={mono}>Eyebrow</label>
                        <input value={method.eyebrow} onChange={e => setMethod({ ...method, eyebrow: e.target.value })} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Heading</label>
                            <input value={method.heading} onChange={e => setMethod({ ...method, heading: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Accent</label>
                            <input value={method.heading_accent} onChange={e => setMethod({ ...method, heading_accent: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Suffix</label>
                            <input value={method.heading_suffix} onChange={e => setMethod({ ...method, heading_suffix: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Steps</label>
                        {method.steps.map((s: any, i: number) => (
                            <div key={i} className="flex gap-2 mb-2 items-start">
                                <input value={s.n} onChange={e => { const steps = [...method.steps]; steps[i] = { ...s, n: e.target.value }; setMethod({ ...method, steps }); }} className={inputCls + ' w-14 text-center'} />
                                <input value={s.t} onChange={e => { const steps = [...method.steps]; steps[i] = { ...s, t: e.target.value }; setMethod({ ...method, steps }); }} className={inputCls + ' w-48'} placeholder="Title" />
                                <input value={s.d} onChange={e => { const steps = [...method.steps]; steps[i] = { ...s, d: e.target.value }; setMethod({ ...method, steps }); }} className={inputCls + ' flex-1'} placeholder="Description" />
                                <input value={s.time} onChange={e => { const steps = [...method.steps]; steps[i] = { ...s, time: e.target.value }; setMethod({ ...method, steps }); }} className={inputCls + ' w-32'} placeholder="Time" />
                            </div>
                        ))}
                    </div>
                    <SaveBtn sectionKey="creamery.method" data={method} />
                </div>
            </Section>

            {/* Delivery */}
            <Section title="Delivery Section" subtitle="Shipping options cards">
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
                    <div>
                        <label className={labelCls} style={mono}>Delivery Cards</label>
                        {delivery.cards.map((c: any, i: number) => (
                            <div key={i} className="bg-[#0C0C0C] border border-[#B96A3D22] p-4 space-y-2 mb-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <input value={c.tag} onChange={e => { const cards = [...delivery.cards]; cards[i] = { ...c, tag: e.target.value }; setDelivery({ ...delivery, cards }); }} className={inputCls} placeholder="Tag" />
                                    <input value={c.title} onChange={e => { const cards = [...delivery.cards]; cards[i] = { ...c, title: e.target.value }; setDelivery({ ...delivery, cards }); }} className={inputCls} placeholder="Title" />
                                    <input value={c.price} onChange={e => { const cards = [...delivery.cards]; cards[i] = { ...c, price: e.target.value }; setDelivery({ ...delivery, cards }); }} className={inputCls} placeholder="Price" />
                                </div>
                                <textarea value={c.body} onChange={e => { const cards = [...delivery.cards]; cards[i] = { ...c, body: e.target.value }; setDelivery({ ...delivery, cards }); }} className={inputCls + ' resize-none'} rows={2} placeholder="Body text" />
                            </div>
                        ))}
                    </div>
                    <SaveBtn sectionKey="creamery.delivery" data={delivery} />
                </div>
            </Section>

            {/* Subscription */}
            <Section title="Cheese Club / Subscription" subtitle="Monthly box section">
                <div className="space-y-4">
                    <div>
                        <label className={labelCls} style={mono}>Eyebrow</label>
                        <input value={subscription.eyebrow} onChange={e => setSubscription({ ...subscription, eyebrow: e.target.value })} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Heading</label>
                            <input value={subscription.heading} onChange={e => setSubscription({ ...subscription, heading: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Accent</label>
                            <input value={subscription.heading_accent} onChange={e => setSubscription({ ...subscription, heading_accent: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Description</label>
                        <textarea value={subscription.description} onChange={e => setSubscription({ ...subscription, description: e.target.value })} rows={3} className={inputCls + ' resize-none'} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Primary CTA</label>
                            <input value={subscription.cta_primary} onChange={e => setSubscription({ ...subscription, cta_primary: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Secondary CTA</label>
                            <input value={subscription.cta_secondary} onChange={e => setSubscription({ ...subscription, cta_secondary: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Box Name</label>
                            <input value={subscription.box_name} onChange={e => setSubscription({ ...subscription, box_name: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Price</label>
                            <input value={subscription.box_price} onChange={e => setSubscription({ ...subscription, box_price: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Period</label>
                            <input value={subscription.box_period} onChange={e => setSubscription({ ...subscription, box_period: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Box Features</label>
                        {subscription.box_features.map((f: string, i: number) => (
                            <div key={i} className="flex gap-2 mb-2">
                                <input value={f} onChange={e => { const features = [...subscription.box_features]; features[i] = e.target.value; setSubscription({ ...subscription, box_features: features }); }} className={inputCls + ' flex-1'} />
                                <button onClick={() => setSubscription({ ...subscription, box_features: subscription.box_features.filter((_: any, j: number) => j !== i) })} className="text-[#A8312C] hover:text-[#F5F0E6] p-2"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                        <button onClick={() => setSubscription({ ...subscription, box_features: [...subscription.box_features, ''] })} className="flex items-center gap-2 text-[#B96A3D] text-[10px] hover:text-[#F5F0E6]" style={mono}><Plus className="w-3 h-3" /> Add Feature</button>
                    </div>
                    <SaveBtn sectionKey="creamery.subscription" data={subscription} />
                </div>
            </Section>
        </div>
    );
}
