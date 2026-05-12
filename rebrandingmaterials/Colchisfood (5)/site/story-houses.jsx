/* global React, ColchisSeal */

// ─── STORY SECTION ─────────────────────────────────────────────────────────
function Story({ palette }) {
  return (
    <section className="ch-section" style={{ background: palette.cream, padding: "140px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div className="ch-section-grid" style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 64, alignItems: "start" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 02</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 8 }}>Our Story</div>
          </div>
          <div>
            <div className="ch-h2-large" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 64, lineHeight: 1.05, letterSpacing: "-0.02em", color: palette.ink, maxWidth: 980 }}>
              Two thousand years ago, Colchis was the kingdom Greek sailors called <em style={{ color: palette.accent, fontWeight: 400 }}>the edge of the known world</em> — a black-sea coast of vine and wheat, of cheese aged in clay and bread baked in earth ovens.
            </div>
            <div className="ch-lede" style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontWeight: 300, fontSize: 36, lineHeight: 1.2, color: palette.ink2, marginTop: 40, maxWidth: 880 }}>
              We make those foods, here, with milk from Ohio dairies and the same recipes our grandmothers taught.
            </div>
            <div className="ch-stats" style={{ display: "flex", gap: 56, marginTop: 64, paddingTop: 40, borderTop: `1px solid ${palette.ink}22` }}>
              <div>
                <div className="ch-stat-num" style={{ fontFamily: "Fraunces, serif", fontSize: 56, fontWeight: 400, color: palette.accent, lineHeight: 1 }}>2,000</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 8 }}>Years of recipe</div>
              </div>
              <div>
                <div className="ch-stat-num" style={{ fontFamily: "Fraunces, serif", fontSize: 56, fontWeight: 400, color: palette.accent, lineHeight: 1 }}>04</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 8 }}>Generations</div>
              </div>
              <div>
                <div className="ch-stat-num" style={{ fontFamily: "Fraunces, serif", fontSize: 56, fontWeight: 400, color: palette.accent, lineHeight: 1 }}>1</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 8 }}>Bakery in Dublin OH</div>
              </div>
              <div>
                <div className="ch-stat-num" style={{ fontFamily: "Fraunces, serif", fontSize: 56, fontWeight: 400, color: palette.accent, lineHeight: 1 }}>50</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 8 }}>States we ship</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── TWO HOUSES (sub-brands as full sections) ────────────────────────────
function ThreeHouses({ palette }) {
  const houses = [
    { name: "The Creamery", ka: "ყველის სახლი", num: "I", tag: "Imeruli & Sulguni, hand-pressed", cta: "Shop cheese →", desc: "Cow-milk Sulguni, brined fresh or aged with honey. Imeruli pulled in salted whey. Aged in our Dublin facility, shipped fresh nationwide.", bg: palette.cream2 },
    { name: "The Bakery", ka: "საცხობი", num: "II", tag: "Khachapuri, hot from the oven", cta: "Order hot delivery →", desc: "Adjaruli, Imeruli, Megruli — pulled apart at 25 minutes via Doordash and Uber Eats inside Dublin. Frozen for the rest of the country.", bg: palette.ink, dark: true },
  ];
  return (
    <section style={{ background: palette.cream }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 32px", borderTop: `1px solid ${palette.ink}22` }}>
        <div className="ch-section-grid" style={{ padding: "100px 24px 60px", display: "grid", gridTemplateColumns: "200px 1fr", gap: 64 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 03</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 8 }}>Two Houses</div>
          </div>
          <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", color: palette.ink, maxWidth: 900 }}>
            One parent house, <em style={{ color: palette.accent, fontWeight: 400 }}>two crafts.</em>
          </div>
        </div>
      </div>
      <div className="ch-houses" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {houses.map((h) => (
          <div key={h.name} className="ch-house" style={{ background: h.bg, color: h.dark ? palette.cream : palette.ink, padding: "64px 48px 56px", minHeight: 560, display: "flex", flexDirection: "column", justifyContent: "space-between", borderRight: `1px solid ${h.dark ? palette.cream + '22' : palette.ink + '22'}` }}>
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
                <ColchisSeal palette={palette} size={56} invert={h.dark} />
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 56, fontWeight: 300, color: h.dark ? palette.accent2 : palette.accent, lineHeight: 1 }}>{h.num}</div>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.32em", color: h.dark ? palette.accent2 : palette.accent, textTransform: "uppercase" }}>{h.tag}</div>
              <div className="ch-house-name" style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 56, fontWeight: 400, lineHeight: 1, color: h.dark ? palette.cream : palette.ink, marginTop: 16, letterSpacing: "-0.01em" }}>{h.name}</div>
              <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 18, color: h.dark ? palette.cream : palette.ink, opacity: 0.55, marginTop: 8 }}>{h.ka}</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 15, lineHeight: 1.65, color: h.dark ? palette.cream : palette.ink2, opacity: h.dark ? 0.8 : 1, marginTop: 24, maxWidth: 360 }}>{h.desc}</div>
            </div>
            <div style={{ marginTop: 32 }}>
              <div style={{ width: "100%", aspectRatio: "16/10", background: h.dark ? palette.ink2 : palette.cream2, border: `1px solid ${h.dark ? palette.cream + '22' : palette.ink + '22'}`, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", color: h.dark ? palette.cream : palette.muted, opacity: 0.6, textTransform: "uppercase" }}>
                [ {h.name} photo ]
              </div>
              <a style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: h.dark ? palette.accent2 : palette.accent, textDecoration: "none", borderBottom: `1px solid ${h.dark ? palette.accent2 : palette.accent}` }}>{h.cta}</a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

window.Story = Story;
window.ThreeHouses = ThreeHouses;
