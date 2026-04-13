import { Metadata } from 'next';
import { prisma } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const canonicalPath = locale === 'en' ? '/legal/privacy' : `/${locale}/legal/privacy`;
    return {
        title: 'Privacy Policy | Colchis Creamery',
        description: 'Learn how Colchis Creamery collects, uses, and protects your personal information. Read our full privacy policy.',
        keywords: ['Colchis Creamery privacy policy', 'data protection', 'personal information', 'cheese shop privacy'],
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: { 'en': `${SITE_URL}/legal/privacy`, 'ka': `${SITE_URL}/ka/legal/privacy`, 'ru': `${SITE_URL}/ru/legal/privacy`, 'es': `${SITE_URL}/es/legal/privacy` },
        },
        openGraph: {
            type: 'website', title: 'Privacy Policy | Colchis Creamery',
            description: 'How Colchis Creamery handles your personal data.',
            url: `${SITE_URL}${canonicalPath}`, siteName: 'Colchis Creamery',
        },
        twitter: { card: 'summary', title: 'Privacy Policy | Colchis Creamery', description: 'Our data privacy practices.' },
    };
}

export const dynamic = 'force-dynamic';

interface LegalSection { heading: string; body: string; }

const DEFAULTS: LegalSection[] = [
    { heading: '1. Information We Collect', body: 'We collect information you provide directly to us, such as when you create an account, make a purchase, sign up for our newsletter, or contact customer support. This may include your name, email address, shipping address, and payment information.' },
    { heading: '2. How We Use Your Information', body: 'We use the information we collect to process transactions, provide customer service, send logistical updates, and improve our services. We may also use your email to send marketing communications, from which you can opt out at any time.' },
    { heading: '3. Data Security', body: 'We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no internet transmission is completely secure, and we cannot guarantee absolute security.' },
    { heading: '4. Sharing of Information', body: 'We do not sell or rent your personal information to third parties. We may share information with trusted service providers who assist us in operating our website and conducting our business (e.g., payment processors like Stripe, logistics partners), subject to strict confidentiality agreements.' },
    { heading: '5. Contact Us', body: 'If you have any questions about this Privacy Policy, please contact us at support@colchiscreamery.com.' },
];

export default async function PrivacyPolicyPage() {
    let sections: LegalSection[] = DEFAULTS;
    let lastUpdated = 'October 2025';
    try {
        const row = await prisma.siteConfig.findUnique({ where: { key: 'legal.privacy' } });
        if (row?.value) {
            const parsed = JSON.parse(row.value);
            if (Array.isArray(parsed) && parsed.length > 0) sections = parsed;
        }
        if (row?.updatedAt) {
            lastUpdated = new Date(row.updatedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
    } catch { /* use defaults */ }

    // JSON-LD for AI crawlers and search engines
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Privacy Policy',
        description: 'Privacy policy for Colchis Creamery',
        url: `${SITE_URL}/legal/privacy`,
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
                        Privacy Policy
                    </h1>

                    <div className="prose prose-lg text-[#2C2A29] opacity-80">
                        <p className="mb-6">Last updated: {lastUpdated}</p>

                        {sections.map((section, idx) => (
                            <div key={idx}>
                                <h2 className="text-2xl font-serif text-[#CBA153] mt-8 mb-4">{section.heading}</h2>
                                <p className="mb-6">{section.body}</p>
                            </div>
                        ))}
                    </div>

                </div>
            </main>
        </>
    );
}
