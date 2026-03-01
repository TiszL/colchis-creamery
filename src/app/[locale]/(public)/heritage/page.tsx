import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

interface HeritagePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HeritagePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "heritage" });

  return {
    title: t("title"),
    description: t("intro"),
  };
}

export default async function HeritagePage({ params }: HeritagePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "heritage" });

  return (
    <div className="bg-cream">
      {/* Hero */}
      <section className="relative py-20 sm:py-28 bg-gradient-to-b from-cream to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block w-16 h-0.5 bg-gold mb-6" />
          <h1 className="font-serif text-4xl sm:text-5xl text-charcoal mb-6">
            {t("title")}
          </h1>
          <p className="text-xl text-charcoal/60 leading-relaxed">
            {t("intro")}
          </p>
        </div>
      </section>

      {/* Georgian Tradition */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-serif text-3xl text-charcoal mb-6">
                {t("traditionTitle")}
              </h2>
              <p className="text-charcoal/70 leading-relaxed text-lg">
                {t("traditionText")}
              </p>
            </div>
            <div className="aspect-[4/3] rounded-lg overflow-hidden shadow-lg border border-border-light relative">
              <img
                src="https://images.unsplash.com/photo-1481070555726-e2fe8357725c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                alt="Georgian Countryside"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Crafted in Ohio */}
      <section className="py-16 bg-cream">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1 aspect-[4/3] rounded-lg overflow-hidden shadow-lg border border-border-light relative">
              <img
                src="https://images.unsplash.com/photo-1559561853-08451507cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                alt="Artisanal Cheesemaking"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="order-1 md:order-2">
              <h2 className="font-serif text-3xl text-charcoal mb-6">
                {t("ohioTitle")}
              </h2>
              <p className="text-charcoal/70 leading-relaxed text-lg">
                {t("ohioText")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Process */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block w-12 h-0.5 bg-gold mb-6" />
          <h2 className="font-serif text-3xl text-charcoal mb-6">
            {t("processTitle")}
          </h2>
          <p className="text-charcoal/70 leading-relaxed text-lg max-w-2xl mx-auto">
            {t("processText")}
          </p>
        </div>
      </section>
    </div>
  );
}
