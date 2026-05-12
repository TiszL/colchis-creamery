/* global React, ColchisSeal */
const { useState } = React;

// ─── BREADCRUMBS ─────────────────────────────────────────────────────────
function Breadcrumbs({ palette, crumbs, current }) {
  return (
    <nav className="ch-breadcrumbs" style={{
      background: palette.cream,
      padding: "20px 56px",
      borderBottom: `1px solid ${palette.ink}11`,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10,
      letterSpacing: "0.22em",
      color: palette.muted,
      textTransform: "uppercase",
    }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            <a href={c.href} style={{ color: palette.muted, textDecoration: "none", transition: "color 200ms" }} onMouseEnter={(e) => e.target.style.color = palette.accent} onMouseLeave={(e) => e.target.style.color = palette.muted}>{c.label}</a>
            <span style={{ color: palette.ink2, opacity: 0.5 }}>/</span>
          </React.Fragment>
        ))}
        <span style={{ color: palette.ink, fontWeight: 500 }}>{current}</span>
      </div>
    </nav>
  );
}

// ─── BADGE ───────────────────────────────────────────────────────────────
function StatusBadge({ palette, kind, label, color }) {
  const map = {
    success: { bg: palette.accent + "18", fg: palette.accent, bd: palette.accent + "44" },
    warning: { bg: "#D9A87622", fg: "#B96A3D", bd: "#D9A87655" },
    error:   { bg: "#A8312C22", fg: "#A8312C", bd: "#A8312C55" },
    line:    { bg: (color || palette.accent) + "18", fg: color || palette.accent, bd: (color || palette.accent) + "44" },
  };
  const c = map[kind] || map.success;
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 9,
      letterSpacing: "0.26em",
      textTransform: "uppercase",
      padding: "6px 12px",
      background: c.bg,
      color: c.fg,
      border: `1px solid ${c.bd}`,
      borderRadius: 999,
      fontWeight: 500,
    }}>{label}</span>
  );
}

