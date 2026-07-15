import Link from "next/link";
import { prisma } from "@/lib/db";
import { NewsletterForm } from "./NewsletterForm";

function ArticleArt({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <div style={{ width: "100%", aspectRatio: "16/9", background: bg, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(45deg, transparent 0 14px, ${fg}10 14px 15px)`, opacity: 0.6 }} />
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.3em", color: fg, opacity: 0.7, textTransform: "uppercase", position: "relative" }}>[ {label} ]</div>
    </div>
  );
}

function RecipeArt({ slug }: { slug: string }) {
  const seed = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const treat = seed % 4;
  const p = [
    { bg: "#EAE2D2", fg: "#1F3026" },
    { bg: "#1F3026", fg: "#8B4A28" },
    { bg: "#B96A3D", fg: "#F5F0E6" },
    { bg: "#2C3D33", fg: "#F5F0E6" },
  ][treat];
  return (
    <div style={{ width: "100%", aspectRatio: "16/9", background: p.bg, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at 30% 30%, ${p.fg}22 0 1px, transparent 1px)`, backgroundSize: "12px 12px", opacity: 0.7 }} />
    </div>
  );
}

function RecipeArtSmall({ slug }: { slug: string }) {
  const seed = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const treat = seed % 4;
  const p = [
    { bg: "#EAE2D2", fg: "#1F3026" },
    { bg: "#1F3026", fg: "#8B4A28" },
    { bg: "#B96A3D", fg: "#F5F0E6" },
    { bg: "#2C3D33", fg: "#F5F0E6" },
  ][treat];
  return (
    <div style={{ width: "100%", aspectRatio: "1/1", background: p.bg, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at 30% 30%, ${p.fg}22 0 1px, transparent 1px)`, backgroundSize: "12px 12px", opacity: 0.7 }} />
    </div>
  );
}

function getArtColors(tags: string | null): { bg: string; fg: string; label: string } {
  const t = (tags || "").toLowerCase();
  if (t.includes("heritage")) return { bg: "#1F3026", fg: "#8B4A28", label: "Heritage" };
  if (t.includes("sourcing")) return { bg: "#EAE2D2", fg: "#1F3026", label: "Sourcing" };
  if (t.includes("field")) return { bg: "#2C3D33", fg: "#8B4A28", label: "Field Notes" };
  if (t.includes("press")) return { bg: "#F5F0E6", fg: "#1F3026", label: "Press" };
  if (t.includes("updates")) return { bg: "#B96A3D", fg: "#F5F0E6", label: "Updates" };
  return { bg: "#EAE2D2", fg: "#1F3026", label: tags || "Article" };
}

function getReadMin(content: string): number {
  return Math.max(2, Math.ceil(content.split(/\s+/).length / 200));
}

function getRecipeMeta(contentBlocks: string | null): { cuisine: string; ka: string; timeLabel: string; serves: string } {
  try {
    const cb = contentBlocks ? JSON.parse(contentBlocks) : {};
    return { cuisine: cb.cuisine || "Traditional", ka: cb.ka || "", timeLabel: cb.timeLabel || "", serves: cb.serves || "4" };
  } catch {
    return { cuisine: "Traditional", ka: "", timeLabel: "", serves: "4" };
  }
}

export async function EditorialStrip({ locale }: { locale: string }) {
  const prefix = locale === "en" ? "" : `/${locale}`;

  const [articles, recipes] = await Promise.all([
    prisma.article.findMany({ where: { isPublished: true }, orderBy: { publishedAt: "desc" }, take: 5 }),
    prisma.recipe.findMany({ where: { isPublished: true }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  if (articles.length === 0 && recipes.length === 0) return null;

  const featuredArticle = articles[0];
  const moreArticles = articles.slice(1, 3);
  const featuredRecipe = recipes[0];
  const moreRecipes = recipes.slice(1, 3);

  return (
    <section className="ch-section" style={{ background: "#EAE2D2", padding: "120px 56px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        {/* Section header */}
        <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 56 }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ 06 — Read · cook · know</div>
            <h2 className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 64, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#1F3026", marginTop: 14 }}>
              The journal & <em style={{ color: "#B96A3D", fontWeight: 400 }}>the kitchen.</em>
            </h2>
            <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 19, lineHeight: 1.55, color: "#2C3D33", maxWidth: 560, marginTop: 18 }}>
              We write about Georgian food and the people who make it. We publish recipes you can actually make tonight. Both, all in one place.
            </p>
          </div>
          <div className="ch-edit-tabs ch-hide-mobile" style={{ display: "flex", border: "1px solid #1F302622", minWidth: 380 }}>
            <div style={{ flex: 1, padding: "20px 24px", background: "#F5F0E6", borderTop: "3px solid #B96A3D" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#B96A3D", textTransform: "uppercase" }}>Stories</div>
              <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "#1F3026", marginTop: 6 }}>{articles.length} essays & news</div>
            </div>
            <div style={{ flex: 1, padding: "20px 24px", borderTop: "3px solid transparent" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>Recipes</div>
              <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "#1F3026", marginTop: 6 }}>{recipes.length} traditional & modern</div>
            </div>
          </div>
        </div>

        {/* TWO-COLUMN MOSAIC */}
        <div className="ch-edit-mosaic" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
          {/* Stories column */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", color: "#1F3026", textTransform: "uppercase" }}>From the journal</div>
              <Link href={`${prefix}/journal`} style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#B96A3D", textDecoration: "none", textTransform: "uppercase", borderBottom: "1px solid #B96A3D" }}>All stories →</Link>
            </div>
            {featuredArticle && (
              <Link href={`${prefix}/journal/${featuredArticle.slug}`} style={{ display: "block", textDecoration: "none", color: "#1F3026", marginBottom: 28 }}>
                {featuredArticle.coverImage ? (
                  <img src={featuredArticle.coverImage} alt={featuredArticle.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }} />
                ) : (
                  <ArticleArt {...getArtColors(featuredArticle.tags)} />
                )}
                <div style={{ paddingTop: 18 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: "#B96A3D", textTransform: "uppercase" }}>{featuredArticle.tags || "Essay"} · {getReadMin(featuredArticle.content)} min</div>
                  <div style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 30, lineHeight: 1.12, letterSpacing: "-0.01em", marginTop: 10, color: "#1F3026" }}>{featuredArticle.title}</div>
                  {featuredArticle.excerpt && <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 17, lineHeight: 1.55, color: "#2C3D33", marginTop: 10 }}>{featuredArticle.excerpt}</div>}
                </div>
              </Link>
            )}
            <div style={{ borderTop: "1px solid #1F302622" }}>
              {moreArticles.map(a => {
                const colors = getArtColors(a.tags);
                return (
                  <Link key={a.slug} href={`${prefix}/journal/${a.slug}`} className="ch-edit-list-row" style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 18, padding: "20px 0", borderBottom: "1px solid #1F302611", textDecoration: "none", color: "#1F3026", alignItems: "start" }}>
                    {a.coverImage ? (
                      <img src={a.coverImage} alt={a.title} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "1/1", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: colors.fg, opacity: 0.6, textTransform: "uppercase" }}>[ {colors.label} ]</div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase" }}>{a.tags}</div>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, lineHeight: 1.2, color: "#1F3026", marginTop: 4 }}>{a.title}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase", marginTop: 6 }}>
                        {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""} · {getReadMin(a.content)} min
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Recipes column */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", color: "#1F3026", textTransform: "uppercase" }}>What to cook</div>
              <Link href={`${prefix}/recipes`} style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#B96A3D", textDecoration: "none", textTransform: "uppercase", borderBottom: "1px solid #B96A3D" }}>All recipes →</Link>
            </div>
            {featuredRecipe && (() => {
              const rm = getRecipeMeta(featuredRecipe.contentBlocks);
              return (
                <Link href={`${prefix}/recipes/${featuredRecipe.slug}`} style={{ display: "block", textDecoration: "none", color: "#F5F0E6", background: "#1F3026", marginBottom: 28 }}>
                  {featuredRecipe.imageUrl ? (
                    <img src={featuredRecipe.imageUrl} alt={featuredRecipe.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }} />
                  ) : (
                    <RecipeArt slug={featuredRecipe.slug} />
                  )}
                  <div style={{ padding: "20px 24px 24px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: "#8B4A28", textTransform: "uppercase" }}>
                      {rm.cuisine} · ◐ {featuredRecipe.prepTime || "1 hr"} · serves {featuredRecipe.servings || "4"}
                    </div>
                    <div style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 30, lineHeight: 1.12, letterSpacing: "-0.01em", marginTop: 10, color: "#F5F0E6" }}>{featuredRecipe.title}</div>
                    {rm.ka && <div style={{ fontFamily: "var(--font-serif-ka, 'Noto Serif Georgian', serif)", fontSize: 16, color: "#8B4A28", marginTop: 6 }}>{rm.ka}</div>}
                    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 16, lineHeight: 1.55, color: "#F5F0E6", opacity: 0.8, marginTop: 10 }}>{featuredRecipe.description}</div>
                  </div>
                </Link>
              );
            })()}
            <div style={{ borderTop: "1px solid #1F302622" }}>
              {moreRecipes.map(r => {
                const rm = getRecipeMeta(r.contentBlocks);
                return (
                  <Link key={r.slug} href={`${prefix}/recipes/${r.slug}`} className="ch-edit-list-row" style={{ display: "grid", gridTemplateColumns: "100px 1fr auto", gap: 18, padding: "20px 0", borderBottom: "1px solid #1F302611", textDecoration: "none", color: "#1F3026", alignItems: "center" }}>
                    <RecipeArtSmall slug={r.slug} />
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase" }}>{rm.cuisine} · {r.prepTime || "1 hr"}</div>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, lineHeight: 1.2, color: "#1F3026", marginTop: 4 }}>{r.title}</div>
                      {rm.ka && <div style={{ fontFamily: "var(--font-serif-ka, 'Noto Serif Georgian', serif)", fontSize: 12, color: "#7A8278", marginTop: 4 }}>{rm.ka}</div>}
                    </div>
                    <div className="ch-hide-mobile" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase" }}>→</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Newsletter strip */}
        <div className="ch-newsletter" style={{ marginTop: 64, padding: "32px 40px", background: "#F5F0E6", border: "1px solid #1F302622", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#B96A3D", textTransform: "uppercase" }}>The High Street Letter</div>
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "#1F3026", marginTop: 6 }}>One essay & one recipe. Twice a month.</div>
          </div>
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}
