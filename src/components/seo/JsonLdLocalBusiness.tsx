import type { PrimaryLocation } from "@/lib/business-location";

// LocalBusiness rich-result schema. Address/geo/phone come from the primary
// location (single source of truth) so the schema can never drift from the
// footer/contact page. Google needs image + address (with geo + hours) to
// render a LocalBusiness result; a bare address won't validate for the local
// pack.
export function JsonLdLocalBusiness({ primary }: { primary?: PrimaryLocation }) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Colchis Food",
    description:
      "Authentic Georgian dairy crafted exclusively from 100% Grass-Fed A2 Brown Swiss Milk. Heritage recipes from ancient Colchian traditions, handcrafted fresh in Ohio.",
    url: "https://colchisfood.com",
    logo: "https://colchisfood.com/icon.png",
    image: "https://colchisfood.com/icon.png",
    address: {
      "@type": "PostalAddress",
      streetAddress: primary?.addressLine1 ?? "84 N High St",
      addressLocality: primary?.city ?? "Dublin",
      addressRegion: primary?.state ?? "OH",
      postalCode: primary?.postalCode ?? "43017",
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

  const lat = primary?.latitude;
  const lng = primary?.longitude;
  if (typeof lat === "number" && typeof lng === "number") {
    jsonLd.geo = { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
  }
  if (primary?.phone) jsonLd.telephone = primary.phone;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
