'use client';

// Phase 7b.5 — Customer cancel button.
//
// Two-step confirm: prevents accidental clicks (refund + stock-release isn't
// trivially reversible — would need admin re-creation of the order). On
// success, refreshes the page to show the new CANCELLED state.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelOrder } from '@/app/actions/orders';

interface Props {
    orderId: string;
    /** Minutes remaining in the 15-min cancel window. Used for UI hint only;
        server re-validates on action invocation. */
    minutesRemaining: number;
}

export default function CancelOrderButton({ orderId, minutesRemaining }: Props) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleConfirm = () => {
        setError(null);
        startTransition(async () => {
            const result = await cancelOrder(orderId);
            if (!result.ok) {
                setError(result.error);
                setShowConfirm(false);
                return;
            }
            router.refresh();
        });
    };

    if (!showConfirm) {
        return (
            <div>
                <button
                    onClick={() => setShowConfirm(true)}
                    style={{
                        width: '100%',
                        background: 'transparent',
                        color: '#A8312C',
                        border: '1px solid #A8312C55',
                        padding: '12px 0',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        letterSpacing: '0.32em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                    }}
                >
                    Cancel order
                </button>
                <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#7A8278', textTransform: 'uppercase', textAlign: 'center' }}>
                    Available for {minutesRemaining} more {minutesRemaining === 1 ? 'minute' : 'minutes'}
                </div>
                {error && (
                    <div style={{ marginTop: 10, padding: 10, background: '#FBEAE9', border: '1px solid #A8312C44', fontFamily: 'var(--font-sans)', fontSize: 12.5, color: '#A8312C', lineHeight: 1.5 }}>
                        {error}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div>
            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14, color: '#2C3D33', margin: '0 0 12px', lineHeight: 1.5 }}>
                Cancel and refund this order? Your card will be refunded within 5–10 business days.
            </p>
            <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                <button
                    onClick={handleConfirm}
                    disabled={isPending}
                    style={{
                        width: '100%',
                        background: '#A8312C',
                        color: '#F5F0E6',
                        border: 'none',
                        padding: '12px 0',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        letterSpacing: '0.32em',
                        textTransform: 'uppercase',
                        cursor: isPending ? 'not-allowed' : 'pointer',
                        opacity: isPending ? 0.7 : 1,
                    }}
                >
                    {isPending ? 'Cancelling…' : 'Yes, cancel & refund'}
                </button>
                <button
                    onClick={() => setShowConfirm(false)}
                    disabled={isPending}
                    style={{
                        width: '100%',
                        background: 'transparent',
                        color: '#1F3026',
                        border: '1px solid #1F302655',
                        padding: '10px 0',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        letterSpacing: '0.28em',
                        textTransform: 'uppercase',
                        cursor: isPending ? 'not-allowed' : 'pointer',
                    }}
                >
                    Keep order
                </button>
            </div>
        </div>
    );
}
