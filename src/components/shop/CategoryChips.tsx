import Link from "next/link";

interface ChipCategory {
    slug: string;
    name: string;
    count: number;
}

interface CategoryChipsProps {
    /** Storefront section path (e.g. "/creamery", "/bakery", "/shop"). The
     *  active link target prepends the locale prefix automatically via `prefix`. */
    basePath: string;
    /** "/" or "/ka" — locale prefix, prepended to each Link. */
    prefix: string;
    /** All categories visible on this section, with their product counts. */
    categories: ChipCategory[];
    /** Currently active category slug, or null/undefined to show "All". */
    activeSlug: string | null;
    /** Total product count for the "All" chip. */
    totalCount: number;
    /** Section label shown in the eyebrow above the chips (e.g. "Browse by category"). */
    label?: string;
}

/**
 * Stage 4: server-rendered Category filter chips for /shop, /creamery, /bakery.
 *
 * Each chip is a plain Link that changes the `?cat=<slug>` query string —
 * no client JS needed. The page re-renders with the new filter applied
 * (server component reads searchParams and filters its product query).
 *
 * Hidden entirely when there are 0 or 1 categories, since chips with one
 * option are just visual noise.
 */
export function CategoryChips({
    basePath,
    prefix,
    categories,
    activeSlug,
    totalCount,
    label = "Browse by category",
}: CategoryChipsProps) {
    if (categories.length <= 1) return null;

    const allHref = `${prefix}${basePath}`;
    const chipHref = (slug: string) => `${prefix}${basePath}?cat=${slug}`;

    return (
        <section
            className="ch-cat-chips"
            style={{
                background: "#EAE2D2",
                borderBottom: "1px solid #1F302614",
                padding: "20px 56px",
            }}
        >
            <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                    style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: "0.28em",
                        color: "#7A8278",
                        textTransform: "uppercase",
                    }}
                >
                    {label}
                </div>
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        overflowX: "auto",
                    }}
                >
                    <CategoryChip href={allHref} active={!activeSlug} label="All" count={totalCount} />
                    {categories.map(c => (
                        <CategoryChip
                            key={c.slug}
                            href={chipHref(c.slug)}
                            active={activeSlug === c.slug}
                            label={c.name}
                            count={c.count}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}

function CategoryChip({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
    return (
        <Link
            href={href}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                textDecoration: "none",
                whiteSpace: "nowrap",
                background: active ? "#1F3026" : "transparent",
                color: active ? "#F5F0E6" : "#1F3026",
                border: `1px solid ${active ? "#1F3026" : "#1F302633"}`,
            }}
        >
            <span>{label}</span>
            <span style={{ opacity: 0.55, fontSize: 9 }}>{count}</span>
        </Link>
    );
}
