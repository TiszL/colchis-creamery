/* global React, ARTICLES */
const { useState: useArticleState, useMemo: useArticleMemo } = React;

// ─── HERO ART (procedural placeholders so list page has visual rhythm) ───
function ArticleArt({ kind, palette, ratio = "4/3" }) {
  const map = {
    "stone-press": { bg: palette.ink, fg: palette.accent2, label: "Stone press" },
    "market-stall": { bg: palette.accent, fg: palette.cream, label: "Pop-up market" },
    "dairy": { bg: palette.cream2, fg: palette.ink, label: "Three rivers" },
    "khachapuri-flat": { bg: palette.ink2, fg: palette.accent2, label: "Khachapuri map" },
    "press-clipping": { bg: palette.cream, fg: palette.ink, label: "Press" },
    "supra": { bg: palette.accent, fg: palette.cream, label: "Supra" },
    "sulguni-section": { bg: palette.cream2, fg: palette.ink, label: "Sulguni" },
    "wholesale-crate": { bg: palette.ink, fg: palette.cream, label: "Wholesale" },
  };
  const m = map[kind] || { bg: palette.cream2, fg: palette.ink, label: "Article" };
  return (
    <div style={{ width: "100%", aspectRatio: ratio, background: m.bg, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(45deg, transparent 0 14px, ${m.fg}10 14px 15px)`, opacity: 0.6 }} />
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: m.fg, opacity: 0.7, textTransform: "uppercase", position: "relative" }}>[ {m.label} ]</div>
    </div>
  );
}

// ─── ARTICLES HERO ─────────────────────────────────────────────────────────
function ArticlesHero({ palette }) {
  return (
    <section className="ch-section" style={{ background: palette.ink, color: palette.cream, padding: "100px 56px 72px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase", marginBottom: 24 }}>
          № 09 — The Journal · ჟურნალი
        </div>
        <h1 className="ch-h1" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 112, lineHeight: 0.92, letterSpacing: "-0.025em", margin: 0, maxWidth: 1100 }}>
          Stories from <em style={{ color: palette.accent2, fontWeight: 300 }}>a country</em><br />you should know.
        </h1>
        <p className="ch-lede" style={{ marginTop: 32, fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, lineHeight: 1.55, color: palette.cream, opacity: 0.78, maxWidth: 720 }}>
          Heritage essays, field notes from the creamery and the bakery, news from the road.
          We publish when we have something worth saying.
        </p>
      </div>
    </section>
  );
}

// ─── FILTER PILLS ─────────────────────────────────────────────────────────
function FilterRow({ palette, options, value, onChange, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {label && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>{label}</div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button key={opt.value} onClick={() => onChange(opt.value)}
              style={{
                padding: "10px 18px",
                border: `1px solid ${active ? palette.ink : palette.ink + "33"}`,
                background: active ? palette.ink : "transparent",
                color: active ? palette.cream : palette.ink,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}>
              {opt.label}{opt.count != null && <span style={{ opacity: 0.55, marginLeft: 8 }}>{opt.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── ARTICLE CARD (variants: hero / standard / compact / news) ───────────
function ArticleCard({ a, palette, variant = "standard", href }) {
  const link = href || `Article.html?slug=${a.slug}`;
  if (variant === "hero") {
    return (
      <a href={link} className="ch-art-hero" style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 48, textDecoration: "none", color: palette.ink, alignItems: "center" }}>
        <ArticleArt kind={a.hero} palette={palette} ratio="4/3" />
        <div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase" }}>
            <span style={{ color: palette.accent }}>{a.category}</span>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: palette.muted }} />
            <span style={{ color: palette.muted }}>{a.date}</span>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: palette.muted }} />
            <span style={{ color: palette.muted }}>{a.readMin} min read</span>
          </div>
          <h2 className="ch-art-hero-title" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 56, lineHeight: 1.02, letterSpacing: "-0.02em", margin: 0, color: palette.ink }}>
            {a.title}
          </h2>
          <p style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 19, lineHeight: 1.55, color: palette.ink2, marginTop: 20, marginBottom: 0 }}>
            {a.dek}
          </p>
          <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>By {a.author}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", color: palette.ink, textTransform: "uppercase", borderBottom: `1px solid ${palette.ink}` }}>Read essay →</span>
          </div>
        </div>
      </a>
    );
  }
  if (variant === "news") {
    return (
      <a href={link} style={{ display: "block", padding: "24px 0", textDecoration: "none", color: palette.ink, borderBottom: `1px solid ${palette.ink}14` }}>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 28, alignItems: "baseline" }} className="ch-news-row">
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>{a.date}</div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", color: palette.accent, textTransform: "uppercase" }}>{a.category}</div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, lineHeight: 1.2, marginTop: 6, color: palette.ink }}>{a.title}</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 1.55, color: palette.ink2, marginTop: 8, opacity: 0.85 }}>{a.dek}</div>
          </div>
          <div className="ch-hide-mobile" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>{a.readMin} min →</div>
        </div>
      </a>
    );
  }
  // standard card
  return (
    <a href={link} style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: palette.ink, background: palette.cream, border: `1px solid ${palette.ink}14` }}>
      <ArticleArt kind={a.hero} palette={palette} ratio="4/3" />
      <div style={{ padding: "26px 26px 30px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase" }}>
          <span style={{ color: palette.accent }}>{a.category}</span>
          <span style={{ color: palette.muted }}>{a.date}</span>
        </div>
        <h3 style={{ fontFamily: "Fraunces, serif", fontWeight: 400, fontSize: 28, lineHeight: 1.12, letterSpacing: "-0.01em", margin: "14px 0 0", color: palette.ink }}>
          {a.title}
        </h3>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 1.6, color: palette.ink2, opacity: 0.85, marginTop: 12, flex: 1 }}>{a.dek}</p>
        <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>
          <span>{a.author}</span>
          <span>{a.readMin} min →</span>
        </div>
      </div>
    </a>
  );
}

window.ArticleArt = ArticleArt;
window.ArticlesHero = ArticlesHero;
window.FilterRow = FilterRow;
window.ArticleCard = ArticleCard;
