'use client';

// QR table ordering — inline menu + cart + pay. Payment happens on Stripe's
// hosted page (card-only); on success the customer lands on their order
// tracking page and the kitchen sees the ticket with the table number.

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { placeTableOrder } from '@/app/actions/table-order';

export type TableMenuItem = {
    id: string;
    name: string;
    ka: string;
    desc: string;
    price: string;    // dollars string
    imageUrl: string;
    dietaryTags: string[];
    category: string;
};

export default function TableOrderClient({
    locationId, table, locationName, items, isOpen, locale,
}: {
    locationId: string;
    table: number;
    locationName: string;
    items: TableMenuItem[];
    isOpen: boolean;
    locale: string;
}) {
    const [qty, setQty] = useState<Record<string, number>>({});
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    // Tip: preset percentage of the food subtotal, or a custom dollar amount.
    // null percent + empty custom = no tip. 100% voluntary — it goes to the
    // server who takes the table, never to the house.
    const [tipPercent, setTipPercent] = useState<number | null>(null);
    const [tipCustom, setTipCustom] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sections = useMemo(() => {
        const byCat = new Map<string, TableMenuItem[]>();
        for (const it of items) {
            const list = byCat.get(it.category) ?? [];
            list.push(it);
            byCat.set(it.category, list);
        }
        return [...byCat.entries()];
    }, [items]);

    const cart = useMemo(() => items.filter(i => (qty[i.id] ?? 0) > 0), [items, qty]);
    const subtotalCents = cart.reduce((sum, i) => sum + Math.round(parseFloat(i.price) * 100) * (qty[i.id] ?? 0), 0);
    const tipCents = tipCustom.trim() !== ''
        ? Math.max(0, Math.min(50_000, Math.round(parseFloat(tipCustom) * 100) || 0))
        : tipPercent
            ? Math.round(subtotalCents * tipPercent / 100)
            : 0;
    const bump = (id: string, delta: number) =>
        setQty(prev => ({ ...prev, [id]: Math.max(0, Math.min(20, (prev[id] ?? 0) + delta)) }));

    const canSubmit = isOpen && cart.length > 0 && name.trim().length > 0 && /.+@.+\..+/.test(email) && !submitting;

    const submit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await placeTableOrder({
                locationId,
                table,
                items: cart.map(i => ({ productId: i.id, quantity: qty[i.id] ?? 0 })),
                contact: { name: name.trim(), email: email.trim() },
                tipCents,
                locale,
            });
            if (res.ok) {
                window.location.assign(res.paymentUrl);
                return; // navigating away — keep the button in its busy state
            }
            setError(res.error);
        } catch {
            setError('Something went wrong — please try again or order at the counter.');
        }
        setSubmitting(false);
    };

    return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 220px' }}>
            {!isOpen && (
                <div style={{ padding: '16px 18px', background: '#EAE2D2', border: '1px solid #B96A3D44', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.2em', color: '#8A4F2D', textTransform: 'uppercase', marginBottom: 20 }}>
                    The kitchen is closed right now — ordering resumes at opening time.
                </div>
            )}
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#7A8278', textTransform: 'uppercase', margin: '4px 0 20px' }}>
                {locationName} · order &amp; pay from your phone · we bring it to table {table}
            </p>

            {items.length === 0 && (
                <div style={{ padding: '32px 20px', textAlign: 'center', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 20, color: '#1F3026' }}>
                    The menu isn&apos;t available right now — please order at the counter.
                </div>
            )}
            {sections.map(([cat, list]) => (
                <section key={cat} style={{ marginBottom: 28 }}>
                    <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 26, color: '#1F3026', borderBottom: '1px solid #1F302622', paddingBottom: 8, margin: '0 0 4px' }}>{cat}</h2>
                    {list.map(item => {
                        const q = qty[item.id] ?? 0;
                        return (
                            <div key={item.id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #1F302611' }}>
                                {item.imageUrl ? (
                                    <div style={{ width: 64, height: 64, position: 'relative', flexShrink: 0, background: '#EAE2D2', overflow: 'hidden' }}>
                                        <Image src={item.imageUrl} alt={item.name} fill sizes="64px" style={{ objectFit: 'cover' }} />
                                    </div>
                                ) : (
                                    <div style={{ width: 64, height: 64, flexShrink: 0, background: '#EAE2D2' }} />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                                        <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18, color: '#1F3026' }}>{item.name}</span>
                                        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: '#B96A3D', whiteSpace: 'nowrap' }}>${item.price}</span>
                                    </div>
                                    {item.ka && <div style={{ fontFamily: 'var(--font-serif-ka, serif)', fontSize: 13, color: '#1F3026', opacity: 0.5 }}>{item.ka}</div>}
                                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#2C3D33', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.desc}</div>
                                    {item.dietaryTags.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                            {item.dietaryTags.map(dt => (
                                                <span key={dt} style={{ padding: '2px 6px', border: '1px solid #2C3D3333', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.14em', color: '#2C3D33', textTransform: 'uppercase' }}>{dt}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    {q > 0 && (
                                        <>
                                            <button type="button" aria-label={`Remove one ${item.name}`} onClick={() => bump(item.id, -1)} style={{ width: 40, height: 40, border: '1px solid #1F302633', background: '#F5F0E6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1F3026' }}>
                                                <Minus size={14} />
                                            </button>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, minWidth: 20, textAlign: 'center', color: '#1F3026' }}>{q}</span>
                                        </>
                                    )}
                                    <button type="button" aria-label={`Add one ${item.name}`} onClick={() => bump(item.id, 1)} disabled={!isOpen} style={{ width: 40, height: 40, border: 'none', background: isOpen ? '#B96A3D' : '#7A8278', cursor: isOpen ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F5F0E6' }}>
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </section>
            ))}

            {/* Sticky order bar */}
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#1F3026', color: '#F5F0E6', padding: '16px 20px 20px', boxShadow: '0 -8px 24px #1F302633' }}>
                <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {cart.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: '#F5F0E699', textTransform: 'uppercase', marginRight: 2 }}>
                                    Tip your server
                                </span>
                                {[null, 10, 15, 20].map(p => {
                                    const active = tipCustom.trim() === '' && tipPercent === p;
                                    return (
                                        <button
                                            key={p ?? 'none'} type="button"
                                            onClick={() => { setTipPercent(p); setTipCustom(''); }}
                                            style={{ padding: '8px 12px', border: active ? '1px solid #B96A3D' : '1px solid #F5F0E633', background: active ? '#B96A3D' : '#F5F0E60D', color: '#F5F0E6', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em' }}
                                        >
                                            {p === null ? 'No tip' : `${p}%`}
                                        </button>
                                    );
                                })}
                                <input
                                    value={tipCustom}
                                    onChange={e => setTipCustom(e.target.value.replace(/[^0-9.]/g, ''))}
                                    placeholder="Custom $" inputMode="decimal"
                                    style={{ width: 86, padding: '8px 10px', border: tipCustom.trim() !== '' ? '1px solid #B96A3D' : '1px solid #F5F0E633', background: '#F5F0E60D', color: '#F5F0E6', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none' }}
                                />
                            </div>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#F5F0E666', margin: '0 0 4px' }}>
                                Your tip goes to the person serving your table.
                            </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                                autoComplete="name"
                                style={{ flex: 1, minWidth: 0, padding: '12px 14px', border: '1px solid #F5F0E633', background: '#F5F0E60D', color: '#F5F0E6', fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none' }}
                            />
                            <input
                                value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (receipt)"
                                type="email" autoComplete="email"
                                style={{ flex: 1.2, minWidth: 0, padding: '12px 14px', border: '1px solid #F5F0E633', background: '#F5F0E60D', color: '#F5F0E6', fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none' }}
                            />
                        </div>
                        </div>
                    )}
                    {error && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: '#E8A0A0' }}>{error}</div>
                    )}
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSubmit}
                        style={{ width: '100%', minHeight: 52, background: canSubmit ? '#B96A3D' : '#7A8278', color: '#F5F0E6', border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                    >
                        <ShoppingBag size={16} />
                        {submitting
                            ? 'Opening secure payment…'
                            : cart.length === 0
                                ? 'Add something to order'
                                : `Pay $${((subtotalCents + tipCents) / 100).toFixed(2)}${tipCents > 0 ? ` (incl. $${(tipCents / 100).toFixed(2)} tip)` : ''} + tax · Table ${table}`}
                    </button>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#F5F0E699', margin: 0, textAlign: 'center' }}>
                        Secure card payment by Stripe. Exact total incl. tax shows before you pay.
                    </p>
                </div>
            </div>
        </div>
    );
}
