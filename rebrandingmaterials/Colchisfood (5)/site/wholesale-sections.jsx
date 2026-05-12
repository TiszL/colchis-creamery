/* global React, ColchisSeal, SiteHeader, Footer */

function WholesaleHero({ palette }) {
  return (
    <section className="ch-section" style={{ background: palette.ink, color: palette.cream, padding: "120px 56px 100px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${palette.cream}06 1px, transparent 1px), linear-gradient(90deg, ${palette.cream}06 1px, transparent 1px)`, backgroundSize: "80px 80px", pointerEvents: "none" }} />
      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase", marginBottom: 32 }}>
          For Restaurants, Grocers & Specialty Markets
        </div>
        <h1 className="ch-bakery-h1" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 124, lineHeight: 0.9, letterSpacing: "-0.03em", margin: 0, maxWidth: 1100 }}>
          Stock the only <em style={{ color: palette.accent2, fontWeight: 300 }}>Georgian cheese</em><br />made in the Midwest.
        </h1>
        <div className="ch-section-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 48, marginTop: 80, paddingTop: 48, borderTop: `1px solid ${palette.cream}22` }}>
          <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, lineHeight: 1.5, opacity: 0.85 }}>
            Wholesale partners get cold-chain delivery within a 10-hour drive radius, custom labels, and access to the full Creamery & Bakery line — including private-label runs.
          </div>
          <div>
            <div className="ch-stat-num" style={{ fontFamily: "Fraunces, serif", fontSize: 56, fontWeight: 400, color: palette.accent2, lineHeight: 1 }}>40+</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.cream, opacity: 0.6, textTransform: "uppercase", marginTop: 8 }}>Active accounts in 6 states</div>
          </div>
          <div>
            <div className="ch-stat-num" style={{ fontFamily: "Fraunces, serif", fontSize: 56, fontWeight: 400, color: palette.accent2, lineHeight: 1 }}>72h</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.cream, opacity: 0.6, textTransform: "uppercase", marginTop: 8 }}>From order to your dock</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WholesaleTiers({ palette }) {
  const tiers = [
    { tag: "01", name: "Restaurant", min: "$200 / wk", desc: "Standard line. Net 14. Free delivery in Ohio + 5-state ring.", who: "Restaurants, cafés, bakeries", check: ["Full Creamery & Bakery line", "Weekly cold-chain delivery", "Net 14 terms", "Menu support & training"] },
    { tag: "02", name: "Grocery", min: "$500 / wk", desc: "Retail-ready packaging with UPC, planogram support, in-store demo days.", who: "Independent grocers, co-ops", check: ["Retail-ready labels & UPC", "Planogram & POS materials", "Quarterly demo days", "Net 30 terms"] },
    { tag: "03", name: "Private Label", min: "$2,500 / mo", desc: "Your brand on our cheese. Minimum 100 wheels per SKU per run.", who: "Brands, hotels, meal-kits", check: ["Custom artwork & SKU", "Min. 100 units / SKU / run", "Quarterly production windows", "Co-marketing rights"] },
  ];
  return (
    <section className="ch-section" style={{ background: palette.cream, padding: "140px 56px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div className="ch-section-grid" style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 64, marginBottom: 72 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 01</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 8 }}>Three ways to partner</div>
          </div>
          <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", color: palette.ink, maxWidth: 800 }}>
            Pick the relationship <em style={{ color: palette.accent, fontWeight: 400 }}>that fits.</em>
          </div>
        </div>
        <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {tiers.map((t) => (
            <div key={t.name} style={{ background: palette.cream2, padding: "44px 36px 40px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 44, fontWeight: 300, color: palette.accent, lineHeight: 1 }}>{t.tag}</div>
                <ColchisSeal palette={palette} size={44} />
              </div>
              <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 36, color: palette.ink, lineHeight: 1, fontWeight: 400 }}>{t.name}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase", marginTop: 10 }}>Min · {t.min}</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 1.6, color: palette.ink2, marginTop: 20 }}>{t.desc}</div>
              <div style={{ height: 1, background: palette.ink + "22", margin: "28px 0" }} />
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                {t.check.map((c) => (
                  <li key={c} style={{ display: "flex", gap: 12, fontFamily: "Inter, sans-serif", fontSize: 13, color: palette.ink, lineHeight: 1.5 }}>
                    <span style={{ color: palette.accent, fontFamily: "'JetBrains Mono', monospace" }}>+</span>{c}
                  </li>
                ))}
              </ul>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 28 }}>For · {t.who}</div>
              <button style={{ marginTop: 24, background: palette.ink, color: palette.cream, border: "none", padding: "16px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Apply →</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WholesaleCatalog({ palette }) {
  const sku = [
    { code: "CRE-01", name: "Sulguni · Fresh", size: "340g wheel", case: "12 / case", price: "$8.40 ea" },
    { code: "CRE-02", name: "Sulguni · Aged · Honey", size: "280g wheel", case: "12 / case", price: "$11.20 ea" },
    { code: "CRE-03", name: "Imeruli", size: "320g round", case: "12 / case", price: "$7.20 ea" },
    { code: "CRE-04", name: "Sulguni · Bulk loaf", size: "2.5 kg", case: "4 / case", price: "$48.00 ea" },
    { code: "BAK-01", name: "Adjaruli · Frozen", size: "520g, 2 pk", case: "6 cs / case", price: "$14.40 ea" },
    { code: "BAK-02", name: "Imeruli Khachapuri · Frozen", size: "480g, 2 pk", case: "6 cs / case", price: "$12.60 ea" },
    { code: "BAK-03", name: "Megruli · Frozen", size: "500g, 2 pk", case: "6 cs / case", price: "$15.20 ea" },
    { code: "BAK-04", name: "Lobiani · Frozen", size: "440g, 2 pk", case: "6 cs / case", price: "$11.80 ea" },
  ];
  return (
    <section className="ch-section" style={{ background: palette.cream2, padding: "120px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 48 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 02 — Catalog</div>
            <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", color: palette.ink, marginTop: 14 }}>
              Wholesale <em style={{ color: palette.accent, fontWeight: 400 }}>SKUs.</em>
            </div>
          </div>
          <a style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: palette.ink, textDecoration: "none", borderBottom: `1px solid ${palette.ink}` }}>Download line sheet PDF →</a>
        </div>
        <div style={{ background: palette.cream, border: `1px solid ${palette.ink}14` }}>
          <div className="ch-table-header" style={{ display: "grid", gridTemplateColumns: "120px 1fr 200px 160px 160px", padding: "20px 32px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", borderBottom: `1px solid ${palette.ink}22` }}>
            <span>SKU</span><span>Product</span><span className="ch-hide-mobile">Size</span><span className="ch-hide-mobile">Pack</span><span style={{ textAlign: "right" }}>Wholesale</span>
          </div>
          {sku.map((s, i) => (
            <div key={s.code} className="ch-table-row" style={{ display: "grid", gridTemplateColumns: "120px 1fr 200px 160px 160px", padding: "22px 32px", borderBottom: i < sku.length - 1 ? `1px solid ${palette.ink}11` : "none", alignItems: "center" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: palette.accent, letterSpacing: "0.16em" }}>{s.code}</span>
              <span className="ch-product-name" style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, color: palette.ink }}>{s.name}</span>
              <span className="ch-hide-mobile" style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: palette.ink2 }}>{s.size}</span>
              <span className="ch-hide-mobile" style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: palette.ink2 }}>{s.case}</span>
              <span style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: palette.ink, textAlign: "right" }}>{s.price}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WholesaleApply({ palette }) {
  return (
    <section className="ch-section" style={{ background: palette.cream, padding: "120px 56px" }}>
      <div className="ch-split" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 80, alignItems: "start" }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 03 — Apply</div>
          <div className="ch-h2-large" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 64, lineHeight: 1.0, letterSpacing: "-0.02em", color: palette.ink, marginTop: 16 }}>
            Tell us about <em style={{ color: palette.accent, fontWeight: 400 }}>your shop.</em>
          </div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, lineHeight: 1.6, color: palette.ink2, marginTop: 28, fontStyle: "italic" }}>
            We review applications every Tuesday. Most accounts are onboarded within 10 days. Cold-chain shipping is included to anywhere within a 10-hour drive of Dublin, OH.
          </div>
          <div style={{ marginTop: 40, paddingTop: 28, borderTop: `1px solid ${palette.ink}22` }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>Or email directly</div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: palette.ink, marginTop: 8 }}>wholesale@colchisfood.com</div>
          </div>
        </div>
        <div style={{ background: palette.cream2, padding: 40 }}>
          {[
            { l: "Business name", p: "Your restaurant or shop" },
            { l: "Contact name", p: "" },
            { l: "Email", p: "" },
            { l: "Phone", p: "" },
            { l: "ZIP code", p: "43017" },
            { l: "Tier of interest", p: "Restaurant / Grocery / Private Label", select: true },
          ].map((f, i) => (
            <div key={i} style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginBottom: 8 }}>{f.l}</div>
              <input placeholder={f.p} style={{ width: "100%", fontFamily: f.select ? "Inter, sans-serif" : "Fraunces, serif", fontStyle: f.select ? "normal" : "italic", fontSize: 18, background: "transparent", border: "none", borderBottom: `1px solid ${palette.ink}44`, padding: "10px 0", color: palette.ink, outline: "none" }} />
            </div>
          ))}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginBottom: 8 }}>Tell us about your business</div>
            <textarea rows="3" style={{ width: "100%", fontFamily: "Inter, sans-serif", fontSize: 14, background: "transparent", border: `1px solid ${palette.ink}44`, padding: "12px", color: palette.ink, outline: "none", resize: "vertical" }} />
          </div>
          <button style={{ width: "100%", background: palette.ink, color: palette.cream, border: "none", padding: "18px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer", marginTop: 12 }}>Submit application →</button>
        </div>
      </div>
    </section>
  );
}

window.WholesaleHero = WholesaleHero;
window.WholesaleTiers = WholesaleTiers;
window.WholesaleCatalog = WholesaleCatalog;
window.WholesaleApply = WholesaleApply;
