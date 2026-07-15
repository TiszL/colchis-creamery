import type { Product } from "@/types";
import { prisma } from "@/lib/db";

interface JsonLdProductProps {
  product: Product;
  url: string;
  productId?: string;
}

export async function JsonLdProduct({ product, url, productId }: JsonLdProductProps) {
  const isComingSoon = product.status === 'COMING_SOON';

  // Fetch review data for structured data
  let reviewData: {
    avgRating: number;
    reviewCount: number;
    reviews: { rating: number; title: string; body: string; userName: string; date: string }[];
  } | null = null;

  if (productId) {
    try {
      const approvedReviews = await prisma.productReview.findMany({
        where: { productId, status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true } } },
      });

      if (approvedReviews.length > 0) {
        const avgRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length;
        reviewData = {
          avgRating: Math.round(avgRating * 10) / 10,
          reviewCount: approvedReviews.length,
          reviews: approvedReviews.map(r => ({
            rating: r.rating,
            title: r.title,
            body: r.body,
            userName: r.user.name ? `${r.user.name.split(' ')[0]} ${r.user.name.split(' ')[1]?.[0] || ''}.`.trim() : 'Customer',
            date: r.createdAt.toISOString().split('T')[0],
          })),
        };
      }
    } catch {
      // Silently fail — don't break page if reviews query fails
    }
  }

  // Emit an Offer only when we have an accurate price. Coming-soon products
  // intentionally omit offers (no price to publish → schema.org Product without
  // an Offer is valid and avoids Google's "missing price" critical error).
  const hasPublishablePrice = !isComingSoon && product.priceB2c > 0;

  const offers = hasPublishablePrice
    ? {
        "@type": "Offer",
        url,
        priceCurrency: "USD",
        price: product.priceB2c,
        // Cached stockQuantity is unreliable (truth is per-location Stock);
        // made-to-order items carry 0 cached stock yet are orderable, so don't
        // publish them as OutOfStock and suppress them from Shopping results.
        availability:
          product.stockQuantity > 0 || product.isMadeToOrder
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: {
          "@type": "Organization",
          name: "Colchis Food",
          url: "https://colchisfood.com",
        },
        // Perishable artisanal goods — sale is final per /legal/returns.
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          applicableCountry: "US",
          returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
        },
        // shippingDetails intentionally omitted — fed via Google Merchant Center
        // to avoid publishing inaccurate rates/delivery times in structured data.
      }
    : null;

  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.imageUrl,
    description: product.description,
    sku: product.sku,
    brand: {
      "@type": "Brand",
      name: "Colchis Food",
    },
    // Product attributes for AI crawlers
    ...(product.weight ? { weight: { "@type": "QuantitativeValue", value: product.weight } } : {}),
    material: product.ingredients || "100% Grass-Fed A2 Brown Swiss Milk",
    category: product.productCategory?.name
      ? `${product.productLine?.name || 'Colchis Food'} — ${product.productCategory.name}`
      : product.productLine?.name || "Authentic Georgian A2 Dairy",
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Milk Source",
        value: "100% Grass-Fed A2 Brown Swiss Cow Milk",
      },
      {
        "@type": "PropertyValue",
        name: "Heritage",
        value: "Authentic Georgian dairy traditions — heritage recipes, made fresh in Ohio",
      },
    ],
    ...(offers ? { offers } : {}),
    // Additional structured data for richer search results
    manufacturer: {
      "@type": "Organization",
      name: "Colchis Food",
      url: "https://colchisfood.com",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Dublin",
        addressRegion: "OH",
        addressCountry: "US",
      },
    },
    countryOfOrigin: {
      "@type": "Country",
      name: "United States",
    },
  };

  // Add review structured data (enables Google Rich Results with stars)
  if (reviewData) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: reviewData.avgRating,
      reviewCount: reviewData.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
    jsonLd.review = reviewData.reviews.map(r => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.userName },
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      name: r.title,
      reviewBody: r.body,
      datePublished: r.date,
      publisher: {
        "@type": "Organization",
        name: "Colchis Food",
      },
    }));
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
