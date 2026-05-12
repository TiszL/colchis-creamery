/* global React, ColchisSeal */
const { useState } = React;

function BakeryHero({ palette }) {
  return (
    <section className="ch-bakery-hero" style={{ background: palette.ink, color: palette.cream, padding: "100px 56px 80px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${palette.cream}06 1px, transparent 1px), linear-gradient(90deg, ${palette.cream}06 1px, transparent 1px)`, backgroundSize: "80px 80px", pointerEvents: "none" }} />
      <div className="ch-bakery-hero-grid" style={{ maxWidth: 1280, margin: "0 auto", position: "relative", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 64, alignItems: "end" }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase", marginBottom: 24 }}>The Bakery · საცხობი · Open until 9 PM</div>
          <h1 className="ch-bakery-h1" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 124, lineHeight: 0.9, letterSpacing: "-0.03em", margin: 0 }}>
            Hot from <em style={{ color: palette.accent2, fontWeight: 300 }}>the oven</em><br />in Dublin, Ohio.
          </h1>
        </div>
        <div style={{ background: palette.cream, color: palette.ink, padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: palette.muted }}>Today · Sun May 3</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: palette.accent }}>● Baking now</span>
          </div>
          <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 32, color: palette.ink, lineHeight: 1.1 }}>Adjaruli · Imeruli<br />Megruli · Lobiani</div>
          <div style={{ height: 1, background: palette.ink + "22", margin: "20px 0" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: palette.ink2 }}>
            <span>Hot delivery · 25 min</span>
            <span style={{ textAlign: "right" }}>Pickup · 15 min</span>
            <span>Doordash · Uber Eats</span>
            <span style={{ textAlign: "right" }}>5340 Tuller Rd</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function BakeryMenu({ palette }) {
  const [tab, setTab] = useState("hot");
  const items = {
    hot: [
      { name: "Adjaruli", ka: "აჭარული", desc: "Boat-shaped, egg yolk, melted butter, sulguni & imeruli inside.", weight: "520g", price: "$16", tag: "Bestseller" },
      { name: "Imeruli", ka: "იმერული", desc: "Round, sulguni-stuffed, blistered top.", weight: "480g", price: "$14", tag: "" },
      { name: "Megruli", ka: "მეგრული", desc: "Imeruli with a second layer of sulguni baked over the crust.", weight: "560g", price: "$17", tag: "" },
      { name: "Lobiani", ka: "ლობიანი", desc: "Filled with spiced kidney beans — the day after-the-feast classic.", weight: "440g", price: "$13", tag: "Vegan" },
      { name: "Penovani", ka: "ფენოვანი", desc: "Layered, flaky pastry version with sulguni.", weight: "380g", price: "$12", tag: "" },
      { name: "Achma", ka: "აჩმა", desc: "Many-layered baked pasta-meets-cheese tray slice.", weight: "420g", price: "$15", tag: "Limited" },
    ],
    frozen: [
      { name: "Adjaruli · 2-pk", ka: "აჭარული", desc: "Frozen at peak, ships nationwide. Bake from frozen in 18 min.", weight: "520g × 2", price: "$24", tag: "Ships" },
      { name: "Imeruli · 2-pk", ka: "იმერული", desc: "The classic, frozen. UPS Ground anywhere in 50 states.", weight: "480g × 2", price: "$22", tag: "Ships" },
      { name: "Megruli · 2-pk", ka: "მეგრული", desc: "Cheese on cheese, frozen. Bake at 425°F.", weight: "560g × 2", price: "$26", tag: "Ships" },
      { name: "Lobiani · 2-pk", ka: "ლობიანი", desc: "Bean-filled, vegan, freezer-stable.", weight: "440g × 2", price: "$20", tag: "Vegan" },
    ],
  };
  return (
    <section className="ch-section" style={{ background: palette.cream, padding: "120px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 56 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 01 — The Menu</div>
            <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", color: palette.ink, marginTop: 14 }}>
              Six khachapuri, <em style={{ color: palette.accent, fontWeight: 400 }}>two ways.</em>
            </div>
          </div>
          <div className="ch-tab-row" style={{ display: "flex", gap: 0, border: `1px solid ${palette.ink}44` }}>
            <button onClick={() => setTab("hot")} style={{ padding: "14px 26px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", background: tab === "hot" ? palette.ink : "transparent", color: tab === "hot" ? palette.cream : palette.ink, border: "none", cursor: "pointer" }}>◐ Hot · Dublin</button>
            <button onClick={() => setTab("frozen")} style={{ padding: "14px 26px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", background: tab === "frozen" ? palette.ink : "transparent", color: tab === "frozen" ? palette.cream : palette.ink, border: "none", cursor: "pointer", borderLeft: `1px solid ${palette.ink}44` }}>▸ Frozen · 50 states</button>
          </div>
        </div>
        <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {items[tab].map((p, i) => (
            <div key={i} style={{ background: palette.cream2, border: `1px solid ${palette.ink}14`, display: "flex", flexDirection: "column" }}>
              <div style={{ aspectRatio: "4/3", background: palette.ink + "08", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `1px solid ${palette.ink}14` }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", color: palette.muted, opacity: 0.6, textTransform: "uppercase" }}>[ {p.name} photo ]</div>
                {p.tag && <div style={{ position: "absolute", top: 16, left: 16, padding: "6px 12px", background: p.tag === "Vegan" ? palette.ink2 : palette.accent, color: palette.cream, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase" }}>{p.tag}</div>}
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 28, color: palette.ink, lineHeight: 1 }}>{p.name}</div>
                    <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 16, color: palette.ink, opacity: 0.5, marginTop: 4 }}>{p.ka}</div>
                  </div>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: palette.accent, fontWeight: 500 }}>{p.price}</div>
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: palette.ink2, lineHeight: 1.55, marginTop: 12 }}>{p.desc}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: palette.muted, textTransform: "uppercase", marginTop: 14 }}>{p.weight}</div>
                <button style={{ marginTop: "auto", paddingTop: 18, width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                  <div style={{ marginTop: 18, width: "100%", background: tab === "hot" ? palette.accent : palette.ink, color: palette.cream, padding: "12px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", textAlign: "center" }}>{tab === "hot" ? "Order hot →" : "Add to box →"}</div>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DeliveryZones({ palette }) {
  return (
    <section className="ch-section" style={{ background: palette.cream2, padding: "120px 56px" }}>
      <div className="ch-split" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 02 — Two logistics, one tap</div>
          <div className="ch-h2-large" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 56, lineHeight: 1.0, letterSpacing: "-0.02em", color: palette.ink, marginTop: 16 }}>
            Hot here, <em style={{ color: palette.accent, fontWeight: 400 }}>frozen everywhere.</em>
          </div>
          <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 28 }}>
            <div style={{ paddingLeft: 20, borderLeft: `2px solid ${palette.accent}` }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.accent, textTransform: "uppercase" }}>◐ Hot zone · 8 mi radius</div>
              <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 28, color: palette.ink, marginTop: 6 }}>Dublin · Hilliard · Powell · Worthington</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: palette.ink2, marginTop: 8 }}>Doordash & Uber Eats. ETA 25 min until 9 PM. Adding new locations as we grow.</div>
            </div>
            <div style={{ paddingLeft: 20, borderLeft: `2px solid ${palette.ink}` }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.ink, textTransform: "uppercase" }}>▸ Ship zone · 50 states</div>
              <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 28, color: palette.ink, marginTop: 6 }}>UPS Ground · 1–2 days</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: palette.ink2, marginTop: 8 }}>Frozen at peak, dry-ice insulated. Free shipping over $75. Bake from frozen at home.</div>
            </div>
          </div>
        </div>
        {/* Map placeholder */}
        <div style={{ aspectRatio: "1", background: palette.cream, position: "relative", border: `1px solid ${palette.ink}22`, overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${palette.ink}11 1px, transparent 1px), linear-gradient(90deg, ${palette.ink}11 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
          {/* Concentric zones */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "85%", height: "85%", borderRadius: "50%", border: `1px dashed ${palette.ink}33` }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "55%", height: "55%", borderRadius: "50%", border: `2px solid ${palette.accent}66`, background: palette.accent + "11" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 16, height: 16, borderRadius: "50%", background: palette.ink, boxShadow: `0 0 0 6px ${palette.cream}, 0 0 0 8px ${palette.ink}` }} />
          <div style={{ position: "absolute", top: "calc(50% - 80px)", left: "50%", transform: "translateX(-50%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.ink, textTransform: "uppercase", padding: "4px 10px", background: palette.cream }}>HOT · 25 min</div>
          <div style={{ position: "absolute", bottom: 28, left: 28, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>● Dublin OH · 5340 Tuller Rd</div>
          <div style={{ position: "absolute", top: 28, right: 28, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>▸ Ships nationwide</div>
        </div>
      </div>
    </section>
  );
}

window.BakeryHero = BakeryHero;
window.BakeryMenu = BakeryMenu;
window.DeliveryZones = DeliveryZones;
