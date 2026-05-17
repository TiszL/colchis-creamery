'use client';

// Phase D — Mini-cart dropdown anchored to the header cart icon.
//
// Replaces the previous behaviour where clicking the cart icon yanked the
// user off whatever page they were browsing onto /cart. Now: click → small
// dropdown panel with the current basket; user can adjust quantities,
// remove items, jump to the full cart, or go straight to checkout, all
// without leaving the page they're on.
//
// Anchored absolute inside Header's position:relative wrapper (same pattern
// the auth menu uses at Header.tsx:105+). Mobile: width is clamped to
// viewport so the panel stays on screen even when the cart button sits
// against the right edge.

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useCart } from '@/providers/CartProvider';
import { formatCurrency } from '@/lib/utils';

interface Props {
    open: boolean;
    onClose: () => void;
    locale: string;
}

export default function CartDropdown({ open, onClose, locale }: Props) {
    const { items, updateQuantity, removeItem, itemCount, subtotal } = useCart();
    const prefix = locale === 'en' ? '' : `/${locale}`;
    const firstFocusRef = useRef<HTMLButtonElement>(null);

    // ESC to close + autofocus the close button (gives keyboard users an obvious target).
    useEffect(() => {
        if (!open) return;
        firstFocusRef.current?.focus();
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    const isEmpty = items.length === 0;

    return (
        <div
            role="dialog"
            aria-label="Your basket"
            style={{
                position: 'absolute',
                top: 'calc(100% + 14px)',
                right: 0,
                width: 'min(380px, calc(100vw - 16px))',
                background: '#F5F0E6',
                border: '1px solid #1F302622',
                boxShadow: '0 18px 40px rgba(31,48,38,0.18)',
                zIndex: 60,
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'min(560px, calc(100vh - 160px))',
            }}
        >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1F302614', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>Your basket</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18, color: '#1F3026', marginTop: 2 }}>
                        {isEmpty ? 'Empty' : `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
                    </div>
                </div>
                <button
                    ref={firstFocusRef}
                    onClick={onClose}
                    aria-label="Close basket"
                    style={{ width: 32, height: 32, background: 'transparent', border: '1px solid #1F302633', cursor: 'pointer', fontFamily: 'var(--font-serif)', fontSize: 20, color: '#1F3026', padding: 0, lineHeight: 1 }}
                >
                    ×
                </button>
            </div>

            {/* Empty state */}
            {isEmpty && (
                <div style={{ padding: '40px 22px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18, color: '#7A8278', marginBottom: 14, lineHeight: 1.4 }}>
                        Nothing in your basket yet.
                    </div>
                    <Link
                        href={`${prefix}/bakery`}
                        onClick={onClose}
                        style={{ display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', color: '#1F3026', textDecoration: 'none', borderBottom: '1px solid #1F3026', textTransform: 'uppercase', paddingBottom: 2 }}
                    >
                        → Start shopping
                    </Link>
                </div>
            )}

            {/* Items list */}
            {!isEmpty && (
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    {items.map((item, i) => {
                        const lineTotal = item.product.priceB2c * item.quantity;
                        return (
                            <div
                                key={item.product.id}
                                style={{
                                    padding: '14px 20px',
                                    borderBottom: i === items.length - 1 ? 'none' : '1px solid #1F302614',
                                    display: 'grid',
                                    gridTemplateColumns: '56px 1fr auto',
                                    gap: 12,
                                    alignItems: 'start',
                                }}
                            >
                                {item.product.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={item.product.imageUrl}
                                        alt=""
                                        width={56}
                                        height={56}
                                        style={{ width: 56, height: 56, objectFit: 'cover', border: '1px solid #1F302614', flexShrink: 0 }}
                                    />
                                ) : (
                                    <div style={{ width: 56, height: 56, background: '#EAE2D2', border: '1px solid #1F302614' }} />
                                )}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14, color: '#1F3026', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                        {item.product.name}
                                    </div>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#7A8278', textTransform: 'uppercase', marginTop: 4 }}>
                                        {formatCurrency(item.product.priceB2c)} ea
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                        <button
                                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                            aria-label={`Decrease ${item.product.name} quantity`}
                                            style={stepperBtn}
                                        >−</button>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 22, textAlign: 'center', color: '#1F3026' }}>{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                            aria-label={`Increase ${item.product.name} quantity`}
                                            style={stepperBtn}
                                        >+</button>
                                        <button
                                            onClick={() => removeItem(item.product.id)}
                                            aria-label={`Remove ${item.product.name}`}
                                            style={{ ...stepperBtn, marginLeft: 'auto', borderColor: '#A8312C44', color: '#A8312C' }}
                                        >×</button>
                                    </div>
                                </div>
                                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: '#1F3026', alignSelf: 'flex-start' }}>
                                    {formatCurrency(lineTotal)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Footer */}
            {!isEmpty && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid #1F302614', background: '#EAE2D2', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', color: '#7A8278', textTransform: 'uppercase' }}>Subtotal</div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#1F3026' }}>{formatCurrency(subtotal)}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#7A8278', textTransform: 'uppercase', marginBottom: 14 }}>
                        Shipping &amp; tax at checkout
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Link
                            href={`${prefix}/checkout`}
                            onClick={onClose}
                            style={{ display: 'block', textAlign: 'center', background: '#1F3026', color: '#F5F0E6', padding: '13px 0', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.32em', textTransform: 'uppercase', textDecoration: 'none' }}
                        >
                            Checkout →
                        </Link>
                        <Link
                            href={`${prefix}/cart`}
                            onClick={onClose}
                            style={{ display: 'block', textAlign: 'center', background: 'transparent', color: '#1F3026', border: '1px solid #1F302655', padding: '11px 0', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', textDecoration: 'none' }}
                        >
                            View full cart
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

const stepperBtn: React.CSSProperties = {
    width: 26,
    height: 26,
    border: '1px solid #1F302633',
    background: 'transparent',
    color: '#1F3026',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
};
