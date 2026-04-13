import { Metadata } from 'next';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
    title: 'Return Policy | Colchis Creamery',
};

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
    try {
        const row = await prisma.siteConfig.findUnique({ where: { key: 'legal.returns' } });
        if (row?.value) {
            const parsed = JSON.parse(row.value);
            if (Array.isArray(parsed) && parsed.length > 0) sections = parsed;
        }
    } catch { /* use defaults */ }

    return (
        <main className="min-h-screen bg-[#FAFAFA] py-20 px-4">
            <div className="max-w-3xl mx-auto bg-white p-10 md:p-16 shadow-sm rounded border border-gray-100">

                <h1 className="text-4xl font-serif text-[#2C2A29] mb-8 border-b-2 border-[#CBA153] pb-4 inline-block">
                    Return Policy
                </h1>

                <div className="prose prose-lg text-[#2C2A29] opacity-80">
                    <p className="mb-6">Last updated: October 2025</p>

                    {sections.map((section, idx) => (
                        <div key={idx}>
                            <h2 className="text-2xl font-serif text-[#CBA153] mt-8 mb-4">{section.heading}</h2>
                            <p className="mb-6">{section.body}</p>
                        </div>
                    ))}
                </div>

            </div>
        </main>
    );
}
