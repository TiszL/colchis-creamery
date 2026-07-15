"use client";

import { useState, useTransition } from "react";
import { submitContactFormAction } from "@/app/actions/contact";
import Link from "next/link";
import type { PrimaryLocation } from "@/lib/business-location";

/* ─── Content block types (all admin-editable) ──────────────────────────── */

export type ContactHeroContent = {
    eyebrow: string;
    h1Pre: string;
    h1Accent: string;
    subheadline: string;
    hoursLabel: string;
};
export type ContactDesk = {
    id: string;
    label: string;
    desk: string;
    time: string;
};
export type ContactHoursRow = { day: string; hours: string };
export type ContactFaqLink = { label: string; href: string };
export type ContactMapContent = {
    eyebrow: string;
    hint: string;
};
export type ContactAddressCardContent = {
    eyebrow: string;
};
export type ContactFormIntroContent = {
    eyebrow: string;
    heading: string;
    successHeading: string;
    successBody: string;
    trustLine: string;
};
export type ContactFaqCardContent = {
    eyebrow: string;
    heading: string;
};

const DEFAULT_HERO: ContactHeroContent = {
    eyebrow: '№ 00 — The Switchboard',
    h1Pre: 'Write us',
    h1Accent: 'a postcard.',
    subheadline: "Or an email. Or call the bakery line — Levan picks up when the oven's resting. We answer every note that lands on the counter.",
    hoursLabel: 'Tue–Sat · 9am – 7pm EST',
};

const DEFAULT_DESKS: ContactDesk[] = [
    { id: "order", label: "An order", desk: "Customer care", time: "Replies in < 4h, M–F" },
    { id: "wholesale", label: "Wholesale", desk: "Trade desk", time: "Replies in 1 business day" },
    { id: "press", label: "Press & stories", desk: "Editorial", time: "Replies within the week" },
    { id: "kitchen", label: "The kitchen", desk: "Bake-house notes", time: "Hand-answered by Levan" },
];

const DEFAULT_HOURS_TABLE: ContactHoursRow[] = [
    { day: "Mon", hours: "Closed · cellar day" },
    { day: "Tue – Thu", hours: "9 am – 6 pm" },
    { day: "Fri", hours: "9 am – 8 pm · hot bake" },
    { day: "Sat", hours: "10 am – 7 pm" },
    { day: "Sun", hours: "11 am – 4 pm" },
];

const DEFAULT_FAQ_LINKS: ContactFaqLink[] = [
    { label: "Shipping & cold-chain", href: "/faq" },
    { label: "Replace pledge", href: "/faq" },
    { label: "Wholesale minimums", href: "/faq" },
    { label: "Pickup windows", href: "/faq" },
];

const DEFAULT_MAP: ContactMapContent = {
    eyebrow: '№ 02 — Find us',
    hint: 'Free parking out back · 6 min from I-270 exit 17B',
};

const DEFAULT_ADDRESS_CARD: ContactAddressCardContent = {
    eyebrow: 'The bakery',
};

const DEFAULT_FORM_INTRO: ContactFormIntroContent = {
    eyebrow: '№ 01 — A note to the kitchen',
    heading: 'Send a message',
    successHeading: "Thank you — we'll write back.",
    successBody: 'A copy is on its way to your inbox. Most replies land within a few hours during the bake.',
    trustLine: 'Signed by 1 baker · TLS 1.3',
};

const DEFAULT_FAQ_CARD: ContactFaqCardContent = {
    eyebrow: 'Try the FAQ first',
    heading: 'Most answers live here.',
};

interface Props {
    email: string;
    phone: string;
    primary: PrimaryLocation;
    /** All content overrides come from SiteConfig `contact.*` keys. Null → use defaults. */
    hero?: ContactHeroContent | null;
    desks?: ContactDesk[] | null;
    hoursTable?: ContactHoursRow[] | null;
    faqLinks?: ContactFaqLink[] | null;
    map?: ContactMapContent | null;
    addressCard?: ContactAddressCardContent | null;
    formIntro?: ContactFormIntroContent | null;
    faqCard?: ContactFaqCardContent | null;
}

