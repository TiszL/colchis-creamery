import { getTranslations } from "next-intl/server";
import { getActiveProducts } from "@/lib/products";
import { ProductGrid } from "@/components/shop/ProductGrid";
import type { Metadata } from "next";

interface ShopPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shop" });

  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function ShopPage({ params }: ShopPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shop" });
  const products = getActiveProducts();

  return (
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
  );
}
