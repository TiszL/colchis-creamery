import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import ContactClient from '@/components/contact/ContactClient';
import { getOgImage, buildOgImages } from '@/lib/seo';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const canonicalPath = locale === 'en' ? '/contact' : `/${locale}/contact`;
    const ogImage = await getOgImage('contact');
    return {
        title: 'Contact Us | Colchis Food',
        description: 'Get in touch with the Colchis Food team for inquiries, support, wholesale partnerships, or feedback. Based in Dublin, Ohio.',
        keywords: ['contact Colchis Food', 'Georgian cheese support', 'wholesale inquiry', 'cheese order help', 'Dublin Ohio cheese'],
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: { 'en': `${SITE_URL}/contact`, 'ka': `${SITE_URL}/ka/contact`, 'ru': `${SITE_URL}/ru/contact`, 'es': `${SITE_URL}/es/contact` },
        },
        openGraph: {
            type: 'website', title: 'Contact Us | Colchis Food',
            description: 'Get in touch with the Colchis Food team.',
            url: `${SITE_URL}${canonicalPath}`, siteName: 'Colchis Food',
            ...(ogImage ? { images: buildOgImages(ogImage, 'Contact Colchis Food') } : {}),
        },
        twitter: { card: 'summary', title: 'Contact Us | Colchis Food', description: 'Get in touch with the Colchis Food team.',
            ...(ogImage ? { images: [ogImage] } : {}),
        },
    };
}

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
    const configs = await prisma.siteConfig.findMany({
        where: { key: { startsWith: 'contact.' } }
    });

    function g(key: string, fallback: string) {
        return configs.find(c => c.key === key)?.value || fallback;
    }

    const email = g('contact.email', 'hello@colchisfood.com');
    const phone = g('contact.phone', '+1 (614) 555 0142');

    // JSON-LD
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FoodEstablishment',
        name: 'Colchis Food',
        description: 'Authentic Georgian artisanal cheese, handcrafted in Ohio with premium local milk.',
        url: SITE_URL,
        telephone: phone,
        email: email,
        address: {
            '@type': 'PostalAddress',
            streetAddress: '5340 Tuller Road, Suite 200',
            addressLocality: 'Dublin',
            addressRegion: 'OH',
            postalCode: '43017',
            addressCountry: 'US',
        },
        geo: { '@type': 'GeoCoordinates', latitude: 40.0992, longitude: -83.1141 },
        openingHours: ['Tu-Th 09:00-18:00', 'Fr 09:00-20:00', 'Sa 10:00-19:00', 'Su 11:00-16:00'],
        priceRange: '$$',
        servesCuisine: 'Georgian',
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <ContactClient email={email} phone={phone} />
        </>
    );
}
