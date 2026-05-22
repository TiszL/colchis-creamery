/**
 * Unified /shop page — Phase 10.
 *
 * Renders ALL B2C-visible products (creamery + bakery + any future categories)
 * with a tab filter. The dedicated landing pages for each line live at
 * /creamery and /bakery; this page is the catch-all "browse everything" index
 * that the header "Order →" CTA points at.
 *
 * Card click → kind-specific PDP (/creamery/<slug> for creamery, /bakery/<slug>
 * for bakery). Cart-orderable gating respects Product.isCartOrderable so
 * wholesale-only items are listed but show a "Request a quote" CTA instead of
 * "Add to cart" (wired in Phase 3).
 */
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ProductKind } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { getOgImage, buildOgImages } from "@/lib/seo";
import { getSelectedLocation, productCatalogWhereForLocation } from "@/lib/customer-location";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';

// /shop is the unified all-products index. The other two chips below the hero
// are navigation, NOT in-place filters — clicking Creamery takes the customer
// to /creamery (the curated creamery landing page with its own hero / method /
// delivery story), not a filtered view of /shop. Matches the user mental model:
// each section has a "home" of its own.
function buildTabs(prefix: string): Array<{ id: 'all' | 'creamery' | 'bakery'; label: string; href: string }> {
    return [
        { id: 'all', label: 'Everything', href: `${prefix}/shop` },
        { id: 'creamery', label: 'Creamery →', href: `${prefix}/creamery` },
        { id: 'bakery', label: 'Bakery →', href: `${prefix}/bakery` },
    ];
}

interface ShopPageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'shop' }).catch(() => null);
    const canonicalPath = locale === 'en' ? '/shop' : `/${locale}/shop`;
    const ogImage = await getOgImage('shop');
    const title = t ? `${t('title')} — Everything` : 'Shop — Colchis Food';
    const description = 'Browse the full Colchis Food catalog — Georgian cheese from the creamery and khachapuri from the bakery, all in one place.';
    return {
        title,
        description,
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: { 'en': `${SITE_URL}/shop`, 'ka': `${SITE_URL}/ka/shop`, 'ru': `${SITE_URL}/ru/shop`, 'es': `${SITE_URL}/es/shop`, 'x-default': `${SITE_URL}/shop` },
        },
        openGraph: {
            type: 'website', siteName: 'Colchis Food', title, description,
            url: `${SITE_URL}${canonicalPath}`,
            ...(ogImage ? { images: buildOgImages(ogImage, 'Shop Colchis Food') } : {}),
        },
        twitter: { card: 'summary_large_image' as const, title, description, ...(ogImage ? { images: [ogImage] } : {}) },
    };
}

function kindGroup(k: ProductKind): 'creamery' | 'bakery' {
    return k.toString().startsWith('BAKERY') ? 'bakery' : 'creamery';
}