// ─── GALLERY (uses <image-slot> so user can drop real photos) ──────────
function Gallery({ palette, productId, productName, placeholderEl, mediaCount = 4 }) {
  const [activeIdx, setActiveIdx] = useState(0);

  // We render 4 image-slot elements. The "active" one is shown big; the rest are thumbs.
  // image-slot persists the dropped image by its id, so each slot remains stable across reloads.

  return (
    <div className="ch-pdp-gallery" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Main display */}
      <div style={{
        aspectRatio: "1",
        background: palette.cream2,
        border: `1px solid ${palette.ink}22`,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* All slots stacked; only active one visible */}
        {[...Array(mediaCount)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            inset: 0,
            display: i === activeIdx ? "flex" : "none",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {i === 0 && placeholderEl ? (
              // First slot: image-slot with a custom design placeholder when empty
              <image-slot
                id={`${productId}-img-0`}
                placeholder="Drop the hero product photo here"
                style={{ width: "100%", height: "100%", "--slot-bg": "transparent" }}
              ></image-slot>
            ) : (
              <image-slot
                id={`${productId}-img-${i}`}
                placeholder={`Drop image ${i + 1} here`}
                style={{ width: "100%", height: "100%", "--slot-bg": "transparent" }}
              ></image-slot>
            )}
            {/* When slot is empty, show our placeholder */}
            {i === 0 && placeholderEl && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                {placeholderEl}
              </div>
            )}
          </div>
        ))}
        {/* Pagination dots over the image */}
        <div style={{ position: "absolute", bottom: 16, right: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.22em", color: palette.muted, background: palette.cream + "DD", padding: "4px 10px", borderRadius: 999, textTransform: "uppercase" }}>
          {String(activeIdx + 1).padStart(2, "0")} / {String(mediaCount).padStart(2, "0")}
        </div>
      </div>

      {/* Thumbnail strip */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
        {[...Array(mediaCount)].map((_, i) => (
          <button key={i}
            onClick={() => setActiveIdx(i)}
            style={{
              width: 80,
              height: 80,
              flexShrink: 0,
              border: i === activeIdx ? `2px solid ${palette.accent}` : `1px solid ${palette.ink}22`,
              background: palette.cream2,
              cursor: "pointer",
              padding: 0,
              opacity: i === activeIdx ? 1 : 0.55,
              transition: "all 200ms",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              color: palette.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textTransform: "uppercase",
            }}>
            {String(i + 1).padStart(2, "0")}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN INFO PANEL (Title, price, specs, CTAs) ───────────────────────
function InfoPanel({ palette, product }) {
  const [qty, setQty] = useState(1);

  return (
    <div className="ch-pdp-info" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Badges row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        {product.status === "COMING_SOON"
          ? <StatusBadge palette={palette} kind="warning" label="Coming Soon" />
          : product.stockQuantity > 0
            ? <StatusBadge palette={palette} kind="success" label="In Stock" />
            : <StatusBadge palette={palette} kind="error" label="Out of Stock" />
        }
        {product.line && <StatusBadge palette={palette} kind="line" label={product.line} color={product.lineColor} />}
      </div>

      {/* Category eyebrow */}
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 8 }}>
        {product.eyebrow}
      </div>

      {/* Title block */}
      <h1 className="ch-pdp-h1" style={{
        fontFamily: "Fraunces, serif",
        fontWeight: 300,
        fontSize: 64,
        lineHeight: 0.98,
        letterSpacing: "-0.025em",
        margin: 0,
        color: palette.ink,
      }}>
        {product.title}{product.titleItalic && <><br /><em style={{ color: palette.accent, fontWeight: 300 }}>{product.titleItalic}</em></>}
      </h1>
      {product.titleKa && (
        <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 18, color: palette.muted, marginTop: 12 }}>
          {product.titleKa}
        </div>
      )}

      {/* Price */}
      <div style={{ marginTop: 24, display: "flex", alignItems: "baseline", gap: 14 }}>
        {product.status === "COMING_SOON" ? (
          <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 24, color: palette.accent }}>
            Coming soon — pre-orders open later this season
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 38, color: palette.ink, fontWeight: 400 }}>
              ${product.priceB2c.toFixed(2)}
            </div>
            {product.weight && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.22em", color: palette.muted, textTransform: "uppercase" }}>· {product.weight}</div>}
          </>
        )}
      </div>

      {/* Description */}
      <p style={{
        fontFamily: "Fraunces, serif",
        fontStyle: "italic",
        fontSize: 19,
        lineHeight: 1.6,
        color: palette.ink2,
        marginTop: 28,
        marginBottom: 0,
      }}>{product.description}</p>

      {/* Quick story strip */}
      {product.tagline && (
        <div style={{ marginTop: 24, paddingLeft: 18, borderLeft: `2px solid ${palette.accent}`, fontFamily: "Fraunces, serif", fontSize: 15, lineHeight: 1.6, color: palette.ink, fontStyle: "italic", opacity: 0.85 }}>
          {product.tagline}
        </div>
      )}

      {/* Specs grid */}
      <div className="ch-pdp-specs" style={{
        marginTop: 36,
        paddingTop: 28,
        borderTop: `1px solid ${palette.ink}22`,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "22px 32px",
      }}>
        {product.specs.map((s, i) => (
          <div key={i}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 1.55, color: palette.ink }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="ch-pdp-cta" style={{ marginTop: 36, display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
        {product.status !== "COMING_SOON" && (
          <div style={{ display: "flex", border: `1px solid ${palette.ink}`, background: palette.cream }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 44, height: 56, background: "transparent", border: "none", fontFamily: "Fraunces, serif", fontSize: 20, color: palette.ink, cursor: "pointer" }}>−</button>
            <div style={{ width: 52, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontSize: 22, color: palette.ink, borderLeft: `1px solid ${palette.ink}22`, borderRight: `1px solid ${palette.ink}22` }}>{qty}</div>
            <button onClick={() => setQty(q => q + 1)} style={{ width: 44, height: 56, background: "transparent", border: "none", fontFamily: "Fraunces, serif", fontSize: 20, color: palette.ink, cursor: "pointer" }}>+</button>
          </div>
        )}
        {product.status === "COMING_SOON" ? (
          <button style={{ flex: 1, minWidth: 220, height: 56, background: palette.accent + "22", border: `1px solid ${palette.accent}`, color: palette.accent, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>
            Notify Me When Available
          </button>
        ) : (
          <>
            <button style={{ flex: 1, minWidth: 220, height: 56, background: palette.ink, color: palette.cream, border: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer", transition: "background 200ms" }} onMouseEnter={(e) => e.target.style.background = palette.accent} onMouseLeave={(e) => e.target.style.background = palette.ink}>
              Add to Cart · ${(product.priceB2c * qty).toFixed(2)}
            </button>
            <button style={{ height: 56, padding: "0 22px", background: "transparent", color: palette.ink, border: `1px solid ${palette.ink}`, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>
              Buy on Amazon →
            </button>
          </>
        )}
      </div>

      {/* Delivery + guarantees micro-strip */}
      <div className="ch-pdp-guarantees" style={{ marginTop: 28, paddingTop: 24, borderTop: `1px solid ${palette.ink}22`, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
        {[
          { eyebrow: "Ships in", value: "24-48h cold pack" },
          { eyebrow: "Best by", value: product.bestBy || "14 days fresh" },
          { eyebrow: "Made in", value: "Dublin, Ohio" },
        ].map((g, i) => (
          <div key={i}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase" }}>{g.eyebrow}</div>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 15, color: palette.ink, marginTop: 4 }}>{g.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PAIRINGS & USAGE STRIP ─────────────────────────────────────────────
function PairingsStrip({ palette, product }) {
  return (
    <section className="ch-section" style={{ background: palette.ink, color: palette.cream, padding: "80px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 56, alignItems: "center" }} className="ch-pdp-pairings-grid">
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase" }}>How we'd eat it</div>
          <h2 className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 56, lineHeight: 1.05, marginTop: 16, color: palette.cream }}>
            Pairs with <em style={{ color: palette.accent2, fontWeight: 400 }}>{product.pairsHeadline}</em>
          </h2>
          <p style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 18, lineHeight: 1.6, color: palette.cream, opacity: 0.78, marginTop: 16, maxWidth: 540 }}>
            {product.pairsBody}
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {product.pairings.map((p, i) => (
            <div key={i} style={{
              padding: "20px 20px",
              background: palette.ink2,
              border: `1px solid ${palette.cream}22`,
              minHeight: 132,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, lineHeight: 1.1, color: palette.cream }}>{p.name}</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, lineHeight: 1.5, color: palette.cream, opacity: 0.65, marginTop: 8 }}>{p.note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── REVIEWS ─────────────────────────────────────────────────────────────
function Star({ filled, color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" style={{ display: "inline-block" }}>
      <path d="M8 1l2.09 4.26L15 6l-3.5 3.41.83 4.84L8 11.97 3.67 14.25 4.5 9.41 1 6l4.91-.74L8 1z"
        fill={filled ? color : "transparent"} stroke={color} strokeWidth="1" />
    </svg>
  );
}

function Reviews({ palette, product }) {
  const reviews = product.reviews || [];
  const avg = reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) : 0;
  const dist = [5, 4, 3, 2, 1].map(s => ({
    star: s,
    count: reviews.filter(r => Math.round(r.rating) === s).length,
  }));
  const total = reviews.length || 1;

  return (
    <section className="ch-section" style={{ background: palette.cream, padding: "96px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 44 }} className="ch-section-header">
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>What people say</div>
            <h2 className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 48, lineHeight: 1.05, marginTop: 14, color: palette.ink }}>
              Reviews <em style={{ color: palette.accent, fontWeight: 400 }}>& notes</em>
            </h2>
          </div>
          <button style={{ height: 44, padding: "0 22px", background: palette.ink, color: palette.cream, border: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Write a review</button>
        </div>

        <div className="ch-pdp-reviews-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2.2fr", gap: 48, alignItems: "flex-start" }}>
          {/* Aggregate */}
          <div style={{ padding: 32, background: palette.cream2, border: `1px solid ${palette.ink}22` }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 72, fontWeight: 300, lineHeight: 1, color: palette.ink }}>{avg.toFixed(1)}</div>
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              {[1,2,3,4,5].map(i => <Star key={i} filled={i <= Math.round(avg)} color={palette.accent} />)}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 6 }}>{reviews.length} reviews</div>
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              {dist.map(d => (
                <div key={d.star} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: palette.muted }}>
                  <span style={{ width: 12 }}>{d.star}★</span>
                  <div style={{ flex: 1, height: 4, background: palette.ink + "15", overflow: "hidden", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${(d.count / total) * 100}%`, background: palette.accent, transition: "width 400ms" }} />
                  </div>
                  <span style={{ width: 20, textAlign: "right" }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Review list */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {reviews.map((r, i) => (
              <div key={i} style={{
                padding: "28px 0",
                borderBottom: `1px solid ${palette.ink}15`,
                display: "grid",
                gridTemplateColumns: "44px 1fr",
                gap: 18,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: palette.accent + "22",
                  border: `1px solid ${palette.accent}55`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Fraunces, serif", fontSize: 18, color: palette.accent, fontStyle: "italic"
                }}>{r.author[0]}</div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: palette.ink }}>{r.author}</span>
                      {r.verified && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", color: palette.accent, textTransform: "uppercase", marginLeft: 10 }}>· Verified buyer</span>}
                    </div>
                    <div style={{ display: "flex", gap: 2 }}>
                      {[1,2,3,4,5].map(j => <Star key={j} filled={j <= r.rating} color={palette.accent} />)}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 4 }}>{r.date}</div>
                  {r.title && <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 19, color: palette.ink, marginTop: 12, lineHeight: 1.3 }}>"{r.title}"</div>}
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 1.7, color: palette.ink2, marginTop: 10 }}>{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── RELATED ─────────────────────────────────────────────────────────────
function Related({ palette, items, eyebrow }) {
  return (
    <section className="ch-section" style={{ background: palette.cream2, padding: "96px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 44 }} className="ch-section-header">
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>{eyebrow || "Also in this collection"}</div>
            <h2 className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 48, lineHeight: 1.05, marginTop: 14, color: palette.ink }}>
              You might <em style={{ color: palette.accent, fontWeight: 400 }}>also love</em>
            </h2>
          </div>
          <a href="Shop.html" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", color: palette.ink, textTransform: "uppercase", textDecoration: "none", borderBottom: `1px solid ${palette.ink}` }}>Browse all →</a>
        </div>
        <div className="ch-pdp-related-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
          {items.map((p, i) => (
            <a key={i} href={p.href} style={{ textDecoration: "none", color: "inherit", display: "block", background: palette.cream, border: `1px solid ${palette.ink}22`, transition: "transform 200ms, box-shadow 200ms" }}
               onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 12px 36px ${palette.ink}1A`; }}
               onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ aspectRatio: "1", background: palette.cream2, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <image-slot id={`related-${p.slug}`} placeholder="" style={{ width: "100%", height: "100%" }}></image-slot>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  {p.placeholder}
                </div>
                <div style={{ position: "absolute", top: 14, left: 14 }}>
                  <StatusBadge palette={palette} kind="line" label={p.line} color={p.lineColor} />
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>{p.category}</div>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: palette.ink, marginTop: 6, lineHeight: 1.15 }}>{p.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14 }}>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: palette.ink }}>${p.price.toFixed(2)}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", color: palette.accent, textTransform: "uppercase" }}>Add →</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────
function ProductDetailPage({ palette, product, related, relatedEyebrow }) {
  return (
    <div data-screen-label={`Colchis Food — ${product.title}`}>
      <SiteHeader palette={palette} />
      <Breadcrumbs palette={palette} crumbs={product.breadcrumbs} current={product.title} />

      <main>
        {/* Hero: gallery + info */}
        <section className="ch-section" style={{ background: palette.cream, padding: "60px 56px 80px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            <div className="ch-pdp-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "flex-start" }}>
              <Gallery
                palette={palette}
                productId={product.id}
                productName={product.title}
                placeholderEl={product.galleryPlaceholder}
                mediaCount={product.mediaCount || 4}
              />
              <InfoPanel palette={palette} product={product} />
            </div>
          </div>
        </section>

        {/* Pairings */}
        <PairingsStrip palette={palette} product={product} />

        {/* Reviews */}
        <Reviews palette={palette} product={product} />

        {/* Related */}
        <Related palette={palette} items={related} eyebrow={relatedEyebrow} />
      </main>

      <Footer palette={palette} />
    </div>
  );
}

window.Breadcrumbs = Breadcrumbs;
window.Gallery = Gallery;
window.InfoPanel = InfoPanel;
window.PairingsStrip = PairingsStrip;
window.Reviews = Reviews;
window.Related = Related;
window.ProductDetailPage = ProductDetailPage;
