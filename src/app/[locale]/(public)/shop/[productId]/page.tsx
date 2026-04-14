import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { JsonLdProduct } from "@/components/seo/JsonLdProduct";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import type { Metadata } from "next";
import { ProductGallery } from "@/components/shop/ProductGallery";
import ProductReviews from "@/components/reviews/ProductReviews";
import { ProductCard } from "@/components/shop/ProductCard";

interface ProductPageProps {
  params: Promise<{ locale: string; productId: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale, productId } = await params;
  const product = await prisma.product.findFirst({
    where: { OR: [{ slug: productId }, { id: productId }], status: { in: ['ACTIVE', 'COMING_SOON'] } },
    include: { productLine: true, productCategory: true },
  });

  if (!product) {
    return { title: "Product Not Found" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';
  const slug = product.slug;
  const canonicalPath = locale === 'en' ? `/shop/${slug}` : `/${locale}/shop/${slug}`;
  const lineName = product.productLine?.name || '';
  const catName = product.productCategory?.name || '';

  return {
    title: `${product.name}${lineName ? ` — ${lineName}` : ''}`,
    description: `${product.description} Crafted from 100% Grass-Fed A2 Brown Swiss Milk. Authentic Georgian heritage dairy, made fresh in Ohio.`,
    keywords: [product.name, lineName, catName, 'A2 Brown Swiss milk', 'authentic Georgian cheese',
               'Colchis Creamery', 'grass-fed artisanal dairy', 'made in Ohio',
               product.flavorProfile || '', product.category || 'cheese'].filter(Boolean),
    alternates: {
      canonical: `${siteUrl}${canonicalPath}`,
      languages: {
        'en': `${siteUrl}/shop/${slug}`,
        'ka': `${siteUrl}/ka/shop/${slug}`,
        'ru': `${siteUrl}/ru/shop/${slug}`,
        'es': `${siteUrl}/es/shop/${slug}`,
      },
    },
    openGraph: {
      type: 'website',
      title: `${product.name} | Colchis Creamery`,
      description: `${product.description} Made exclusively from 100% Grass-Fed A2 Brown Swiss Milk.`,
      url: `${siteUrl}${canonicalPath}`,
      siteName: 'Colchis Creamery',
      images: product.imageUrl ? [{ url: product.imageUrl, width: 800, height: 600, alt: product.name }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | Colchis Creamery`,
      description: `${product.description} Made exclusively from 100% Grass-Fed A2 Brown Swiss Milk.`,
      images: product.imageUrl ? [product.imageUrl] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, productId } = await params;
  const product = await prisma.product.findFirst({
    where: { OR: [{ slug: productId }, { id: productId }], status: { in: ['ACTIVE', 'COMING_SOON'] }, isB2cVisible: true },
    include: {
      productLine: true,
      productCategory: true,
    },
  });
  const t = await getTranslations({ locale, namespace: "shop" });
  const common = await getTranslations({ locale, namespace: "common" });
  const prefix = locale === "en" ? "" : `/${locale}`;

  if (!product) {
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://colchiscreamery.com";

  // Build gallery: primary image + additional images
  const allImages = [product.imageUrl, ...(product.images || [])].filter(Boolean);
  const allVideos = (product.videoUrls || []).filter(Boolean);

  // For AddToCartButton and JsonLdProduct, build a compatible product object
  const productForCart = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    description: product.description,
    flavorProfile: product.flavorProfile,
    pairsWith: product.pairsWith,
    weight: product.weight,
    ingredients: product.ingredients,
    imageUrl: product.imageUrl,
    priceB2c: parseFloat(product.priceB2c) || 0,
    priceB2b: parseFloat(product.priceB2b) || 0,
    stockQuantity: product.stockQuantity,
    isActive: product.isActive,
    status: product.status as 'ACTIVE' | 'INACTIVE' | 'COMING_SOON',
    productLineId: product.productLineId,
    categoryId: product.categoryId,
    productLine: product.productLine,
    productCategory: product.productCategory,
  };

  const isComingSoon = product.status === 'COMING_SOON';

  // Fetch related products (same category or same line)
  let relatedProducts: typeof productForCart[] = [];
  try {
    const relatedWhere: any = {
      id: { not: product.id },
      status: { in: ['ACTIVE', 'COMING_SOON'] },
      isB2cVisible: true,
    };

    if (product.categoryId) {
      relatedWhere.categoryId = product.categoryId;
    } else if (product.productLineId) {
      relatedWhere.productLineId = product.productLineId;
    }

    const dbRelated = await prisma.product.findMany({
      where: relatedWhere,
      take: 3,
      orderBy: { name: 'asc' },
      include: {
        productLine: true,
        productCategory: true,
      },
    });

    relatedProducts = dbRelated.map(p => ({
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
  } catch { /* silently fail */ }

  // Breadcrumb segments
  const breadcrumbs = [
    { label: t("title"), href: `${prefix}/shop` },
  ];
  if (product.productLine) {
    breadcrumbs.push({
      label: product.productLine.name,
      href: `${prefix}/shop?line=${product.productLine.slug}`,
    });
  }
  if (product.productCategory) {
    const lineSlug = product.productLine?.slug || '';
    breadcrumbs.push({
      label: product.productCategory.name,
      href: `${prefix}/shop?line=${lineSlug}&category=${product.productCategory.slug}`,
    });
  }

  return (
    <div className="bg-cream min-h-screen">
      <JsonLdProduct product={productForCart} url={`${siteUrl}/${locale}/shop/${product.slug}`} productId={product.id} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Enhanced Breadcrumb */}
        <nav className="mb-8 text-sm text-charcoal/50 flex items-center gap-2 flex-wrap">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-2">
              <Link href={crumb.href} className="hover:text-gold transition">
                {crumb.label}
              </Link>
              <span>/</span>
            </span>
          ))}
          <span className="text-charcoal font-medium">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <ProductGallery images={allImages} videos={allVideos} productName={product.name} />

          {/* Details */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-4">
              {isComingSoon ? (
                <Badge variant="warning">
                  {t("comingSoon")}
                </Badge>
              ) : (
                <Badge
                  variant={product.stockQuantity > 0 ? "success" : "error"}
                >
                  {product.stockQuantity > 0 ? t("inStock") : t("outOfStock")}
                </Badge>
              )}
              {/* Product Line Badge */}
              {product.productLine && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: `${product.productLine.badgeColor || '#CBA153'}15`,
                    color: product.productLine.badgeColor || '#CBA153',
                    border: `1px solid ${product.productLine.badgeColor || '#CBA153'}30`,
                  }}
                >
                  {product.productLine.name}
                </span>
              )}
            </div>

            {/* Category label */}
            {product.productCategory && (
              <p className="text-[11px] text-gold/70 uppercase tracking-widest font-medium mb-2">
                {product.productCategory.name}
              </p>
            )}

            <h1 className="font-serif text-3xl sm:text-4xl text-charcoal mb-4">
              {product.name}
            </h1>

            {isComingSoon ? (
              <p className="text-lg text-amber-600 font-semibold mb-6">
                {t("comingSoon")}
              </p>
            ) : (
              <p className="text-2xl text-gold font-semibold mb-6">
                {formatCurrency(parseFloat(product.priceB2c) || 0)}
              </p>
            )}

            <p className="text-charcoal/70 leading-relaxed mb-8">
              {product.description}
            </p>

            {/* Product details */}
            <div className="space-y-3 mb-8 border-t border-border-light pt-6">
              {product.flavorProfile && (
                <div>
                  <span className="text-sm font-medium text-charcoal/50 uppercase tracking-wider">
                    {t("flavorProfile")}
                  </span>
                  <p className="text-charcoal/80 mt-1">{product.flavorProfile}</p>
                </div>
              )}
              {product.pairsWith && (
                <div>
                  <span className="text-sm font-medium text-charcoal/50 uppercase tracking-wider">
                    {t("pairsWith")}
                  </span>
                  <p className="text-charcoal/80 mt-1">{product.pairsWith}</p>
                </div>
              )}
              {product.weight && (
                <div>
                  <span className="text-sm font-medium text-charcoal/50 uppercase tracking-wider">
                    {t("weight")}
                  </span>
                  <p className="text-charcoal/80 mt-1">{product.weight}</p>
                </div>
              )}
              {product.ingredients && (
                <div>
                  <span className="text-sm font-medium text-charcoal/50 uppercase tracking-wider">
                    {t("ingredients")}
                  </span>
                  <p className="text-charcoal/80 mt-1">{product.ingredients}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              {isComingSoon ? (
                <div className="w-full sm:w-auto px-10 py-4 bg-amber-100 text-amber-700 font-bold rounded-sm tracking-widest uppercase text-center text-sm">
                  {t("comingSoon")}
                </div>
              ) : (
                <>
                  <AddToCartButton product={productForCart} />
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                    {common("buyOnAmazon")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <ProductReviews productId={product.id} productSlug={product.slug} />

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-20 pt-12 border-t border-border-light">
            <div className="text-center mb-10">
              <span className="inline-block w-12 h-0.5 bg-gold mb-4" />
              <h2 className="font-serif text-2xl sm:text-3xl text-charcoal">
                {t("alsoInCollection")}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {relatedProducts.map(rp => (
                <ProductCard key={rp.id} product={rp} locale={locale} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
