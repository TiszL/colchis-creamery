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

interface ProductPageProps {
  params: Promise<{ locale: string; productId: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale, productId } = await params;
  const product = await prisma.product.findFirst({
    where: { OR: [{ slug: productId }, { id: productId }], isActive: true },
  });

  if (!product) {
    return { title: "Product Not Found" };
  }

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: `${product.name} | Colchis Creamery`,
      description: product.description,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, productId } = await params;
  const product = await prisma.product.findFirst({
    where: { OR: [{ slug: productId }, { id: productId }], isActive: true, isB2cVisible: true },
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
  };

  return (
    <div className="bg-cream min-h-screen">
      <JsonLdProduct product={productForCart} url={`${siteUrl}/${locale}/shop/${product.slug}`} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-charcoal/50">
          <Link href={`${prefix}/shop`} className="hover:text-gold transition">
            {t("title")}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <ProductGallery images={allImages} videos={allVideos} productName={product.name} />

          {/* Details */}
          <div className="flex flex-col justify-center">
            <Badge
              variant={product.stockQuantity > 0 ? "success" : "error"}
              className="mb-4 self-start"
            >
              {product.stockQuantity > 0 ? t("inStock") : t("outOfStock")}
            </Badge>

            <h1 className="font-serif text-3xl sm:text-4xl text-charcoal mb-4">
              {product.name}
            </h1>

            <p className="text-2xl text-gold font-semibold mb-6">
              {formatCurrency(parseFloat(product.priceB2c) || 0)}
            </p>

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
              <AddToCartButton product={productForCart} />
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                {common("buyOnAmazon")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
