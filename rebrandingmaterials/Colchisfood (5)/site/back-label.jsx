/* global React, ColchisSeal */

// ─── BACK-OF-PACK LABEL (the branded sticker that goes on the dark side) ──
function BackLabel({ palette, productName, productKa, weight, lot, batch, exp, w = 380, h = 660 }) {
  return (
    <div className="ch-back-label" style={{ width: w, height: h, background: palette.cream, color: palette.ink, padding: 22, fontFamily: "'Inter', sans-serif", position: "relative", boxShadow: `0 24px 60px ${palette.ink}22`, border: `1px solid ${palette.ink}22`, display: "flex", flexDirection: "column" }}>
      {/* Engraved border */}
      <div style={{ position: "absolute", inset: 10, border: `1px solid ${palette.ink}33`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 14, border: `0.5px solid ${palette.ink}22`, pointerEvents: "none" }} />

      {/* Top: micro-text border + seal corner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 10, borderBottom: `1px solid ${palette.ink}22`, position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.36em", color: palette.muted, textTransform: "uppercase" }}>EST · MMXXVI · OHIO</div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 14, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: palette.ink, marginTop: 4 }}>Colchis Food</div>
        </div>
        {ColchisSeal && <ColchisSeal palette={palette} size={42} />}
      </div>

      {/* Product name */}
      <div style={{ marginTop: 14, position: "relative", zIndex: 1 }}>
        <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontWeight: 400, fontSize: 26, lineHeight: 1.05, color: palette.ink, letterSpacing: "-0.01em" }}>{productName}</div>
        {productKa && <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 14, color: palette.accent, marginTop: 4 }}>{productKa}</div>}
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase", marginTop: 8 }}>NET WT · {weight}</div>
      </div>

      {/* Story blurb */}
      <div style={{ marginTop: 14, fontFamily: "Fraunces, serif", fontSize: 9.5, lineHeight: 1.55, color: palette.ink2, position: "relative", zIndex: 1, fontStyle: "italic" }}>
        Hand-pulled in salted whey from the milk of three small Ohio dairies. The recipe is two thousand years old; the cheese is six hours old. <span style={{ fontStyle: "normal", color: palette.muted }}>ხელით დამზადებული · ოჰაიო</span>
      </div>

      {/* INGREDIENTS */}
      <div style={{ marginTop: 12, position: "relative", zIndex: 1 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 4 }}>Ingredients · შემადგენლობა</div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 8.5, lineHeight: 1.5, color: palette.ink }}>
          Pasteurized whole cow milk, salt, microbial rennet, citric acid. <span style={{ color: palette.muted }}>Pasterizirebuli rZe, marili, mayasagani, limanis mJava.</span>
        </div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 8, lineHeight: 1.4, color: palette.muted, marginTop: 4 }}>
          <strong style={{ color: palette.accent }}>Contains:</strong> Milk. Made in a facility that also processes wheat.
        </div>
      </div>

      {/* NUTRITION FACTS panel */}
      <div style={{ marginTop: 10, padding: "8px 10px", border: `1px solid ${palette.ink}`, position: "relative", zIndex: 1, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 12, fontWeight: 500, color: palette.ink, lineHeight: 1, borderBottom: `2px solid ${palette.ink}`, paddingBottom: 4 }}>Nutrition Facts</div>
        <div style={{ fontSize: 7, color: palette.ink, marginTop: 3, display: "flex", justifyContent: "space-between" }}>
          <span>Serving size 28g (1 oz)</span><span>Servings ~18</span>
        </div>
        <div style={{ fontSize: 7, color: palette.ink, borderTop: `1px solid ${palette.ink}`, marginTop: 4, paddingTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>Calories</span><span style={{ fontFamily: "Fraunces, serif", fontSize: 14 }}>80</span></div>
          {[
            ["Total Fat 6g", "8%"],
            ["  Saturated Fat 4g", "20%"],
            ["Cholesterol 22mg", "7%"],
            ["Sodium 180mg", "8%"],
            ["Total Carb 1g", "0%"],
            ["Protein 6g", "12%"],
            ["Calcium 180mg", "14%"],
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", borderTop: `0.5px solid ${palette.ink}55`, padding: "2px 0", fontSize: 7 }}>
              <span>{row[0]}</span><span style={{ fontWeight: 600 }}>{row[1]}</span>
            </div>
          ))}
          <div style={{ borderTop: `4px solid ${palette.ink}`, marginTop: 4, paddingTop: 3, fontSize: 6, color: palette.muted, lineHeight: 1.3 }}>* % Daily Values based on a 2,000 calorie diet.</div>
        </div>
      </div>

      {/* BOTTOM band: lot, batch, expiry, address */}
      <div style={{ marginTop: "auto", paddingTop: 12, display: "flex", flexDirection: "column", gap: 4, zIndex: 1, position: "relative" }}>
        <div style={{ borderTop: `1px solid ${palette.ink}33`, paddingTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.16em", color: palette.ink, textTransform: "uppercase" }}>
          <div><div style={{ color: palette.muted, fontSize: 6, letterSpacing: "0.28em" }}>BATCH</div><div>{batch}</div></div>
          <div><div style={{ color: palette.muted, fontSize: 6, letterSpacing: "0.28em" }}>LOT</div><div>{lot}</div></div>
          <div><div style={{ color: palette.muted, fontSize: 6, letterSpacing: "0.28em" }}>BEST BY</div><div>{exp}</div></div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 6.5, letterSpacing: "0.22em", color: palette.muted, textTransform: "uppercase" }}>
          <span>Colchis Food LLC · 5340 Tuller Rd · Dublin OH 43017</span>
          <span>colchisfood.com</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 6.5, letterSpacing: "0.18em", color: palette.muted }}>
          <span>USDA EST. 38112 · KEEP REFRIGERATED 34–40°F</span>
          <span>♺ PE / RECYCLABLE</span>
        </div>
        {/* Barcode */}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="120" height="34" viewBox="0 0 120 34">
            {[2,3,1,4,2,1,3,2,5,1,2,3,1,2,4,1,3,2,1,4,2,1,3,2,1,3,2,1,4,2].map((w, i, arr) => {
              const x = arr.slice(0, i).reduce((a, b) => a + b, 0) * 1.6;
              return <rect key={i} x={x} y={0} width={w * 1.4} height={28} fill={i % 2 ? palette.cream : palette.ink} />;
            })}
            <text x={0} y={33} fontFamily="'JetBrains Mono', monospace" fontSize={6} fill={palette.ink} letterSpacing={1}>0 12345 67890 1</text>
          </svg>
          <div style={{ width: 32, height: 32, background: `repeating-conic-gradient(${palette.ink} 0 25%, ${palette.cream} 0 50%)`, border: `1px solid ${palette.ink}`, position: "relative" }}>
            <div style={{ position: "absolute", inset: 4, background: palette.cream }} />
            <div style={{ position: "absolute", inset: 8, background: `repeating-linear-gradient(45deg, ${palette.ink} 0 2px, ${palette.cream} 2px 4px)` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

window.BackLabel = BackLabel;
