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
