import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { ProductGrid } from "@/components/shop/ProductGrid";
import ShopFilterBar from "@/components/shop/ShopFilterBar";
import type { Metadata } from "next";
import { getOgImage, buildOgImages } from "@/lib/seo";
import { Suspense } from "react";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';

interface ShopPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ line?: string; category?: string }>;
}

export async function generateMetadata({ params, searchParams }: ShopPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { line, category } = await searchParams;
  const t = await getTranslations({ locale, namespace: "shop" });
  const canonicalPath = locale === 'en' ? '/shop' : `/${locale}/shop`;
  const ogImage = await getOgImage('shop');

  // Build dynamic title/description based on active filters
  let titleSuffix = '';
  if (line) {
    const lineData = await prisma.productLine.findUnique({ where: { slug: line } });
    if (lineData) titleSuffix = ` — ${lineData.name}`;
  }

  const title = `${t("title")}${titleSuffix}`;
  const description = 'Authentic Georgian dairy crafted exclusively from 100% Grass-Fed A2 Brown Swiss Milk. Shop Colchis Reserve™ premium artisanal and Colchis Classic everyday excellence collections.';

  return {
    title,
    description,
    keywords: [
      'A2 Brown Swiss milk cheese', 'Georgian cheese shop', 'authentic Georgian cheese Ohio',
      'Colchis Reserve', 'Colchis Classic', 'grass-fed A2 dairy', 'artisanal pulled-curd cheese',
      'fresh cultured farmer cheese', 'A2 whey spread', 'Colchis Creamery shop',
      'handcrafted Georgian dairy', 'LTLT slow pasteurized cheese',
    ],
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
      title: `${title} | Colchis Creamery`,
      description,
      url: `${SITE_URL}${canonicalPath}`,
      siteName: 'Colchis Creamery',
      ...(ogImage ? { images: buildOgImages(ogImage, title) } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Colchis Creamery`,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const { locale } = await params;
  const { line, category } = await searchParams;
  const t = await getTranslations({ locale, namespace: "shop" });

  // Fetch product lines with categories
  const productLines = await prisma.productLine.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      categories: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  // Build product query with filters
  const where: any = {
    status: { in: ['ACTIVE', 'COMING_SOON'] },
    isB2cVisible: true,
  };

  if (line) {
    const lineData = productLines.find(l => l.slug === line);
    if (lineData) {
      where.productLineId = lineData.id;
      if (category) {
        const catData = lineData.categories.find(c => c.slug === category);
        if (catData) where.categoryId = catData.id;
      }
    }
  }

  const dbProducts = await prisma.product.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      productLine: { select: { id: true, slug: true, name: true, tagline: true, description: true, badgeColor: true, sortOrder: true, isActive: true } },
      productCategory: { select: { id: true, slug: true, name: true, description: true, imageUrl: true, productLineId: true, sortOrder: true, isActive: true } },
    },
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
    productLineId: p.productLineId,
    categoryId: p.categoryId,
    productLine: p.productLine,
    productCategory: p.productCategory,
  }));

  // Flatten all categories for filter bar
  const allCategories = productLines.flatMap(l =>
    l.categories.map(c => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      productLineId: c.productLineId,
    }))
  );

  // Serializable product lines for client
  const serializedLines = productLines.map(l => ({
    id: l.id,
    slug: l.slug,
    name: l.name,
    tagline: l.tagline,
    badgeColor: l.badgeColor,
  }));

  return (
    <>
      {/* JSON-LD: Product collection for search engines & AI */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Colchis Creamery — Authentic Georgian A2 Dairy Collection',
          description: 'Authentic Georgian dairy crafted exclusively from 100% Grass-Fed A2 Brown Swiss Milk. Heritage recipes, made fresh in Ohio.',
          url: `${SITE_URL}${locale === 'en' ? '' : `/${locale}`}/shop`,
          isPartOf: { '@type': 'WebSite', name: 'Colchis Creamery', url: SITE_URL },
          about: {
            '@type': 'Thing',
            name: '100% Grass-Fed A2 Brown Swiss Milk Dairy Products',
            description: 'All products are crafted exclusively from A2 protein milk sourced from grass-fed Brown Swiss cows. Easy to digest, rich in protein, rooted in ancient Georgian dairy traditions.',
          },
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
      {/* Masterbrand Promise Banner */}
      <section className="relative overflow-hidden bg-gradient-to-br from-charcoal via-charcoal to-charcoal-light">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23CBA153\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center relative">
          <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            <span className="text-gold text-[11px] font-bold uppercase tracking-[0.2em]">A2 Brown Swiss Heritage</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white mb-4 leading-tight">
            {t("title")}
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
            {t("masterbrandPromise")}
          </p>
        </div>
      </section>

      {/* Filters & Products */}
      <section className="py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filter Bar */}
          {productLines.length > 0 && (
            <div className="mb-10">
              <Suspense fallback={null}>
                <ShopFilterBar
                  productLines={serializedLines}
                  categories={allCategories}
                  allLabel={t("filterAll")}
                  allCategoriesLabel={t("allCategories")}
                />
              </Suspense>
            </div>
          )}

          {/* Active line description */}
          {line && (() => {
            const activeLineData = productLines.find(l => l.slug === line);
            if (!activeLineData?.tagline) return null;
            return (
              <div className="text-center mb-10">
                <p className="text-sm text-charcoal/50 italic">{activeLineData.tagline}</p>
              </div>
            );
          })()}

          {/* Product Grid */}
          {products.length > 0 ? (
            <ProductGrid products={products} locale={locale} />
          ) : (
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gold/5 flex items-center justify-center">
                <svg className="w-10 h-10 text-gold/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="font-serif text-xl text-charcoal mb-2">{t("noProductsFound")}</h3>
              <p className="text-charcoal/50 text-sm">Try adjusting your filters to discover our full collection.</p>
            </div>
          )}
        </div>
      </section>
    </div>
    </>
  );
}
