"use client";

import { useTranslations, useLocale } from "next-intl";
import { useCart } from "@/providers/CartProvider";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export default function CartPage() {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { items, removeItem, updateQuantity, subtotal } = useCart();
  const prefix = locale === "en" ? "" : `/${locale}`;

  if (items.length === 0) {
    return (
      <div className="bg-cream min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <span className="inline-block w-12 h-0.5 bg-gold mb-6" />
          <h1 className="font-serif text-3xl text-charcoal mb-4">{t("title")}</h1>
          <p className="text-charcoal/60 mb-8">{t("empty")}</p>
          <Link href={`${prefix}/shop`}>
            <Button variant="primary">{t("continueShopping")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h1 className="font-serif text-3xl sm:text-4xl text-charcoal mb-10">{t("title")}</h1>

        {/* Cart items */}
        <div className="space-y-4 mb-10">
          {items.map((item) => (
            <div
              key={item.product.id}
              className="bg-white rounded-lg p-6 shadow-sm border border-border-light flex flex-col sm:flex-row items-start sm:items-center gap-4"
            >
              {/* Product image placeholder */}
              <div className="w-20 h-20 bg-gradient-to-br from-cream to-gold/10 rounded flex items-center justify-center flex-shrink-0">
                <span className="font-serif text-2xl text-gold/30">C</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-lg text-charcoal">{item.product.name}</h3>
                <p className="text-gold font-semibold">{formatCurrency(item.product.priceB2c)}</p>
              </div>

              {/* Quantity */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-charcoal/50">{t("quantity")}:</label>
                <select
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.product.id, Number(e.target.value))}
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:border-gold focus:ring-1 focus:ring-gold outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {/* Subtotal + Remove */}
              <div className="flex items-center gap-4">
                <span className="font-medium text-charcoal min-w-[80px] text-right">
                  {formatCurrency(item.product.priceB2c * item.quantity)}
                </span>
                <button
                  onClick={() => removeItem(item.product.id)}
                  className="text-charcoal/30 hover:text-red-500 transition"
                  aria-label={t("remove")}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-border-light">
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-charcoal/60">
              <span>{t("subtotal")}</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-charcoal/60">
              <span>{t("shipping")}</span>
              <span className="text-sm">{t("shippingCalc")}</span>
            </div>
            <div className="border-t border-border-light pt-3 flex justify-between">
              <span className="font-serif text-xl text-charcoal">{t("total")}</span>
              <span className="font-serif text-xl text-charcoal">{formatCurrency(subtotal)}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href={`${prefix}/checkout`} className="flex-1">
              <Button variant="primary" size="lg" className="w-full">
                {t("checkout")}
              </Button>
            </Link>
            <Link href={`${prefix}/shop`}>
              <Button variant="outline" size="lg">
                {t("continueShopping")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
