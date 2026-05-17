// Phase E1.7 — Breadcrumb JSON-LD.
//
// Tells Google + AI tools the hierarchy of a deep page (e.g.
// Home › Shop › Sulguni Reserve). Surfaces in Google as breadcrumb chips
// under the search result instead of the raw URL — meaningfully better CTR.
//
// Caller passes an ordered array of { name, url }. The component handles
// the schema.org wrapping. Skip the trailing page (we infer it from the list).

interface BreadcrumbItem {
    name: string;
    url: string;
}

export function JsonLdBreadcrumbList({ items }: { items: BreadcrumbItem[] }) {
    if (items.length === 0) return null;

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.name,
            item: item.url,
        })),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    );
}
