'use client';

// Stripe return_url landing for confirmPayment.
// Stripe appends `payment_intent`, `payment_intent_client_secret`, `redirect_status` to the URL.
// We append `order_id` from our own checkout flow so we can display it without round-tripping
// to Stripe. The 7a.6 webhook is the source of truth for whether the payment actually succeeded —
// this page only reflects the redirect_status hint for UX.

import { useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/providers/CartProvider';

interface SuccessClientProps {
    locale: string;
    status: string;
    paymentIntentId: string | null;
    orderId: string | null;
}

export default function SuccessClient({ locale, status, paymentIntentId, orderId }: SuccessClientProps) {
    const { clearCart } = useCart();
    const prefix = locale === 'en' ? '' : `/${locale}`;

    const isSucceeded = status === 'succeeded';
    const isProcessing = status === 'processing';

    // Clear the cart only on a clean success or "processing" (bank review). On
    // failure we keep the cart so the user can retry without re-adding items.
    useEffect(() => {
        if (isSucceeded || isProcessing) clearCart();
    }, [isSucceeded, isProcessing, clearCart]);

    return (
        <main style={{ background: '#F5F0E6', minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
            <div style={{ textAlign: 'center', maxWidth: 580 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>
                    № 04 — {isSucceeded ? 'Confirmation' : isProcessing ? 'Processing' : 'Try again'}
                </div>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 64, color: '#1F3026', margin: '16px 0 14px', lineHeight: 0.95, letterSpacing: '-0.02em' }}>
                    {isSucceeded ? (
                        <>Your order, <em style={{ color: '#B96A3D' }}>placed.</em></>
                    ) : isProcessing ? (
                        <>Almost there — <em style={{ color: '#B96A3D' }}>still processing.</em></>
                    ) : (
                        <>Payment <em style={{ color: '#A8312C' }}>didn&apos;t go through.</em></>
                    )}
                </h1>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontStyle: 'italic', color: '#2C3D33', opacity: 0.85, marginBottom: 22, lineHeight: 1.5 }}>
                    {isSucceeded
                        ? "We'll email you a confirmation shortly. Hot food and frozen items will be scheduled per fulfillment."
                        : isProcessing
                            ? "Your bank is reviewing the payment. We'll email you once it clears."
                            : "Your card wasn't charged. You can retry from your cart."}
                </p>
                {orderId && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', color: '#7A8278', textTransform: 'uppercase', marginBottom: 10 }}>
                        Order id · <span style={{ color: '#1F3026' }}>{orderId}</span>
                    </div>
                )}
                {paymentIntentId && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', color: '#7A8278', textTransform: 'uppercase', marginBottom: 28 }}>
                        Payment ref · <span style={{ color: '#1F3026' }}>{paymentIntentId}</span>
                    </div>
                )}
                <Link
                    href={`${prefix}${isSucceeded || isProcessing ? '/shop' : '/cart'}`}
                    style={{
                        display: 'inline-block',
                        background: '#1F3026',
                        color: '#F5F0E6',
                        padding: '16px 28px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.32em',
                        textTransform: 'uppercase',
                        textDecoration: 'none',
                    }}
                >
                    {isSucceeded || isProcessing ? 'Continue shopping' : 'Back to cart'} →
                </Link>
            </div>
        </main>
    );
}
