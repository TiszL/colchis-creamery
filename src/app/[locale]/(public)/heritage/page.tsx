import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
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

// ─── Metadata ────────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: HeritagePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "heritage" });

  return {
    title: t("title"),
    description: t("intro"),
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

  return (
    <div className="bg-cream">
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
                            <div className="aspect-[4/3] rounded-lg overflow-hidden shadow-lg border border-border-light">
                              <img
                                src={section.images[0]}
                                alt={heading}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            /* Image gallery (2+ images) */
                            <div className="space-y-3">
                              <div className="aspect-[4/3] rounded-lg overflow-hidden shadow-lg border border-border-light">
                                <img
                                  src={section.images[0]}
                                  alt={heading}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {section.images.slice(1, 4).map((img, imgIdx) => (
                                  <div key={imgIdx} className="aspect-[4/3] rounded-md overflow-hidden border border-border-light">
                                    <img src={img} alt="" className="w-full h-full object-cover" />
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
                <div className="aspect-[4/3] rounded-lg overflow-hidden shadow-lg border border-border-light">
                  <img
                    src="https://images.unsplash.com/photo-1481070555726-e2fe8357725c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                    alt="Georgian Countryside"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </section>
          <section className="py-16 bg-cream">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1 aspect-[4/3] rounded-lg overflow-hidden shadow-lg border border-border-light">
                  <img
                    src="https://images.unsplash.com/photo-1559561853-08451507cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                    alt="Artisanal Cheesemaking"
                    className="w-full h-full object-cover"
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
