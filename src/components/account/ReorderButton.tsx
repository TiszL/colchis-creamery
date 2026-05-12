'use client';

// Phase 7b.4 — Reorder button.
//
// Drops every still-orderable item from a past order back into the customer's
// cart, then routes them to /cart. Skips items whose product is no longer
// active (server filtered before passing to this component).
//
// Two modes (customer choice via checkbox):
//   - Additive (default): items merge into existing cart via CartProvider's
//     addItem (dedupes by productId, accumulates quantity).
//   - Replace: clear cart first, then add. Useful when the customer wants a
//     fresh basket rather than mixing with whatever's already there.
//
// Toast handoff: writes a one-shot sessionStorage payload before routing to
// /cart. CartClient reads + clears it on mount to surface "N items added"
// feedback. Survives the navigation; doesn't pollute the URL.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/providers/CartProvider';
import type { Product } from '@/types';

interface Props {
    items: { product: Product; quantity: number }[];
    locale: string;
    /** Count of items in the source order that were filtered out as unavailable. */
    skippedCount?: number;
}

export const REORDER_TOAST_KEY = 'colchis-reorder-toast';

export default function ReorderButton({ items, locale, skippedCount = 0 }: Props) {
    const { addItem, clearCart } = useCart();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [replaceCart, setReplaceCart] = useState(false);
    const prefix = locale === 'en' ? '' : `/${locale}`;

    const handleReorder = () => {
        if (items.length === 0) return;
        startTransition(() => {
            if (replaceCart) clearCart();
            for (const { product, quantity } of items) {
                addItem(product, quantity);
            }
            // One-shot toast for /cart to surface "N items added" feedback.
            // sessionStorage so it survives the navigation but auto-clears
            // on tab close. CartClient pops + displays it on mount.
            try {
                window.sessionStorage.setItem(REORDER_TOAST_KEY, JSON.stringify({
                    added: items.length,
                    skipped: skippedCount,
                    replaced: replaceCart,
                }));
            } catch { /* ignore quota / private mode */ }
            router.push(`${prefix}/cart`);
        });
    };

    const noneAvailable = items.length === 0;
    const disabled = noneAvailable || isPending;

    return (
        <div>
            <button
                onClick={handleReorder}
                disabled={disabled}
                style={{
                    width: '100%',
                    background: disabled ? '#7A8278' : '#1F3026',
                    color: '#F5F0E6',
                    border: 'none',
                    padding: '14px 0',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.32em',
                    textTransform: 'uppercase',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.7 : 1,
                }}
            >
                {isPending
                    ? 'Adding to cart…'
                    : noneAvailable
                        ? 'No items available to reorder'
                        : 'Reorder these items →'}
            </button>
            {!noneAvailable && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#7A8278', textTransform: 'uppercase' }}>
                    <input
                        type="checkbox"
                        checked={replaceCart}
                        onChange={(e) => setReplaceCart(e.target.checked)}
                        disabled={isPending}
                        style={{ accentColor: '#B96A3D', cursor: 'pointer' }}
                    />
                    Replace cart first
                </label>
            )}
            {skippedCount > 0 && !noneAvailable && (
                <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#A8312C', textTransform: 'uppercase', textAlign: 'center' }}>
                    {skippedCount} {skippedCount === 1 ? 'item' : 'items'} no longer available — skipped
                </div>
            )}
        </div>
    );
}
