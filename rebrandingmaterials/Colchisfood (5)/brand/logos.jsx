/* global React */
const { useMemo } = React;

// ─── LOGO 01: Asomtavruli-inspired CF monogram in soft seal ────────────────
// "Stone-carved" custom letterforms. Reduced badge. Two-tone.
function LogoAsomtavruli({ palette, size = 320, showWordmark = true, showTagline = true }) {
  const ink = palette.ink;
  const accent = palette.accent;
  const cream = palette.cream;
  return (
    <div style={{ width: size, display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.04 }}>
      <svg viewBox="0 0 200 200" width={size * 0.7} height={size * 0.7} style={{ display: "block" }}>
        <defs>
          <clipPath id={`clip-aso-${size}`}>
            <circle cx="100" cy="100" r="92" />
          </clipPath>
        </defs>
        <circle cx="100" cy="100" r="92" fill={cream} stroke={ink} strokeWidth="2" />
        <circle cx="100" cy="100" r="86" fill="none" stroke={accent} strokeWidth="0.6" />
        {/* Golden Fleece — subtle fleece arc behind the monogram, copper accent */}
        <g opacity="0.9">
          <path d="M 60 158 Q 70 150 78 154 Q 86 148 94 154 Q 100 148 106 154 Q 114 148 122 154 Q 130 150 140 158" fill="none" stroke={accent} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M 64 162 Q 72 156 80 160 Q 88 154 96 160 Q 104 154 112 160 Q 120 156 128 162" fill="none" stroke={accent} strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
        </g>
        {/* Stone-carved CF monogram */}
        <g clipPath={`url(#clip-aso-${size})`}>
          {/* C */}
          <path
            d="M 78 64 Q 56 64 56 100 Q 56 136 78 136 L 86 136 L 86 124 L 80 124 Q 70 124 70 100 Q 70 76 80 76 L 86 76 L 86 64 Z"
            fill={ink}
          />
          {/* F overlapping */}
          <path
            d="M 96 64 L 96 136 L 110 136 L 110 106 L 132 106 L 132 94 L 110 94 L 110 76 L 138 76 L 138 64 Z"
            fill={ink}
          />
          {/* Serif terminals — squared, stone-cut */}
          <rect x="70" y="62" width="20" height="3" fill={ink} />
          <rect x="70" y="135" width="20" height="3" fill={ink} />
          <rect x="92" y="62" width="20" height="3" fill={ink} />
          <rect x="92" y="135" width="22" height="3" fill={ink} />
          <rect x="130" y="62" width="12" height="3" fill={ink} />
          {/* Tiny copper ornament dot — Georgian carved-stone dot */}
          <circle cx="100" cy="50" r="2" fill={accent} />
          {/* Golden Fleece curl — tiny ram's-horn spiral above the dot at top, signaling the fleece */}
          <path d="M 100 42 q -3 -2 -3 -5 q 0 -3 3 -3 q 3 0 3 3" fill="none" stroke={accent} strokeWidth="1.1" strokeLinecap="round" />
        </g>
        {/* Seal text top */}
        <path id={`top-${size}`} d="M 100 100 m -72 0 a 72 72 0 0 1 144 0" fill="none" />
        <path id={`bot-${size}`} d="M 100 100 m -72 0 a 72 72 0 0 0 144 0" fill="none" />
        <text fontFamily="Fraunces, serif" fontSize="9" letterSpacing="4" fontWeight="500" fill={ink}>
          <textPath href={`#top-${size}`} startOffset="50%" textAnchor="middle">EST · MMXXVI · OHIO</textPath>
        </text>
        <text fontFamily="Fraunces, serif" fontSize="8" letterSpacing="3" fontWeight="500" fill={ink}>
          <textPath href={`#bot-${size}`} startOffset="50%" textAnchor="middle">COLCHIS · GEORGIA · 𐌝</textPath>
        </text>
      </svg>
      {showWordmark && (
        <div style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: size * 0.11, letterSpacing: "0.18em", color: ink, textTransform: "uppercase" }}>
          Colchis Food
        </div>
      )}
      {showTagline && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: size * 0.032, letterSpacing: "0.32em", color: accent, textTransform: "uppercase" }}>
          Heritage in every bite
        </div>
      )}
    </div>
  );
}

