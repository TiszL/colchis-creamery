import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import Image from "next/image";
import type { Metadata } from "next";

interface HeritagePageProps {
  params: Promise<{ locale: string }>;
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface LocaleStrings {
  en: string;
  ka: string;
  ru: string;
  es: string;
}

interface HeritageSection {
  id: string;
  heading: LocaleStrings;
  text: LocaleStrings;
  images: string[];
  videos: string[];
  layout: 'image-left' | 'image-right';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';

function getVal(configs: { key: string; value: string }[], key: string): string {
  return configs.find(c => c.key === key)?.value || '';
}

function localizedText(raw: string, locale: string, fallback: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed.en !== undefined) {
      return parsed[locale] || parsed.en || fallback;
    }
  } catch { /* ignore */ }
  return raw || fallback;
}

function locStr(obj: LocaleStrings, locale: string): string {
  const lc = locale as keyof LocaleStrings;
  return obj[lc] || obj.en || '';
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// ─── Metadata (SEO) ──────────────────────────────────────────────────────────
export async function generateMetadata({ params }: HeritagePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "heritage" });

  // Load CMS content for dynamic descriptions
  const configs = await prisma.siteConfig.findMany({
    where: { key: { startsWith: 'heritage.' } },
  });

  const title = localizedText(getVal(configs, 'heritage.pageTitle'), locale, t("title"));
  const description = localizedText(getVal(configs, 'heritage.pageIntro'), locale, t("intro"));

  // Find first image from sections for OG image
  let ogImage: string | undefined;
  const sectionsRaw = getVal(configs, 'heritage.sections');
  if (sectionsRaw) {
    try {
      const sections: HeritageSection[] = JSON.parse(sectionsRaw);
      for (const s of sections) {
        if (s.images?.length > 0) { ogImage = s.images[0]; break; }
      }
    } catch { /* ignore */ }
  }

  const canonicalPath = locale === 'en' ? '/heritage' : `/${locale}/heritage`;

  return {
    title,
    description,
    keywords: [
      'Georgian cheese heritage', 'Colchis Creamery story', 'artisanal cheesemaking',
      'Georgian tradition', 'Ohio cheese', 'Sulguni history', 'handcrafted cheese',
      'ancient cheesemaking', 'Georgian dairy', 'Colchis heritage',
    ],
    alternates: {
      canonical: `${SITE_URL}${canonicalPath}`,
      languages: {
        'en': `${SITE_URL}/heritage`,
        'ka': `${SITE_URL}/ka/heritage`,
        'ru': `${SITE_URL}/ru/heritage`,
        'es': `${SITE_URL}/es/heritage`,
      },
    },
    openGraph: {
      type: 'website',
      title: `${title} | Colchis Creamery`,
      description,
      url: `${SITE_URL}${canonicalPath}`,
      siteName: 'Colchis Creamery',
      locale: locale === 'en' ? 'en_US' : locale === 'ka' ? 'ka_GE' : locale === 'ru' ? 'ru_RU' : 'es_ES',
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 900, alt: title }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Colchis Creamery`,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function HeritagePage({ params }: HeritagePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "heritage" });

  // Load heritage config from DB
  const configs = await prisma.siteConfig.findMany({
    where: { key: { startsWith: 'heritage.' } },
  });

  // Parse page-level fields with i18n fallbacks
  const pageTitle = localizedText(getVal(configs, 'heritage.pageTitle'), locale, t("title"));
  const pageIntro = localizedText(getVal(configs, 'heritage.pageIntro'), locale, t("intro"));
  const processTitle = localizedText(getVal(configs, 'heritage.processTitle'), locale, t("processTitle"));
  const processText = localizedText(getVal(configs, 'heritage.processText'), locale, t("processText"));

  // Parse sections
  let sections: HeritageSection[] = [];
  const sectionsRaw = getVal(configs, 'heritage.sections');
  if (sectionsRaw) {
    try {
      sections = JSON.parse(sectionsRaw);
    } catch { /* ignore */ }
  }

  // Fallback: if no sections exist, use i18n-based defaults
  const hasSections = sections.length > 0;

  // ── JSON-LD Structured Data for Search Engines & AI Crawlers ──
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: pageTitle,
    description: pageIntro,
    url: `${SITE_URL}${locale === 'en' ? '' : `/${locale}`}/heritage`,
    inLanguage: locale === 'en' ? 'en-US' : locale === 'ka' ? 'ka-GE' : locale === 'ru' ? 'ru-RU' : 'es-ES',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Colchis Creamery',
      url: SITE_URL,
    },
    about: {
      '@type': 'Organization',
      name: 'Colchis Creamery',
      description: 'Authentic Georgian artisanal cheese, handcrafted in Ohio with premium local milk.',
      url: SITE_URL,
      foundingDate: '2024',
      areaServed: 'United States',
      knowsAbout: ['Georgian cheese', 'Sulguni', 'Imeretian cheese', 'artisanal cheesemaking', 'Georgian cuisine'],
    },
    mainEntity: hasSections ? sections.map(s => ({
      '@type': 'WebPageElement',
      name: locStr(s.heading, locale),
      text: locStr(s.text, locale),
      ...(s.images?.length > 0 ? { image: s.images[0] } : {}),
    })) : undefined,
  };

  return (
    <div className="bg-cream">
      {/* JSON-LD Structured Data — invisible, read by search engines & AI bots */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Hero */}
      <section className="relative py-20 sm:py-28 bg-gradient-to-b from-cream to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block w-16 h-0.5 bg-gold mb-6" />
          <h1 className="font-serif text-4xl sm:text-5xl text-charcoal mb-6">
            {pageTitle}
          </h1>
          <p className="text-xl text-charcoal/60 leading-relaxed">
            {pageIntro}
          </p>
        </div>
      </section>

      {/* Dynamic Sections */}
      {hasSections ? (
        sections.map((section, idx) => {
          const heading = locStr(section.heading, locale);
          const text = locStr(section.text, locale);
          const isImageLeft = section.layout === 'image-left';
          const bgClass = idx % 2 === 0 ? 'bg-white' : 'bg-cream';

          const hasImages = section.images && section.images.length > 0;
          const hasVideos = section.videos && section.videos.length > 0;
          const hasMedia = hasImages || hasVideos;

          return (
            <section key={section.id} className={`py-16 ${bgClass}`}>
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-12 items-center`}>
                  {/* Text side */}
                  <div className={isImageLeft ? 'order-1 md:order-2' : ''}>
                    <h2 className="font-serif text-3xl text-charcoal mb-6">
                      {heading}
                    </h2>
                    <p className="text-charcoal/70 leading-relaxed text-lg whitespace-pre-line">
                      {text}
                    </p>
                  </div>

                  {/* Media side */}
                  <div className={isImageLeft ? 'order-2 md:order-1' : ''}>
                    {hasMedia && (
                      <div className="space-y-4">
                        {/* Primary image */}
                        {hasImages && (
                          section.images.length === 1 ? (
                            <div className="aspect-[4/3] relative rounded-lg overflow-hidden shadow-lg border border-border-light">
                              <Image
                                src={section.images[0]}
                                alt={heading}
                                fill
                                sizes="(max-width: 768px) 100vw, 50vw"
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            /* Image gallery (2+ images) */
                            <div className="space-y-3">
                              <div className="aspect-[4/3] relative rounded-lg overflow-hidden shadow-lg border border-border-light">
                                <Image
                                  src={section.images[0]}
                                  alt={heading}
                                  fill
                                  sizes="(max-width: 768px) 100vw, 50vw"
                                  className="object-cover"
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {section.images.slice(1, 4).map((img, imgIdx) => (
                                  <div key={imgIdx} className="aspect-[4/3] relative rounded-md overflow-hidden border border-border-light">
                                    <Image src={img} alt={`${heading} — image ${imgIdx + 2}`} fill sizes="33vw" className="object-cover" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        )}

                        {/* Video embeds */}
                        {hasVideos && section.videos.map((videoUrl, vIdx) => {
                          const ytId = getYouTubeId(videoUrl);
                          return ytId ? (
                            <div key={vIdx} className="relative w-full aspect-video rounded-lg overflow-hidden shadow-lg border border-border-light">
                              <iframe
                                src={`https://www.youtube.com/embed/${ytId}?rel=0`}
                                title={heading}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="absolute inset-0 w-full h-full"
                              />
                            </div>
                          ) : (
                            <video key={vIdx} src={videoUrl} controls className="w-full rounded-lg shadow-lg border border-border-light" />
                          );
                        })}
                      </div>
                    )}

                    {/* No media — show placeholder */}
                    {!hasMedia && (
                      <div className="aspect-[4/3] rounded-lg overflow-hidden shadow-lg border border-border-light bg-gradient-to-br from-gold/10 to-cream flex items-center justify-center">
                        <span className="text-charcoal/30 text-sm">No media uploaded</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })
      ) : (
        /* Fallback: old hardcoded sections using i18n */
        <>
          <section className="py-16 bg-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="font-serif text-3xl text-charcoal mb-6">{t("traditionTitle")}</h2>
                  <p className="text-charcoal/70 leading-relaxed text-lg">{t("traditionText")}</p>
                </div>
                <div className="aspect-[4/3] relative rounded-lg overflow-hidden shadow-lg border border-border-light">
                  <Image
                    src="https://u1on4xcfmtn0uyz6.public.blob.vercel-storage.com/products/1776099898316-seo1.webp"
                    alt="Georgian Countryside"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </section>
          <section className="py-16 bg-cream">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1 aspect-[4/3] relative rounded-lg overflow-hidden shadow-lg border border-border-light">
                  <Image
                    src="https://u1on4xcfmtn0uyz6.public.blob.vercel-storage.com/products/1776099898316-seo1.webp"
                    alt="Artisanal Cheesemaking"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <div className="order-1 md:order-2">
                  <h2 className="font-serif text-3xl text-charcoal mb-6">{t("ohioTitle")}</h2>
                  <p className="text-charcoal/70 leading-relaxed text-lg">{t("ohioText")}</p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Our Process */}
      <section className={`py-16 ${hasSections && sections.length % 2 === 0 ? 'bg-white' : 'bg-cream'}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block w-12 h-0.5 bg-gold mb-6" />
          <h2 className="font-serif text-3xl text-charcoal mb-6">
            {processTitle}
          </h2>
          <p className="text-charcoal/70 leading-relaxed text-lg max-w-2xl mx-auto">
            {processText}
          </p>
        </div>
      </section>
    </div>
  );
}
