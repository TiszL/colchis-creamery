export function JsonLdLocalBusiness() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Colchis Creamery",
    description:
      "Authentic Georgian dairy crafted exclusively from 100% Grass-Fed A2 Brown Swiss Milk. Heritage recipes from ancient Colchian traditions, handcrafted fresh in Ohio.",
    url: "https://colchiscreamery.com",
    logo: "https://colchiscreamery.com/icon.png",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Columbus",
      addressRegion: "OH",
      addressCountry: "US",
    },
    priceRange: "$$",
    servesCuisine: "Georgian",
    knowsAbout: [
      "A2 Brown Swiss milk",
      "Georgian cheese",
      "Sulguni",
      "artisanal cheesemaking",
      "grass-fed dairy",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Authentic Georgian A2 Dairy — Colchis Reserve™ & Colchis Classic",
      itemListElement: [
        {
          "@type": "OfferCatalog",
          name: "Colchis Reserve™ — Small-Batch Artisanal",
          description: "Premium handcrafted Georgian dairy, LTLT slow-pasteurized from 100% Grass-Fed A2 Brown Swiss Milk",
        },
        {
          "@type": "OfferCatalog",
          name: "Colchis Classic — Everyday Excellence",
          description: "Approachable Georgian dairy essentials made from the same exceptional A2 Brown Swiss Milk",
        },
      ],
    },
    sameAs: [],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