// ─── LOGO 02: Wordmark with custom ligature + wheat counterform ────────────
// Clean, retail-shelf, modern editorial.
function LogoWordmark({ palette, size = 320, showTagline = true }) {
  const ink = palette.ink;
  const accent = palette.accent;
  return (
    <div style={{ width: size, display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.04 }}>
      <div style={{ display: "flex", alignItems: "center", gap: size * 0.04 }}>
        {/* Wheat-stalk glyph — single stroke, minimal */}
        <svg viewBox="0 0 40 80" width={size * 0.13} height={size * 0.26}>
          <line x1="20" y1="10" x2="20" y2="74" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 20 18 Q 14 20 12 26 Q 18 26 20 22 Z" fill={accent} />
          <path d="M 20 18 Q 26 20 28 26 Q 22 26 20 22 Z" fill={accent} />
          <path d="M 20 30 Q 14 32 12 38 Q 18 38 20 34 Z" fill={accent} />
          <path d="M 20 30 Q 26 32 28 38 Q 22 38 20 34 Z" fill={accent} />
          <path d="M 20 42 Q 14 44 12 50 Q 18 50 20 46 Z" fill={accent} />
          <path d="M 20 42 Q 26 44 28 50 Q 22 50 20 46 Z" fill={accent} />
          <path d="M 20 54 Q 14 56 12 62 Q 18 62 20 58 Z" fill={accent} />
          <path d="M 20 54 Q 26 56 28 62 Q 22 62 20 58 Z" fill={accent} />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 0.92 }}>
          <div style={{ fontFamily: "Fraunces, serif", fontWeight: 400, fontSize: size * 0.18, color: ink, fontStyle: "normal", letterSpacing: "-0.02em" }}>
            Colchis
          </div>
          <div style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontStyle: "italic", fontSize: size * 0.13, color: accent, letterSpacing: "-0.01em", marginTop: size * 0.01 }}>
            food&nbsp;co.
          </div>
        </div>
      </div>
      {showTagline && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: size * 0.028, letterSpacing: "0.36em", color: ink, textTransform: "uppercase", opacity: 0.7, marginTop: size * 0.02 }}>
          Cheese · Bread · Heritage
        </div>
      )}
    </div>
  );
}

// ─── LOGO 03: Modern monoline mark — abstract Borjgali / sun-wheel ────────
// References Georgian solar symbol (Borjgali). Single-weight geometric.
function LogoBorjgali({ palette, size = 320, showWordmark = true, showTagline = true }) {
  const ink = palette.ink;
  const accent = palette.accent;
  return (
    <div style={{ width: size, display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.05 }}>
      <svg viewBox="0 0 200 200" width={size * 0.55} height={size * 0.55}>
        <g transform="translate(100,100)">
          {/* 7-arm spiral — abstracted Borjgali */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <g key={i} transform={`rotate(${(360 / 7) * i})`}>
              <path
                d="M 0 -8 Q 6 -38 28 -42 Q 14 -28 14 -14 Q 14 -2 0 -2 Z"
                fill={i % 2 === 0 ? ink : accent}
              />
            </g>
          ))}
          <circle r="6" fill={palette.cream} stroke={ink} strokeWidth="1.5" />
        </g>
      </svg>
      {showWordmark && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 0.95 }}>
          <div style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: size * 0.115, letterSpacing: "0.32em", color: ink, textTransform: "uppercase" }}>
            Colchis
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 400, fontSize: size * 0.038, letterSpacing: "0.5em", color: accent, textTransform: "uppercase", marginTop: size * 0.025 }}>
            Food Co.
          </div>
        </div>
      )}
      {showTagline && (
        <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: size * 0.05, color: ink, opacity: 0.6, marginTop: size * 0.01 }}>
          From the Black Sea to your table
        </div>
      )}
    </div>
  );
}

window.LogoAsomtavruli = LogoAsomtavruli;
window.LogoWordmark = LogoWordmark;
window.LogoBorjgali = LogoBorjgali;
