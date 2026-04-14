import { Metadata } from 'next';
import { prisma } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const canonicalPath = locale === 'en' ? '/legal/returns' : `/${locale}/legal/returns`;
    return {
        title: 'Return Policy | Colchis Creamery',
        description: 'Read the return and refund policy for Colchis Creamery artisanal cheese. Learn about our quality guarantee and how to file a claim.',
        keywords: ['Colchis Creamery returns', 'return policy', 'cheese refund', 'quality guarantee', 'wholesale returns'],
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: { 'en': `${SITE_URL}/legal/returns`, 'ka': `${SITE_URL}/ka/legal/returns`, 'ru': `${SITE_URL}/ru/legal/returns`, 'es': `${SITE_URL}/es/legal/returns` },
        },
        openGraph: {
            type: 'website', title: 'Return Policy | Colchis Creamery',
            description: 'Our return and quality guarantee policy.',
            url: `${SITE_URL}${canonicalPath}`, siteName: 'Colchis Creamery',
        },
        twitter: { card: 'summary', title: 'Return Policy | Colchis Creamery', description: 'Our return policy and quality guarantee.' },
    };
}

export const dynamic = 'force-dynamic';

interface LegalSection { heading: string; body: string; }

const DEFAULTS: LegalSection[] = [
    { heading: '1. Perishable Goods', body: 'Due to the perishable nature of our artisanal cheese, we cannot accept general returns. Once a product has left our facility and is in transit, the sale is considered final. We take great care in packaging our products to ensure they arrive fresh.' },
    { heading: '2. Quality Guarantee', body: 'We stand behind the quality of our craftsmanship. If you receive a product that is damaged, spoiled, or incorrect, please contact us within 24 hours of delivery. You must provide photographic evidence of the issue and the packaging.' },
    { heading: '3. Refunds and Replacements', body: 'If a claim is approved under our Quality Guarantee, we will, at our discretion, either ship a replacement product at our expense or issue a full refund to your original method of payment.' },
    { heading: '4. Wholesale Returns', body: 'B2B partners must report discrepancies or quality issues within 24 hours of receiving a pallet. Wholesale returns are subject to the specific terms outlined in your signed Vendor Agreement via Adobe Sign.' },
    { heading: '5. Contact Information', body: 'To initiate a quality claim, please email our support team at support@colchiscreamery.com with your order number and photos of the problem.' },
];

export default async function ReturnPolicyPage() {
    let sections: LegalSection[] = DEFAULTS;
    let lastUpdated = 'October 2025';
    try {
        const row = await prisma.siteConfig.findUnique({ where: { key: 'legal.returns' } });
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
        name: 'Return Policy',
        description: 'Return and refund policy for Colchis Creamery',
        url: `${SITE_URL}/legal/returns`,
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
            <main className="min-h-screen bg-[#FAFAFA] py-20 px-4">
                <div className="max-w-3xl mx-auto bg-white p-10 md:p-16 shadow-sm rounded border border-gray-100">

                    <h1 className="text-4xl font-serif text-[#2C2A29] mb-8 border-b-2 border-[#CBA153] pb-4 inline-block">
                        Return Policy
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
            </main>
        </>
    );
}
