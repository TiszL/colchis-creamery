import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';

// Convert free-form duration strings ("1 hour", "30 min", "1h30m", "PT1H30M",
// "1:30") into ISO 8601 duration (e.g. "PT1H30M"). Returns null when the input
// can't be parsed — we'd rather omit the field than emit invalid markup that
// triggers Google's structured-data validator.
function toIso8601Duration(input: string | null | undefined): string | null {
    if (!input) return null;
    const s = input.trim();

    if (/^PT\d+([HMS]\d*)*$/i.test(s)) return s.toUpperCase();

    const colonMatch = s.match(/^(\d+):(\d+)$/);
    if (colonMatch) {
        const h = parseInt(colonMatch[1], 10);
        const m = parseInt(colonMatch[2], 10);
        if (h === 0 && m === 0) return null;
        return `PT${h > 0 ? `${h}H` : ''}${m > 0 ? `${m}M` : ''}`;
    }

    const lower = s.toLowerCase();
    const hourMatch = lower.match(/(\d+)\s*(?:h(?:ours?|rs?)?)\b/);
    const minMatch = lower.match(/(\d+)\s*(?:m(?:in(?:ute)?s?)?)\b/);
    const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
    const minutes = minMatch ? parseInt(minMatch[1], 10) : 0;
    if (hours === 0 && minutes === 0) return null;
    return `PT${hours > 0 ? `${hours}H` : ''}${minutes > 0 ? `${minutes}M` : ''}`;
}

