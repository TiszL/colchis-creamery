/* global React, RECIPES, FilterRow */
const { useState: useRecListState, useMemo: useRecListMemo } = React;

// ─── RECIPE ART ─────────────────────────────────────────────────────────
function RecipeArt({ slug, palette, ratio = "4/3" }) {
  // hash slug to one of a few visual treatments so the grid has rhythm
  const seed = slug ? slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0) : 0;
  const treat = seed % 4;
  const palettes = [
    { bg: palette.cream2, fg: palette.ink, glyph: "○" },
    { bg: palette.ink, fg: palette.accent2, glyph: "◐" },
    { bg: palette.accent, fg: palette.cream, glyph: "✶" },
    { bg: palette.ink2, fg: palette.cream, glyph: "▸" },
  ][treat];
  return (
    <div style={{ width: "100%", aspectRatio: ratio, background: palettes.bg, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at 30% 30%, ${palettes.fg}22 0 1px, transparent 1px)`, backgroundSize: "12px 12px", opacity: 0.7 }} />
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 88, color: palettes.fg, opacity: 0.5, position: "relative" }}>{palettes.glyph}</div>
    </div>
  );
}

// ─── RECIPES HERO ──────────────────────────────────────────────────────
function RecipesHero({ palette }) {
  return (
    <section className="ch-section" style={{ background: palette.cream2, padding: "100px 56px 72px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 64, alignItems: "end" }} className="ch-rec-hero">
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 24 }}>
            № 10 — The Kitchen · სამზარეულო
          </div>
          <h1 className="ch-h1" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 112, lineHeight: 0.92, letterSpacing: "-0.025em", margin: 0, color: palette.ink }}>
            Cook with us, <em style={{ color: palette.accent, fontWeight: 300 }}>tonight.</em>
          </h1>
        </div>
        <p className="ch-lede" style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, lineHeight: 1.55, color: palette.ink2, margin: 0, paddingBottom: 12 }}>
          Traditional Georgian and easy modern. Filter by what you have time for, what you have in the fridge, and who you are feeding.
        </p>
      </div>
    </section>
  );
}

// ─── RECIPE CARD ───────────────────────────────────────────────────────
function RecipeCard({ r, palette, variant = "standard" }) {
  const link = `Recipe.html?slug=${r.slug}`;
  if (variant === "feature") {
    return (
      <a href={link} className="ch-rec-feature" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 0, textDecoration: "none", color: palette.ink, background: palette.ink, alignItems: "stretch" }}>
        <RecipeArt slug={r.slug} palette={palette} ratio="4/3" />
        <div style={{ padding: "48px 44px", color: palette.cream, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase", marginBottom: 18 }}>★ Recipe of the week</div>
          <h2 className="ch-rec-feature-title" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 52, lineHeight: 1.02, letterSpacing: "-0.02em", margin: 0, color: palette.cream }}>{r.title}</h2>
          {r.ka && <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 22, color: palette.accent2, opacity: 0.8, marginTop: 12 }}>{r.ka}</div>}
          <p style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 18, lineHeight: 1.55, color: palette.cream, opacity: 0.78, marginTop: 24, marginBottom: 0 }}>{r.note}</p>
          <div style={{ display: "flex", gap: 24, marginTop: 28, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.cream, opacity: 0.7, textTransform: "uppercase", flexWrap: "wrap" }}>
            <span>◐ {r.timeLabel}</span>
            <span>· {r.difficulty}</span>
            <span>· serves {r.serves}</span>
            <span>· {r.cuisine}</span>
          </div>
          <div style={{ marginTop: 32 }}>
            <span style={{ display: "inline-block", padding: "12px 22px", border: `1px solid ${palette.cream}55`, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", color: palette.cream, textTransform: "uppercase" }}>Open recipe →</span>
          </div>
        </div>
      </a>
    );
  }
  return (
    <a href={link} style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: palette.ink, background: palette.cream, border: `1px solid ${palette.ink}14` }}>
      <div style={{ position: "relative" }}>
        <RecipeArt slug={r.slug} palette={palette} ratio="4/3" />
        <div style={{ position: "absolute", top: 14, left: 14, padding: "6px 12px", background: palette.cream, color: palette.ink, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase" }}>{r.cuisine}</div>
        <div style={{ position: "absolute", top: 14, right: 14, padding: "6px 12px", background: palette.ink, color: palette.cream, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase" }}>◐ {r.timeLabel}</div>
      </div>
      <div style={{ padding: "24px 24px 26px", flex: 1, display: "flex", flexDirection: "column" }}>
        <h3 style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontWeight: 400, fontSize: 26, lineHeight: 1.15, letterSpacing: "-0.01em", margin: 0, color: palette.ink }}>{r.title}</h3>
        {r.ka && <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 14, color: palette.muted, marginTop: 6 }}>{r.ka}</div>}
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.6, color: palette.ink2, opacity: 0.85, marginTop: 12, flex: 1 }}>{r.note}</p>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.22em", color: palette.muted, textTransform: "uppercase" }}>
          <span>{r.difficulty} · serves {r.serves}</span>
          {r.diet && r.diet.length > 0 && <span style={{ color: palette.accent }}>{r.diet[0]}</span>}
        </div>
      </div>
    </a>
  );
}

// ─── RECIPES INDEX PAGE ────────────────────────────────────────────────
function RecipesIndex({ palette }) {
  const [cuisine, setCuisine] = useRecListState("All");
  const [diet, setDiet] = useRecListState("Any");
  const [time, setTime] = useRecListState("Any");
  const [q, setQ] = useRecListState("");

  const cuisineOpts = useRecListMemo(() => {
    const counts = {};
    RECIPES.forEach(r => { counts[r.cuisine] = (counts[r.cuisine] || 0) + 1; });
    return [{ value: "All", label: "All", count: RECIPES.length }, ...Object.keys(counts).sort().map(c => ({ value: c, label: c, count: counts[c] }))];
  }, []);
  const dietOpts = [
    { value: "Any", label: "Any" }, { value: "Vegetarian", label: "Vegetarian" }, { value: "Vegan", label: "Vegan" }, { value: "Gluten-free", label: "Gluten-free" }, { value: "Quick", label: "Quick" },
  ];
  const timeOpts = [
    { value: "Any", label: "Any time" }, { value: "30", label: "≤ 30 min" }, { value: "60", label: "≤ 1 hr" }, { value: "120", label: "≤ 2 hr" }, { value: "long", label: "Project" },
  ];

  const filtered = useRecListMemo(() => RECIPES.filter(r => {
    if (cuisine !== "All" && r.cuisine !== cuisine) return false;
    if (diet !== "Any" && !r.diet.includes(diet)) return false;
    if (time === "30" && r.time > 30) return false;
    if (time === "60" && r.time > 60) return false;
    if (time === "120" && r.time > 120) return false;
    if (time === "long" && r.time < 120) return false;
    if (q && !(r.title + r.note).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [cuisine, diet, time, q]);

  const featured = filtered.find(r => r.feature) || filtered[0];
  const rest = filtered.filter(r => r !== featured);

  return (
    <>
      <RecipesHero palette={palette} />

      {/* Filters */}
      <section className="ch-section" style={{ background: palette.cream, padding: "48px 56px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
          <FilterRow palette={palette} options={cuisineOpts} value={cuisine} onChange={setCuisine} label="Cuisine" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 32 }} className="ch-filter-row">
            <FilterRow palette={palette} options={dietOpts} value={diet} onChange={setDiet} label="Diet" />
            <FilterRow palette={palette} options={timeOpts} value={time} onChange={setTime} label="Time" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>Search</div>
              <div style={{ position: "relative" }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try 'khachapuri'…"
                  style={{ width: "100%", padding: "12px 14px 12px 38px", border: `1px solid ${palette.ink}33`, background: "transparent", fontFamily: "Inter, sans-serif", fontSize: 14, color: palette.ink, outline: "none" }} />
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: palette.muted }}>⌕</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured */}
      {featured && (
        <section className="ch-section" style={{ background: palette.cream, padding: "32px 56px 48px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            <RecipeCard r={featured} palette={palette} variant="feature" />
          </div>
        </section>
      )}

      {/* Grid */}
      <section className="ch-section" style={{ background: palette.cream, padding: "32px 56px 100px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 28, color: palette.ink }}>
              {filtered.length} {filtered.length === 1 ? "recipe" : "recipes"}{(cuisine !== "All" || diet !== "Any" || time !== "Any" || q) && <span style={{ color: palette.muted }}> matching</span>}
            </div>
            {(cuisine !== "All" || diet !== "Any" || time !== "Any" || q) && (
              <button onClick={() => { setCuisine("All"); setDiet("Any"); setTime("Any"); setQ(""); }} style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.accent, textTransform: "uppercase" }}>Clear filters ×</button>
            )}
          </div>
          {rest.length > 0 ? (
            <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              {rest.map(r => <RecipeCard key={r.slug} r={r} palette={palette} />)}
            </div>
          ) : (!featured && (
            <div style={{ padding: "80px 0", textAlign: "center", fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 24, color: palette.muted }}>No recipes match. Try clearing the filter.</div>
          ))}
        </div>
      </section>
    </>
  );
}

window.RecipeArt = RecipeArt;
window.RecipeCard = RecipeCard;
window.RecipesIndex = RecipesIndex;
