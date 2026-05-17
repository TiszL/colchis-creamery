"use client";

import { useTranslations } from "next-intl";
import { useCart } from "@/providers/CartProvider";
import { Button } from "@/components/ui/Button";
import type { Product } from "@/types";
import { useState } from "react";

interface AddToCartButtonProps {
  product: Product;
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const t = useTranslations("common");
  const shopT = useTranslations("shop");
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  // Defense-in-depth: callers should branch on isCartOrderable before mounting
  // this button, but if they don't, surface the wholesale CTA instead of letting
  // a B2B-only product slip into the cart.
  if (product.isCartOrderable === false) {
    return (
      <a href="/wholesale" className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-[#2C3D33] text-[#F5F0E6] font-mono text-xs tracking-[0.28em] uppercase no-underline">
        Request wholesale quote →
      </a>
    );
  }

  function handleAdd() {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <Button
      variant="primary"
      size="lg"
      onClick={handleAdd}
      disabled={product.stockQuantity <= 0}
      className="w-full sm:w-auto"
    >
      {added ? shopT("addedToCart") : t("addToCart")}
    </Button>
  );
}
