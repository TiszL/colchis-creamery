import WholesaleForm from '@/components/b2b/WholesaleForm';
import { Metadata } from 'next';
import Link from 'next/link';
import { Truck, FileText } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getOgImage, buildOgImages } from '@/lib/seo';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const canonicalPath = locale === 'en' ? '/wholesale' : `/${locale}/wholesale`;
    const ogImage = await getOgImage('wholesale');
    return {
        title: 'Wholesale Partners | Colchis Creamery',
        description: 'Apply to become a wholesale partner with Colchis Creamery and offer premium artisanal Georgian cheese at your establishment.',
        keywords: ['wholesale cheese', 'B2B cheese supply', 'Georgian cheese wholesale', 'restaurant cheese supplier', 'Colchis Creamery wholesale'],
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: { 'en': `${SITE_URL}/wholesale`, 'ka': `${SITE_URL}/ka/wholesale`, 'ru': `${SITE_URL}/ru/wholesale`, 'es': `${SITE_URL}/es/wholesale` },
        },
        openGraph: {
            type: 'website', title: 'Wholesale Partners | Colchis Creamery',
            description: 'Partner with Colchis Creamery for premium artisanal Georgian cheese.',
            url: `${SITE_URL}${canonicalPath}`, siteName: 'Colchis Creamery',
            ...(ogImage ? { images: buildOgImages(ogImage, 'Wholesale Partners') } : {}),
        },
        twitter: { card: 'summary_large_image', title: 'Wholesale Partners | Colchis Creamery', description: 'Partner with Colchis Creamery for premium artisanal Georgian cheese.',
            ...(ogImage ? { images: [ogImage] } : {}),
        },
    };
}

export const dynamic = 'force-dynamic';

function getVal(configs: { key: string; value: string }[], key: string, fallback = ''): string {
    return configs.find(c => c.key === key)?.value || fallback;
}

export default async function WholesalePage() {
    let configs: { key: string; value: string }[] = [];
    try {
        configs = await prisma.siteConfig.findMany({ where: { key: { startsWith: 'wholesale.' } } });
    } catch { /* use defaults */ }

    const subtitle = getVal(configs, 'wholesale.subtitle', 'Supply & Distribution');
    const headingLine1 = getVal(configs, 'wholesale.headingLine1', 'Wholesale');
    const headingLine2 = getVal(configs, 'wholesale.headingLine2', 'Partnership.');
    const description = getVal(configs, 'wholesale.description', 'Elevate your culinary offerings with the finest authentic Georgian cheese. We empower premium retailers and fine-dining restaurants across Ohio and the Midwest with steady, high-quality artisanal cheese supply.');
    const feature1Title = getVal(configs, 'wholesale.feature1Title', 'Cold Chain Logistics');
    const feature1Desc = getVal(configs, 'wholesale.feature1Desc', 'Fresh from our facility to your inventory.');
    const feature2Title = getVal(configs, 'wholesale.feature2Title', 'Paperless Contracting');
    const feature2Desc = getVal(configs, 'wholesale.feature2Desc', 'Fully integrated Adobe Sign agreements.');
    const buttonText = getVal(configs, 'wholesale.buttonText', 'Partner Portal Login');
    const buttonLink = getVal(configs, 'wholesale.buttonLink', '/b2b/login');
    const imageUrl = getVal(configs, 'wholesale.imageUrl', 'https://images.unsplash.com/photo-1447078806655-40579c2520d6?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80');
    const formHeading = getVal(configs, 'wholesale.formHeading', 'Apply for Distribution');

    return (
        <main className="bg-[#1A1A1A] text-[#CBA153] min-h-screen pt-24 md:pt-32 pb-16 md:pb-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">

                {/* Hero / Value Prop Section */}
                <div className="grid md:grid-cols-2 gap-10 md:gap-20 items-stretch mb-12 md:mb-24">
                    <div className="flex flex-col justify-center">
                        <span className="text-xs tracking-[0.3em] md:tracking-[0.4em] uppercase opacity-60 mb-4 md:mb-6 block">{subtitle}</span>
                        <h2 className="text-3xl sm:text-5xl md:text-7xl font-serif text-white mb-5 md:mb-8 leading-tight">
                            {headingLine1} <br />
                            <span className="text-[#CBA153]">{headingLine2}</span>
                        </h2>
                        <p className="text-gray-400 text-base md:text-lg mb-8 md:mb-10 font-light leading-relaxed">
                            {description}
                        </p>
                        <div className="space-y-4 md:space-y-6">
                            <div className="flex items-center gap-3 md:gap-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-[#CBA153]/30 flex items-center justify-center shrink-0">
                                    <Truck size={18} className="md:w-5 md:h-5" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm md:text-base">{feature1Title}</h4>
                                    <p className="text-xs md:text-sm text-gray-500">{feature1Desc}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 md:gap-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-[#CBA153]/30 flex items-center justify-center shrink-0">
                                    <FileText size={18} className="md:w-5 md:h-5" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm md:text-base">{feature2Title}</h4>
                                    <p className="text-xs md:text-sm text-gray-500">{feature2Desc}</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 md:mt-12">
                            <Link href={buttonLink} className="bg-[#CBA153] text-black px-8 md:px-12 py-4 md:py-5 font-bold uppercase tracking-widest text-xs md:text-sm hover:bg-white transition-all inline-block text-center w-full sm:w-auto">
                                {buttonText}
                            </Link>
                        </div>
                    </div>

                    {/* Hero Image — visible on mobile as a banner, full aspect on desktop */}
                    <div className="relative aspect-[16/9] md:aspect-[4/5] md:p-10 overflow-hidden rounded-lg md:rounded-none">
                        <div className="absolute top-0 left-0 w-full h-full border border-[#CBA153]/10"></div>
                        <img
                            src={imageUrl}
                            className="absolute inset-0 w-full h-full object-cover grayscale opacity-60 contrast-125"
                            alt={headingLine1}
                            loading="lazy"
                        />
                    </div>
                </div>

                {/* Form Section */}
                <div className="bg-[#2C2A29] p-5 sm:p-8 md:p-12 rounded-lg max-w-4xl mx-auto shadow-2xl border border-gray-800">
                    <h3 className="text-2xl md:text-3xl font-serif text-white mb-6 md:mb-8 text-center">{formHeading}</h3>
                    <WholesaleForm />
                </div>

            </div>
        </main>
    );
}
