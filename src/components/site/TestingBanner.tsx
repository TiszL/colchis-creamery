'use client';

// Phase E1.2 — Pre-launch banner system.
//
// Two-tier UX so testing-mode is obvious without being obnoxious:
//   1) First-visit modal — full disclosure on first hit
//   2) Persistent top strip — subtle reminder for repeat visitors
//
// State persistence:
//   - localStorage `colchis-testing-ack-v<N>` ← stores the version they acknowledged
//   - sessionStorage `colchis-testing-strip-dismissed` ← per-tab strip dismissal
//
// Admin bumps `version` in site.testingMode SiteConfig → ack key changes →
// modal re-shows for everyone (without nuking their entire localStorage).
//
// SEO: this is a client component mounted in body — crawlers see the actual
// page content; the strip/modal is overlay-only.

import { useEffect, useRef, useState } from 'react';
import type { TestingModeConfig } from '@/lib/site-config';

interface Props {
    config: TestingModeConfig;
}

// Minimum heights only keep first paint stable before the ResizeObserver
// reports the real rendered height. The CSS variable below is driven by the
// MEASURED strip height so wrapping (e.g. long stripText or narrow/RTL
// locales) never leaves panel chrome tucked behind the banner.
const STRIP_MIN_HEIGHT_DESKTOP = 36;
const STRIP_MIN_HEIGHT_MOBILE = 52;

// Single source of truth for the offset variable. globals.css seeds it to 0px;
// we set the measured value while visible and reset to 0px when dismissed.
function setStripHeightVar(px: number) {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--testing-strip-height', `${px}px`);
}

export default function TestingBanner({ config }: Props) {
    const [mounted, setMounted] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [stripDismissed, setStripDismissed] = useState(false);
    const stripRef = useRef<HTMLDivElement | null>(null);

    // Hydration-safe: only consult storage AFTER mount. SSR renders the strip
    // unconditionally so first paint matches before storage check pops it off.
    useEffect(() => {
        setMounted(true);
        if (!config.enabled) return;
        try {
            const ackKey = `colchis-testing-ack-v${config.version}`;
            const acknowledged = window.localStorage.getItem(ackKey);
            const stripGone = window.sessionStorage.getItem('colchis-testing-strip-dismissed') === 'true';
            setStripDismissed(stripGone);
            if (!acknowledged && config.showModalOnFirstVisit) {
                setShowModal(true);
            }
        } catch {
            // localStorage blocked (Safari private, etc.) — fall through, show modal optimistically
            if (config.showModalOnFirstVisit) setShowModal(true);
        }
    }, [config.enabled, config.showModalOnFirstVisit, config.version]);

    // Drive --testing-strip-height from the strip's MEASURED rendered height so
    // any wrapping grows the offset in lockstep. Re-measures on resize/content
    // change via ResizeObserver. Skipped while the modal is up (strip not in DOM)
    // or once dismissed (handled in dismissStrip, which sets the var to 0px).
    useEffect(() => {
        const el = stripRef.current;
        if (!el) return;
        const update = () => setStripHeightVar(Math.ceil(el.getBoundingClientRect().height));
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [mounted, showModal, stripDismissed, config.stripText]);

    const acknowledgeModal = () => {
        try {
            window.localStorage.setItem(
                `colchis-testing-ack-v${config.version}`,
                String(Date.now()),
            );
        } catch { /* ignore */ }
        setShowModal(false);
    };

    const dismissStrip = () => {
        try {
            window.sessionStorage.setItem('colchis-testing-strip-dismissed', 'true');
        } catch { /* ignore */ }
        setStripHeightVar(0);
        setStripDismissed(true);
    };

    if (!config.enabled) return null;

    // Modal: only renders after mount (to avoid SSR/CSR flash). When showing,
    // locks body scroll behind it.
    if (mounted && showModal) {
        return (
            <>
                {/* Strip is hidden under the modal — re-render after modal closes */}
                <TestingModal config={config} onAcknowledge={acknowledgeModal} />
            </>
        );
    }

    // Strip: SSR-render unconditionally; client suppresses if dismissed.
    // The CSS variable lets the header layout offset itself below the strip.
    if (mounted && stripDismissed) {
        // After dismissal the var is already 0px (set in dismissStrip; globals.css
        // also seeds 0px for repeat-visit mounts), so the header pops back up.
        return null;
    }

    return (
        <>
            <div
                ref={stripRef}
                role="status"
                aria-live="polite"
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    background: '#B96A3D',
                    color: '#F5F0E6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 16px',
                    minHeight: STRIP_MIN_HEIGHT_DESKTOP,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    lineHeight: 1.4,
                    borderBottom: '1px solid rgba(31,48,38,0.18)',
                }}
            >
                <span
                    style={{
                        // flex:1 + minWidth:0 lets the span shrink instead of
                        // pushing the dismiss button off-screen; the 2-line clamp
                        // caps wrapped height while the ResizeObserver measures it.
                        flex: 1,
                        minWidth: 0,
                        paddingRight: 12,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {config.stripText}
                </span>
                <button
                    onClick={dismissStrip}
                    aria-label="Dismiss testing notice"
                    style={{
                        flexShrink: 0,
                        background: 'transparent',
                        border: '1px solid rgba(245,240,230,0.4)',
                        color: '#F5F0E6',
                        width: 22,
                        height: 22,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-serif)',
                        fontSize: 14,
                        lineHeight: 1,
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    ×
                </button>
            </div>
            <style jsx global>{`
                @media (max-width: 640px) {
                    [role="status"][aria-live="polite"]:first-of-type {
                        min-height: ${STRIP_MIN_HEIGHT_MOBILE}px !important;
                        font-size: 9px !important;
                        letter-spacing: 0.14em !important;
                    }
                }
            `}</style>
        </>
    );
}

/* ─── Modal ────────────────────────────────────────────────────────────── */

function TestingModal({
    config,
    onAcknowledge,
}: {
    config: TestingModeConfig;
    onAcknowledge: () => void;
}) {
    // Lock body scroll while modal is open. Cleanup on unmount.
    useEffect(() => {
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = original; };
    }, []);

    // ESC also acknowledges (treats it as understood).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onAcknowledge();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onAcknowledge]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="testing-modal-title"
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(31,48,38,0.78)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
                zIndex: 200,
            }}
        >
            <div
                style={{
                    background: '#F5F0E6',
                    border: '1px solid #1F302622',
                    maxWidth: 540,
                    width: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    padding: '32px 28px 28px',
                    boxShadow: '0 28px 56px rgba(31,48,38,0.32)',
                }}
            >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>
                    Colchis Food · testing mode
                </div>
                <h2
                    id="testing-modal-title"
                    style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontStyle: 'italic', fontSize: 28, color: '#1F3026', margin: '8px 0 18px', lineHeight: 1.2 }}
                >
                    {config.modalTitle}
                </h2>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: '#2C3D33', lineHeight: 1.55 }}>
                    <MarkdownLite source={config.modalBody} />
                </div>
                <button
                    onClick={onAcknowledge}
                    style={{
                        marginTop: 26,
                        width: '100%',
                        background: '#1F3026',
                        color: '#F5F0E6',
                        border: 'none',
                        padding: '15px 0',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.32em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                    }}
                >
                    I understand · continue
                </button>
            </div>
        </div>
    );
}

