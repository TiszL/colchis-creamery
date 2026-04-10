import { HeroSection } from "@/components/home/HeroSection";
import { TrustBadges } from "@/components/home/TrustBadges";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });

  return {
    title: `Colchis Creamery | ${t("heroTitle")}`,
    description: t("heroSubtitle"),
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const prefix = locale === "en" ? "" : `/${locale}`;

  // Fetch featured products from database (same source as shop page)
  const dbProducts = await prisma.product.findMany({
    where: { isActive: true, isB2cVisible: true },
    orderBy: { name: 'asc' },
    take: 3,
  });

  const products = dbProducts.map(p => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    description: p.description,
    flavorProfile: p.flavorProfile,
    pairsWith: p.pairsWith,
    weight: p.weight,
    ingredients: p.ingredients,
    imageUrl: p.imageUrl,
    priceB2c: parseFloat(p.priceB2c) || 0,
    priceB2b: parseFloat(p.priceB2b) || 0,
    stockQuantity: p.stockQuantity,
    isActive: p.isActive,
  }));

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
                <img
                  src="https://images.unsplash.com/photo-1559561853-08451507cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                  alt="Georgian Cheese Heritage"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gold/10 rounded-full -z-10 blur-2xl"></div>
              <div className="absolute -top-6 -left-6 w-24 h-24 bg-cream rounded-full -z-10 blur-xl"></div>
            </div>
            <div className="w-full lg:w-1/2">
              <span className="inline-block w-12 h-0.5 bg-gold mb-6" />
              <h2 className="font-serif text-4xl sm:text-5xl text-charcoal mb-6 leading-tight">
                {t("heritageTitle")}
              </h2>
              <p className="text-lg text-charcoal/70 leading-relaxed mb-10">
                {t("heritageText")}
              </p>
              <Link href={`${prefix}/heritage`}>
                <Button variant="outline" size="lg" className="hover:bg-charcoal hover:text-white transition-colors duration-300">
                  {t("heritageCta")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
