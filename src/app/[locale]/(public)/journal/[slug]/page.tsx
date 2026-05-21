import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';

interface ArticlePageProps {
    params: Promise<{ locale: string; slug: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
    const { locale, slug } = await params;
    const article = await prisma.article.findFirst({ where: { slug, isPublished: true } });
    if (!article) return { title: 'Article Not Found | Colchis Food' };
    const canonicalPath = locale === 'en' ? `/journal/${slug}` : `/${locale}/journal/${slug}`;
    return {
        title: `${article.title} | Journal | Colchis Food`,
        description: article.excerpt || article.title,
        keywords: article.tags ? article.tags.split(',').map(t => t.trim()) : ['Colchis Food', 'Georgian cheese'],
        openGraph: {
            title: article.title,
            description: article.excerpt || article.title,
            images: article.coverImage ? [{ url: article.coverImage, width: 1200, height: 675, alt: article.title }] : [],
            type: 'article',
            siteName: 'Colchis Food',
            url: `${SITE_URL}${canonicalPath}`,
            publishedTime: article.publishedAt?.toISOString(),
        },
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: {
                'en': `${SITE_URL}/journal/${slug}`,
                'ka': `${SITE_URL}/ka/journal/${slug}`,
                'ru': `${SITE_URL}/ru/journal/${slug}`,
                'es': `${SITE_URL}/es/journal/${slug}`,
                'x-default': `${SITE_URL}/journal/${slug}`,
            },
        },
    };
}

function getReadMin(content: string): number {
    return Math.max(2, Math.ceil(content.split(/\s+/).length / 200));
}

export default async function ArticlePage({ params }: ArticlePageProps) {
    const { locale, slug } = await params;
    const prefix = locale === 'en' ? '' : `/${locale}`;
    const article = await prisma.article.findFirst({ where: { slug, isPublished: true } });
    if (!article) notFound();

    const related = await prisma.article.findMany({
        where: { isPublished: true, slug: { not: slug }, tags: article.tags || undefined },
        take: 3,
        orderBy: { publishedAt: 'desc' },
    });

    const readMin = getReadMin(article.content);
    const dateStr = article.publishedAt
        ? new Date(article.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "";

    // JSON-LD
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.excerpt || article.title,
        image: article.coverImage || undefined,
        datePublished: article.publishedAt?.toISOString() || article.createdAt.toISOString(),
        dateModified: article.updatedAt.toISOString(),
        author: { '@type': 'Organization', name: 'Colchis Food', url: SITE_URL },
        publisher: { '@type': 'Organization', name: 'Colchis Food' },
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <article>
                {/* Breadcrumb */}
                <div className="ch-breadcrumb" style={{ background: "#F5F0E6", padding: "24px 56px 0" }}>
                    <div style={{ maxWidth: 920, margin: "0 auto", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>
                        <Link href={`${prefix}/`} style={{ color: "#7A8278", textDecoration: "none" }}>Colchis Food</Link>
                        <span style={{ margin: "0 10px" }}>/</span>
                        <Link href={`${prefix}/journal`} style={{ color: "#7A8278", textDecoration: "none" }}>The Journal</Link>
                        <span style={{ margin: "0 10px" }}>/</span>
                        <span style={{ color: "#1F3026" }}>{article.tags || "Essay"}</span>
                    </div>
                </div>

                {/* Title block */}
                <header className="ch-article-head" style={{ background: "#F5F0E6", padding: "48px 56px 56px" }}>
                    <div style={{ maxWidth: 920, margin: "0 auto" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 24 }}>
                            № — {article.tags || "Essay"}
                        </div>
                        <h1 className="ch-article-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 76, lineHeight: 1.0, letterSpacing: "-0.025em", margin: 0, color: "#1F3026" }}>
                            {article.title}
                        </h1>
                        {article.excerpt && (
                            <p className="ch-article-dek" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 24, lineHeight: 1.5, color: "#2C3D33", marginTop: 28, marginBottom: 0, maxWidth: 760 }}>
                                {article.excerpt}
                            </p>
                        )}
                        <div className="ch-article-meta" style={{ display: "flex", gap: 22, marginTop: 36, paddingTop: 24, borderTop: "1px solid #1F302622", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", flexWrap: "wrap" }}>
                            <span>By <span style={{ color: "#1F3026" }}>Colchis Food</span></span>
                            <span>{dateStr}</span>
                            <span>{readMin} min read</span>
                            <span style={{ marginLeft: "auto" }}>Share · Save · Print</span>
                        </div>
                    </div>
                </header>

                {/* Hero image placeholder */}
                <div className="ch-article-hero-wrap" style={{ background: "#F5F0E6", padding: "0 56px 56px" }}>
                    <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                        {article.coverImage ? (
                            <img src={article.coverImage} alt={article.title} style={{ width: "100%", aspectRatio: "16/8", objectFit: "cover" }} />
                        ) : (
                            <div style={{ width: "100%", aspectRatio: "16/8", background: "#1F3026", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                                <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(45deg, transparent 0 14px, #8B4A2810 14px 15px)`, opacity: 0.6 }} />
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.3em", color: "#8B4A28", opacity: 0.7, textTransform: "uppercase", position: "relative" }}>[ Article photo ]</div>
                            </div>
                        )}
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginTop: 14 }}>
                            Photograph — Colchis Food
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="ch-article-body-wrap" style={{ background: "#F5F0E6", padding: "0 56px 96px" }}>
                    <div style={{ maxWidth: 720, margin: "0 auto" }}>
                        <ContentBlockRenderer blocks={article.contentBlocks} legacyContent={article.content} />
                        {/* End mark */}
                        <div style={{ marginTop: 56, paddingTop: 36, borderTop: "1px solid #1F302622", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, color: "#7A8278" }}>— Colchis Food</div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>END · {dateStr}</div>
                        </div>
                    </div>
                </div>

                {/* Related */}
                {related.length > 0 && (
                    <section className="ch-section" style={{ background: "#EAE2D2", padding: "96px 56px" }}>
                        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                            <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }}>
                                <div className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 48, lineHeight: 1.05 }}>
                                    Keep <em style={{ color: "#B96A3D", fontWeight: 400 }}>reading.</em>
                                </div>
                                <Link href={`${prefix}/journal`} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", color: "#1F3026", textTransform: "uppercase", textDecoration: "none", borderBottom: "1px solid #1F3026" }}>All stories →</Link>
                            </div>
                            <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
                                {related.map(r => (
                                    <Link key={r.slug} href={`${prefix}/journal/${r.slug}`} style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "#1F3026", background: "#F5F0E6", border: "1px solid #1F302614" }}>
                                        <div style={{ width: "100%", aspectRatio: "4/3", background: "#2C3D33", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            {r.coverImage ? (
                                                <img src={r.coverImage} alt={r.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.3em", color: "#8B4A28", opacity: 0.7, textTransform: "uppercase" }}>[ {r.tags} ]</div>
                                            )}
                                        </div>
                                        <div style={{ padding: "26px 26px 30px", flex: 1, display: "flex", flexDirection: "column" }}>
                                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase" }}>{r.tags}</div>
                                            <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 28, lineHeight: 1.12, margin: "14px 0 0" }}>{r.title}</h3>
                                            {r.excerpt && <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.6, color: "#2C3D33", opacity: 0.85, marginTop: 12, flex: 1 }}>{r.excerpt}</p>}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </article>
        </>
    );
}
