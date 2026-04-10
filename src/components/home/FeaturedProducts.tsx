import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Product } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

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
          <p className="text-charcoal/60 max-w-xl mx-auto">
            {t("featuredSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`${prefix}/shop/${product.slug}`}
              className="group"
            >
              <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-border-light hover:shadow-md transition-shadow duration-300">
                {/* Product Image */}
                <div className="aspect-[4/3] relative bg-cream">
                  <img
                    src={product.imageUrl || 'https://images.unsplash.com/photo-1447078806655-40579c2520d6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'}
                    alt={product.name}
                    className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition duration-500"
                  />
                </div>

                <div className="p-6">
                  <h3 className="font-serif text-xl text-charcoal mb-2 group-hover:text-gold transition">
                    {product.name}
                  </h3>
                  <p className="text-sm text-charcoal/60 mb-4 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-gold">
                      {formatCurrency(product.priceB2c)}
                    </span>
                    <span className="text-sm text-charcoal/50">
                      {common("viewDetails")} &rarr;
                    </span>
                  </div>
                </div>
              </div>
            </Link>
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
