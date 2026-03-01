import { getTranslations } from "next-intl/server";
import { getProduct, getActiveProducts } from "@/lib/products";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { JsonLdProduct } from "@/components/seo/JsonLdProduct";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import type { Metadata } from "next";

interface ProductPageProps {
  params: Promise<{ locale: string; productId: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale, productId } = await params;
  const product = getProduct(productId);

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
  const product = getProduct(productId);
  const t = await getTranslations({ locale, namespace: "shop" });
  const common = await getTranslations({ locale, namespace: "common" });
  const prefix = locale === "en" ? "" : `/${locale}`;

  if (!product) {
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://colchiscreamery.com";

  return (
    <div className="bg-cream min-h-screen">
      <JsonLdProduct product={product} url={`${siteUrl}/${locale}/shop/${product.slug}`} />

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
          {/* Image */}
          <div className="aspect-square relative bg-cream rounded-lg overflow-hidden border border-border-light shadow-sm">
            <img
              src={product.slug === 'aged-sulguni'
                ? 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'
                : product.slug === 'smoked-sulguni'
                  ? 'https://images.unsplash.com/photo-1559561853-08451507cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'
                  : 'https://images.unsplash.com/photo-1447078806655-40579c2520d6?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'
              }
              alt={product.name}
              className="w-full h-full object-cover mix-blend-multiply"
            />
          </div>

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
              {formatCurrency(product.priceB2c)}
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
              <AddToCartButton product={product} />
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
