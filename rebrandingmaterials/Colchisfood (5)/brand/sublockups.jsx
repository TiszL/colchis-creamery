/* global React */

// ─── Canonical seal — same geometry as LogoAsomtavruli, parameterized ──────
function ColchisSeal({ palette, size = 140, mono = false, invert = false }) {
  const cream = invert ? palette.ink : palette.cream;
  const ink = invert ? palette.cream : palette.ink;
  const accent = mono ? ink : palette.accent;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ display: "block" }}>
      <defs>
        <clipPath id={`clip-seal-${size}-${invert ? 'i' : 'n'}`}>
          <circle cx="100" cy="100" r="92" />
        </clipPath>
      </defs>
      <circle cx="100" cy="100" r="92" fill={cream} stroke={ink} strokeWidth="2" />
      <circle cx="100" cy="100" r="86" fill="none" stroke={accent} strokeWidth="0.6" />
      {/* Golden Fleece arc */}
      <g opacity="0.9">
        <path d="M 60 158 Q 70 150 78 154 Q 86 148 94 154 Q 100 148 106 154 Q 114 148 122 154 Q 130 150 140 158" fill="none" stroke={accent} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M 64 162 Q 72 156 80 160 Q 88 154 96 160 Q 104 154 112 160 Q 120 156 128 162" fill="none" stroke={accent} strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
      </g>
      <g clipPath={`url(#clip-seal-${size}-${invert ? 'i' : 'n'})`}>
        <path d="M 78 64 Q 56 64 56 100 Q 56 136 78 136 L 86 136 L 86 124 L 80 124 Q 70 124 70 100 Q 70 76 80 76 L 86 76 L 86 64 Z" fill={ink} />
        <path d="M 96 64 L 96 136 L 110 136 L 110 106 L 132 106 L 132 94 L 110 94 L 110 76 L 138 76 L 138 64 Z" fill={ink} />
        <rect x="70" y="62" width="20" height="3" fill={ink} />
        <rect x="70" y="135" width="20" height="3" fill={ink} />
        <rect x="92" y="62" width="20" height="3" fill={ink} />
        <rect x="92" y="135" width="22" height="3" fill={ink} />
        <rect x="130" y="62" width="12" height="3" fill={ink} />
        <circle cx="100" cy="50" r="2" fill={accent} />
        <path d="M 100 42 q -3 -2 -3 -5 q 0 -3 3 -3 q 3 0 3 3" fill="none" stroke={accent} strokeWidth="1.1" strokeLinecap="round" />
      </g>
    </svg>
  );
}

window.ColchisSeal = ColchisSeal;

// ─── Sub-brand lockup ──────────────────────────────────────────────────────
function SubBrandLockup({ palette, sub, accentOverride, dark = false }) {
  const ink = dark ? palette.cream : palette.ink;
  const cream = dark ? palette.ink : palette.cream;
  const accent = accentOverride || palette.accent;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <ColchisSeal palette={palette} size={140} invert={dark} />
      <div style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: 22, letterSpacing: "0.18em", color: ink, textTransform: "uppercase" }}>
        Colchis Food
      </div>
      <div style={{ width: 8, height: 8, background: accent, transform: "rotate(45deg)", marginTop: 2 }} />
      <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontWeight: 400, fontSize: 32, color: accent, marginTop: 4 }}>
        {sub}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.32em", color: ink, opacity: 0.55, textTransform: "uppercase" }}>
        Est. MMXXVI · Dublin, Ohio
      </div>
    </div>
  );
}

// ─── Packaging mock — Sulguni Aged + Sulguni Fresh + Adjaruli box ──────────
function PackagingMock({ palette }) {
  const RoundLabel = ({ title, kaTitle, variant, batch, age, weight }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{
        width: 320, height: 320, borderRadius: "50%",
        background: palette.cream,
        border: `2px solid ${palette.ink}`,
        position: "relative",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        boxShadow: `0 24px 48px ${palette.ink}22, inset 0 0 0 12px ${palette.cream}, inset 0 0 0 13px ${palette.accent}66`,
      }}>
        <div style={{ marginTop: -4, marginBottom: 4 }}>
          <ColchisSeal palette={palette} size={48} />
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>The Creamery</div>
        <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontWeight: 400, fontSize: 44, color: palette.ink, lineHeight: 1, marginTop: 6 }}>{title}</div>
        <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 18, color: palette.ink, opacity: 0.7, marginTop: 4 }}>{kaTitle}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.32em", color: palette.ink2, textTransform: "uppercase", marginTop: 8, padding: "3px 10px", border: `1px solid ${palette.accent}` }}>{variant}</div>
        <div style={{ width: 24, height: 1, background: palette.accent, margin: "12px 0" }} />
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: palette.ink2, textAlign: "center", maxWidth: 200, lineHeight: 1.5 }}>
          100% cow milk · brined 24h<br />{age} · {weight}
        </div>
        <div style={{ position: "absolute", bottom: 30, fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.24em", color: palette.muted }}>{batch}</div>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>
        {title} · {variant}
      </div>
    </div>
  );

  return (
    <div style={{ width: 1280, background: palette.cream2, padding: 64, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32 }}>
      <RoundLabel title="Sulguni" kaTitle="სულგუნი" variant="Fresh" batch="BATCH 04 · DAY 02" age="Brined fresh" weight="340g wheel" />
      <RoundLabel title="Sulguni" kaTitle="სულგუნი" variant="Aged · honey · 7 days" batch="BATCH 02 · 07D" age="Aged 7 days · honey-cured" weight="280g wheel" />

      {/* Bakery box — kraft */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={{
          width: 320, height: 320,
          background: palette.ink,
          padding: 28,
          color: palette.cream,
          position: "relative",
          boxShadow: `0 24px 48px ${palette.ink}33`,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ marginBottom: 10 }}>
                <ColchisSeal palette={palette} size={36} invert />
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>The Bakery</div>
              <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 38, lineHeight: 1, color: palette.cream, marginTop: 10 }}>
                Khachapuri<br />Adjaruli
              </div>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 44, color: palette.accent, lineHeight: 1 }}>04</div>
          </div>
          <div style={{ borderTop: `1px solid ${palette.cream}33`, paddingTop: 14, display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: palette.cream, opacity: 0.7 }}>
            <span>Hot · 9 min</span>
            <span>520g</span>
            <span>Eat warm</span>
          </div>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>
          Bakery · Hot Box · 22×22cm
        </div>
      </div>
    </div>
  );
}

window.SubBrandLockup = SubBrandLockup;
window.PackagingMock = PackagingMock;
