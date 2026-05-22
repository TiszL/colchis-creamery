'use client';

/**
 * Brand-styled confirmation dialog. Drop-in replacement for window.confirm().
 *
 * Two variants:
 *  - `light` (default): cream card, dark-green text. For customer-facing pages.
 *  - `dark`:            charcoal card, light text. For admin panels.
 *
 * Two tones:
 *  - `normal`: copper confirm button (regular actions)
 *  - `danger`: red confirm button (destructive — delete, irreversible ops)
 *
 * Dismissals: ESC key, backdrop click, Cancel button all close.
 * Focus: Cancel button is focused on open so Enter won't accidentally confirm.
 * Body click stops propagation so clicking inside the card doesn't dismiss.
 */
import { useEffect, useRef, type ReactNode } from 'react';

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    /** Optional secondary content rendered below the title (string or JSX). */
    body?: ReactNode;
    /** Mono-caps eyebrow above the title. Default depends on `tone`. */
    eyebrow?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'light' | 'dark';
    tone?: 'normal' | 'danger';
    /** Disable confirm + show pending visuals (use during an in-flight server action). */
    busy?: boolean;
    /** Info-only mode: hides the Cancel button and treats confirm as "OK / Got it".
     *  Use this in place of `window.alert()` for non-destructive notices. */
    infoOnly?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({
    open,
    title,
    body,
    eyebrow,
    confirmLabel,
    cancelLabel = 'Cancel',
    variant = 'light',
    tone = 'normal',
    busy = false,
    infoOnly = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const cancelRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
        window.addEventListener('keydown', handleKey);
        // Defer focus — the button isn't laid out on the same tick as the effect.
        const focusId = window.setTimeout(() => cancelRef.current?.focus(), 0);
        return () => {
            window.removeEventListener('keydown', handleKey);
            window.clearTimeout(focusId);
        };
    }, [open, onCancel]);

    if (!open) return null;

    const isDark = variant === 'dark';
    const palette = isDark
        ? { cardBg: '#161616', cardBorder: '#ffffff14', title: '#F5F0E6', body: '#9CA3AF', cancelBorder: '#ffffff22', cancelText: '#F5F0E6' }
        : { cardBg: '#F5F0E6', cardBorder: '#1F302633', title: '#1F3026', body: '#2C3D33', cancelBorder: '#1F302633', cancelText: '#1F3026' };
    const eyebrowColor = '#B96A3D';
    const confirmBg = tone === 'danger' ? '#A8312C' : '#B96A3D';
    const defaultEyebrow = infoOnly ? 'Notice' : tone === 'danger' ? 'Confirm — irreversible' : 'Confirm';
    const resolvedConfirmLabel = confirmLabel ?? (infoOnly ? 'OK' : 'Confirm');

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ch-confirm-title"
            onClick={onCancel}
            style={{
                position: 'fixed', inset: 0, zIndex: 80,
                background: 'rgba(31,48,38,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20, backdropFilter: 'blur(2px)',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: palette.cardBg,
                    border: `1px solid ${palette.cardBorder}`,
                    maxWidth: 480, width: '100%',
                    padding: 'clamp(20px, 5vw, 32px)',
                    display: 'flex', flexDirection: 'column', gap: 16,
                    boxShadow: '0 24px 60px rgba(31,48,38,0.45)',
                }}
            >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.32em', color: eyebrowColor, textTransform: 'uppercase' }}>
                    {eyebrow ?? defaultEyebrow}
                </div>
                <h3
                    id="ch-confirm-title"
                    style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontStyle: 'italic', fontSize: 28, color: palette.title, margin: 0, lineHeight: 1.15, letterSpacing: '-0.01em' }}
                >
                    {title}
                </h3>
                {body && (
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: palette.body, lineHeight: 1.5 }}>
                        {body}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                    {!infoOnly && (
                        <button
                            ref={cancelRef}
                            onClick={onCancel}
                            disabled={busy}
                            style={{ background: 'transparent', border: `1px solid ${palette.cancelBorder}`, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', color: palette.cancelText, textTransform: 'uppercase', cursor: busy ? 'not-allowed' : 'pointer', padding: '11px 20px', opacity: busy ? 0.6 : 1 }}
                        >
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        ref={infoOnly ? cancelRef : undefined}
                        onClick={onConfirm}
                        disabled={busy}
                        style={{ background: infoOnly ? 'transparent' : confirmBg, border: infoOnly ? `1px solid ${palette.cancelBorder}` : 'none', color: infoOnly ? palette.cancelText : '#F5F0E6', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', cursor: busy ? 'not-allowed' : 'pointer', padding: '11px 20px', opacity: busy ? 0.6 : 1 }}
                    >
                        {busy ? 'Working…' : resolvedConfirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