interface RecipePageProps {
    params: Promise<{ locale: string; slug: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: RecipePageProps): Promise<Metadata> {
    const { locale, slug } = await params;
    const recipe = await prisma.recipe.findFirst({ where: { slug, isPublished: true } });
    if (!recipe) return { title: 'Recipe Not Found' };
    const canonicalPath = locale === 'en' ? `/recipes/${slug}` : `/${locale}/recipes/${slug}`;
    return {
        title: `${recipe.title} | Recipes`,
        description: recipe.description,
        openGraph: {
            title: recipe.title,
            description: recipe.description,
            images: recipe.imageUrl ? [{ url: recipe.imageUrl, width: 1200, height: 675, alt: recipe.title }] : [],
            type: 'article',
            siteName: 'Colchis Food',
            url: `${SITE_URL}${canonicalPath}`,
        },
        alternates: {
            canonical: `${SITE_URL}${canonicalPath}`,
            languages: {
                'en': `${SITE_URL}/recipes/${slug}`,
                'ka': `${SITE_URL}/ka/recipes/${slug}`,
                'ru': `${SITE_URL}/ru/recipes/${slug}`,
                'es': `${SITE_URL}/es/recipes/${slug}`,
                'x-default': `${SITE_URL}/recipes/${slug}`,
            },
        },
    };
}

function RecipeArt({ slug, ratio = "4/5" }: { slug: string; ratio?: string }) {
    const seed = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const treat = seed % 4;
    const p = [
        { bg: "#EAE2D2", fg: "#1F3026", glyph: "○" },
        { bg: "#1F3026", fg: "#8B4A28", glyph: "◐" },
        { bg: "#B96A3D", fg: "#F5F0E6", glyph: "✶" },
        { bg: "#2C3D33", fg: "#F5F0E6", glyph: "▸" },
    ][treat];
    return (
        <div style={{ width: "100%", aspectRatio: ratio, background: p.bg, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at 30% 30%, ${p.fg}22 0 1px, transparent 1px)`, backgroundSize: "12px 12px", opacity: 0.7 }} />
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 88, color: p.fg, opacity: 0.5, position: "relative" }}>{p.glyph}</div>
        </div>
    );
}

// Default ingredients/steps (placeholder for DB content)
const DEFAULT_INGREDIENTS = [
    { group: "Dough", items: ["500g bread flour", "300ml warm milk", "7g instant yeast", "10g fine salt", "1 tbsp olive oil", "1 tsp sugar"] },
    { group: "Filling & top", items: ["300g Colchis Sulguni Fresh, shredded", "200g Colchis Imeruli, crumbled", "4 egg yolks", "60g cold butter, in cubes", "Flaky salt", "Black pepper"] },
];
const DEFAULT_STEPS = [
    { t: "Bloom the yeast", d: "Stir yeast and sugar into warm milk and let it foam — 8 minutes." },
    { t: "Mix and knead", d: "Combine flour, salt, oil. Pour in the yeast milk. Knead 10 minutes by hand." },
    { t: "First rise", d: "Cover and let rise in a warm spot until doubled — 60 to 90 minutes." },
    { t: "Shape", d: "Divide the dough and shape according to the recipe style." },
    { t: "Fill", d: "Mix the cheeses with seasoning. Fill the dough generously." },
    { t: "Bake hot", d: "Bake at highest oven temperature until golden and bubbling." },
    { t: "Serve immediately", d: "Eat while hot — this is best fresh from the oven." },
];

export default async function SingleRecipePage({ params }: RecipePageProps) {
    const { locale, slug } = await params;
    const prefix = locale === 'en' ? '' : `/${locale}`;
    const recipe = await prisma.recipe.findFirst({ where: { slug, isPublished: true } });
    if (!recipe) notFound();

    const more = await prisma.recipe.findMany({
        where: { isPublished: true, slug: { not: slug } },
        take: 3,
        orderBy: { createdAt: 'desc' },
    });

    // Parse contentBlocks for metadata. We track the *raw* parsed object
    // separately so the JSON-LD below only emits real per-recipe data — the
    // DEFAULT_INGREDIENTS/STEPS are khachapuri-flavoured visual fallbacks that
    // would be misleading if published as structured data for an arbitrary recipe.
    let meta = { cuisine: "Traditional", ka: "", pairing: "", diet: [] as string[], ingredients: DEFAULT_INGREDIENTS, steps: DEFAULT_STEPS };
    let cb: any = null;
    try {
        cb = recipe.contentBlocks ? JSON.parse(recipe.contentBlocks) : null;
        if (cb) {
            meta = {
                cuisine: cb.cuisine || "Traditional",
                ka: cb.ka || "",
                pairing: cb.pairing || "",
                diet: cb.diet || [],
                ingredients: cb.ingredients || DEFAULT_INGREDIENTS,
                steps: cb.steps || DEFAULT_STEPS,
            };
        }
    } catch { /* use defaults */ }

    const serves = recipe.servings || "4";
    const timeLabel = recipe.prepTime || "1 hour";

    // JSON-LD — emit only when we have a real image. Without an image the
    // Recipe rich result is invalid per Google; better to skip the markup
    // entirely than publish broken structured data.
    const prepTimeIso = toIso8601Duration(recipe.prepTime);
    const cookTimeIso = toIso8601Duration(recipe.cookTime);
    const totalMinutes = (() => {
        const parse = (iso: string | null) => {
            if (!iso) return 0;
            const h = parseInt(iso.match(/(\d+)H/)?.[1] ?? '0', 10);
            const m = parseInt(iso.match(/(\d+)M/)?.[1] ?? '0', 10);
            return h * 60 + m;
        };
        return parse(prepTimeIso) + parse(cookTimeIso);
    })();
    const totalTimeIso = totalMinutes > 0
        ? `PT${Math.floor(totalMinutes / 60) > 0 ? `${Math.floor(totalMinutes / 60)}H` : ''}${totalMinutes % 60 > 0 ? `${totalMinutes % 60}M` : ''}`
        : null;
    const realIngredients = Array.isArray(cb?.ingredients)
        ? (cb.ingredients as Array<{ items?: string[] }>).flatMap(g => g.items ?? [])
        : null;
    const realSteps = Array.isArray(cb?.steps)
        ? (cb.steps as Array<{ t: string; d: string }>)
        : null;
    const keywords = [meta.cuisine, ...meta.diet, 'Georgian', 'Colchis Food']
        .filter((k): k is string => !!k && k.length > 0)
        .join(', ');

    const jsonLd = recipe.imageUrl ? {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: recipe.title,
        description: recipe.description,
        image: recipe.imageUrl,
        author: { '@type': 'Organization', name: 'Colchis Food', url: SITE_URL },
        datePublished: recipe.createdAt.toISOString(),
        ...(prepTimeIso && { prepTime: prepTimeIso }),
        ...(cookTimeIso && { cookTime: cookTimeIso }),
        ...(totalTimeIso && { totalTime: totalTimeIso }),
        ...(recipe.servings && { recipeYield: recipe.servings }),
        recipeCategory: 'Georgian Cuisine',
        recipeCuisine: 'Georgian',
        keywords,
        ...(realIngredients && realIngredients.length > 0 && { recipeIngredient: realIngredients }),
        ...(realSteps && realSteps.length > 0 && {
            recipeInstructions: realSteps.map((s, i) => ({
                '@type': 'HowToStep',
                position: i + 1,
                name: s.t,
                text: s.d,
            })),
        }),
    } : null;

    return (
        <>
            {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
            <article>
                {/* Breadcrumb */}
                <div className="ch-breadcrumb" style={{ background: "#F5F0E6", padding: "24px 56px 0" }}>
                    <div style={{ maxWidth: 1120, margin: "0 auto", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>
                        <Link href={`${prefix}/`} style={{ color: "#7A8278", textDecoration: "none" }}>Colchis Food</Link>
                        <span style={{ margin: "0 10px" }}>/</span>
                        <Link href={`${prefix}/recipes`} style={{ color: "#7A8278", textDecoration: "none" }}>Recipes</Link>
                        <span style={{ margin: "0 10px" }}>/</span>
                        <span style={{ color: "#1F3026" }}>{meta.cuisine}</span>
                    </div>
                </div>

                {/* HERO: title + meta on left, photo on right */}
                <header className="ch-rec-detail-head" style={{ background: "#F5F0E6", padding: "40px 56px 64px" }}>
                    <div className="ch-rec-hero-grid" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 64, alignItems: "center" }}>
                        <div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 20 }}>{meta.cuisine} · {recipe.difficulty || "Easy"}</div>
                            <h1 className="ch-rec-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 80, lineHeight: 1.0, letterSpacing: "-0.025em", margin: 0, color: "#1F3026" }}>{recipe.title}</h1>
                            {meta.ka && <div style={{ fontFamily: "var(--font-serif-ka, 'Noto Serif Georgian', serif)", fontSize: 28, color: "#B96A3D", marginTop: 14, opacity: 0.85 }}>{meta.ka}</div>}
                            <p className="ch-rec-dek" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, lineHeight: 1.55, color: "#2C3D33", marginTop: 24, marginBottom: 0 }}>{recipe.description}</p>
                            <div className="ch-rec-meta-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 36, paddingTop: 28, borderTop: "1px solid #1F302622" }}>
                                {[
                                    { l: "Time", v: timeLabel },
                                    { l: "Serves", v: serves },
                                    { l: "Difficulty", v: recipe.difficulty || "Easy" },
                                    { l: "Pairs with", v: meta.pairing || "—" },
                                ].map(m => (
                                    <div key={m.l}>
                                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>{m.l}</div>
                                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "#1F3026", marginTop: 6, lineHeight: 1.15 }}>{m.v}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                                <button style={{ background: "#1F3026", color: "#F5F0E6", border: "none", padding: "14px 24px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Save recipe ♡</button>
                                <button style={{ background: "transparent", color: "#1F3026", border: "1px solid #1F3026", padding: "14px 24px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Print · Share</button>
                            </div>
                        </div>
                        {recipe.imageUrl ? (
                            <img src={recipe.imageUrl} alt={recipe.title} style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover" }} />
                        ) : (
                            <RecipeArt slug={recipe.slug} />
                        )}
                    </div>
                </header>

                {/* Story intro */}
                <section className="ch-section" style={{ background: "#F5F0E6", padding: "32px 56px 56px" }}>
                    <div style={{ maxWidth: 720, margin: "0 auto" }}>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 21, lineHeight: 1.65, color: "#2C3D33" }}>
                            <ContentBlockRenderer blocks={null} legacyContent={recipe.content} />
                        </div>
                    </div>
                </section>

                {/* INGREDIENTS + STEPS */}
                <section className="ch-section" style={{ background: "#F5F0E6", padding: "0 56px 96px" }}>
                    <div className="ch-rec-cook-grid" style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "320px 1fr", gap: 64, alignItems: "start" }}>
                        <aside className="ch-rec-ingredients" style={{ position: "sticky", top: 100 }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 16 }}>Ingredients</div>
                            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 32, color: "#1F3026", marginBottom: 28 }}>For {serves}</div>
                            {meta.ingredients.map((g: { group: string; items: string[] }) => (
                                <div key={g.group} style={{ marginBottom: 28 }}>
                                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase", marginBottom: 10 }}>{g.group}</div>
                                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                        {g.items.map((it: string, i: number) => (
                                            <li key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid #1F302611", fontFamily: "var(--font-sans)", fontSize: 14, color: "#1F3026", lineHeight: 1.45 }}>
                                                <input type="checkbox" style={{ accentColor: "#B96A3D", marginTop: 4 }} />
                                                <span>{it}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </aside>
                        <div className="ch-rec-steps">
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 16 }}>Method · {meta.steps.length} steps</div>
                            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 32, color: "#1F3026", marginBottom: 32 }}>
                                {timeLabel === "all day" ? "All day, mostly cooking" : `${timeLabel}, mostly waiting`}
                            </div>
                            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" }}>
                                {meta.steps.map((s: { t: string; d: string }, i: number) => (
                                    <li key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 24, padding: "28px 0", borderBottom: "1px solid #1F302614" }}>
                                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 40, fontWeight: 300, color: "#B96A3D", lineHeight: 1 }}>{String(i + 1).padStart(2, "0")}</div>
                                        <div>
                                            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 24, color: "#1F3026", lineHeight: 1.2 }}>{s.t}</div>
                                            <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, lineHeight: 1.6, color: "#2C3D33", marginTop: 10 }}>{s.d}</div>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                </section>

                {/* Pairing CTA */}
                {meta.pairing && (
                    <section className="ch-section" style={{ background: "#1F3026", color: "#F5F0E6", padding: "72px 56px" }}>
                        <div className="ch-split" style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
                            <div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#8B4A28", textTransform: "uppercase", marginBottom: 18 }}>Made with</div>
                                <div className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 48, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#F5F0E6" }}>
                                    {meta.pairing}
                                </div>
                                <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, lineHeight: 1.6, color: "#F5F0E6", opacity: 0.78, marginTop: 18, fontStyle: "italic" }}>
                                    We make this every morning in Dublin, Ohio. Order it for delivery tonight, or have it shipped overnight to anywhere in the US.
                                </p>
                            </div>
                            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                                <Link href={`${prefix}/`} style={{ display: "inline-block", background: "#B96A3D", color: "#F5F0E6", border: "none", padding: "16px 28px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Shop the Creamery →</Link>
                            </div>
                        </div>
                    </section>
                )}

                {/* More recipes */}
                {more.length > 0 && (
                    <section className="ch-section" style={{ background: "#EAE2D2", padding: "96px 56px" }}>
                        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                            <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }}>
                                <div className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 48 }}>
                                    Cook <em style={{ color: "#B96A3D", fontWeight: 400 }}>more.</em>
                                </div>
                                <Link href={`${prefix}/recipes`} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", color: "#1F3026", textTransform: "uppercase", textDecoration: "none", borderBottom: "1px solid #1F3026" }}>All recipes →</Link>
                            </div>
                            <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
                                {more.map(m => (
                                    <Link key={m.slug} href={`${prefix}/recipes/${m.slug}`} style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "#1F3026", background: "#F5F0E6", border: "1px solid #1F302614" }}>
                                        {m.imageUrl ? (
                                            <img src={m.imageUrl} alt={m.title} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} />
                                        ) : (
                                            <RecipeArt slug={m.slug} ratio="4/3" />
                                        )}
                                        <div style={{ padding: "24px 24px 26px", flex: 1, display: "flex", flexDirection: "column" }}>
                                            <h3 style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, fontSize: 26, lineHeight: 1.15, margin: 0, color: "#1F3026" }}>{m.title}</h3>
                                            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.6, color: "#2C3D33", opacity: 0.85, marginTop: 12, flex: 1 }}>{m.description}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </article>
        </>
    );
}
