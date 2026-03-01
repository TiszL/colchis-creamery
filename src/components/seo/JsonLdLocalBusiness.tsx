export function JsonLdLocalBusiness() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Colchis Creamery",
    description:
      "Authentic Georgian artisanal cheese, handcrafted in Ohio with premium local milk.",
    url: "https://colchiscreamery.com",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Columbus",
      addressRegion: "OH",
      addressCountry: "US",
    },
    priceRange: "$$",
    servesCuisine: "Georgian",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Artisanal Georgian Cheese",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
