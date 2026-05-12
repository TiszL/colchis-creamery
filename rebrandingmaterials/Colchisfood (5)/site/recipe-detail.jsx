/* global React, RECIPES, RecipeCard, RecipeArt */

function getRecipeSlug() {
  try { return new URL(window.location.href).searchParams.get("slug") || RECIPES[0].slug; } catch { return RECIPES[0].slug; }
}

// Demo ingredients/steps — same content for all slugs (placeholder editorial)
const DEMO_INGREDIENTS = [
  { group: "Dough", items: [
    "500g bread flour",
    "300ml warm milk",
    "7g instant yeast",
    "10g fine salt",
    "1 tbsp olive oil",
    "1 tsp sugar",
  ]},
  { group: "Filling & top", items: [
    "300g Colchis Sulguni Fresh, shredded",
    "200g Colchis Imeruli, crumbled",
    "4 egg yolks (one per bread, on top)",
    "60g cold butter, in cubes",
    "Flaky salt, for finishing",
    "Black pepper, freshly cracked",
  ]},
];

const DEMO_STEPS = [
  { t: "Bloom the yeast", d: "Stir yeast and sugar into warm milk and let it foam — 8 minutes. If it does not foam, your yeast is dead; start over with new yeast." },
  { t: "Mix and knead", d: "Combine flour, salt, oil. Pour in the yeast milk. Knead 10 minutes by hand or 6 in a stand mixer. The dough should be soft and a little tacky, not sticky." },
  { t: "First rise", d: "Cover and let rise in a warm spot until doubled — 60 to 90 minutes. The dough is ready when a finger pressed in stays pressed." },
  { t: "Shape the boats", d: "Divide into 4. Roll each piece into an oval, then pinch and twist the long sides into a boat shape. Score a deep well in the middle." },
  { t: "Fill", d: "Mix the sulguni and imeruli with two tablespoons of yogurt and a beaten egg. Mound the cheese filling into each well, leaving the rim clean." },
  { t: "Bake hot", d: "500°F (260°C) for 12 minutes on a preheated stone or steel. Pull, drop a yolk into each well, scatter butter cubes, return for 90 seconds." },
  { t: "Eat with your hands", d: "Tear the rim, swirl through the molten yolk and butter, and dip. Eat the boat from the outside in, finishing with the rich middle. Salt to taste." },
];

