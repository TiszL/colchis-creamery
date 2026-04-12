import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = {
    title: 'Journal | Colchis Creamery',
    description: 'Stories, insights, and news from the world of Georgian artisanal cheese.',
};

export const dynamic = 'force-dynamic';

export default async function JournalPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const prefix = locale === 'en' ? '' : `/${locale}`;
    const t = await getTranslations({ locale, namespace: 'journal' });

    const articles = await prisma.article.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
    });

    return (
        <main className="min-h-screen bg-[#FDFBF7] py-20 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <span className="inline-block w-12 h-0.5 bg-[#CBA153] mb-6" />
                    <h1 className="text-5xl font-serif text-[#2C2A29] mb-4">{t('title')}</h1>
                    <p className="text-xl text-[#2C2A29] leading-relaxed opacity-80">
                        {t('subtitle')}
                    </p>
                </div>

                {articles.length === 0 ? (
                    <div className="text-center py-20 text-[#2C2A29]/50">
                        <p className="text-lg">{t('empty')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        {articles.map((article) => (
                            <Link
                                href={`${prefix}/journal/${article.slug}`}
                                key={article.id}
                                className="group flex flex-col bg-white rounded-lg shadow-sm hover:shadow-xl transition overflow-hidden border border-[#FDFBF7]"
                            >
                                {article.coverImage && (
                                    <div className="relative w-full aspect-[16/9] overflow-hidden">
                                        <img
                                            src={article.coverImage}
                                            alt={article.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500 ease-in-out"
                                        />
                                    </div>
                                )}
                                <div className="p-8 w-full flex-1 flex flex-col">
                                    {article.tags && (
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {article.tags.split(',').map((tag, i) => (
                                                <span key={i} className="text-xs uppercase tracking-wider text-[#CBA153] font-medium">
                                                    {tag.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <h3 className="text-2xl font-serif text-[#2C2A29] mb-3 group-hover:text-[#CBA153] transition">
                                        {article.title}
                                    </h3>
                                    {article.excerpt && (
                                        <p className="text-[#2C2A29] opacity-75 mb-4 line-clamp-3 flex-1">
                                            {article.excerpt}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between mt-auto pt-4">
                                        <span className="text-sm font-medium text-[#CBA153] uppercase tracking-wide flex items-center">
                                            {t('readArticle')}
                                            <span className="ml-2 transform group-hover:translate-x-1 transition">→</span>
                                        </span>
                                        {article.publishedAt && (
                                            <span className="text-xs text-[#2C2A29]/40">
                                                {new Date(article.publishedAt).toLocaleDateString(locale === 'ka' ? 'ka-GE' : locale === 'ru' ? 'ru-RU' : locale === 'es' ? 'es-ES' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
