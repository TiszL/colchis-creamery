"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus, ShoppingBag, Check } from "lucide-react";
import type { Product } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/providers/CartProvider";

interface ProductCardProps {
  product: Product;
  locale: string;
}

export function ProductCard({ product, locale }: ProductCardProps) {
  const t = useTranslations("common");
  const { addItem } = useCart();
  const prefix = locale === "en" ? "" : `/${locale}`;

  const isComingSoon = product.status === 'COMING_SOON';
  const isOutOfStock = product.stockQuantity <= 0;
  const cartDisabled = isComingSoon || isOutOfStock;

  const lineName = product.productLine?.name;
  const lineColor = product.productLine?.badgeColor || '#B96A3D';
  const categoryName = product.productCategory?.name;

  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const cap = isOutOfStock ? 0 : product.stockQuantity > 0 ? product.stockQuantity : Infinity;

  const handleAdd = () => {
    if (cartDisabled) return;
    const finalQty = Math.min(qty, cap);
    if (finalQty <= 0) return;
    addItem(product, finalQty);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
    setQty(1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", background: "#F5F0E6", border: "1px solid #1F302614", overflow: "hidden" }}>
      {/* Clickable area — image + title + price → PDP */}
      <Link href={`${prefix}/shop/${product.slug}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}>
        {/* Image */}
        <div style={{ position: "relative", aspectRatio: "4/3", background: "#EAE2D2", overflow: "hidden", borderBottom: "1px solid #1F302614" }}>
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            style={{ objectFit: "cover" }}
          />
          {/* Tag badge */}
          <div style={{ position: "absolute", top: 14, left: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            {isComingSoon ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", padding: "6px 12px", background: "#B96A3D", color: "#F5F0E6" }}>Coming Soon</span>
            ) : isOutOfStock ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", padding: "6px 12px", background: "#A8312C", color: "#F5F0E6" }}>Sold Out</span>
            ) : (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", padding: "6px 12px", background: "#1F3026", color: "#F5F0E6" }}>In Stock</span>
            )}
          </div>
          {/* Product line badge */}
          {lineName && (
            <div style={{ position: "absolute", top: 14, right: 14 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", padding: "6px 12px", background: `${lineColor}18`, color: lineColor, border: `1px solid ${lineColor}44`, borderRadius: 999, fontWeight: 500 }}>{lineName}</span>
            </div>
          )}
        </div>

        {/* Title + description + price */}
        <div style={{ padding: "24px 24px 16px", display: "flex", flexDirection: "column" }}>
          {categoryName && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase", marginBottom: 6 }}>{categoryName}</div>
          )}
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 26, color: "#1F3026", lineHeight: 1.05 }}>{product.name}</div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#2C3D33", lineHeight: 1.55, marginTop: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{product.description}</p>
          <div style={{ marginTop: 14 }}>
            {isComingSoon ? (
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, color: "#B96A3D" }}>Coming Soon</span>
            ) : (
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "#1F3026", fontWeight: 500 }}>{formatCurrency(product.priceB2c)}</span>
            )}
          </div>
        </div>
      </Link>

      {/* Cart controls — outside the Link so clicks don't navigate */}
      <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
          {/* Quantity stepper */}
          <div style={{ display: "flex", alignItems: "stretch", border: "1px solid #1F302633", background: "#F5F0E6" }}>
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQty(q => Math.max(1, q - 1))}
              disabled={qty <= 1 || cartDisabled}
              style={{ width: 44, height: 44, border: "none", background: "transparent", cursor: (qty <= 1 || cartDisabled) ? "not-allowed" : "pointer", color: (qty <= 1 || cartDisabled) ? "#7A827855" : "#1F3026", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div style={{ minWidth: 36, height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 14, color: "#1F3026", borderLeft: "1px solid #1F302622", borderRight: "1px solid #1F302622" }}>
              {qty}
            </div>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQty(q => Math.min(cap, q + 1))}
              disabled={qty >= cap || cartDisabled}
              style={{ width: 44, height: 44, border: "none", background: "transparent", cursor: (qty >= cap || cartDisabled) ? "not-allowed" : "pointer", color: (qty >= cap || cartDisabled) ? "#7A827855" : "#1F3026", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Add button */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={cartDisabled}
            style={{
              flex: 1,
              height: 44,
              background: cartDisabled ? "#7A8278" : justAdded ? "#2C3D33" : "#B96A3D",
              color: "#F5F0E6",
              border: "none",
              cursor: cartDisabled ? "not-allowed" : "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background-color 200ms",
              opacity: cartDisabled ? 0.6 : 1,
            }}
          >
            {isComingSoon ? 'Soon' : isOutOfStock ? 'Sold out' : justAdded ? (
              <><Check className="w-3.5 h-3.5" /> Added</>
            ) : (
              <><ShoppingBag className="w-3.5 h-3.5" /> {t("addToCart")}</>
            )}
          </button>
        </div>
        {!isOutOfStock && product.stockQuantity > 0 && product.stockQuantity <= 5 && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#A8312C", textTransform: "uppercase" }}>
            Only {product.stockQuantity} left
          </div>
        )}
      </div>
    </div>
  );
}