/* ─── Minimal markdown renderer ────────────────────────────────────────── */
//
// Handles paragraphs (blank-line separated), **bold**, *italic*, and
// [text](url) links. Deliberately tiny — avoids pulling in react-markdown
// for a single admin-controlled body field. If admin needs more, swap to
// react-markdown later.

function MarkdownLite({ source }: { source: string }) {
    const paragraphs = source.split(/\n\s*\n/);
    return (
        <>
            {paragraphs.map((p, i) => (
                <p key={i} style={{ margin: i === 0 ? '0 0 12px' : '0 0 12px' }}>
                    {renderInline(p)}
                </p>
            ))}
        </>
    );
}

function renderInline(text: string): React.ReactNode[] {
    // Split by inline tokens. Order matters: links first (greedy), then bold, then italic.
    // This is a simple regex pipeline; not a full parser, but covers the admin's needs.
    const out: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;
    while (remaining.length > 0) {
        const link = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
        const bold = remaining.match(/\*\*([^*]+)\*\*/);
        const italic = remaining.match(/\*([^*]+)\*/);
        const candidates = [link, bold, italic].filter(Boolean) as RegExpMatchArray[];
        if (candidates.length === 0) {
            out.push(remaining);
            break;
        }
        // Pick the EARLIEST match
        candidates.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
        const next = candidates[0];
        const idx = next.index ?? 0;
        if (idx > 0) out.push(remaining.slice(0, idx));
        if (next === link) {
            out.push(
                <a key={`l${key++}`} href={link![2]} target="_blank" rel="noopener noreferrer" style={{ color: '#B96A3D', textDecoration: 'underline' }}>
                    {link![1]}
                </a>,
            );
        } else if (next === bold) {
            out.push(<strong key={`b${key++}`}>{bold![1]}</strong>);
        } else if (next === italic) {
            out.push(<em key={`i${key++}`}>{italic![1]}</em>);
        }
        remaining = remaining.slice(idx + next[0].length);
    }
    return out;
}
