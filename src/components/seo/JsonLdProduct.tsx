import type { Product } from "@/types";

interface JsonLdProductProps {
  product: Product;
  url: string;
}

export function JsonLdProduct({ product, url }: JsonLdProductProps) {
  const isComingSoon = product.status === 'COMING_SOON';

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
    // Product attributes for AI crawlers
    ...(product.weight ? { weight: { "@type": "QuantitativeValue", value: product.weight } } : {}),
    ...(product.ingredients ? { material: product.ingredients } : {}),
    category: "Artisanal Georgian Cheese",
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "USD",
      price: isComingSoon ? undefined : product.priceB2c,
      availability: isComingSoon
        ? "https://schema.org/PreOrder"
        : product.stockQuantity > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: "Colchis Creamery",
        url: "https://colchiscreamery.com",
      },
    },
    // Additional structured data for richer search results
    manufacturer: {
      "@type": "Organization",
      name: "Colchis Creamery",
      url: "https://colchiscreamery.com",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Columbus",
        addressRegion: "OH",
        addressCountry: "US",
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
