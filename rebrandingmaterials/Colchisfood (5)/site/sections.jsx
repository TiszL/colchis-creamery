/* global React, ColchisSeal */

// ─── PRODUCTS / SHOP TEASER ────────────────────────────────────────────────
function Products({ palette }) {
  const items = [
    { house: "Creamery", name: "Sulguni · Fresh", ka: "სულგუნი", price: "$14", note: "100% cow milk · 340g · brined fresh", tag: "Bestseller", href: "Product - Aged Sulguni Reserve.html" },
    { house: "Creamery", name: "Sulguni · Aged", ka: "სულგუნი", price: "$18", note: "Cow milk · honey-cured · 7 days · 280g", tag: "Limited", href: "Product - Aged Sulguni Reserve.html" },
    { house: "Creamery", name: "Imeruli", ka: "იმერული", price: "$12", note: "Cow milk · pulled in salted whey · 320g", tag: "", href: "Product - Aged Sulguni Reserve.html" },
    { house: "Bakery", name: "Adjaruli Khachapuri", ka: "აჭარული", price: "$16", note: "Boat-shape · egg yolk · butter · 520g", tag: "Hot · 25 min", href: "Product - Adjaruli Khachapuri.html" },
    { house: "Bakery", name: "Imeruli Khachapuri", ka: "იმერული", price: "$14", note: "Round, sulguni-stuffed · 480g", tag: "", href: "Product - Adjaruli Khachapuri.html" },
    { house: "Bakery", name: "Frozen Adjaruli · 2-pk", ka: "აჭარული", price: "$24", note: "Ships nationwide · bake in 18 min", tag: "Ships", href: "Product - Adjaruli Khachapuri.html" },
  ];
  return (
    <section className="ch-section" style={{ background: palette.cream2, padding: "120px 56px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 56 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 04 — The Shop</div>
            <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 64, lineHeight: 1.05, letterSpacing: "-0.02em", color: palette.ink, marginTop: 14 }}>
              What's <em style={{ color: palette.accent, fontWeight: 400 }}>made today.</em>
            </div>
          </div>
          <a style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: palette.ink, textDecoration: "none", borderBottom: `1px solid ${palette.ink}` }}>See all 12 items →</a>
        </div>
        <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {items.map((p, i) => (
            <a key={i} href={p.href} style={{ background: palette.cream, border: `1px solid ${palette.ink}14`, overflow: "hidden", display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit", cursor: "pointer" }}>
              <div style={{ aspectRatio: "4/3", background: palette.cream2, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `1px solid ${palette.ink}14` }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", color: palette.muted, opacity: 0.6, textTransform: "uppercase" }}>[ {p.name} photo ]</div>
                {p.tag && <div style={{ position: "absolute", top: 16, left: 16, padding: "6px 12px", background: p.tag.includes("Hot") ? palette.accent : palette.ink, color: palette.cream, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase" }}>{p.tag}</div>}
                <div style={{ position: "absolute", top: 16, right: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", color: palette.accent, textTransform: "uppercase" }}>{p.house}</div>
              </div>
              <div style={{ padding: "24px 24px 28px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 26, color: palette.ink, lineHeight: 1 }}>{p.name}</div>
                    <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 14, color: palette.ink, opacity: 0.5, marginTop: 4 }}>{p.ka}</div>
                  </div>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: palette.accent, fontWeight: 500 }}>{p.price}</div>
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: palette.ink2, lineHeight: 1.5, marginTop: 12, flex: 1 }}>{p.note}</div>
                <div style={{ marginTop: 20, background: "transparent", color: palette.ink, border: `1px solid ${palette.ink}`, padding: "12px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", textAlign: "center" }}>View product →</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── PROCESS / HOW WE MAKE IT ──────────────────────────────────────────────
function Process({ palette }) {
  const steps = [
    { n: "01", t: "Milk arrives 6 AM", d: "From three Ohio dairies, within 4 hours of milking. Cow only — never sheep." },
    { n: "02", t: "Curds, cut by hand", d: "Heated to 86°F, cut, pulled, kneaded. The same motions for two thousand years." },
    { n: "03", t: "Brine 24 hours", d: "Cold salt brine. Fresh sulguni ships at hour 24. Aged sulguni rests 7 days with raw honey." },
    { n: "04", t: "Out the door by 5 PM", d: "Packed cold, into UPS for the country, or onto Doordash for Dublin." },
  ];
  return (
    <section className="ch-section" style={{ background: palette.ink, color: palette.cream, padding: "120px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div className="ch-section-grid" style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 64, marginBottom: 72 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase" }}>№ 05</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.24em", color: palette.cream, opacity: 0.5, textTransform: "uppercase", marginTop: 8 }}>How we make it</div>
          </div>
          <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", color: palette.cream, maxWidth: 880 }}>
            One day, <em style={{ color: palette.accent2, fontWeight: 400 }}>start to finish.</em>
          </div>
        </div>
        <div className="ch-process-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: palette.cream + "22" }}>
          {steps.map((s) => (
            <div key={s.n} className="ch-process-step" style={{ background: palette.ink, padding: 36 }}>
              <div className="ch-process-num" style={{ fontFamily: "Fraunces, serif", fontSize: 64, fontWeight: 300, color: palette.accent2, lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 26, color: palette.cream, marginTop: 20, lineHeight: 1.1 }}>{s.t}</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: palette.cream, opacity: 0.7, lineHeight: 1.6, marginTop: 14 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── PRESS / REVIEWS ───────────────────────────────────────────────────────
function Press({ palette }) {
  return (
    <section className="ch-section" style={{ background: palette.cream, padding: "120px 56px" }}>
      <div className="ch-split" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80 }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 32 }}>№ 06 — In good company</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {["Columbus Monthly", "Eater Midwest", "Cherry Bombe", "Bon Appétit"].map((p) => (
              <div key={p} style={{ aspectRatio: "16/7", background: palette.cream2, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${palette.ink}14`, fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, color: palette.ink, opacity: 0.55 }}>{p}</div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 32 }}>★ 4.9 / 312 reviews</div>
          <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontWeight: 300, fontSize: 36, lineHeight: 1.3, color: palette.ink, letterSpacing: "-0.01em" }}>
            "I grew up eating khachapuri on the Black Sea. This tastes exactly like the bakery on the corner where I was a kid. Somehow they did it in Ohio."
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 28 }}>— Nia G. · Brooklyn NY · ★★★★★</div>
        </div>
      </div>
    </section>
  );
}

// ─── FOUNDERS / VISIT ──────────────────────────────────────────────────────
function Visit({ palette }) {
  return (
    <section className="ch-section" style={{ background: palette.cream2, padding: "120px 56px" }}>
      <div className="ch-split" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
        <div style={{ aspectRatio: "4/5", background: palette.ink2, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.cream, opacity: 0.5, textTransform: "uppercase" }}>[ Founders portrait ]</div>
        </div>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 07 — Visit us</div>
          <div className="ch-h2-large" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 64, lineHeight: 1.0, letterSpacing: "-0.02em", color: palette.ink, marginTop: 16 }}>
            5340 Tuller Rd<br /><em style={{ color: palette.accent, fontWeight: 400 }}>Dublin, OH</em>
          </div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, lineHeight: 1.6, color: palette.ink2, marginTop: 28, maxWidth: 480 }}>
            The bakery is open Wednesday through Sunday, 8 AM to 9 PM. The creamery is by appointment — we'd love to show you the cheese cellar.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 40, paddingTop: 32, borderTop: `1px solid ${palette.ink}22` }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>Bakery hours</div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: palette.ink, marginTop: 8 }}>Wed–Sun · 8a–9p</div>
            </div>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>Phone</div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: palette.ink, marginTop: 8 }}>(614) 555-0142</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
            <button style={{ background: palette.ink, color: palette.cream, border: "none", padding: "16px 28px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Get directions →</button>
            <button style={{ background: "transparent", color: palette.ink, border: `1px solid ${palette.ink}`, padding: "16px 28px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Book a tour</button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ────────────────────────────────────────────────────────────────
function Footer({ palette }) {
  return (
    <footer className="ch-footer" style={{ background: palette.ink, color: palette.cream, padding: "80px 56px 40px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div className="ch-footer-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 1.2fr", gap: 56, paddingBottom: 56, borderBottom: `1px solid ${palette.cream}22` }}>
          <div className="ch-footer-brand">
            <ColchisSeal palette={palette} size={64} invert />
            <div style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: 16, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 18 }}>Colchis Food</div>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 18, color: palette.accent2, marginTop: 12 }}>Ancient heritage, fresh every day.</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, opacity: 0.6, marginTop: 24, lineHeight: 1.6, maxWidth: 280 }}>
              5340 Tuller Rd<br />Dublin, Ohio 43017<br />Made by hand, since 2026
            </div>
          </div>
          {[
            { t: "The Creamery", l: ["Sulguni Fresh", "Sulguni Aged", "Imeruli", "Cheese boards", "Subscriptions"] },
            { t: "The Bakery", l: ["Hot delivery", "Pickup", "Frozen ship", "Catering", "Today's menu"] },
            { t: "Company", l: ["Heritage", "Wholesale", "Press", "Contact", "Careers"] },
          ].map((c) => (
            <div key={c.t}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.accent2, textTransform: "uppercase", marginBottom: 18 }}>{c.t}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {c.l.map((i) => <li key={i}><a style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: palette.cream, opacity: 0.75, textDecoration: "none" }}>{i}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="ch-footer-bottom" style={{ display: "flex", justifyContent: "space-between", marginTop: 36, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.cream, opacity: 0.5, textTransform: "uppercase" }}>
          <span>© 2026 Colchis Food LLC · Dublin OH</span>
          <span>EN / ქართული</span>
          <span>colchisfood.com</span>
        </div>
      </div>
    </footer>
  );
}

window.Products = Products;
window.Process = Process;
window.Press = Press;
window.Visit = Visit;
window.Footer = Footer;
