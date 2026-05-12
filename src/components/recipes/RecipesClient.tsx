"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface RecipeData {
  id: string;
  slug: string;
  title: string;
  description: string;
  prepTime: string | null;
  cookTime: string | null;
  servings: string | null;
  difficulty: string | null;
  imageUrl: string | null;
  contentBlocks: string | null;
}

function RecipeArt({ slug }: { slug: string }) {
  const seed = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const treat = seed % 4;
  const palettes = [
    { bg: "#EAE2D2", fg: "#1F3026", glyph: "○" },
    { bg: "#1F3026", fg: "#8B4A28", glyph: "◐" },
    { bg: "#B96A3D", fg: "#F5F0E6", glyph: "✶" },
    { bg: "#2C3D33", fg: "#F5F0E6", glyph: "▸" },
  ][treat];
  return (
    <div style={{ width: "100%", aspectRatio: "4/3", background: palettes.bg, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at 30% 30%, ${palettes.fg}22 0 1px, transparent 1px)`, backgroundSize: "12px 12px", opacity: 0.7 }} />
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 88, color: palettes.fg, opacity: 0.5, position: "relative" }}>{palettes.glyph}</div>
    </div>
  );
}

function FilterPill({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 18px", border: `1px solid ${active ? "#1F3026" : "#1F302633"}`,
      background: active ? "#1F3026" : "transparent", color: active ? "#F5F0E6" : "#1F3026",
      fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
    }}>
      {label}{count != null && <span style={{ opacity: 0.55, marginLeft: 8 }}>{count}</span>}
    </button>
  );
}

function getMeta(r: RecipeData): { cuisine: string; ka: string; pairing: string; diet: string[]; time: number; timeLabel: string } {
  try {
    const cb = r.contentBlocks ? JSON.parse(r.contentBlocks) : {};
    const time = r.prepTime ? parseInt(r.prepTime) || 60 : 60;
    return {
      cuisine: cb.cuisine || "Traditional",
      ka: cb.ka || "",
      pairing: cb.pairing || "",
      diet: cb.diet || [],
      time,
      timeLabel: r.prepTime || `${time} min`,
    };
  } catch {
    return { cuisine: "Traditional", ka: "", pairing: "", diet: [], time: 60, timeLabel: r.prepTime || "60 min" };
  }
}

export function RecipesClient({ recipes, locale }: { recipes: RecipeData[]; locale: string }) {
  const prefix = locale === "en" ? "" : `/${locale}`;
  const [cuisine, setCuisine] = useState("All");
  const [diet, setDiet] = useState("Any");
  const [time, setTime] = useState("Any");
  const [q, setQ] = useState("");

  const cuisineOpts = useMemo(() => {
    const counts: Record<string, number> = {};
    recipes.forEach(r => { const m = getMeta(r); counts[m.cuisine] = (counts[m.cuisine] || 0) + 1; });
    return [{ value: "All", label: "All", count: recipes.length }, ...Object.keys(counts).sort().map(c => ({ value: c, label: c, count: counts[c] }))];
  }, [recipes]);

  const dietOpts = [
    { value: "Any", label: "Any" }, { value: "Vegetarian", label: "Vegetarian" },
    { value: "Vegan", label: "Vegan" }, { value: "Gluten-free", label: "Gluten-free" }, { value: "Quick", label: "Quick" },
  ];
  const timeOpts = [
    { value: "Any", label: "Any time" }, { value: "30", label: "≤ 30 min" },
    { value: "60", label: "≤ 1 hr" }, { value: "120", label: "≤ 2 hr" }, { value: "long", label: "Project" },
  ];

  const filtered = useMemo(() => recipes.filter(r => {
    const m = getMeta(r);
    if (cuisine !== "All" && m.cuisine !== cuisine) return false;
    if (diet !== "Any" && !m.diet.includes(diet)) return false;
    if (time === "30" && m.time > 30) return false;
    if (time === "60" && m.time > 60) return false;
    if (time === "120" && m.time > 120) return false;
    if (time === "long" && m.time < 120) return false;
    if (q && !(r.title + r.description).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [recipes, cuisine, diet, time, q]);

  const featured = filtered[0];
  const rest = filtered.filter(r => r !== featured);
  const anyFilter = cuisine !== "All" || diet !== "Any" || time !== "Any" || q;

  return (
    <>
      {/* Filters */}
      <section className="ch-section" style={{ background: "#F5F0E6", padding: "48px 56px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>Cuisine</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {cuisineOpts.map(opt => <FilterPill key={opt.value} label={opt.label} count={opt.count} active={cuisine === opt.value} onClick={() => setCuisine(opt.value)} />)}
            </div>
          </div>
          <div className="ch-filter-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>Diet</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {dietOpts.map(opt => <FilterPill key={opt.value} label={opt.label} active={diet === opt.value} onClick={() => setDiet(opt.value)} />)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>Time</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {timeOpts.map(opt => <FilterPill key={opt.value} label={opt.label} active={time === opt.value} onClick={() => setTime(opt.value)} />)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>Search</div>
              <div style={{ position: "relative" }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try 'khachapuri'…"
                  style={{ width: "100%", padding: "12px 14px 12px 38px", border: "1px solid #1F302633", background: "transparent", fontFamily: "var(--font-sans)", fontSize: 14, color: "#1F3026", outline: "none" }} />
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#7A8278" }}>⌕</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured */}
      {featured && (
        <section className="ch-section" style={{ background: "#F5F0E6", padding: "32px 56px 48px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            <Link href={`${prefix}/recipes/${featured.slug}`} className="ch-rec-feature" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 0, textDecoration: "none", color: "#1F3026", background: "#1F3026", alignItems: "stretch" }}>
              {featured.imageUrl ? (
                <img src={featured.imageUrl} alt={featured.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <RecipeArt slug={featured.slug} />
              )}
              <div style={{ padding: "48px 44px", color: "#F5F0E6", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", color: "#8B4A28", textTransform: "uppercase", marginBottom: 18 }}>★ Recipe of the week</div>
                <h2 className="ch-rec-feature-title" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 52, lineHeight: 1.02, letterSpacing: "-0.02em", margin: 0, color: "#F5F0E6" }}>{featured.title}</h2>
                {(() => { const m = getMeta(featured); return m.ka ? <div style={{ fontFamily: "var(--font-serif-ka, 'Noto Serif Georgian', serif)", fontSize: 22, color: "#8B4A28", opacity: 0.8, marginTop: 12 }}>{m.ka}</div> : null; })()}
                <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, lineHeight: 1.55, color: "#F5F0E6", opacity: 0.78, marginTop: 24, marginBottom: 0 }}>{featured.description}</p>
                <div style={{ display: "flex", gap: 24, marginTop: 28, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#F5F0E6", opacity: 0.7, textTransform: "uppercase", flexWrap: "wrap" }}>
                  {(() => { const m = getMeta(featured); return <><span>◐ {m.timeLabel}</span><span>· {featured.difficulty || "Easy"}</span><span>· serves {featured.servings || "4"}</span><span>· {m.cuisine}</span></>; })()}
                </div>
                <div style={{ marginTop: 32 }}>
                  <span style={{ display: "inline-block", padding: "12px 22px", border: "1px solid rgba(245,240,230,0.33)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", color: "#F5F0E6", textTransform: "uppercase" }}>Open recipe →</span>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Grid */}
      <section className="ch-section" style={{ background: "#F5F0E6", padding: "32px 56px 100px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28 }}>
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 28, color: "#1F3026" }}>
              {filtered.length} {filtered.length === 1 ? "recipe" : "recipes"}{anyFilter && <span style={{ color: "#7A8278" }}> matching</span>}
            </div>
            {anyFilter && (
              <button onClick={() => { setCuisine("All"); setDiet("Any"); setTime("Any"); setQ(""); }} style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase" }}>Clear filters ×</button>
            )}
          </div>
          {rest.length > 0 ? (
            <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              {rest.map(r => {
                const m = getMeta(r);
                return (
                  <Link key={r.slug} href={`${prefix}/recipes/${r.slug}`} style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "#1F3026", background: "#F5F0E6", border: "1px solid #1F302614" }}>
                    <div style={{ position: "relative" }}>
                      {r.imageUrl ? (
                        <img src={r.imageUrl} alt={r.title} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} />
                      ) : (
                        <RecipeArt slug={r.slug} />
                      )}
                      <div style={{ position: "absolute", top: 14, left: 14, padding: "6px 12px", background: "#F5F0E6", color: "#1F3026", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase" }}>{m.cuisine}</div>
                      <div style={{ position: "absolute", top: 14, right: 14, padding: "6px 12px", background: "#1F3026", color: "#F5F0E6", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase" }}>◐ {m.timeLabel}</div>
                    </div>
                    <div style={{ padding: "24px 24px 26px", flex: 1, display: "flex", flexDirection: "column" }}>
                      <h3 style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, fontSize: 26, lineHeight: 1.15, letterSpacing: "-0.01em", margin: 0, color: "#1F3026" }}>{r.title}</h3>
                      {m.ka && <div style={{ fontFamily: "var(--font-serif-ka, 'Noto Serif Georgian', serif)", fontSize: 14, color: "#7A8278", marginTop: 6 }}>{m.ka}</div>}
                      <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.6, color: "#2C3D33", opacity: 0.85, marginTop: 12, flex: 1 }}>{r.description}</p>
                      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase" }}>
                        <span>{r.difficulty || "Easy"} · serves {r.servings || "4"}</span>
                        {m.diet.length > 0 && <span style={{ color: "#B96A3D" }}>{m.diet[0]}</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (!featured && (
            <div style={{ padding: "80px 0", textAlign: "center", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 24, color: "#7A8278" }}>No recipes match. Try clearing the filter.</div>
          ))}
        </div>
      </section>
    </>
  );
}
