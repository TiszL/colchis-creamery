import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import ContactClient, {
    type ContactHeroContent, type ContactDesk, type ContactHoursRow, type ContactFaqLink,
    type ContactMapContent, type ContactAddressCardContent, type ContactFormIntroContent, type ContactFaqCardContent,
} from '@/components/contact/ContactClient';
import { getOgImage, buildOgImages } from '@/lib/seo';
import { getPrimaryLocation } from '@/lib/business-location';

function parseJSON<T>(value: string | undefined | null): T | null {
    if (!value) return null;
    try { return JSON.parse(value) as T; } catch { return null; }
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const canonicalPath = locale === 'en' ? '/contact' : `/${locale}/contact`;
    const ogImage = await getOgImage('contact');
    return {
        title: 'Contact Us',
        description: 'Get in touch with the Colchis Food team for inquiries, support, wholesale partnerships, or feedback. Based in Dublin, Ohio.',
        keywords: ['contact Colchis Food', 'Georgian cheese support', 'wholesale inquiry', 'cheese order help', 'Dublin Ohio cheese'],
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: { 'en': `${SITE_URL}/contact`, 'ka': `${SITE_URL}/ka/contact`, 'ru': `${SITE_URL}/ru/contact`, 'es': `${SITE_URL}/es/contact`, 'x-default': `${SITE_URL}/contact` },
        },
        openGraph: {
            type: 'website', title: 'Contact Us',
            description: 'Get in touch with the Colchis Food team.',
            url: `${SITE_URL}${canonicalPath}`, siteName: 'Colchis Food',
            ...(ogImage ? { images: buildOgImages(ogImage, 'Contact Colchis Food') } : {}),
        },
        twitter: { card: 'summary', title: 'Contact Us', description: 'Get in touch with the Colchis Food team.',
            ...(ogImage ? { images: [ogImage] } : {}),
        },
    };
}

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
    const [configs, primary] = await Promise.all([
        prisma.siteConfig.findMany({ where: { key: { startsWith: 'contact.' } } }),
        getPrimaryLocation(),
    ]);

    function g(key: string, fallback: string) {
        return configs.find(c => c.key === key)?.value || fallback;
    }

    const email = g('contact.email', 'hello@colchisfood.com');
    // Launch polish: NEVER show a fabricated number (it also flowed into the
    // JSON-LD structured data). Empty = the phone row is hidden entirely.
    const phone = g('contact.phone', primary.phone || '');

    // JSON-LD — every address field comes from the primary Location row so the
    // structured data matches what customers actually see on the page.
    const streetAddress = primary.addressLine2
        ? `${primary.addressLine1}, ${primary.addressLine2}`
        : primary.addressLine1;
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FoodEstablishment',
        name: 'Colchis Food',
        description: 'Authentic Georgian artisanal cheese, handcrafted in Ohio with premium local milk.',
        url: SITE_URL,
        ...(phone ? { telephone: phone } : {}),
        email: email,
        address: {
            '@type': 'PostalAddress',
            streetAddress,
            addressLocality: primary.city,
            addressRegion: primary.state,
            postalCode: primary.postalCode,
            addressCountry: primary.country,
        },
        ...(primary.latitude !== null && primary.longitude !== null
            ? { geo: { '@type': 'GeoCoordinates', latitude: primary.latitude, longitude: primary.longitude } }
            : {}),
        openingHours: ['Mo-Su 07:00-22:00'],
        priceRange: '$$',
        servesCuisine: 'Georgian',
    };

    // Parse admin-editable content blocks (Phase 10 Phase 4). Null → ContactClient
    // falls back to its hardcoded DEFAULT_* tables.
    const blocks = (() => {
        const m: Record<string, string> = {};
        for (const c of configs) m[c.key] = c.value;
        return {
            hero: parseJSON<ContactHeroContent>(m['contact.hero']),
            desks: parseJSON<ContactDesk[]>(m['contact.desks']),
            hoursTable: parseJSON<ContactHoursRow[]>(m['contact.hours_table']),
            faqLinks: parseJSON<ContactFaqLink[]>(m['contact.faq_links']),
            map: parseJSON<ContactMapContent>(m['contact.map']),
            addressCard: parseJSON<ContactAddressCardContent>(m['contact.address_card']),
            formIntro: parseJSON<ContactFormIntroContent>(m['contact.form_intro']),
            faqCard: parseJSON<ContactFaqCardContent>(m['contact.faq_card']),
        };
    })();

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <ContactClient
                email={email}
                phone={phone}
                primary={primary}
                hero={blocks.hero}
                desks={blocks.desks}
                hoursTable={blocks.hoursTable}
                faqLinks={blocks.faqLinks}
                map={blocks.map}
                addressCard={blocks.addressCard}
                formIntro={blocks.formIntro}
                faqCard={blocks.faqCard}
            />
        </>
    );
}
