import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { ProductGrid } from "@/components/shop/ProductGrid";
import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';

interface ShopPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shop" });
  const canonicalPath = locale === 'en' ? '/shop' : `/${locale}/shop`;

  return {
    title: t("title"),
    description: t("subtitle"),
    keywords: ['Georgian cheese shop', 'buy Sulguni', 'artisanal cheese online', 'Imeretian cheese',
               'Colchis Creamery shop', 'handcrafted cheese', 'Ohio cheese', 'Georgian dairy products'],
    alternates: {
      canonical: `${SITE_URL}${canonicalPath}`,
      languages: {
        'en': `${SITE_URL}/shop`,
        'ka': `${SITE_URL}/ka/shop`,
        'ru': `${SITE_URL}/ru/shop`,
        'es': `${SITE_URL}/es/shop`,
      },
    },
    openGraph: {
      type: 'website',
      title: `${t("title")} | Colchis Creamery`,
      description: t("subtitle"),
      url: `${SITE_URL}${canonicalPath}`,
      siteName: 'Colchis Creamery',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${t("title")} | Colchis Creamery`,
      description: t("subtitle"),
    },
  };
}

export default async function ShopPage({ params }: ShopPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shop" });

  const dbProducts = await prisma.product.findMany({
    where: { status: { in: ['ACTIVE', 'COMING_SOON'] }, isB2cVisible: true },
    orderBy: { name: 'asc' },
  });

  // Map DB products to the Product type expected by ProductGrid
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
    status: p.status as 'ACTIVE' | 'INACTIVE' | 'COMING_SOON',
  }));

  return (
    <>
      {/* JSON-LD: Product collection for search engines & AI */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Colchis Creamery Cheese Collection',
          description: 'Handcrafted artisanal Georgian cheese — shop Sulguni, Imeretian, smoked, and aged varieties.',
          url: `${SITE_URL}${locale === 'en' ? '' : `/${locale}`}/shop`,
          isPartOf: { '@type': 'WebSite', name: 'Colchis Creamery', url: SITE_URL },
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: products.length,
            itemListElement: products.map((p, idx) => ({
              '@type': 'ListItem',
              position: idx + 1,
              url: `${SITE_URL}${locale === 'en' ? '' : `/${locale}`}/shop/${p.slug}`,
              name: p.name,
              image: p.imageUrl,
            })),
          },
        }) }}
      />
    <div className="bg-cream min-h-screen">
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block w-12 h-0.5 bg-gold mb-6" />
            <h1 className="font-serif text-4xl sm:text-5xl text-charcoal mb-4">
              {t("title")}
            </h1>
            <p className="text-charcoal/60 max-w-xl mx-auto text-lg">
              {t("subtitle")}
            </p>
          </div>

          <ProductGrid products={products} locale={locale} />
        </div>
      </section>
    </div>
    </>
  );
}
