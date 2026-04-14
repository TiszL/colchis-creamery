import { Metadata } from 'next';
import { prisma } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const canonicalPath = locale === 'en' ? '/legal/terms' : `/${locale}/legal/terms`;
    return {
        title: 'Terms of Service | Colchis Creamery',
        description: 'Read the Terms of Service for Colchis Creamery, including wholesale account terms, product information policies, and intellectual property rights.',
        keywords: ['Colchis Creamery terms', 'terms of service', 'wholesale terms', 'cheese shop terms'],
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: { 'en': `${SITE_URL}/legal/terms`, 'ka': `${SITE_URL}/ka/legal/terms`, 'ru': `${SITE_URL}/ru/legal/terms`, 'es': `${SITE_URL}/es/legal/terms` },
        },
        openGraph: {
            type: 'website', title: 'Terms of Service | Colchis Creamery',
            description: 'Terms and conditions for Colchis Creamery.',
            url: `${SITE_URL}${canonicalPath}`, siteName: 'Colchis Creamery',
        },
        twitter: { card: 'summary', title: 'Terms of Service | Colchis Creamery', description: 'Our terms of service.' },
    };
}

export const dynamic = 'force-dynamic';

interface LegalSection { heading: string; body: string; }

const DEFAULTS: LegalSection[] = [
    { heading: '1. Acceptance of Terms', body: 'By accessing and using colchiscreamery.com, you accept and agree to be bound by the terms and provisions of this agreement.' },
    { heading: '2. B2B Wholesale Accounts', body: 'Wholesale accounts are subject to approval. By establishing a wholesale account, you agree to our Net-30 payment terms (where applicable) and acknowledge that pricing is confidential. Overdue invoices may incur a late fee of 1.5% per month.' },
    { heading: '3. Product Information', body: 'We attempt to be as accurate as possible regarding product descriptions. However, because our cheeses are handmade artisan products, slight variations in weight and appearance may occur. All weights listed are approximate.' },
    { heading: '4. Intellectual Property', body: 'The Site and its original content, features, functionalities, and branding (including the "Colchis Creamery" name and logos) are owned by Colchis Creamery LLC and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.' },
    { heading: '5. Modifications', body: 'We reserve the right to modify these terms at any time. Your continued use of the Site following any such modification constitutes your agreement to follow and be bound by the modified terms.' },
];

export default async function TermsOfServicePage() {
    let sections: LegalSection[] = DEFAULTS;
    let lastUpdated = 'October 2025';
    try {
        const row = await prisma.siteConfig.findUnique({ where: { key: 'legal.terms' } });
        if (row?.value) {
            const parsed = JSON.parse(row.value);
            if (Array.isArray(parsed) && parsed.length > 0) sections = parsed;
        }
        if (row?.updatedAt) {
            lastUpdated = new Date(row.updatedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
    } catch { /* use defaults */ }

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Terms of Service',
        description: 'Terms of service for Colchis Creamery',
        url: `${SITE_URL}/legal/terms`,
        isPartOf: { '@type': 'WebSite', name: 'Colchis Creamery', url: SITE_URL },
        publisher: { '@type': 'Organization', name: 'Colchis Creamery', url: SITE_URL },
        mainContentOfPage: {
            '@type': 'WebPageElement',
            text: sections.map(s => `${s.heading}: ${s.body}`).join(' '),
        },
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <div className="min-h-screen bg-[#FAFAFA] py-20 px-4">
                <div className="max-w-3xl mx-auto bg-white p-10 md:p-16 shadow-sm rounded border border-gray-100">

                    <h1 className="text-4xl font-serif text-[#2C2A29] mb-8 border-b-2 border-[#CBA153] pb-4 inline-block">
                        Terms of Service
                    </h1>

                    <div className="prose prose-lg text-[#2C2A29] opacity-80">
                        <p className="mb-6">Last updated: {lastUpdated}</p>

                        {sections.map((section, idx) => (
                            <div key={idx}>
                                <h2 className="text-2xl font-serif text-[#8A6A28] mt-8 mb-4">{section.heading}</h2>
                                <p className="mb-6">{section.body}</p>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </>
    );
}
