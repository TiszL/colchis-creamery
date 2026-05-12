/* global React, ARTICLES, ArticlesHero, FilterRow, ArticleCard */
const { useState: useArtListState, useMemo: useArtListMemo } = React;

function ArticlesIndex({ palette }) {
  const [cat, setCat] = useArtListState("All");
  const [q, setQ] = useArtListState("");

  const cats = useArtListMemo(() => {
    const counts = {};
    ARTICLES.forEach(a => { counts[a.category] = (counts[a.category] || 0) + 1; });
    const list = [{ value: "All", label: "All", count: ARTICLES.length }];
    Object.keys(counts).sort().forEach(c => list.push({ value: c, label: c, count: counts[c] }));
    return list;
  }, []);

  const filtered = useArtListMemo(() => {
    return ARTICLES.filter(a =>
      (cat === "All" || a.category === cat) &&
      (!q || (a.title + a.dek + a.author).toLowerCase().includes(q.toLowerCase()))
    );
  }, [cat, q]);

  const featured = filtered.find(a => a.feature === "large") || filtered[0];
  const rest = filtered.filter(a => a !== featured);
  const essays = rest.filter(a => a.kind === "essay");
  const news = rest.filter(a => a.kind === "news");

  return (
    <>
      <ArticlesHero palette={palette} />

      {/* Filter + search bar */}
      <section className="ch-section" style={{ background: palette.cream, padding: "56px 56px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 320px", gap: 32, alignItems: "end" }} className="ch-filter-bar">
          <FilterRow palette={palette} options={cats} value={cat} onChange={setCat} label="Filter by topic" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>Search the journal</div>
            <div style={{ position: "relative" }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try 'sulguni' or 'supra'…"
                style={{ width: "100%", padding: "12px 14px 12px 38px", border: `1px solid ${palette.ink}33`, background: "transparent", fontFamily: "Inter, sans-serif", fontSize: 14, color: palette.ink, outline: "none" }} />
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: palette.muted }}>⌕</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured + essays grid */}
      <section className="ch-section" style={{ background: palette.cream, padding: "32px 56px 100px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          {featured && (
            <div style={{ marginBottom: 80, paddingBottom: 64, borderBottom: `1px solid ${palette.ink}22` }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 28 }}>★ Featured essay</div>
              <ArticleCard a={featured} palette={palette} variant="hero" />
            </div>
          )}
          {essays.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 32 }}>
                <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 32, color: palette.ink }}>More essays</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>{essays.length} {essays.length === 1 ? "story" : "stories"}</div>
              </div>
              <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
                {essays.map(a => <ArticleCard key={a.slug} a={a} palette={palette} variant="standard" />)}
              </div>
            </>
          )}
          {essays.length === 0 && !featured && (
            <div style={{ padding: "80px 0", textAlign: "center", fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 24, color: palette.muted }}>No essays match. Try clearing the filter.</div>
          )}
        </div>
      </section>

      {/* News & updates */}
      {news.length > 0 && (
        <section className="ch-section" style={{ background: palette.cream2, padding: "100px 56px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }} className="ch-section-header">
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>News & updates</div>
                <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", marginTop: 14 }}>
                  From the <em style={{ color: palette.accent, fontWeight: 400 }}>road & the road-stand.</em>
                </div>
              </div>
              <a href="#" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", color: palette.ink, textTransform: "uppercase", textDecoration: "none", borderBottom: `1px solid ${palette.ink}` }}>Subscribe to newsletter →</a>
            </div>
            <div style={{ borderTop: `1px solid ${palette.ink}22` }}>
              {news.map(a => <ArticleCard key={a.slug} a={a} palette={palette} variant="news" />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

window.ArticlesIndex = ArticlesIndex;
