/* global React */
const { useState } = React;

// ─── Smart delivery selector — auto-detects mode by location ───────────────
function DeliverySelector({ palette }) {
  const [mode, setMode] = useState("hot");
  const [zip, setZip] = useState("43017");
  const isLocal = ["43016", "43017", "43002", "43026", "43221"].includes(zip);
  return (
    <div style={{
      background: palette.cream,
      border: `1px solid ${palette.ink}22`,
      padding: 24,
      width: 520,
      fontFamily: "Inter, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>
          Deliver to
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: isLocal ? palette.accent : palette.ink, textTransform: "uppercase" }}>
          {isLocal ? "● Local zone" : "○ Ships nationwide"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          maxLength={5}
          style={{
            flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 18, letterSpacing: "0.2em",
            background: "transparent", border: `1px solid ${palette.ink}44`, padding: "12px 14px",
            color: palette.ink, outline: "none",
          }}
        />
        <button style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase",
          background: palette.ink, color: palette.cream, border: "none", padding: "0 22px", cursor: "pointer",
        }}>Use my location</button>
      </div>

      {/* Two delivery modes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          onClick={() => setMode("hot")}
          disabled={!isLocal}
          style={{
            textAlign: "left", padding: 16, cursor: isLocal ? "pointer" : "not-allowed",
            background: mode === "hot" && isLocal ? palette.ink : "transparent",
            color: mode === "hot" && isLocal ? palette.cream : palette.ink,
            opacity: isLocal ? 1 : 0.4,
            border: `1px solid ${palette.ink}44`,
          }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", opacity: 0.7 }}>
            ◐ Hot · 25 min
          </div>
          <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, marginTop: 6 }}>Bakery</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Khachapuri, fresh from the oven</div>
        </button>
        <button
          onClick={() => setMode("ship")}
          style={{
            textAlign: "left", padding: 16, cursor: "pointer",
            background: mode === "ship" ? palette.ink : "transparent",
            color: mode === "ship" ? palette.cream : palette.ink,
            border: `1px solid ${palette.ink}44`,
          }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", opacity: 0.7 }}>
            ▸ UPS · 1–2 days
          </div>
          <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, marginTop: 6 }}>Creamery</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Cheese & frozen, anywhere in the US</div>
        </button>
      </div>

      {/* Status line */}
      <div style={{ marginTop: 16, padding: "12px 14px", background: palette.cream2, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.16em", color: palette.ink, textTransform: "uppercase" }}>
        {isLocal && mode === "hot" && "→ Doordash · Uber Eats · ETA 25 min · Until 9 PM"}
        {isLocal && mode === "ship" && "→ UPS Ground · arrives Wed, May 6 · free over $75"}
        {!isLocal && "→ UPS Ground · 1–2 days · free shipping over $75"}
      </div>
    </div>
  );
}

window.DeliverySelector = DeliverySelector;

// ─── Hero — full-bleed homepage hero ───────────────────────────────────────
function HomepageHero({ palette }) {
  return (
    <div style={{
      width: 1440, height: 900, background: palette.ink, color: palette.cream,
      position: "relative", overflow: "hidden", fontFamily: "Inter, sans-serif",
    }}>
      {/* Subtle texture grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(${palette.cream}06 1px, transparent 1px), linear-gradient(90deg, ${palette.cream}06 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
      }} />

      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "28px 56px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg viewBox="0 0 200 200" width="38" height="38">
            <circle cx="100" cy="100" r="92" fill="none" stroke={palette.cream} strokeWidth="3" />
            <path d="M 78 64 Q 56 64 56 100 Q 56 136 78 136 L 86 136 L 86 124 L 80 124 Q 70 124 70 100 Q 70 76 80 76 L 86 76 L 86 64 Z" fill={palette.cream} />
            <path d="M 96 64 L 96 136 L 110 136 L 110 106 L 132 106 L 132 94 L 110 94 L 110 76 L 138 76 L 138 64 Z" fill={palette.cream} />
          </svg>
          <div style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: 18, letterSpacing: "0.18em", textTransform: "uppercase" }}>Colchis Food</div>
        </div>
        <div style={{ display: "flex", gap: 36, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", alignItems: "center" }}>
          <a style={{ color: palette.cream, textDecoration: "none" }}>The Creamery</a>
          <a style={{ color: palette.cream, textDecoration: "none" }}>The Bakery</a>
          <a style={{ color: palette.cream, textDecoration: "none" }}>Heritage</a>
          <a style={{ color: palette.cream, textDecoration: "none" }}>Wholesale</a>
          <span style={{ opacity: 0.5 }}>EN / ქარ</span>
          <button style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", background: palette.accent, color: palette.cream, border: "none", padding: "10px 22px", cursor: "pointer" }}>Order →</button>
        </div>
      </div>

      {/* LEFT: Headline */}
      <div style={{ position: "absolute", left: 56, top: 160, width: 720, zIndex: 5 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase", marginBottom: 28 }}>
          № 01 — From Colchis, est. MMXXVI
        </div>
        <div style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 132, lineHeight: 0.9, letterSpacing: "-0.03em", color: palette.cream }}>
          Bread,<br />cheese,<br /><em style={{ color: palette.accent2, fontWeight: 300 }}>and a country</em><br />you should know.
        </div>
        <div style={{ marginTop: 36, fontFamily: "Fraunces, serif", fontSize: 20, lineHeight: 1.5, color: palette.cream, opacity: 0.78, maxWidth: 520, fontStyle: "italic" }}>
          Two thousand years of recipes, hand-pressed and hand-baked in Dublin, Ohio. Hot khachapuri to your door tonight, or aged sulguni shipped to all fifty states.
        </div>
      </div>

      {/* RIGHT: Image placeholder + delivery selector */}
      <div style={{ position: "absolute", right: 56, top: 160, width: 540, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{
          width: 540, height: 380,
          background: `repeating-linear-gradient(45deg, ${palette.ink2}, ${palette.ink2} 1px, ${palette.ink} 1px, ${palette.ink} 8px)`,
          border: `1px solid ${palette.cream}22`,
          position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.cream, opacity: 0.5, textTransform: "uppercase", textAlign: "center" }}>
            [ Hero photo ]<br />
            <span style={{ opacity: 0.7 }}>540 × 380 · adjaruli khachapuri,<br />still steaming, marble surface</span>
          </div>
          {/* Sticker overlay */}
          <div style={{
            position: "absolute", top: 20, right: 20, width: 110, height: 110, borderRadius: "50%",
            background: palette.accent, color: palette.cream, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 1.1,
          }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.24em" }}>HOT NOW</div>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 26, marginTop: 4 }}>25 min</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.16em", marginTop: 4 }}>DUBLIN OH</div>
          </div>
        </div>
        <DeliverySelector palette={palette} />
      </div>

      {/* Bottom ticker */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, borderTop: `1px solid ${palette.cream}22`, padding: "18px 56px", display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: palette.cream, opacity: 0.6 }}>
        <span>◐ The Bakery — open until 9 PM</span>
        <span>▸ Free UPS over $75</span>
        <span>● Made in Dublin, Ohio</span>
        <span>★ 4.9 / 312 reviews</span>
      </div>
    </div>
  );
}

window.HomepageHero = HomepageHero;
