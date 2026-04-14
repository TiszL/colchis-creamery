import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';

interface ArticlePageProps {
    params: Promise<{ locale: string; slug: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
    const { locale, slug } = await params;
    const article = await prisma.article.findFirst({ where: { slug, isPublished: true } });

    if (!article) return { title: 'Article Not Found | Colchis Creamery' };

    const canonicalPath = locale === 'en' ? `/journal/${slug}` : `/${locale}/journal/${slug}`;

    return {
        title: `${article.title} | Journal | Colchis Creamery`,
        description: article.excerpt || article.title,
        keywords: article.tags ? article.tags.split(',').map(t => t.trim()) : ['Colchis Creamery', 'Georgian cheese'],
        openGraph: {
            title: article.title,
            description: article.excerpt || article.title,
            images: article.coverImage ? [{ url: article.coverImage, width: 1200, height: 675, alt: article.title }] : [],
            type: 'article',
            siteName: 'Colchis Creamery',
            url: `${SITE_URL}${canonicalPath}`,
            publishedTime: article.publishedAt?.toISOString(),
            modifiedTime: article.updatedAt.toISOString(),
            ...(article.tags && { tags: article.tags.split(',').map(t => t.trim()) }),
        },
        twitter: {
            card: 'summary_large_image',
            title: article.title,
            description: article.excerpt || article.title,
            images: article.coverImage ? [article.coverImage] : [],
        },
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: {
                'en': `${SITE_URL}/journal/${slug}`,
                'ka': `${SITE_URL}/ka/journal/${slug}`,
                'ru': `${SITE_URL}/ru/journal/${slug}`,
                'es': `${SITE_URL}/es/journal/${slug}`,
            },
        },
    };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
    const { locale, slug } = await params;
    const prefix = locale === 'en' ? '' : `/${locale}`;

    const article = await prisma.article.findFirst({ where: { slug, isPublished: true } });

    if (!article) {
        notFound();
    }

    // JSON-LD structured data for Article
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.excerpt || article.title,
        image: article.coverImage || undefined,
        datePublished: article.publishedAt?.toISOString() || article.createdAt.toISOString(),
        dateModified: article.updatedAt.toISOString(),
        author: {
            '@type': 'Organization',
            name: 'Colchis Creamery',
            url: 'https://colchiscreamery.com',
        },
        publisher: {
            '@type': 'Organization',
            name: 'Colchis Creamery',
            logo: {
                '@type': 'ImageObject',
                url: 'https://colchiscreamery.com/icon.png',
            },
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://colchiscreamery.com/journal/${slug}`,
        },
        ...(article.tags && { keywords: article.tags }),
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <div className="min-h-screen bg-[#FAFAFA] py-16 px-4">
                <article className="max-w-4xl mx-auto bg-white shadow-xl rounded-lg overflow-hidden" itemScope itemType="https://schema.org/Article">
                    {article.coverImage && (
                        <div className="relative w-full h-[400px]">
                            <Image
                                src={article.coverImage}
                                alt={article.title}
                                fill
                                priority
                                sizes="(max-width: 768px) 100vw, 896px"
                                className="object-cover"
                            />
                        </div>
                    )}

                    <div className="p-8 md:p-12">
                        <Link href={`${prefix}/journal`} className="text-sm uppercase tracking-wider text-[#CBA153] font-medium hover:underline mb-6 inline-block">
                            ← Back to Journal
                        </Link>

                        <h1 className="text-4xl md:text-5xl font-serif text-[#2C2A29] mb-4" itemProp="headline">
                            {article.title}
                        </h1>

                        <div className="flex items-center gap-4 mb-8 text-sm text-[#2C2A29]/50">
                            {article.publishedAt && (
                                <time dateTime={article.publishedAt.toISOString()} itemProp="datePublished">
                                    {new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </time>
                            )}
                            {article.tags && (
                                <div className="flex gap-2">
                                    {article.tags.split(',').map((tag, i) => (
                                        <span key={i} className="px-2 py-0.5 text-xs bg-[#FDFBF7] rounded-full text-[#CBA153] font-medium">
                                            {tag.trim()}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {article.excerpt && (
                            <p className="text-xl text-[#2C2A29] opacity-80 mb-10 leading-relaxed font-serif italic border-l-4 border-[#CBA153] pl-6" itemProp="description">
                                {article.excerpt}
                            </p>
                        )}

                        {/* Render content blocks (with legacy fallback) */}
                        <ContentBlockRenderer
                            blocks={article.contentBlocks}
                            legacyContent={article.content}
                        />

                        {/* Hidden structured data */}
                        <meta itemProp="dateModified" content={article.updatedAt.toISOString()} />
                        <span itemProp="author" itemScope itemType="https://schema.org/Organization" className="hidden">
                            <meta itemProp="name" content="Colchis Creamery" />
                        </span>
                    </div>
                </article>
            </div>
        </>
    );
}
