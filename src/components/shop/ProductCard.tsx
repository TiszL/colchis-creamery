import Link from "next/link";
import Image from "next/image";
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

  const isComingSoon = product.status === 'COMING_SOON';
  const isOutOfStock = product.stockQuantity <= 0;

  const lineName = product.productLine?.name;
  const lineColor = product.productLine?.badgeColor || '#CBA153';
  const categoryName = product.productCategory?.name;

  return (
    <Link href={`${prefix}/shop/${product.slug}`} className="group animate-filter-in">
      <div className={`bg-white rounded-lg overflow-hidden shadow-sm border border-border-light hover:shadow-md transition-all duration-300 ${isComingSoon ? 'ring-1 ring-amber-300/30' : ''}`}>
        {/* Image */}
        <div className="relative aspect-[4/3] bg-cream flex items-center justify-center overflow-hidden">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={`object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-500 ${isComingSoon ? 'opacity-80' : ''}`}
          />
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
            {isComingSoon ? (
              <Badge variant="warning">
                {t("comingSoon")}
              </Badge>
            ) : (
              <Badge variant={isOutOfStock ? "error" : "success"}>
                {isOutOfStock ? t("outOfStock") : t("inStock")}
              </Badge>
            )}
          </div>
          {/* Product Line Badge */}
          {lineName && (
            <div className="absolute top-3 left-3">
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full backdrop-blur-sm"
                style={{
                  backgroundColor: `${lineColor}18`,
                  color: lineColor,
                  border: `1px solid ${lineColor}30`,
                }}
              >
                {lineName}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {categoryName && (
            <p className="text-[11px] text-gold-text/80 uppercase tracking-widest font-medium mb-1.5">
              {categoryName}
            </p>
          )}
          <h3 className="font-serif text-xl text-charcoal mb-2 group-hover:text-gold-text transition">
            {product.name}
          </h3>
          <p className="text-sm text-charcoal/75 mb-4 line-clamp-2">
            {product.description}
          </p>
          <div className="flex items-center justify-between">
            {isComingSoon ? (
              <span className="text-lg font-semibold text-amber-700 tracking-wide">
                {t("comingSoon")}
              </span>
            ) : (
              <span className="text-xl font-semibold text-gold-text">
                {formatCurrency(product.priceB2c)}
              </span>
            )}
            <span className="text-sm text-charcoal/60 group-hover:text-gold-text transition">
              {common("viewDetails")} &rarr;
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

