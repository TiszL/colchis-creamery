import { HeroSection } from "@/components/home/HeroSection";
import { TrustBadges } from "@/components/home/TrustBadges";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { prisma } from "@/lib/db";
import type { Product } from "@/types";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { getOgImage, buildOgImages } from "@/lib/seo";

function localizedCms(raw: string, locale: string, fallback: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed.en !== undefined) return parsed[locale] || parsed.en || fallback;
  } catch { /* not JSON */ }
  return raw || fallback;
}
function getVal(configs: { key: string; value: string }[], key: string): string {
  return configs.find(c => c.key === key)?.value || '';
}

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const ogImage = await getOgImage('home');
  const title = `Colchis Creamery | ${t("heroTitle")}`;
  const description = t("heroSubtitle");

  return {
    title,
    description,
    openGraph: {
      type: 'website' as const,
      siteName: 'Colchis Creamery',
      title,
      description,
      ...(ogImage ? { images: buildOgImages(ogImage, 'Colchis Creamery') } : {}),
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const prefix = locale === "en" ? "" : `/${locale}`;

  // Fetch featured products from database (same source as shop page)
  let products: Product[] = [];
  try {
    const dbProducts = await prisma.product.findMany({
      where: { status: { in: ['ACTIVE', 'COMING_SOON'] }, isB2cVisible: true },
      orderBy: { name: 'asc' },
      take: 3,
    });
    products = dbProducts.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      description: p.description || '',
      flavorProfile: p.flavorProfile,
      pairsWith: p.pairsWith,
      weight: p.weight,
      ingredients: p.ingredients,
      imageUrl: p.imageUrl || '',
      priceB2c: parseFloat(p.priceB2c) || 0,
      priceB2b: parseFloat(p.priceB2b) || 0,
      stockQuantity: p.stockQuantity,
      isActive: p.isActive,
      status: p.status as 'ACTIVE' | 'INACTIVE' | 'COMING_SOON',
    }));
  } catch (err) {
    console.error('[HomePage] DB unreachable, showing empty products:', (err as Error).message);
  }

  // Load heritage teaser CMS data
  let heritageCfg: { key: string; value: string }[] = [];
  try {
    heritageCfg = await prisma.siteConfig.findMany({
      where: { key: { startsWith: 'homeHeritage.' } },
    });
  } catch { /* fallback to i18n */ }

  const heritageTitle = localizedCms(getVal(heritageCfg, 'homeHeritage.title'), locale, t("heritageTitle"));
  const heritageText = localizedCms(getVal(heritageCfg, 'homeHeritage.text'), locale, t("heritageText"));
  const heritageCta = localizedCms(getVal(heritageCfg, 'homeHeritage.cta'), locale, t("heritageCta"));
  const heritageImage = getVal(heritageCfg, 'homeHeritage.imageUrl') || 'https://images.unsplash.com/photo-1559561853-08451507cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80';

  return (
    <>
      <HeroSection locale={locale} />
      <TrustBadges />
      <FeaturedProducts products={products} locale={locale} />

      {/* Heritage Teaser */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="w-full lg:w-1/2 relative">
              <div className="aspect-[4/5] md:aspect-square relative w-full overflow-hidden rounded-lg shadow-xl border border-border-light">
                <Image
                  src={heritageImage}
                  alt={heritageTitle}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gold/10 rounded-full -z-10 blur-2xl"></div>
              <div className="absolute -top-6 -left-6 w-24 h-24 bg-cream rounded-full -z-10 blur-xl"></div>
            </div>
            <div className="w-full lg:w-1/2">
              <span className="inline-block w-12 h-0.5 bg-gold mb-6" />
              <h2 className="font-serif text-4xl sm:text-5xl text-charcoal mb-6 leading-tight">
                {heritageTitle}
              </h2>
              <p className="text-lg text-charcoal/70 leading-relaxed mb-10">
                {heritageText}
              </p>
              <Link href={`${prefix}/heritage`}>
                <Button variant="outline" size="lg" className="hover:bg-charcoal hover:text-white transition-colors duration-300">
                  {heritageCta}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