function fmtPrice(s: string): string {
    const n = parseFloat(s);
    if (isNaN(n)) return `$${s}`;
    return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export default async function ShopPage({ params }: ShopPageProps) {
    const { locale } = await params;
    const prefix = locale === 'en' ? '' : `/${locale}`;
    const tabs = buildTabs(prefix);

    // Phase 1 (1f) — scope catalog to the customer's selected location.
    // When no location is picked, the picker auto-defaults to the primary
    // bakery on first paint, so this branch is rare in practice.
    const selectedLocation = await getSelectedLocation();
    const locationFilter = productCatalogWhereForLocation(selectedLocation);

    const products = await prisma.product.findMany({
        where: {
            status: { in: ['ACTIVE', 'COMING_SOON'] },
            isActive: true,
            isB2cVisible: true,
            ...locationFilter,
        },
        orderBy: [{ kind: 'asc' }, { name: 'asc' }],
        select: {
            id: true, sku: true, slug: true, name: true, nameKa: true,
            description: true, weight: true, tag: true,
            kind: true, status: true,
            imageUrl: true, priceB2c: true, isCartOrderable: true,
        },
    });

    // /shop renders EVERY product. The Creamery and Bakery chips below are
    // navigation, not in-place filters — they take customers to /creamery
    // and /bakery (the curated section pages with their own copy + UX).
    const filtered = products;

    const counts = {
        all: products.length,
        creamery: products.filter(p => kindGroup(p.kind) === 'creamery').length,
        bakery: products.filter(p => kindGroup(p.kind) === 'bakery').length,
    };

    return (
        <main style={{ background: '#F5F0E6', minHeight: '100vh' }}>
            {/* Hero */}
            <section style={{ padding: '80px 56px 40px', borderBottom: '1px solid #1F302622' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>The Shop · ყველაფერი</div>
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 88, lineHeight: 0.95, letterSpacing: '-0.025em', color: '#1F3026', margin: '20px 0 0' }}>
                        Everything we make, <em style={{ color: '#B96A3D', fontWeight: 300 }}>in one place.</em>
                    </h1>
                    <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 20, color: '#2C3D33', maxWidth: 640, lineHeight: 1.55, marginTop: 22 }}>
                        Cheese from the creamery, khachapuri from the bakery. Browse the catalog. Each item links to the right shop for ordering.
                    </p>
                </div>
            </section>

            {/* Nav chips — Everything (current page) + jump-to-dedicated section pages */}
            <section style={{ borderBottom: '1px solid #1F302614', background: '#EAE2D2', position: 'sticky', top: 88, zIndex: 10 }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 56px', display: 'flex', gap: 0, overflowX: 'auto' }}>
                    {tabs.map(t => {
                        const on = t.id === 'all';
                        return (
                            <Link key={t.id} href={t.href} style={{
                                padding: '20px 26px',
                                fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase',
                                color: on ? '#B96A3D' : '#1F3026',
                                background: on ? '#fff' : 'transparent',
                                borderBottom: on ? '2px solid #B96A3D' : '2px solid transparent',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex', alignItems: 'center', gap: 10,
                            }}>
                                <span>{t.label}</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.55 }}>{counts[t.id]}</span>
                            </Link>
                        );
                    })}
                </div>
            </section>

            {/* Grid */}
            <section style={{ padding: '56px' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '80px 0', textAlign: 'center', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, color: '#7A8278' }}>
                            No products in this section yet.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                            {filtered.map(p => {
                                const kg = kindGroup(p.kind);
                                const pdpHref = kg === 'bakery' ? `${prefix}/bakery/${p.slug}` : `${prefix}/creamery/${p.slug}`;
                                const isComingSoon = p.status === 'COMING_SOON';
                                return (
                                    <Link key={p.id} href={pdpHref} style={{
                                        display: 'flex', flexDirection: 'column', background: '#FFFFFF', border: '1px solid #1F302614',
                                        textDecoration: 'none', color: 'inherit', transition: 'transform 200ms, box-shadow 200ms',
                                    }}>
                                        <div style={{ position: 'relative', aspectRatio: '4/3', background: '#EAE2D2', overflow: 'hidden', borderBottom: '1px solid #1F302614' }}>
                                            {p.imageUrl ? (
                                                <Image src={p.imageUrl} alt={p.name} fill sizes="(max-width: 768px) 100vw, 33vw" style={{ objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', color: '#1F302655', textTransform: 'uppercase' }}>{kg}</div>
                                            )}
                                            <div style={{ position: 'absolute', top: 12, left: 12, background: '#1F3026', color: '#F5F0E6', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', padding: '5px 9px' }}>{kg}</div>
                                            {isComingSoon && (
                                                <div style={{ position: 'absolute', top: 12, right: 12, background: '#B96A3D', color: '#F5F0E6', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', padding: '5px 9px' }}>Coming soon</div>
                                            )}
                                            {!p.isCartOrderable && !isComingSoon && (
                                                <div style={{ position: 'absolute', top: 12, right: 12, background: '#2C3D33', color: '#F5F0E6', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', padding: '5px 9px' }}>Wholesale only</div>
                                            )}
                                        </div>
                                        <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                                            <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, color: '#1F3026', lineHeight: 1.2 }}>{p.name}</div>
                                            {p.nameKa ? <div style={{ fontFamily: 'var(--font-serif-ka), var(--font-serif)', fontSize: 14, color: '#7A8278' }}>{p.nameKa}</div> : null}
                                            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: '#2C3D33', opacity: 0.82, lineHeight: 1.55, marginTop: 2 }}>{p.description.length > 110 ? p.description.slice(0, 107) + '…' : p.description}</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'auto', paddingTop: 12 }}>
                                                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#1F3026' }}>{fmtPrice(p.priceB2c)}</div>
                                                {p.weight ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#7A8278', textTransform: 'uppercase' }}>{p.weight}</div> : null}
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
