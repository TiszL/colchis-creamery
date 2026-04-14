import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { getOgImage, buildOgImages } from '@/lib/seo';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const canonicalPath = locale === 'en' ? '/faq' : `/${locale}/faq`;
    const ogImage = await getOgImage('faq');
    return {
        title: 'Frequently Asked Questions | Colchis Creamery',
        description: 'Find answers to common questions about Colchis Creamery — Georgian cheese ordering, shipping, wholesale accounts, storage, and more.',
        keywords: ['Colchis Creamery FAQ', 'Georgian cheese questions', 'cheese shipping', 'wholesale cheese', 'Sulguni storage'],
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: { 'en': `${SITE_URL}/faq`, 'ka': `${SITE_URL}/ka/faq`, 'ru': `${SITE_URL}/ru/faq`, 'es': `${SITE_URL}/es/faq` },
        },
        openGraph: {
            type: 'website', title: 'FAQ | Colchis Creamery',
            description: 'Find answers to common questions about Colchis Creamery.',
            url: `${SITE_URL}${canonicalPath}`, siteName: 'Colchis Creamery',
            ...(ogImage ? { images: buildOgImages(ogImage, 'FAQ') } : {}),
        },
        twitter: { card: 'summary', title: 'FAQ | Colchis Creamery', description: 'Frequently asked questions about Georgian artisanal cheese.',
            ...(ogImage ? { images: [ogImage] } : {}),
        },
    };
}

export const dynamic = 'force-dynamic';

interface FaqItem { question: string; answer: string; }

const DEFAULTS: FaqItem[] = [
    { question: 'Where is your cheese made?', answer: 'Our cheese is handcrafted in Ohio, USA, using premium local milk, while strictly following ancient Georgian cheese-making traditions.' },
    { question: 'How is the cheese shipped to ensure freshness?', answer: 'We ship our cheese in insulated packaging with ice packs via expedited shipping to ensure it arrives at your doorstep in perfect condition.' },
    { question: 'Are your cheeses pasteurized?', answer: 'Yes, all Colchis Creamery cheeses are made from pasteurized milk to comply with FDA regulations while maintaining authentic flavor profiles.' },
    { question: 'Do you offer wholesale pricing for restaurants?', answer: 'Absolutely. We partner with premium restaurants, grocery stores, and distributors. Please visit our Wholesale page to apply for a B2B account.' },
    { question: 'How long does Sulguni cheese last?', answer: 'Unopened, our Sulguni cheese will last up to 60 days in the refrigerator. Once opened, we recommend consuming it within 5-7 days for optimal taste.' },
];

export default async function FAQPage() {
    let faqs: FaqItem[] = DEFAULTS;
    try {
        const row = await prisma.siteConfig.findUnique({ where: { key: 'legal.faq' } });
        if (row?.value) {
            const parsed = JSON.parse(row.value);
            if (Array.isArray(parsed) && parsed.length > 0) faqs = parsed;
        }
    } catch { /* use defaults */ }

    // JSON-LD: FAQPage schema — directly consumed by Google & AI bots
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <div className="min-h-screen bg-[#FDFBF7] py-20 px-4">
                <div className="max-w-3xl mx-auto">

                    <div className="text-center mb-16">
                        <h1 className="text-5xl font-serif text-[#2C2A29] mb-4">Frequently Asked Questions</h1>
                        <p className="text-xl text-[#2C2A29] opacity-80">
                            Find answers to common questions about our heritage, products, and services.
                        </p>
                    </div>

                    <div className="space-y-6">
                        {faqs.map((faq, index) => (
                            <div key={index} className="bg-white p-8 rounded shadow-sm border border-gray-100">
                                <h3 className="text-xl font-serif text-[#A6812F] mb-3">
                                    {faq.question}
                                </h3>
                                <p className="text-[#2C2A29] leading-relaxed opacity-90">
                                    {faq.answer}
                                </p>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </>
    );
}
