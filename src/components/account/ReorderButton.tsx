'use client';

// Phase 7b.4 → Phase D — Reorder button with smart-confirmation modal.
//
// Drops every still-orderable item from a past order back into the customer's
// cart, then routes them to /cart. Skips items whose product is no longer
// active (server filtered before passing to this component).
//
// Flow:
//   - Cart empty       → just add immediately, route to /cart, toast on arrival
//   - Cart has items   → open a confirmation modal with 3 explicit choices:
//       • REPLACE CART     wipe current cart, then add reorder items
//       • ADD TO CART      merge into existing (dedupes by productId, accumulates)
//       • CANCEL           close modal, no changes
//
// Previous "Replace cart first" checkbox UX was easy to miss → cart got
// ambushed. The modal makes the choice explicit when (and only when) it
// actually matters (cart isn't empty).
//
// Toast handoff: writes a one-shot sessionStorage payload before routing to
// /cart. CartClient reads + clears it on mount to surface "N items added"
// feedback. Survives the navigation; doesn't pollute the URL.

import { useState, useTransition, useEffect, useRef } from 'react';
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
    const { items: cartItems, addItem, clearCart } = useCart();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showModal, setShowModal] = useState(false);
    const prefix = locale === 'en' ? '' : `/${locale}`;

    const noneAvailable = items.length === 0;
    const cartHasItems = cartItems.length > 0;

    const doReorder = (mode: 'replace' | 'add') => {
        if (items.length === 0) return;
        startTransition(() => {
            if (mode === 'replace') clearCart();
            for (const { product, quantity } of items) {
                addItem(product, quantity);
            }
            // One-shot toast for /cart to surface "N items added" feedback.
            // sessionStorage survives the navigation but auto-clears on tab close.
            try {
                window.sessionStorage.setItem(REORDER_TOAST_KEY, JSON.stringify({
                    added: items.length,
                    skipped: skippedCount,
                    replaced: mode === 'replace',
                }));
            } catch { /* ignore quota / private mode */ }
            router.push(`${prefix}/cart`);
        });
    };

    const handleClick = () => {
        if (cartHasItems) {
            setShowModal(true);
        } else {
            // No conflict possible — same effect either way; pass 'add' to keep semantics clean.
            doReorder('add');
        }
    };

    return (
        <>
            <div>
                <button
                    onClick={handleClick}
                    disabled={noneAvailable || isPending}
                    style={{
                        width: '100%',
                        background: (noneAvailable || isPending) ? '#7A8278' : '#1F3026',
                        color: '#F5F0E6',
                        border: 'none',
                        padding: '14px 0',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.32em',
                        textTransform: 'uppercase',
                        cursor: (noneAvailable || isPending) ? 'not-allowed' : 'pointer',
                        opacity: (noneAvailable || isPending) ? 0.7 : 1,
                    }}
                >
                    {isPending
                        ? 'Adding to cart…'
                        : noneAvailable
                            ? 'No items available to reorder'
                            : 'Reorder these items →'}
                </button>
                {skippedCount > 0 && !noneAvailable && (
                    <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#A8312C', textTransform: 'uppercase', textAlign: 'center' }}>
                        {skippedCount} {skippedCount === 1 ? 'item' : 'items'} no longer available — skipped
                    </div>
                )}
            </div>

            {showModal && (
                <ReorderConfirmModal
                    cartItems={cartItems}
                    reorderItems={items}
                    isPending={isPending}
                    onReplace={() => doReorder('replace')}
                    onAdd={() => doReorder('add')}
                    onCancel={() => setShowModal(false)}
                />
            )}
        </>
    );
}

/* ─── Modal ────────────────────────────────────────────────────────────── */

interface ModalProps {
    cartItems: { product: Product; quantity: number }[];
    reorderItems: { product: Product; quantity: number }[];
    isPending: boolean;
    onReplace: () => void;
    onAdd: () => void;
    onCancel: () => void;
}

function ReorderConfirmModal({ cartItems, reorderItems, isPending, onReplace, onAdd, onCancel }: ModalProps) {
    const firstButtonRef = useRef<HTMLButtonElement>(null);

    // ESC to close + autofocus the primary action.
    useEffect(() => {
        firstButtonRef.current?.focus();
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isPending) onCancel();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isPending, onCancel]);

    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget && !isPending) onCancel(); }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(31, 48, 38, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                zIndex: 1000,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reorder-modal-title"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#F5F0E6',
                    border: '1px solid #1F302622',
                    maxWidth: 640,
                    width: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    padding: 28,
                    boxShadow: '0 24px 48px rgba(31, 48, 38, 0.18)',
                }}
            >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>
                    Your cart isn&apos;t empty
                </div>
                <h2 id="reorder-modal-title" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontStyle: 'italic', fontSize: 26, color: '#1F3026', margin: '6px 0 6px', lineHeight: 1.15 }}>
                    Add these items, or <em style={{ color: '#B96A3D' }}>replace</em> what&apos;s in your cart?
                </h2>
                <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14, color: '#2C3D33', opacity: 0.85, margin: '0 0 20px', lineHeight: 1.5 }}>
                    Replace wipes your current cart first. Add merges the reorder items into it.
                </p>

                <div className="reorder-cmp" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
                    <PreviewColumn label="Currently in your cart" items={cartItems} accent="#7A8278" />
                    <PreviewColumn label="Items to reorder" items={reorderItems} accent="#B96A3D" />
                </div>

                <div className="reorder-actions" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                        ref={firstButtonRef}
                        onClick={onReplace}
                        disabled={isPending}
                        style={{
                            background: '#1F3026',
                            color: '#F5F0E6',
                            border: 'none',
                            padding: '14px 0',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            letterSpacing: '0.32em',
                            textTransform: 'uppercase',
                            cursor: isPending ? 'not-allowed' : 'pointer',
                            opacity: isPending ? 0.7 : 1,
                        }}
                    >
                        {isPending ? 'Working…' : 'Replace cart →'}
                    </button>
                    <button
                        onClick={onAdd}
                        disabled={isPending}
                        style={{
                            background: 'transparent',
                            color: '#1F3026',
                            border: '1px solid #1F302655',
                            padding: '13px 0',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            letterSpacing: '0.32em',
                            textTransform: 'uppercase',
                            cursor: isPending ? 'not-allowed' : 'pointer',
                            opacity: isPending ? 0.7 : 1,
                        }}
                    >
                        Add to existing cart
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={isPending}
                        style={{
                            background: 'transparent',
                            color: '#7A8278',
                            border: 'none',
                            padding: '8px 0',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            letterSpacing: '0.28em',
                            textTransform: 'uppercase',
                            cursor: isPending ? 'not-allowed' : 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
            <style jsx>{`
                @media (max-width: 540px) {
                    :global(.reorder-cmp) {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}

function PreviewColumn({ label, items, accent }: { label: string; items: { product: Product; quantity: number }[]; accent: string }) {
    return (
        <div style={{ background: '#EAE2D2', border: '1px solid #1F302622', padding: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', color: accent, textTransform: 'uppercase', marginBottom: 10 }}>
                {label} ({items.length})
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.slice(0, 6).map((it) => (
                    <li key={it.product.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: 'var(--font-serif)', fontSize: 13, color: '#1F3026', lineHeight: 1.35 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.product.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#7A8278', flexShrink: 0 }}>×{it.quantity}</span>
                    </li>
                ))}
                {items.length > 6 && (
                    <li style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#7A8278', textTransform: 'uppercase', marginTop: 4 }}>
                        + {items.length - 6} more
                    </li>
                )}
            </ul>
        </div>
    );
}
