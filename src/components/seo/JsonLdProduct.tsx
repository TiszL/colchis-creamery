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

  const jsonLd: Record<string, any> = {
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
    material: product.ingredients || "100% Grass-Fed A2 Brown Swiss Milk",
    category: product.productCategory?.name
      ? `${product.productLine?.name || 'Colchis Creamery'} — ${product.productCategory.name}`
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
        name: "Colchis Creamery",
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
