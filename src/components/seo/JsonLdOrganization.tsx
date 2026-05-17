// Phase E1.7 — Organization-level JSON-LD.
//
// Mounted at root so every crawled page surfaces the central business entity.
// Complements JsonLdLocalBusiness (which is specifically about the brick-and-
// mortar bakery). Organization is the higher-level brand entity that ties
// social profiles, founders, etc. together for entity recognition by Google +
// AI tools (ChatGPT/Perplexity/Claude use sameAs to cross-reference accounts).
//
// Social URLs come from SiteConfig (social_instagram etc.) so admins can edit
// them in /admin/website/settings without redeploying. Empty entries are filtered
// out — search engines reject empty sameAs URLs.

interface Props {
    /** Optional social URLs sourced from SiteConfig. Strings only — empty/null skipped. */
    socials?: {
        instagram?: string | null;
        facebook?: string | null;
        twitter?: string | null;
        tiktok?: string | null;
        linkedin?: string | null;
        youtube?: string | null;
    };
}

export function JsonLdOrganization({ socials }: Props = {}) {
    const sameAs: string[] = [];
    if (socials) {
        for (const url of [
            socials.instagram,
            socials.facebook,
            socials.twitter,
            socials.tiktok,
            socials.linkedin,
            socials.youtube,
        ]) {
            if (url && url.trim() && /^https?:\/\//.test(url.trim())) {
                sameAs.push(url.trim());
            }
        }
    }

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Colchis Food",
        legalName: "Colchis Food LLC",
        alternateName: ["Colchis Creamery", "Colchis"],
        description:
            "Georgian artisanal cheese and bread — sulguni, imeruli, hot khachapuri — hand-pressed and baked in Dublin, Ohio. The Creamery ships nationwide; the Bakery delivers in 25 minutes.",
        url: "https://colchisfood.com",
        logo: {
            "@type": "ImageObject",
            url: "https://colchisfood.com/icon.png",
        },
        foundingLocation: {
            "@type": "Place",
            name: "Dublin, Ohio, USA",
        },
        knowsAbout: [
            "Georgian cheese",
            "sulguni",
            "imeruli",
            "khachapuri",
            "adjaruli khachapuri",
            "A2 Brown Swiss milk",
            "Georgian heritage cuisine",
            "artisanal cheesemaking",
            "hand-pressed cheese",
        ],
        ...(sameAs.length > 0 ? { sameAs } : {}),
        contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            email: "hello@colchisfood.com",
            availableLanguage: ["English", "Georgian", "Russian", "Spanish"],
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    );
}
