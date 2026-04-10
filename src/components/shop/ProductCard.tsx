import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Product } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

interface ProductCardProps {
  product: Product;
  locale: string;
}

export function ProductCard({ product, locale }: ProductCardProps) {
  const t = useTranslations("shop");
  const common = useTranslations("common");
  const prefix = locale === "en" ? "" : `/${locale}`;

  return (
    <Link href={`${prefix}/shop/${product.slug}`} className="group">
      <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-border-light hover:shadow-md transition-all duration-300">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-cream flex items-center justify-center overflow-hidden">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-3 right-3">
            <Badge variant={product.stockQuantity > 0 ? "success" : "error"}>
              {product.stockQuantity > 0 ? t("inStock") : t("outOfStock")}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="font-serif text-xl text-charcoal mb-2 group-hover:text-gold transition">
            {product.name}
          </h3>
          <p className="text-sm text-charcoal/60 mb-4 line-clamp-2">
            {product.description}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xl font-semibold text-gold">
              {formatCurrency(product.priceB2c)}
            </span>
            <span className="text-sm text-charcoal/40 group-hover:text-gold transition">
              {common("viewDetails")} &rarr;
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