function RecipePage({ palette }) {
  const slug = getRecipeSlug();
  const r = RECIPES.find(x => x.slug === slug) || RECIPES[0];
  const more = RECIPES.filter(x => x.slug !== r.slug).slice(0, 3);

  return (
    <article data-screen-label={`Recipe — ${r.title}`}>
      {/* Breadcrumb */}
      <div style={{ background: palette.cream, padding: "24px 56px 0" }} className="ch-breadcrumb">
        <div style={{ maxWidth: 1120, margin: "0 auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>
          <a href="index.html" style={{ color: palette.muted, textDecoration: "none" }}>Colchis Food</a>
          <span style={{ margin: "0 10px" }}>/</span>
          <a href="Recipes.html" style={{ color: palette.muted, textDecoration: "none" }}>Recipes</a>
          <span style={{ margin: "0 10px" }}>/</span>
          <span style={{ color: palette.ink }}>{r.cuisine}</span>
        </div>
      </div>

      {/* HERO: title + meta on left, photo on right */}
      <header style={{ background: palette.cream, padding: "40px 56px 64px" }} className="ch-rec-detail-head">
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 64, alignItems: "center" }} className="ch-rec-hero-grid">
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 20 }}>{r.cuisine} · {r.difficulty}</div>
            <h1 className="ch-rec-h1" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 80, lineHeight: 1.0, letterSpacing: "-0.025em", margin: 0, color: palette.ink, textWrap: "pretty" }}>{r.title}</h1>
            {r.ka && <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 28, color: palette.accent, marginTop: 14, opacity: 0.85 }}>{r.ka}</div>}
            <p className="ch-rec-dek" style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, lineHeight: 1.55, color: palette.ink2, marginTop: 24, marginBottom: 0 }}>{r.note}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 36, paddingTop: 28, borderTop: `1px solid ${palette.ink}22` }} className="ch-rec-meta-grid">
              {[
                { l: "Time", v: r.timeLabel },
                { l: "Serves", v: r.serves },
                { l: "Difficulty", v: r.difficulty },
                { l: "Pairs with", v: r.pairing || "—" },
              ].map(m => (
                <div key={m.l}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>{m.l}</div>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: palette.ink, marginTop: 6, lineHeight: 1.15 }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
              <button style={{ background: palette.ink, color: palette.cream, border: "none", padding: "14px 24px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Save recipe ♡</button>
              <button style={{ background: "transparent", color: palette.ink, border: `1px solid ${palette.ink}`, padding: "14px 24px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Print · Share</button>
            </div>
          </div>
          <RecipeArt slug={r.slug} palette={palette} ratio="4/5" />
        </div>
      </header>

      {/* STORY-FIRST intro */}
      <section style={{ background: palette.cream, padding: "32px 56px 56px" }} className="ch-section">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 21, lineHeight: 1.65, color: palette.ink2 }}>
            <p style={{ margin: "0 0 22px" }}>Adjaruli is the show-off of the khachapuri family. It is a yeasted dough boat — open-topped, golden-brown — full of melted sulguni and imeruli, with a raw egg yolk and a knob of cold butter dropped on top in the last minute of baking. You tear the crust, swirl through the molten middle, and eat with your hands.</p>
            <p style={{ margin: "0 0 22px" }}>This is not a weeknight recipe — it takes about three hours, most of it waiting on dough. But it is worth a Saturday. Make four, and feed four people. Or make one for yourself, and eat it standing at the counter, the way I do.</p>
          </div>
        </div>
      </section>

      {/* INGREDIENTS + STEPS, two columns */}
      <section style={{ background: palette.cream, padding: "0 56px 96px" }} className="ch-section">
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "320px 1fr", gap: 64, alignItems: "start" }} className="ch-rec-cook-grid">
          <aside style={{ position: "sticky", top: 100 }} className="ch-rec-ingredients">
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 16 }}>Ingredients</div>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 32, color: palette.ink, marginBottom: 20 }}>For {r.serves}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
              {[r.serves, r.serves * 2, r.serves * 4].map((n, i) => (
                <button key={n} style={{ flex: 1, padding: "10px 0", border: `1px solid ${i === 0 ? palette.ink : palette.ink + "33"}`, background: i === 0 ? palette.ink : "transparent", color: i === 0 ? palette.cream : palette.ink, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", cursor: "pointer" }}>×{n}</button>
              ))}
            </div>
            {DEMO_INGREDIENTS.map(g => (
              <div key={g.group} style={{ marginBottom: 28 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase", marginBottom: 10 }}>{g.group}</div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {g.items.map((it, i) => (
                    <li key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: `1px solid ${palette.ink}11`, fontFamily: "Inter, sans-serif", fontSize: 14, color: palette.ink, lineHeight: 1.45 }}>
                      <input type="checkbox" style={{ accentColor: palette.accent, marginTop: 4 }} />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>
          <div className="ch-rec-steps">
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 16 }}>Method · 7 steps</div>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 32, color: palette.ink, marginBottom: 32 }}>Three hours, mostly waiting</div>
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 0 }}>
              {DEMO_STEPS.map((s, i) => (
                <li key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 24, padding: "28px 0", borderBottom: `1px solid ${palette.ink}14` }}>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 40, fontWeight: 300, color: palette.accent, lineHeight: 1 }}>{String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 24, color: palette.ink, lineHeight: 1.2 }}>{s.t}</div>
                    <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, lineHeight: 1.6, color: palette.ink2, marginTop: 10 }}>{s.d}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* PAIRING / SHOP CTA */}
      {r.pairing && (
        <section style={{ background: palette.ink, color: palette.cream, padding: "72px 56px" }} className="ch-section">
          <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }} className="ch-split">
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase", marginBottom: 18 }}>Made with</div>
              <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 48, lineHeight: 1.05, letterSpacing: "-0.02em", color: palette.cream }}>
                {r.pairing}
              </div>
              <p style={{ fontFamily: "Fraunces, serif", fontSize: 18, lineHeight: 1.6, color: palette.cream, opacity: 0.78, marginTop: 18, fontStyle: "italic" }}>
                We make this every morning in Dublin, Ohio. Order it for delivery tonight, or have it shipped overnight to anywhere in the US.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button style={{ background: palette.accent, color: palette.cream, border: "none", padding: "16px 28px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Shop the Creamery →</button>
            </div>
          </div>
        </section>
      )}

      {/* MORE recipes */}
      <section style={{ background: palette.cream2, padding: "96px 56px" }} className="ch-section">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }} className="ch-section-header">
            <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 48 }}>
              Cook <em style={{ color: palette.accent, fontWeight: 400 }}>more.</em>
            </div>
            <a href="Recipes.html" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", color: palette.ink, textTransform: "uppercase", textDecoration: "none", borderBottom: `1px solid ${palette.ink}` }}>All recipes →</a>
          </div>
          <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {more.map(m => <RecipeCard key={m.slug} r={m} palette={palette} />)}
          </div>
        </div>
      </section>
    </article>
  );
}

window.RecipePage = RecipePage;
