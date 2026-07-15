import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { getOgImage, buildOgImages } from '@/lib/seo';
import { JournalClient } from '@/components/journal/JournalClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const canonicalPath = locale === 'en' ? '/journal' : `/${locale}/journal`;
    const ogImage = await getOgImage('journal');

    return {
        title: 'The Journal',
        description: 'Heritage essays, field notes from the creamery and the bakery, news from the road. We publish when we have something worth saying.',
        keywords: ['Georgian cheese blog', 'artisanal cheese journal', 'Colchis Food news', 'cheesemaking stories', 'Georgian heritage'],
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: {
                'en': `${SITE_URL}/journal`,
                'ka': `${SITE_URL}/ka/journal`,
                'ru': `${SITE_URL}/ru/journal`,
                'es': `${SITE_URL}/es/journal`,
                'x-default': `${SITE_URL}/journal`,
            },
        },
        openGraph: {
            type: 'website',
            title: 'The Journal',
            description: 'Heritage essays, field notes, and news from Colchis Food.',
            url: `${SITE_URL}${canonicalPath}`,
            siteName: 'Colchis Food',
            ...(ogImage ? { images: buildOgImages(ogImage, 'The Journal') } : {}),
        },
    };
}

export const dynamic = 'force-dynamic';

export default async function JournalPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;

    const articles = await prisma.article.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
    });

    // JSON-LD
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'The Journal — Colchis Food',
        description: 'Heritage essays, field notes, and news from the creamery and the bakery.',
        url: `${SITE_URL}/${locale === 'en' ? '' : locale + '/'}journal`,
        publisher: { '@type': 'Organization', name: 'Colchis Food', url: SITE_URL },
        blogPost: articles.map(a => ({
            '@type': 'BlogPosting',
            headline: a.title,
            description: a.excerpt || a.title,
            url: `${SITE_URL}/journal/${a.slug}`,
            ...(a.publishedAt ? { datePublished: a.publishedAt.toISOString() } : {}),
        })),
    };

    // Serialize for client component
    const serialized = articles.map(a => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        tags: a.tags,
        coverImage: a.coverImage,
        publishedAt: a.publishedAt?.toISOString() || null,
        content: a.content,
    }));

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

            {/* Hero */}
            <section className="ch-section" style={{ background: "#1F3026", color: "#F5F0E6", padding: "100px 56px 72px" }}>
                <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#8B4A28", textTransform: "uppercase", marginBottom: 24 }}>
                        № 09 — The Journal · ჟურნალი
                    </div>
                    <h1 className="ch-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 112, lineHeight: 0.92, letterSpacing: "-0.025em", margin: 0, maxWidth: 1100 }}>
                        Stories from <em style={{ color: "#8B4A28", fontWeight: 300 }}>a country</em><br />you should know.
                    </h1>
                    <p className="ch-lede" style={{ marginTop: 32, fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, lineHeight: 1.55, color: "#F5F0E6", opacity: 0.78, maxWidth: 720 }}>
                        Heritage essays, field notes from the creamery and the bakery, news from the road.
                        We publish when we have something worth saying.
                    </p>
                </div>
            </section>

            <JournalClient articles={serialized} locale={locale} />
        </>
    );
}
