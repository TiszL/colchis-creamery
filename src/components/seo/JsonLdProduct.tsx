import type { Product } from "@/types";

interface JsonLdProductProps {
  product: Product;
  url: string;
}

export function JsonLdProduct({ product, url }: JsonLdProductProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.imageUrl,
    description: product.description,
    sku: product.sku,
    brand: {
      "@type": "Brand",
      name: "Colchis Creamery",
    },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "USD",
      price: product.priceB2c,
      availability: product.stockQuantity > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: "Colchis Creamery",
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
