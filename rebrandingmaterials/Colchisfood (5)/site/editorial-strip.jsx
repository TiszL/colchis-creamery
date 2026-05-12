/* global React, ARTICLES, RECIPES, ArticleArt, RecipeArt */

// ─── EDITORIAL STRIP for homepage: 3 articles + 3 recipes, mosaic ────────
function EditorialStrip({ palette }) {
  const featuredArticle = ARTICLES.find(a => a.feature === "large") || ARTICLES[0];
  const moreArticles = ARTICLES.filter(a => a.kind === "essay" && a.slug !== featuredArticle.slug).slice(0, 2);
  const featuredRecipe = RECIPES.find(r => r.feature) || RECIPES[0];
  const moreRecipes = RECIPES.filter(r => r.slug !== featuredRecipe.slug).slice(0, 2);

  const Tab = ({ active, label, count, sub }) => (
    <div style={{ flex: 1, padding: "20px 24px", background: active ? palette.cream : "transparent", borderTop: active ? `3px solid ${palette.accent}` : `3px solid transparent`, cursor: "default" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: active ? palette.accent : palette.muted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, color: palette.ink, marginTop: 6 }}>{count} {sub}</div>
    </div>
  );

  return (
    <section className="ch-section" style={{ background: palette.cream2, padding: "120px 56px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        {/* Section header */}
        <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 56 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 06 — Read · cook · know</div>
            <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 64, lineHeight: 1.05, letterSpacing: "-0.02em", color: palette.ink, marginTop: 14, textWrap: "pretty" }}>
              The journal & <em style={{ color: palette.accent, fontWeight: 400 }}>the kitchen.</em>
            </div>
            <p style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 19, lineHeight: 1.55, color: palette.ink2, maxWidth: 560, marginTop: 18 }}>
              We write about Georgian food and the people who make it. We publish recipes you can actually make tonight. Both, all in one place.
            </p>
          </div>
          <div className="ch-edit-tabs ch-hide-mobile" style={{ display: "flex", border: `1px solid ${palette.ink}22`, minWidth: 380 }}>
            <Tab active label="Stories" count={ARTICLES.length} sub="essays & news" />
            <Tab label="Recipes" count={RECIPES.length} sub="traditional & modern" />
          </div>
        </div>

        {/* TWO-COLUMN MOSAIC: Stories / Recipes */}
        <div className="ch-edit-mosaic" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
          {/* Stories column */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", color: palette.ink, textTransform: "uppercase" }}>From the journal</div>
              <a href="Articles.html" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.accent, textDecoration: "none", textTransform: "uppercase", borderBottom: `1px solid ${palette.accent}` }}>All stories →</a>
            </div>
            <a href={`Article.html?slug=${featuredArticle.slug}`} style={{ display: "block", textDecoration: "none", color: palette.ink, marginBottom: 28 }}>
              <ArticleArt kind={featuredArticle.hero} palette={palette} ratio="16/9" />
              <div style={{ paddingTop: 18 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", color: palette.accent, textTransform: "uppercase" }}>{featuredArticle.category} · {featuredArticle.readMin} min</div>
                <div style={{ fontFamily: "Fraunces, serif", fontWeight: 400, fontSize: 30, lineHeight: 1.12, letterSpacing: "-0.01em", marginTop: 10, color: palette.ink, textWrap: "pretty" }}>{featuredArticle.title}</div>
                <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 17, lineHeight: 1.55, color: palette.ink2, marginTop: 10 }}>{featuredArticle.dek}</div>
              </div>
            </a>
            <div style={{ borderTop: `1px solid ${palette.ink}22` }}>
              {moreArticles.map(a => (
                <a key={a.slug} href={`Article.html?slug=${a.slug}`} style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 18, padding: "20px 0", borderBottom: `1px solid ${palette.ink}11`, textDecoration: "none", color: palette.ink, alignItems: "start" }} className="ch-edit-list-row">
                  <ArticleArt kind={a.hero} palette={palette} ratio="1/1" />
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", color: palette.accent, textTransform: "uppercase" }}>{a.category}</div>
                    <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, lineHeight: 1.2, color: palette.ink, marginTop: 4 }}>{a.title}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", color: palette.muted, textTransform: "uppercase", marginTop: 6 }}>{a.date} · {a.readMin} min</div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Recipes column */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", color: palette.ink, textTransform: "uppercase" }}>What to cook</div>
              <a href="Recipes.html" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.accent, textDecoration: "none", textTransform: "uppercase", borderBottom: `1px solid ${palette.accent}` }}>All recipes →</a>
            </div>
            <a href={`Recipe.html?slug=${featuredRecipe.slug}`} style={{ display: "block", textDecoration: "none", color: palette.cream, background: palette.ink, marginBottom: 28 }}>
              <RecipeArt slug={featuredRecipe.slug} palette={palette} ratio="16/9" />
              <div style={{ padding: "20px 24px 24px" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", color: palette.accent2, textTransform: "uppercase" }}>{featuredRecipe.cuisine} · ◐ {featuredRecipe.timeLabel} · serves {featuredRecipe.serves}</div>
                <div style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 30, lineHeight: 1.12, letterSpacing: "-0.01em", marginTop: 10, color: palette.cream, textWrap: "pretty" }}>{featuredRecipe.title}</div>
                {featuredRecipe.ka && <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 16, color: palette.accent2, marginTop: 6 }}>{featuredRecipe.ka}</div>}
                <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 16, lineHeight: 1.55, color: palette.cream, opacity: 0.8, marginTop: 10 }}>{featuredRecipe.note}</div>
              </div>
            </a>
            <div style={{ borderTop: `1px solid ${palette.ink}22` }}>
              {moreRecipes.map(r => (
                <a key={r.slug} href={`Recipe.html?slug=${r.slug}`} style={{ display: "grid", gridTemplateColumns: "100px 1fr auto", gap: 18, padding: "20px 0", borderBottom: `1px solid ${palette.ink}11`, textDecoration: "none", color: palette.ink, alignItems: "center" }} className="ch-edit-list-row">
                  <RecipeArt slug={r.slug} palette={palette} ratio="1/1" />
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", color: palette.accent, textTransform: "uppercase" }}>{r.cuisine} · {r.timeLabel}</div>
                    <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, lineHeight: 1.2, color: palette.ink, marginTop: 4 }}>{r.title}</div>
                    {r.ka && <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 12, color: palette.muted, marginTop: 4 }}>{r.ka}</div>}
                  </div>
                  <div className="ch-hide-mobile" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.22em", color: palette.muted, textTransform: "uppercase" }}>→</div>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Newsletter strip */}
        <div className="ch-newsletter" style={{ marginTop: 64, padding: "32px 40px", background: palette.cream, border: `1px solid ${palette.ink}22`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.accent, textTransform: "uppercase" }}>The Tuller Road Letter</div>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, color: palette.ink, marginTop: 6 }}>One essay & one recipe. Twice a month.</div>
          </div>
          <form style={{ display: "flex", gap: 8, flex: "1 1 360px", maxWidth: 480 }} onSubmit={(e) => e.preventDefault()}>
            <input placeholder="your@email" style={{ flex: 1, padding: "14px 16px", border: `1px solid ${palette.ink}33`, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: "0.06em", background: "transparent", color: palette.ink, outline: "none" }} />
            <button style={{ background: palette.ink, color: palette.cream, border: "none", padding: "14px 24px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Subscribe →</button>
          </form>
        </div>
      </div>
    </section>
  );
}

window.EditorialStrip = EditorialStrip;
