"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface ArticleData {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  tags: string | null;
  coverImage: string | null;
  publishedAt: string | null;
  content: string;
}

function ArticleArt({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <div style={{ width: "100%", aspectRatio: "4/3", background: bg, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(45deg, transparent 0 14px, ${fg}10 14px 15px)`, opacity: 0.6 }} />
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.3em", color: fg, opacity: 0.7, textTransform: "uppercase", position: "relative" }}>[ {label} ]</div>
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

function getReadMin(content: string): number {
  return Math.max(2, Math.ceil(content.split(/\s+/).length / 200));
}

function getArticleKind(tags: string | null): "essay" | "news" {
  const t = (tags || "").toLowerCase();
  return (t.includes("updates") || t.includes("press")) ? "news" : "essay";
}

function getArtColors(tags: string | null): { bg: string; fg: string } {
  const t = (tags || "").toLowerCase();
  if (t.includes("heritage")) return { bg: "#1F3026", fg: "#8B4A28" };
  if (t.includes("sourcing")) return { bg: "#EAE2D2", fg: "#1F3026" };
  if (t.includes("field")) return { bg: "#2C3D33", fg: "#8B4A28" };
  if (t.includes("press")) return { bg: "#F5F0E6", fg: "#1F3026" };
  if (t.includes("updates")) return { bg: "#B96A3D", fg: "#F5F0E6" };
  return { bg: "#EAE2D2", fg: "#1F3026" };
}

export function JournalClient({ articles, locale }: { articles: ArticleData[]; locale: string }) {
  const prefix = locale === "en" ? "" : `/${locale}`;
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");

  const cats = useMemo(() => {
    const counts: Record<string, number> = {};
    articles.forEach(a => { const t = a.tags || "Uncategorized"; counts[t] = (counts[t] || 0) + 1; });
    const list = [{ value: "All", label: "All", count: articles.length }];
    Object.keys(counts).sort().forEach(c => list.push({ value: c, label: c, count: counts[c] }));
    return list;
  }, [articles]);

  const filtered = useMemo(() => {
    return articles.filter(a =>
      (cat === "All" || a.tags === cat) &&
      (!q || (a.title + (a.excerpt || "")).toLowerCase().includes(q.toLowerCase()))
    );
  }, [articles, cat, q]);

  const featured = filtered[0];
  const rest = filtered.filter(a => a !== featured);
  const essays = rest.filter(a => getArticleKind(a.tags) === "essay");
  const news = rest.filter(a => getArticleKind(a.tags) === "news");

  return (
    <>
      {/* Filter + search bar */}
      <section className="ch-section" style={{ background: "#F5F0E6", padding: "56px 56px 24px" }}>
        <div className="ch-filter-bar" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 320px", gap: 32, alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>Filter by topic</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {cats.map(opt => (
                <FilterPill key={opt.value} label={opt.label} count={opt.count} active={cat === opt.value} onClick={() => setCat(opt.value)} />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>Search the journal</div>
            <div style={{ position: "relative" }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try 'sulguni' or 'supra'…"
                style={{ width: "100%", padding: "12px 14px 12px 38px", border: "1px solid #1F302633", background: "transparent", fontFamily: "var(--font-sans)", fontSize: 14, color: "#1F3026", outline: "none" }} />
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-mono)", fontSize: 14, color: "#7A8278" }}>⌕</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured + essays */}
      <section className="ch-section" style={{ background: "#F5F0E6", padding: "32px 56px 100px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          {featured && (
            <div style={{ marginBottom: 80, paddingBottom: 64, borderBottom: "1px solid #1F302622" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 28 }}>★ Featured essay</div>
              {/* Hero card */}
              <Link href={`${prefix}/journal/${featured.slug}`} className="ch-art-hero" style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 48, textDecoration: "none", color: "#1F3026", alignItems: "center" }}>
                {featured.coverImage ? (
                  <img src={featured.coverImage} alt={featured.title} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} />
                ) : (
                  <ArticleArt label={featured.tags || "Article"} {...getArtColors(featured.tags)} />
                )}
                <div>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase" }}>
                    <span style={{ color: "#B96A3D" }}>{featured.tags || "Essay"}</span>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#7A8278" }} />
                    <span style={{ color: "#7A8278" }}>{featured.publishedAt ? new Date(featured.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</span>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#7A8278" }} />
                    <span style={{ color: "#7A8278" }}>{getReadMin(featured.content)} min read</span>
                  </div>
                  <h2 className="ch-art-hero-title" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, lineHeight: 1.02, letterSpacing: "-0.02em", margin: 0, color: "#1F3026" }}>{featured.title}</h2>
                  {featured.excerpt && <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 19, lineHeight: 1.55, color: "#2C3D33", marginTop: 20, marginBottom: 0 }}>{featured.excerpt}</p>}
                  <div style={{ marginTop: 28, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", color: "#1F3026", textTransform: "uppercase", borderBottom: "1px solid #1F3026", display: "inline-block" }}>Read essay →</div>
                </div>
              </Link>
            </div>
          )}

          {essays.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 32 }}>
                <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 32, color: "#1F3026" }}>More essays</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>{essays.length} {essays.length === 1 ? "story" : "stories"}</div>
              </div>
              <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
                {essays.map(a => {
                  const colors = getArtColors(a.tags);
                  return (
                    <Link key={a.slug} href={`${prefix}/journal/${a.slug}`} style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "#1F3026", background: "#F5F0E6", border: "1px solid #1F302614" }}>
                      {a.coverImage ? (
                        <img src={a.coverImage} alt={a.title} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} />
                      ) : (
                        <ArticleArt label={a.tags || "Article"} bg={colors.bg} fg={colors.fg} />
                      )}
                      <div style={{ padding: "26px 26px 30px", flex: 1, display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase" }}>
                          <span style={{ color: "#B96A3D" }}>{a.tags}</span>
                          <span style={{ color: "#7A8278" }}>{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
                        </div>
                        <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 28, lineHeight: 1.12, letterSpacing: "-0.01em", margin: "14px 0 0", color: "#1F3026" }}>{a.title}</h3>
                        {a.excerpt && <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.6, color: "#2C3D33", opacity: 0.85, marginTop: 12, flex: 1 }}>{a.excerpt}</p>}
                        <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>
                          <span>{getReadMin(a.content)} min →</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {essays.length === 0 && !featured && (
            <div style={{ padding: "80px 0", textAlign: "center", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 24, color: "#7A8278" }}>No essays match. Try clearing the filter.</div>
          )}
        </div>
      </section>

      {/* News & updates */}
      {news.length > 0 && (
        <section className="ch-section" style={{ background: "#EAE2D2", padding: "100px 56px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>News & updates</div>
                <div className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", marginTop: 14 }}>
                  From the <em style={{ color: "#B96A3D", fontWeight: 400 }}>road & the road-stand.</em>
                </div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #1F302622" }}>
              {news.map(a => (
                <Link key={a.slug} href={`${prefix}/journal/${a.slug}`} style={{ display: "block", padding: "24px 0", textDecoration: "none", color: "#1F3026", borderBottom: "1px solid #1F302614" }}>
                  <div className="ch-news-row" style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 28, alignItems: "baseline" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</div>
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: "#B96A3D", textTransform: "uppercase" }}>{a.tags}</div>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, lineHeight: 1.2, marginTop: 6, color: "#1F3026" }}>{a.title}</div>
                      {a.excerpt && <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "#2C3D33", marginTop: 8, opacity: 0.85 }}>{a.excerpt}</div>}
                    </div>
                    <div className="ch-hide-mobile" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>{getReadMin(a.content)} min →</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