export default function ContactClient({ email, phone, primary, hero: heroProp, desks: desksProp, hoursTable: hoursProp, faqLinks: faqProp, map: mapProp, addressCard: cardProp, formIntro: formProp, faqCard: faqCardProp }: Props) {
    // Merge admin-provided content with hardcoded defaults so a missing key
    // never crashes the page or leaves a UI blank.
    const hero = heroProp || DEFAULT_HERO;
    const topics: ContactDesk[] = (desksProp && desksProp.length > 0) ? desksProp : DEFAULT_DESKS;
    const hours: ContactHoursRow[] = (hoursProp && hoursProp.length > 0) ? hoursProp : DEFAULT_HOURS_TABLE;
    const faqLinks: ContactFaqLink[] = (faqProp && faqProp.length > 0) ? faqProp : DEFAULT_FAQ_LINKS;
    const map = mapProp || DEFAULT_MAP;
    const addressCard = cardProp || DEFAULT_ADDRESS_CARD;
    const formIntro = formProp || DEFAULT_FORM_INTRO;
    const faqCard = faqCardProp || DEFAULT_FAQ_CARD;

    const heroAddressLabel = `${primary.formattedAddress}`;
    const cardName = primary.contactCardName || primary.name;
    const cardAddressLines = primary.formattedAddressLines;
    const doorNote = primary.contactCardDoorNote;
    const mapTitle = `Colchis Food — ${primary.formattedAddress}`;
    const mapHeadingStreet = primary.addressLine1;
    const mapHeadingCity = `${primary.city}, ${primary.state}.`;
    const [topic, setTopic] = useState(topics[0]?.id || "order");
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [loadedAt] = useState(() => Date.now().toString());

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        fd.set("_t", loadedAt);
        fd.set("topic", topic);

        startTransition(async () => {
            const result = await submitContactFormAction(fd);
            if (result.success) {
                setSent(true);
                form.reset();
            } else {
                setError(result.error || "Something went wrong.");
            }
        });
    }

    const inputStyle: React.CSSProperties = {
        width: "100%", padding: "13px 14px", background: "#F5F0E6",
        border: "1px solid #1F302633", color: "#1F3026",
        fontFamily: "var(--font-sans)", fontSize: 14, outline: "none",
    };

    return (
        <main className="ch-contact" style={{ background: "#F5F0E6", minHeight: "100vh" }}>
            {/* ─── HERO ────────────────────────────────────────────────── */}
            <section style={{ background: "#1F3026", color: "#F5F0E6", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#F5F0E606 1px, transparent 1px), linear-gradient(90deg, #F5F0E606 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none" }} />
                <div className="ch-contact-hero" style={{ maxWidth: 1440, margin: "0 auto", padding: "80px 56px 56px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48, alignItems: "end", position: "relative" }}>
                    <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#D9A876", textTransform: "uppercase" }}>{hero.eyebrow}</div>
                        <h1 className="ch-contact-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 104, lineHeight: 0.92, letterSpacing: "-0.03em", margin: "18px 0 0" }}>
                            {hero.h1Pre}<br /><em style={{ color: "#D9A876", fontWeight: 300 }}>{hero.h1Accent}</em>
                        </h1>
                        <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 20, marginTop: 22, maxWidth: 560, opacity: 0.82, lineHeight: 1.55 }}>
                            {hero.subheadline}
                        </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", opacity: 0.85 }}>
                        {[
                            ["Email", email],
                            ["Phone", phone],
                            ["Hours", hero.hoursLabel],
                            ["Address", heroAddressLabel],
                        ].filter(([, v]) => !!v).map(([k, v]) => (
                            <div key={k} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 16, paddingBottom: 12, borderBottom: "1px solid #F5F0E61A" }}>
                                <span style={{ color: "#F5F0E6", opacity: 0.5 }}>{k}</span>
                                <span style={{ color: "#F5F0E6", opacity: 0.95 }}>{v}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── DESKS ───────────────────────────────────────────────── */}
            <section style={{ background: "#EAE2D2", borderBottom: "1px solid #1F302614" }}>
                <div className="ch-contact-desks" style={{ maxWidth: 1440, margin: "0 auto", padding: "0 56px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
                    {topics.map((t, i) => {
                        const on = topic === t.id;
                        return (
                            <button key={t.id} onClick={() => setTopic(t.id)} style={{
                                background: on ? "#fff" : "transparent", border: "none", borderLeft: i === 0 ? "none" : "1px solid #1F302614",
                                cursor: "pointer", padding: "26px 24px", textAlign: "left", position: "relative",
                            }}>
                                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: on ? "#B96A3D" : "transparent" }} />
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: on ? "#B96A3D" : "#7A8278", textTransform: "uppercase" }}>{`0${i + 1} · ${t.desk}`}</div>
                                <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 26, color: "#1F3026", marginTop: 6 }}>{t.label}</div>
                                <div style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "#2C3D33", opacity: 0.7, marginTop: 4 }}>{t.time}</div>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* ─── BODY ────────────────────────────────────────────────── */}
            <div className="ch-contact-body" style={{ maxWidth: 1440, margin: "0 auto", padding: "56px 56px 64px", display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: 48, alignItems: "flex-start" }}>

                {/* FORM */}
                <div style={{ background: "#fff", border: "1px solid #1F302622" }}>
                    <div style={{ padding: "22px 32px", borderBottom: "1px solid #1F302614" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>{formIntro.eyebrow}</div>
                        <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontStyle: "italic", fontSize: 30, color: "#1F3026", margin: "6px 0 0" }}>{formIntro.heading}</h2>
                    </div>

                    {sent ? (
                        <div style={{ padding: "56px 32px", textAlign: "center" }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>Received ✓</div>
                            <div style={{ fontFamily: "var(--font-serif)", fontSize: 38, color: "#1F3026", marginTop: 10, fontWeight: 300, letterSpacing: "-0.02em" }}>{formIntro.successHeading}</div>
                            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 17, color: "#2C3D33", opacity: 0.8, marginTop: 10, maxWidth: 420, margin: "10px auto 0", lineHeight: 1.5 }}>
                                {formIntro.successBody}
                            </div>
                            <button onClick={() => setSent(false)} style={{ marginTop: 22, background: "transparent", color: "#1F3026", border: "1px solid #1F3026", padding: "12px 20px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Send another</button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} style={{ padding: 32, display: "flex", flexDirection: "column", gap: 18 }}>
                            {/* Honeypot */}
                            <div style={{ position: "absolute", opacity: 0, height: 0, width: 0, overflow: "hidden" }} aria-hidden="true">
                                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                            </div>

                            <div className="ch-contact-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                <div>
                                    <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Name</label>
                                    <input type="text" name="name" placeholder="Nino Beridze" required style={inputStyle} />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Email</label>
                                    <input type="email" name="email" placeholder="you@colchisfood.com" required style={inputStyle} />
                                </div>
                            </div>

                            <div className="ch-contact-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                <div>
                                    <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Phone (optional)</label>
                                    <input type="tel" name="phone" placeholder="+1 (614) 555 0142" style={inputStyle} />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Order # (if any)</label>
                                    <input type="text" name="orderNumber" placeholder="CH-XXXX-XX" style={inputStyle} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>About</label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {topics.map(t => {
                                        const on = topic === t.id;
                                        return (
                                            <button type="button" key={t.id} onClick={() => setTopic(t.id)} style={{
                                                background: on ? "#1F3026" : "transparent",
                                                color: on ? "#F5F0E6" : "#1F3026",
                                                border: `1px solid ${on ? "#1F3026" : "#1F302655"}`,
                                                padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer",
                                            }}>{t.label}</button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Message</label>
                                <textarea name="message" rows={6} placeholder="A short note, an idea, a baker's question…" required minLength={10} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
                            </div>

                            {error && (
                                <div style={{ padding: 12, background: "#A8312C11", color: "#A8312C", fontSize: 13, border: "1px solid #A8312C33", fontFamily: "var(--font-sans)" }}>
                                    {error}
                                </div>
                            )}

                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                                <input id="dispatch" type="checkbox" defaultChecked style={{ accentColor: "#1F3026", width: 16, height: 16 }} />
                                <label htmlFor="dispatch" style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "#2C3D33" }}>
                                    Send me an occasional dispatch about new wheels &amp; bake days.
                                </label>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 12 }}>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>{formIntro.trustLine}</div>
                                <button type="submit" disabled={isPending} style={{ background: "#1F3026", color: "#F5F0E6", border: "none", padding: "16px 28px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", cursor: "pointer", opacity: isPending ? 0.7 : 1 }}>
                                    {isPending ? "Sending..." : "Send the note →"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* SIDE RAIL */}
                <aside style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {/* Address card */}
                    <div style={{ background: "#fff", border: "1px solid #1F302622", padding: 28 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>{addressCard.eyebrow}</div>
                        <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 28, color: "#1F3026", marginTop: 8, lineHeight: 1.15 }}>{cardName}</div>
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "#2C3D33", marginTop: 10, lineHeight: 1.65, whiteSpace: "pre-line" }}>
                            {cardAddressLines}
                            {doorNote ? <><br /><span style={{ color: "#7A8278" }}>{doorNote}</span></> : null}
                        </div>
                        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                            <a href="#map" style={{ background: "transparent", color: "#1F3026", border: "1px solid #1F3026", padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Directions →</a>
                            {phone && (
                                <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} style={{ background: "transparent", color: "#1F3026", border: "1px solid #1F302633", padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Call</a>
                            )}
                        </div>
                    </div>

                    {/* Hours */}
                    <div style={{ background: "#EAE2D2", border: "1px solid #1F302614", padding: 28 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>Counter hours</div>
                        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                            {hours.map(row => (
                                <div key={row.day} style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-serif)", fontSize: 17, color: "#1F3026", paddingBottom: 8, borderBottom: "1px solid #1F302614" }}>
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>{row.day}</span>
                                    <span style={{ fontStyle: "italic" }}>{row.hours}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* FAQ */}
                    <div style={{ background: "#1F3026", color: "#F5F0E6", padding: 28 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", color: "#D9A876", textTransform: "uppercase" }}>{faqCard.eyebrow}</div>
                        <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 26, marginTop: 8, lineHeight: 1.2 }}>{faqCard.heading}</div>
                        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                            {faqLinks.map(q => (
                                <Link key={q.label} href={q.href} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F5F0E61A", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 17, color: "#F5F0E6", textDecoration: "none" }}>
                                    <span>{q.label}</span><span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#D9A876" }}>→</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>

            {/* ─── MAP ─────────────────────────────────────────────────── */}
            <section id="map" style={{ borderTop: "1px solid #1F302614", background: "#EAE2D2" }}>
                <div className="ch-contact-map-wrap" style={{ maxWidth: 1440, margin: "0 auto", padding: "56px 56px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, gap: 18, flexWrap: "wrap" }}>
                        <div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>{map.eyebrow}</div>
                            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, color: "#1F3026", margin: "10px 0 0", letterSpacing: "-0.02em" }}>{mapHeadingStreet}, <em style={{ color: "#B96A3D" }}>{mapHeadingCity}</em></h2>
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase", maxWidth: 320 }}>
                            {map.hint}
                        </div>
                    </div>
                </div>
                <div className="ch-contact-map" style={{ maxWidth: 1440, margin: "0 auto", padding: "0 56px 80px" }}>
                    <div style={{ width: "100%", height: 460, border: "1px solid #1F302622", overflow: "hidden", background: "#fff" }}>
                        <iframe
                            src={primary.mapEmbedUrl}
                            width="100%"
                            height="100%"
                            style={{ border: 0, filter: "grayscale(0.4) sepia(0.1)" }}
                            loading="lazy"
                            title={mapTitle}
                        />
                    </div>
                </div>
            </section>
        </main>
    );
}
