'use client';

import { useState, useTransition } from 'react';
import { Save, CheckCircle, Plus, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
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

interface HomepageEditorProps {
    initialData: {
        hero: any;
        story: any;
        threeHouses: any;
        process: any;
        press: any;
        visit: any;
        ticker: any;
    };
}

export default function HomepageEditor({ initialData }: HomepageEditorProps) {
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState<string | null>(null);

    // ─── Hero State ──────────────────────────────────────────────────────────────
    const [hero, setHero] = useState(initialData.hero || {
        eyebrow: '№ 01 — From Colchis, est. MMXXVI',
        headline: 'Bread,\ncheese,\nand a country\nyou should know.',
        headline_accent: 'and a country',
        subheadline: 'Six thousand years of recipes, hand-pressed and hand-baked in Dublin, Ohio. Hot khachapuri to your door tonight, or aged sulguni shipped to all fifty states.',
        cta_primary: 'Shop the Creamery →',
        cta_primary_link: '/shop',
        cta_secondary: 'Read our story',
        cta_secondary_link: '/heritage',
        badge_label: 'HOT NOW',
        badge_value: '25 min',
        badge_location: 'DUBLIN OH',
    });

    // ─── Story State ─────────────────────────────────────────────────────────────
    const [story, setStory] = useState(initialData.story || {
        heading: 'Six thousand years ago, Colchis was the kingdom Greek sailors called the edge of the known world — a black-sea coast of vine and wheat, of cheese aged in clay and bread baked in earth ovens.',
        heading_accent: 'the edge of the known world',
        subheading: 'We make those foods, here, with milk from Ohio dairies and the same recipes our grandmothers taught.',
        image: '',
        stats: [
            { val: '6,000', label: 'Years of recipe' },
            { val: '04', label: 'Generations' },
            { val: '1', label: 'Bakery in Dublin OH' },
            { val: '50', label: 'States we ship' },
        ],
    });

    // ─── Three Houses State ──────────────────────────────────────────────────────
    const [threeHouses, setThreeHouses] = useState(initialData.threeHouses || {
        heading: 'One parent house, two crafts.',
        heading_accent: 'two crafts.',
        houses: [
            { name: 'The Creamery', ka: 'ყველის სახლი', tag: 'Imeruli & Sulguni, hand-pressed', desc: 'Cow-milk Sulguni, brined fresh or aged with honey. Imeruli pulled in salted whey. Aged in our Dublin facility, shipped fresh nationwide.', cta: 'Shop cheese →', href: '/shop', image: '' },
            { name: 'The Bakery', ka: 'საცხობი', tag: 'Khachapuri, hot from the oven', desc: 'Adjaruli, Imeruli, Megruli — pulled apart at 25 minutes via Doordash and Uber Eats inside Dublin. Frozen for the rest of the country.', cta: 'Order hot delivery →', href: '/bakery', image: '' },
        ],
    });

    // ─── Process State ───────────────────────────────────────────────────────────
    const [process, setProcess] = useState(initialData.process || {
        heading: 'One day, start to finish.',
        heading_accent: 'start to finish.',
        steps: [
            { n: '01', t: 'Milk arrives 6 AM', d: 'From three Ohio dairies, within 4 hours of milking. Cow only — never sheep.' },
            { n: '02', t: 'Curds, cut by hand', d: 'Heated to 86°F, cut, pulled, kneaded. The same motions for six thousand years.' },
            { n: '03', t: 'Brine 24 hours', d: 'Cold salt brine. Fresh sulguni ships at hour 24. Aged sulguni rests 7 days with raw honey.' },
            { n: '04', t: 'Out the door by 5 PM', d: 'Packed cold, into UPS for the country, or onto Doordash for Dublin.' },
        ],
    });

    // ─── Press State ─────────────────────────────────────────────────────────────
    const [press, setPress] = useState(initialData.press || {
        outlets: ['Columbus Monthly', 'Eater Midwest', 'Cherry Bombe', 'Bon Appétit'],
        review_score: '',
        review_count: '',
        quote: 'I grew up eating khachapuri on the Black Sea. This tastes exactly like the bakery on the corner where I was a kid. Somehow they did it in Ohio.',
        quote_author: '— Nia G. · Brooklyn NY · ★★★★★',
    });

    // ─── Visit State ─────────────────────────────────────────────────────────────
    // The live "Visit Us" section reads address / city / hours / phone / the
    // directions map link from the PRIMARY LOCATION row (Admin → Locations),
    // NOT from here — only `description` and `image` are set on this page. The
    // old editor exposed address/phone/map fields that silently did nothing;
    // we now persist only the two fields that actually render, so stale values
    // (e.g. a leftover map URL) can't linger or mislead.
    const [visit, setVisit] = useState(() => {
        const v = (initialData.visit || {}) as { description?: string; image?: string };
        return {
            description: v.description ?? 'The bakery is open daily, 7 AM to 10 PM. The creamery is by appointment — we\'d love to show you the cheese cellar.',
            image: v.image ?? '',
        };
    });

    // ─── Ticker State ────────────────────────────────────────────────────────────
    const [ticker, setTicker] = useState(initialData.ticker || {
        items: [
            '◐ The Bakery — open until 10 PM',
            '▸ Free UPS over $75',
            '● Made in Dublin, Ohio',
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
        <button
            onClick={() => handleSave(sectionKey, data)}
            disabled={isPending}
            className="flex items-center gap-2 bg-[#B96A3D] text-[#F5F0E6] px-4 py-2 text-[10px] hover:bg-[#F5F0E6] hover:text-[#1F3026] transition-all disabled:opacity-50"
            style={mono}
        >
            {saved === sectionKey ? <><CheckCircle className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save Section</>}
        </button>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <span className="text-[9px] text-[#D9A876] block mb-1" style={mono}>Homepage Sections</span>
                    <h2 className="text-xl text-[#F5F0E6]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300 }}>Editable Content Blocks</h2>
                </div>
            </div>

            {/* Hero Section */}
            <Section title="Hero Section" subtitle="Headline, subheadline, CTAs, badge" defaultOpen>
                <div className="space-y-4">
                    <div>
                        <label className={labelCls} style={mono}>Eyebrow Text</label>
                        <input value={hero.eyebrow} onChange={e => setHero({ ...hero, eyebrow: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Headline (use \n for line breaks)</label>
                        <textarea value={hero.headline} onChange={e => setHero({ ...hero, headline: e.target.value })} rows={4} className={inputCls + ' resize-none'} />
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Accent Portion (appears in copper)</label>
                        <input value={hero.headline_accent} onChange={e => setHero({ ...hero, headline_accent: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Subheadline</label>
                        <textarea value={hero.subheadline} onChange={e => setHero({ ...hero, subheadline: e.target.value })} rows={3} className={inputCls + ' resize-none'} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Primary CTA Text</label>
                            <input value={hero.cta_primary} onChange={e => setHero({ ...hero, cta_primary: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Primary CTA Link</label>
                            <input value={hero.cta_primary_link} onChange={e => setHero({ ...hero, cta_primary_link: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Secondary CTA Text</label>
                            <input value={hero.cta_secondary} onChange={e => setHero({ ...hero, cta_secondary: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Secondary CTA Link</label>
                            <input value={hero.cta_secondary_link} onChange={e => setHero({ ...hero, cta_secondary_link: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Badge Label</label>
                            <input value={hero.badge_label} onChange={e => setHero({ ...hero, badge_label: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Badge Value</label>
                            <input value={hero.badge_value} onChange={e => setHero({ ...hero, badge_value: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Badge Location</label>
                            <input value={hero.badge_location} onChange={e => setHero({ ...hero, badge_location: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <SaveBtn sectionKey="home.hero" data={hero} />
                </div>
            </Section>

            {/* Ticker */}
            <Section title="Ticker Bar" subtitle="Bottom announcement strip">
                <div className="space-y-3">
                    {ticker.items.map((item: string, i: number) => (
                        <div key={i} className="flex gap-2">
                            <input value={item} onChange={e => { const items = [...ticker.items]; items[i] = e.target.value; setTicker({ ...ticker, items }); }} className={inputCls + ' flex-1'} />
                            <button onClick={() => setTicker({ ...ticker, items: ticker.items.filter((_: any, j: number) => j !== i) })} className="text-[#A8312C] hover:text-[#F5F0E6] p-2"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                    <button onClick={() => setTicker({ ...ticker, items: [...ticker.items, ''] })} className="flex items-center gap-2 text-[#B96A3D] text-[10px] hover:text-[#F5F0E6]" style={mono}><Plus className="w-3 h-3" /> Add Item</button>
                    <SaveBtn sectionKey="home.ticker" data={ticker} />
                </div>
            </Section>

            {/* Story */}
            <Section title="Story Section" subtitle="Heritage story text + statistics">
                <div className="space-y-4">
                    <div>
                        <label className={labelCls} style={mono}>Main Heading</label>
                        <textarea value={story.heading} onChange={e => setStory({ ...story, heading: e.target.value })} rows={3} className={inputCls + ' resize-none'} />
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Accent Portion (copper italic)</label>
                        <input value={story.heading_accent} onChange={e => setStory({ ...story, heading_accent: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Subheading</label>
                        <textarea value={story.subheading} onChange={e => setStory({ ...story, subheading: e.target.value })} rows={2} className={inputCls + ' resize-none'} />
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Stats (up to 4)</label>
                        <div className="grid grid-cols-2 gap-3">
                            {story.stats.map((s: any, i: number) => (
                                <div key={i} className="flex gap-2">
                                    <input value={s.val} onChange={e => { const stats = [...story.stats]; stats[i] = { ...s, val: e.target.value }; setStory({ ...story, stats }); }} className={inputCls + ' w-20'} placeholder="Value" />
                                    <input value={s.label} onChange={e => { const stats = [...story.stats]; stats[i] = { ...s, label: e.target.value }; setStory({ ...story, stats }); }} className={inputCls + ' flex-1'} placeholder="Label" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Section Image</label>
                        <MediaUploadZone
                            value={story.image ? [story.image] : []}
                            onChange={(urls) => setStory({ ...story, image: urls[0] || '' })}
                            type="image"
                            label="Story Image"
                            multiple={false}
                            maxFiles={1}
                        />
                    </div>
                    <SaveBtn sectionKey="home.story" data={story} />
                </div>
            </Section>

            {/* Three Houses */}
            <Section title="Two Houses Section" subtitle="Creamery & Bakery cards">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Section Heading</label>
                            <input value={threeHouses.heading} onChange={e => setThreeHouses({ ...threeHouses, heading: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Accent Portion</label>
                            <input value={threeHouses.heading_accent} onChange={e => setThreeHouses({ ...threeHouses, heading_accent: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    {threeHouses.houses.map((h: any, i: number) => (
                        <div key={i} className="bg-[#0C0C0C] border border-[#B96A3D22] p-4 space-y-3">
                            <label className={labelCls} style={mono}>House {i + 1}: {h.name}</label>
                            <div className="grid grid-cols-2 gap-3">
                                <input value={h.name} onChange={e => { const houses = [...threeHouses.houses]; houses[i] = { ...h, name: e.target.value }; setThreeHouses({ ...threeHouses, houses }); }} className={inputCls} placeholder="Name" />
                                <input value={h.ka} onChange={e => { const houses = [...threeHouses.houses]; houses[i] = { ...h, ka: e.target.value }; setThreeHouses({ ...threeHouses, houses }); }} className={inputCls} placeholder="Georgian name" />
                                <input value={h.tag} onChange={e => { const houses = [...threeHouses.houses]; houses[i] = { ...h, tag: e.target.value }; setThreeHouses({ ...threeHouses, houses }); }} className={inputCls} placeholder="Tagline" />
                                <input value={h.href} onChange={e => { const houses = [...threeHouses.houses]; houses[i] = { ...h, href: e.target.value }; setThreeHouses({ ...threeHouses, houses }); }} className={inputCls} placeholder="Link" />
                                <input value={h.cta} onChange={e => { const houses = [...threeHouses.houses]; houses[i] = { ...h, cta: e.target.value }; setThreeHouses({ ...threeHouses, houses }); }} className={inputCls} placeholder="CTA text" />
                            </div>
                            <textarea value={h.desc} onChange={e => { const houses = [...threeHouses.houses]; houses[i] = { ...h, desc: e.target.value }; setThreeHouses({ ...threeHouses, houses }); }} rows={2} className={inputCls + ' resize-none'} placeholder="Description" />
                            <div className="mt-2">
                                <label className={labelCls} style={mono}>House Image (16:10)</label>
                                <MediaUploadZone
                                    value={h.image ? [h.image] : []}
                                    onChange={(urls) => { const houses = [...threeHouses.houses]; houses[i] = { ...h, image: urls[0] || '' }; setThreeHouses({ ...threeHouses, houses }); }}
                                    type="image"
                                    label={`${h.name} Image`}
                                    multiple={false}
                                    maxFiles={1}
                                    aspectRatio="16:9"
                                    landscapeThumbs
                                />
                            </div>
                        </div>
                    ))}
                    <SaveBtn sectionKey="home.three_houses" data={threeHouses} />
                </div>
            </Section>

            {/* Process */}
            <Section title="Process Section" subtitle="How we make it — 4 steps">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Section Heading</label>
                            <input value={process.heading} onChange={e => setProcess({ ...process, heading: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Accent Portion</label>
                            <input value={process.heading_accent} onChange={e => setProcess({ ...process, heading_accent: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    {process.steps.map((s: any, i: number) => (
                        <div key={i} className="flex gap-3 items-start">
                            <input value={s.n} onChange={e => { const steps = [...process.steps]; steps[i] = { ...s, n: e.target.value }; setProcess({ ...process, steps }); }} className={inputCls + ' w-16 text-center'} />
                            <input value={s.t} onChange={e => { const steps = [...process.steps]; steps[i] = { ...s, t: e.target.value }; setProcess({ ...process, steps }); }} className={inputCls + ' w-48'} placeholder="Title" />
                            <input value={s.d} onChange={e => { const steps = [...process.steps]; steps[i] = { ...s, d: e.target.value }; setProcess({ ...process, steps }); }} className={inputCls + ' flex-1'} placeholder="Description" />
                        </div>
                    ))}
                    <SaveBtn sectionKey="home.process" data={process} />
                </div>
            </Section>

            {/* Press */}
            <Section title="Press & Reviews Section" subtitle="Media logos, featured quote">
                <div className="space-y-4">
                    <div>
                        <label className={labelCls} style={mono}>Press Outlets (comma-separated)</label>
                        <input value={press.outlets.join(', ')} onChange={e => setPress({ ...press, outlets: e.target.value.split(',').map((s: string) => s.trim()) })} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={mono}>Review Score</label>
                            <input value={press.review_score} onChange={e => setPress({ ...press, review_score: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls} style={mono}>Review Count</label>
                            <input value={press.review_count} onChange={e => setPress({ ...press, review_count: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Featured Quote</label>
                        <textarea value={press.quote} onChange={e => setPress({ ...press, quote: e.target.value })} rows={3} className={inputCls + ' resize-none'} />
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Quote Attribution</label>
                        <input value={press.quote_author} onChange={e => setPress({ ...press, quote_author: e.target.value })} className={inputCls} />
                    </div>
                    <SaveBtn sectionKey="home.press" data={press} />
                </div>
            </Section>

            {/* Visit */}
            <Section title="Visit Us Section" subtitle="Description + photo (address, hours, phone & map come from Admin → Locations)">
                <div className="space-y-4">
                    <div className="rounded border border-[#B96A3D]/40 bg-[#B96A3D]/10 px-3 py-2.5 text-[12px] leading-relaxed text-[#1F3026]/80">
                        The <strong>address, hours, phone, and “Get directions” map link</strong> shown in this section come from your primary location — edit them in{' '}
                        <a href="/admin/locations" className="underline font-medium">Admin → Locations</a>. Only the description and photo below are set here.
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Description</label>
                        <textarea value={visit.description} onChange={e => setVisit({ ...visit, description: e.target.value })} rows={2} className={inputCls + ' resize-none'} />
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Visit Image (Portrait)</label>
                        <MediaUploadZone
                            value={visit.image ? [visit.image] : []}
                            onChange={(urls) => setVisit({ ...visit, image: urls[0] || '' })}
                            type="image"
                            label="Visit / Founders Image"
                            multiple={false}
                            maxFiles={1}
                        />
                    </div>
                    <SaveBtn sectionKey="home.visit" data={visit} />
                </div>
            </Section>
        </div>
    );
}
