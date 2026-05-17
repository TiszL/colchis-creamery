'use client';

import { useState, useTransition } from 'react';
import { Save, CheckCircle, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { saveContentBlock } from '@/app/actions/content';

const mono = { fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' as const };
const inputCls = 'w-full bg-[#0C0C0C] border border-[#B96A3D22] text-[#F5F0E6] py-2.5 px-3.5 focus:outline-none focus:border-[#B96A3D] transition-colors text-sm';
const labelCls = 'block text-[9px] text-[#D9A876] mb-1.5';

type HeroState = { eyebrow: string; h1Pre: string; h1Accent: string; subheadline: string; hoursLabel: string };
type DeskState = { id: string; label: string; desk: string; time: string };
type HoursRowState = { day: string; hours: string };
type FaqLinkState = { label: string; href: string };
type MapState = { eyebrow: string; hint: string };
type AddressCardState = { eyebrow: string };
type FormIntroState = { eyebrow: string; heading: string; successHeading: string; successBody: string; trustLine: string };
type FaqCardState = { eyebrow: string; heading: string };

const DEFAULT_HERO: HeroState = {
    eyebrow: '№ 00 — The Switchboard',
    h1Pre: 'Write us',
    h1Accent: 'a postcard.',
    subheadline: "Or an email. Or call the bakery line — Levan picks up when the oven's resting. We answer every note that lands on the counter.",
    hoursLabel: 'Tue–Sat · 9am – 7pm EST',
};
const DEFAULT_DESKS: DeskState[] = [
    { id: 'order', label: 'An order', desk: 'Customer care', time: 'Replies in < 4h, M–F' },
    { id: 'wholesale', label: 'Wholesale', desk: 'Trade desk', time: 'Replies in 1 business day' },
    { id: 'press', label: 'Press & stories', desk: 'Editorial', time: 'Replies within the week' },
    { id: 'kitchen', label: 'The kitchen', desk: 'Bake-house notes', time: 'Hand-answered by Levan' },
];
const DEFAULT_HOURS: HoursRowState[] = [
    { day: 'Mon', hours: 'Closed · cellar day' },
    { day: 'Tue – Thu', hours: '9 am – 6 pm' },
    { day: 'Fri', hours: '9 am – 8 pm · hot bake' },
    { day: 'Sat', hours: '10 am – 7 pm' },
    { day: 'Sun', hours: '11 am – 4 pm' },
];
const DEFAULT_FAQ_LINKS: FaqLinkState[] = [
    { label: 'Shipping & cold-chain', href: '/faq' },
    { label: 'Replace pledge', href: '/faq' },
    { label: 'Wholesale minimums', href: '/faq' },
    { label: 'Pickup windows', href: '/faq' },
];
const DEFAULT_MAP: MapState = { eyebrow: '№ 02 — Find us', hint: 'Free parking out back · 6 min from I-270 exit 17B' };
const DEFAULT_ADDRESS_CARD: AddressCardState = { eyebrow: 'The bakery' };
const DEFAULT_FORM_INTRO: FormIntroState = {
    eyebrow: '№ 01 — A note to the kitchen',
    heading: 'Send a message',
    successHeading: "Thank you — we'll write back.",
    successBody: 'A copy is on its way to your inbox. Most replies land within a few hours during the bake.',
    trustLine: 'Signed by 1 baker · TLS 1.3',
};
const DEFAULT_FAQ_CARD: FaqCardState = { eyebrow: 'Try the FAQ first', heading: 'Most answers live here.' };

interface Props {
    initial: {
        hero: unknown;
        desks: unknown;
        hoursTable: unknown;
        faqLinks: unknown;
        map: unknown;
        addressCard: unknown;
        formIntro: unknown;
        faqCard: unknown;
        heroHoursLabel?: string | null;  // legacy contact.hours fallback
    };
}

function Section({ title, subtitle, children, defaultOpen = false }: { title: string; subtitle: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-[#161616] border border-[#B96A3D22] overflow-hidden">
            <button type="button" onClick={() => setOpen(o => !o)} className="w-full px-6 py-4 flex items-center gap-3 hover:bg-[#1C1C1C] transition-colors">
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

export default function ContactPageEditor({ initial }: Props) {
    const [isPending, startTransition] = useTransition();
    const [savedKey, setSavedKey] = useState<string | null>(null);

    const [hero, setHero] = useState<HeroState>({
        ...DEFAULT_HERO,
        ...((initial.hero as Partial<HeroState>) || {}),
        // Backfill legacy contact.hours into the hero hours label on first load if no hero JSON yet
        hoursLabel: ((initial.hero as Partial<HeroState>)?.hoursLabel) || initial.heroHoursLabel || DEFAULT_HERO.hoursLabel,
    });
    const [desks, setDesks] = useState<DeskState[]>(((initial.desks as DeskState[] | null) ?? DEFAULT_DESKS));
    const [hours, setHours] = useState<HoursRowState[]>(((initial.hoursTable as HoursRowState[] | null) ?? DEFAULT_HOURS));
    const [faqLinks, setFaqLinks] = useState<FaqLinkState[]>(((initial.faqLinks as FaqLinkState[] | null) ?? DEFAULT_FAQ_LINKS));
    const [map, setMap] = useState<MapState>({ ...DEFAULT_MAP, ...((initial.map as Partial<MapState>) || {}) });
    const [addressCard, setAddressCard] = useState<AddressCardState>({ ...DEFAULT_ADDRESS_CARD, ...((initial.addressCard as Partial<AddressCardState>) || {}) });
    const [formIntro, setFormIntro] = useState<FormIntroState>({ ...DEFAULT_FORM_INTRO, ...((initial.formIntro as Partial<FormIntroState>) || {}) });
    const [faqCard, setFaqCard] = useState<FaqCardState>({ ...DEFAULT_FAQ_CARD, ...((initial.faqCard as Partial<FaqCardState>) || {}) });

    function save(key: string, data: unknown) {
        startTransition(async () => {
            const result = await saveContentBlock(key, data as Record<string, unknown>);
            if (result && (result as { success?: boolean }).success) {
                setSavedKey(key);
                setTimeout(() => setSavedKey(null), 2500);
            }
        });
    }

    function SaveBtn({ k, data }: { k: string; data: unknown }) {
        return (
            <button onClick={() => save(k, data)} disabled={isPending}
                className="flex items-center gap-2 bg-[#B96A3D] text-[#F5F0E6] px-4 py-2 text-[10px] hover:bg-[#F5F0E6] hover:text-[#1F3026] transition-all disabled:opacity-50"
                style={mono}>
                {savedKey === k ? <><CheckCircle className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save</>}
            </button>
        );
    }

    return (
        <div className="space-y-4">
            {/* HERO */}
            <Section title="Hero section" subtitle="The dark banner at the top of /contact" defaultOpen>
                <div>
                    <label className={labelCls} style={mono}>Eyebrow (mono caps above headline)</label>
                    <input value={hero.eyebrow} onChange={e => setHero({ ...hero, eyebrow: e.target.value })} className={inputCls} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls} style={mono}>H1 — first part</label>
                        <input value={hero.h1Pre} onChange={e => setHero({ ...hero, h1Pre: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>H1 — italic accent (line 2)</label>
                        <input value={hero.h1Accent} onChange={e => setHero({ ...hero, h1Accent: e.target.value })} className={inputCls} />
                    </div>
                </div>
                <div>
                    <label className={labelCls} style={mono}>Subheadline (italic paragraph)</label>
                    <textarea value={hero.subheadline} onChange={e => setHero({ ...hero, subheadline: e.target.value })} rows={3} className={inputCls + ' resize-none'} />
                </div>
                <div>
                    <label className={labelCls} style={mono}>Hours label (shown in hero side panel)</label>
                    <input value={hero.hoursLabel} onChange={e => setHero({ ...hero, hoursLabel: e.target.value })} className={inputCls} />
                </div>
                <div className="flex justify-end pt-2">
                    <SaveBtn k="contact.hero" data={hero} />
                </div>
            </Section>

            {/* DESKS */}
            <Section title="Desk tabs" subtitle="The 4 'who answers what' cards under the hero">
                <p className="text-[10px] text-[#7A8278] leading-relaxed">Each card represents a topic the customer can pick when sending a message. The <code className="text-[#B96A3D]">id</code> is a stable internal key (used to track which desk the form was submitted to). Keep at least one entry.</p>
                {desks.map((d, i) => (
                    <div key={i} className="bg-[#0C0C0C] border border-[#B96A3D22] p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-[#D9A876] uppercase tracking-wider" style={mono}>Desk {i + 1}</span>
                            <button onClick={() => setDesks(desks.filter((_, j) => j !== i))} className="text-[#A8312C] hover:text-[#F5F0E6] p-1" disabled={desks.length <= 1}>
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls} style={mono}>ID (internal key)</label>
                                <input value={d.id} onChange={e => { const next = [...desks]; next[i] = { ...d, id: e.target.value }; setDesks(next); }} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls} style={mono}>Label (shown to customer)</label>
                                <input value={d.label} onChange={e => { const next = [...desks]; next[i] = { ...d, label: e.target.value }; setDesks(next); }} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls} style={mono}>Desk name (mono caps)</label>
                                <input value={d.desk} onChange={e => { const next = [...desks]; next[i] = { ...d, desk: e.target.value }; setDesks(next); }} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls} style={mono}>Response time</label>
                                <input value={d.time} onChange={e => { const next = [...desks]; next[i] = { ...d, time: e.target.value }; setDesks(next); }} className={inputCls} />
                            </div>
                        </div>
                    </div>
                ))}
                <button type="button" onClick={() => setDesks([...desks, { id: `desk_${desks.length + 1}`, label: 'New desk', desk: 'Team', time: 'Replies soon' }])} className="flex items-center gap-1.5 text-[#B96A3D] text-[10px] hover:text-[#F5F0E6]" style={mono}>
                    <Plus className="w-3 h-3" /> Add desk
                </button>
                <div className="flex justify-end pt-2">
                    <SaveBtn k="contact.desks" data={desks} />
                </div>
            </Section>

            {/* HOURS */}
            <Section title="Hours table" subtitle="The 'Counter hours' card in the sidebar">
                {hours.map((row, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <input value={row.day} onChange={e => { const next = [...hours]; next[i] = { ...row, day: e.target.value }; setHours(next); }} className={inputCls + ' w-32'} placeholder="Day(s)" />
                        <input value={row.hours} onChange={e => { const next = [...hours]; next[i] = { ...row, hours: e.target.value }; setHours(next); }} className={inputCls + ' flex-1'} placeholder="Hours" />
                        <button onClick={() => setHours(hours.filter((_, j) => j !== i))} className="text-[#A8312C] hover:text-[#F5F0E6] p-1" disabled={hours.length <= 1}>
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
                <button type="button" onClick={() => setHours([...hours, { day: '', hours: '' }])} className="flex items-center gap-1.5 text-[#B96A3D] text-[10px] hover:text-[#F5F0E6]" style={mono}>
                    <Plus className="w-3 h-3" /> Add row
                </button>
                <div className="flex justify-end pt-2">
                    <SaveBtn k="contact.hours_table" data={hours} />
                </div>
            </Section>

            {/* FAQ LINKS */}
            <Section title="FAQ teaser links" subtitle="The dark sidebar card with quick FAQ shortcuts">
                {faqLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <input value={link.label} onChange={e => { const next = [...faqLinks]; next[i] = { ...link, label: e.target.value }; setFaqLinks(next); }} className={inputCls + ' flex-1'} placeholder="Question label" />
                        <input value={link.href} onChange={e => { const next = [...faqLinks]; next[i] = { ...link, href: e.target.value }; setFaqLinks(next); }} className={inputCls + ' w-48'} placeholder="/faq#shipping" />
                        <button onClick={() => setFaqLinks(faqLinks.filter((_, j) => j !== i))} className="text-[#A8312C] hover:text-[#F5F0E6] p-1" disabled={faqLinks.length <= 1}>
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
                <button type="button" onClick={() => setFaqLinks([...faqLinks, { label: '', href: '/faq' }])} className="flex items-center gap-1.5 text-[#B96A3D] text-[10px] hover:text-[#F5F0E6]" style={mono}>
                    <Plus className="w-3 h-3" /> Add link
                </button>
                <div className="flex justify-end pt-2">
                    <SaveBtn k="contact.faq_links" data={faqLinks} />
                </div>
            </Section>

            {/* ADDRESS CARD + FAQ CARD copy */}
            <Section title="Address card / FAQ card eyebrows" subtitle="Small mono-caps labels above the address card and FAQ card">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls} style={mono}>Address card eyebrow</label>
                        <input value={addressCard.eyebrow} onChange={e => setAddressCard({ eyebrow: e.target.value })} className={inputCls} />
                        <p className="text-[9px] text-[#7A8278] mt-1">Body of the address card (name, lines, door note) is sourced from your primary location.</p>
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>FAQ card eyebrow</label>
                        <input value={faqCard.eyebrow} onChange={e => setFaqCard({ ...faqCard, eyebrow: e.target.value })} className={inputCls} />
                        <label className={labelCls + ' mt-3'} style={mono}>FAQ card heading (italic serif)</label>
                        <input value={faqCard.heading} onChange={e => setFaqCard({ ...faqCard, heading: e.target.value })} className={inputCls} />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <SaveBtn k="contact.address_card" data={addressCard} />
                    <SaveBtn k="contact.faq_card" data={faqCard} />
                </div>
            </Section>

            {/* FORM INTRO */}
            <Section title="Form copy" subtitle="Eyebrow, heading, success state, and trust line on the contact form">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls} style={mono}>Eyebrow</label>
                        <input value={formIntro.eyebrow} onChange={e => setFormIntro({ ...formIntro, eyebrow: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls} style={mono}>Heading</label>
                        <input value={formIntro.heading} onChange={e => setFormIntro({ ...formIntro, heading: e.target.value })} className={inputCls} />
                    </div>
                </div>
                <div>
                    <label className={labelCls} style={mono}>Success heading (after form submit)</label>
                    <input value={formIntro.successHeading} onChange={e => setFormIntro({ ...formIntro, successHeading: e.target.value })} className={inputCls} />
                </div>
                <div>
                    <label className={labelCls} style={mono}>Success body</label>
                    <textarea value={formIntro.successBody} onChange={e => setFormIntro({ ...formIntro, successBody: e.target.value })} rows={2} className={inputCls + ' resize-none'} />
                </div>
                <div>
                    <label className={labelCls} style={mono}>Trust line (small text near the submit button)</label>
                    <input value={formIntro.trustLine} onChange={e => setFormIntro({ ...formIntro, trustLine: e.target.value })} className={inputCls} />
                </div>
                <div className="flex justify-end pt-2">
                    <SaveBtn k="contact.form_intro" data={formIntro} />
                </div>
            </Section>

            {/* MAP */}
            <Section title="Map section" subtitle="The bottom map embed + its eyebrow / parking hint">
                <div>
                    <label className={labelCls} style={mono}>Eyebrow</label>
                    <input value={map.eyebrow} onChange={e => setMap({ ...map, eyebrow: e.target.value })} className={inputCls} />
                </div>
                <div>
                    <label className={labelCls} style={mono}>Parking / directions hint (right side)</label>
                    <input value={map.hint} onChange={e => setMap({ ...map, hint: e.target.value })} className={inputCls} />
                </div>
                <p className="text-[10px] text-[#7A8278]">The map heading (e.g. &quot;84 N High St, Dublin OH.&quot;) and the embedded Google map both come from your primary business location — edit via <code className="text-[#B96A3D]">/admin/locations</code>.</p>
                <div className="flex justify-end pt-2">
                    <SaveBtn k="contact.map" data={map} />
                </div>
            </Section>
        </div>
    );
}
