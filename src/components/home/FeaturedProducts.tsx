import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Product } from "@/types";
import { Button } from "@/components/ui/Button";
import { ProductCard } from "@/components/shop/ProductCard";

interface FeaturedProductsProps {
  products: Product[];
  locale: string;
}

export function FeaturedProducts({ products, locale }: FeaturedProductsProps) {
  const t = useTranslations("home");
  const common = useTranslations("common");
  const prefix = locale === "en" ? "" : `/${locale}`;

  return (
    <section className="py-20 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block w-12 h-0.5 bg-gold mb-6" />
          <h2 className="font-serif text-3xl sm:text-4xl text-charcoal mb-4">
            {t("featuredTitle")}
          </h2>
          <p className="text-charcoal/75 max-w-xl mx-auto">
            {t("featuredSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} />
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href={`${prefix}/shop`}>
            <Button variant="outline" size="md">
              {common("shopNow")}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
