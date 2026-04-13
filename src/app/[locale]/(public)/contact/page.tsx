import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import ContactFormClient from '@/components/contact/ContactFormClient';
import { getOgImage, buildOgImages } from '@/lib/seo';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';

interface Location {
    name: string;
    address: string;
    lat: string;
    lng: string;
    phone: string;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const canonicalPath = locale === 'en' ? '/contact' : `/${locale}/contact`;
    const ogImage = await getOgImage('contact');
    return {
        title: 'Contact Us | Colchis Creamery',
        description: 'Get in touch with the Colchis Creamery team for inquiries, support, wholesale partnerships, or feedback. Based in Columbus, Ohio.',
        keywords: ['contact Colchis Creamery', 'Georgian cheese support', 'wholesale inquiry', 'cheese order help', 'Columbus Ohio cheese'],
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: { 'en': `${SITE_URL}/contact`, 'ka': `${SITE_URL}/ka/contact`, 'ru': `${SITE_URL}/ru/contact`, 'es': `${SITE_URL}/es/contact` },
        },
        openGraph: {
            type: 'website', title: 'Contact Us | Colchis Creamery',
            description: 'Get in touch with the Colchis Creamery team.',
            url: `${SITE_URL}${canonicalPath}`, siteName: 'Colchis Creamery',
            ...(ogImage ? { images: buildOgImages(ogImage, 'Contact Colchis Creamery') } : {}),
        },
        twitter: { card: 'summary', title: 'Contact Us | Colchis Creamery', description: 'Get in touch with the Colchis Creamery team.',
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

    const email = g('contact.email', 'support@colchiscreamery.com');
    const phone = g('contact.phone', '+1 (555) 123-4567');
    const hours = g('contact.hours', 'Monday - Friday: 9 AM - 5 PM EST');

    // Parse locations (new format) with fallback to legacy fields
    let locations: Location[] = [];
    const rawLocations = g('contact.locations', '');
    if (rawLocations) {
        try {
            const parsed = JSON.parse(rawLocations);
            if (Array.isArray(parsed) && parsed.length > 0) locations = parsed;
        } catch { /* fallback below */ }
    }
    if (locations.length === 0) {
        const address = g('contact.address', 'Columbus, OH');
        const mapLat = g('contact.mapLat', '39.9612');
        const mapLng = g('contact.mapLng', '-82.9988');
        locations = [{ name: 'Colchis Creamery', address, lat: mapLat, lng: mapLng, phone: '' }];
    }

    const primaryLocation = locations[0];
    const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
    const mapSrc = MAPS_KEY
        ? `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${encodeURIComponent(primaryLocation.address)}&center=${primaryLocation.lat},${primaryLocation.lng}&zoom=13`
        : `https://maps.google.com/maps?q=${primaryLocation.lat},${primaryLocation.lng}&z=13&output=embed`;

    // JSON-LD: LocalBusiness schema
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FoodEstablishment',
        name: 'Colchis Creamery',
        description: 'Authentic Georgian artisanal cheese, handcrafted in Ohio with premium local milk.',
        url: SITE_URL,
        telephone: phone,
        email: email,
        address: {
            '@type': 'PostalAddress',
            streetAddress: primaryLocation.address.split(',')[0]?.trim() || primaryLocation.address,
            addressLocality: 'Columbus',
            addressRegion: 'OH',
            addressCountry: 'US',
        },
        geo: {
            '@type': 'GeoCoordinates',
            latitude: parseFloat(primaryLocation.lat),
            longitude: parseFloat(primaryLocation.lng),
        },
        openingHours: hours,
        priceRange: '$$',
        servesCuisine: 'Georgian',
        hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'Artisanal Georgian Cheese',
            itemListElement: [
                { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Sulguni Cheese' } },
                { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Imeretian Cheese' } },
            ],
        },
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <main className="min-h-screen bg-[#FDFBF7] py-20 px-4">
                <div className="max-w-4xl mx-auto">

                    <div className="text-center mb-16">
                        <h1 className="text-5xl font-serif text-[#2C2A29] mb-4">Contact Us</h1>
                        <p className="text-xl text-[#2C2A29] opacity-80 max-w-2xl mx-auto">
                            We are here to assist you. Whether you have a question about our artisanal cheese, your recent order, or wholesale opportunities, our team is ready to help.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-12 bg-white p-8 md:p-12 shadow-sm rounded border border-gray-100">

                        <div>
                            <h2 className="text-2xl font-serif text-[#CBA153] mb-6">Our Information</h2>
                            <div className="space-y-6 text-[#2C2A29]">
                                {/* Locations */}
                                {locations.map((loc, idx) => (
                                    <div key={idx}>
                                        <strong className="block uppercase tracking-wider text-xs text-gray-400 mb-1">
                                            {locations.length > 1 ? loc.name || `Location ${idx + 1}` : 'Address'}
                                        </strong>
                                        <p>{loc.address}</p>
                                        {loc.phone && (
                                            <a href={`tel:${loc.phone.replace(/[^+\d]/g, '')}`}
                                                className="text-sm text-[#CBA153] hover:underline mt-0.5 block">{loc.phone}</a>
                                        )}
                                    </div>
                                ))}
                                <div>
                                    <strong className="block uppercase tracking-wider text-xs text-gray-400 mb-1">Email</strong>
                                    <a href={`mailto:${email}`} className="text-[#CBA153] hover:underline">{email}</a>
                                </div>
                                <div>
                                    <strong className="block uppercase tracking-wider text-xs text-gray-400 mb-1">Phone</strong>
                                    <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="text-[#CBA153] hover:underline">{phone}</a>
                                </div>
                                <div>
                                    <strong className="block uppercase tracking-wider text-xs text-gray-400 mb-1">Hours</strong>
                                    <p>{hours}</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-serif text-[#CBA153] mb-6">Send a Message</h2>
                            <ContactFormClient />
                        </div>

                    </div>

                    {/* Google Maps */}
                    <div className="mt-12 bg-white shadow-sm rounded border border-gray-100 overflow-hidden">
                        <div className="px-8 pt-6 pb-2">
                            <h2 className="text-2xl font-serif text-[#2C2A29] mb-1">
                                {locations.length > 1 ? 'Our Locations' : 'Find Us'}
                            </h2>
                            <p className="text-sm text-gray-500">{primaryLocation.address}</p>
                        </div>
                        <div className="w-full h-[400px]">
                            <iframe
                                src={mapSrc}
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title={`Colchis Creamery location — ${primaryLocation.address}`}
                            />
                        </div>
                    </div>

                </div>
            </main>
        </>
    );
}
