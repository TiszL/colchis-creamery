// Phase E1.8 — Default OpenGraph image for every page in the [locale] segment.
//
// Generated at build/request time using @vercel/og (built into Next.js).
// Returns a 1200x630 PNG used by Facebook, X/Twitter, LinkedIn, iMessage
// previews, etc. Per-page OG images can override this by placing their own
// opengraph-image.tsx in nested route folders (e.g. shop/[productId]/) — that
// pattern is reserved for Phase 9 polish.
//
// Brand-aligned: cream background, dark green ink, copper accents, serif italic
// typography matching the rest of the site.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Colchis Food — Georgian cheese & bread, made in Dublin, Ohio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    background: '#F5F0E6',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '72px 80px',
                    position: 'relative',
                }}
            >
                {/* Subtle ledger-grid background */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage:
                            'linear-gradient(#1F302608 1px, transparent 1px), linear-gradient(90deg, #1F302608 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                    }}
                />

                {/* Eyebrow */}
                <div
                    style={{
                        fontFamily: 'serif',
                        fontSize: 22,
                        letterSpacing: '0.36em',
                        textTransform: 'uppercase',
                        color: '#B96A3D',
                        marginBottom: 28,
                        position: 'relative',
                    }}
                >
                    Colchis Food · Est. MMXXVI
                </div>

                {/* Headline */}
                <div
                    style={{
                        fontFamily: 'serif',
                        fontSize: 92,
                        fontStyle: 'italic',
                        fontWeight: 400,
                        color: '#1F3026',
                        lineHeight: 1.0,
                        letterSpacing: '-0.02em',
                        marginBottom: 36,
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <span>Georgian cheese &amp; bread,</span>
                    <span style={{ color: '#B96A3D' }}>made in Dublin, Ohio.</span>
                </div>

                {/* Sub-line */}
                <div
                    style={{
                        fontFamily: 'serif',
                        fontSize: 30,
                        fontStyle: 'italic',
                        color: '#2C3D33',
                        opacity: 0.85,
                        lineHeight: 1.4,
                        maxWidth: 980,
                        position: 'relative',
                    }}
                >
                    Hand-pressed sulguni and imeruli · hot khachapuri to your door · ancient heritage, fresh every day.
                </div>

                {/* Footer URL */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 56,
                        left: 80,
                        right: 80,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontFamily: 'monospace',
                        fontSize: 22,
                        letterSpacing: '0.18em',
                        color: '#1F3026',
                        textTransform: 'uppercase',
                    }}
                >
                    <span>colchisfood.com</span>
                    <span style={{ color: '#7A8278' }}>Creamery · Bakery · Heritage</span>
                </div>
            </div>
        ),
        {
            ...size,
        },
    );
}
