/* global React */

const PALETTES = {
  forest: {
    name: "Forest & Copper",
    sub: "Earthy, premium, Georgian-vineyard",
    cream: "#F5F0E6",
    cream2: "#EAE2D2",
    ink: "#1F3026",
    ink2: "#2C3D33",
    accent: "#B96A3D",
    accent2: "#8B4A28",
    muted: "#7A8278",
  },
  wine: {
    name: "Saperavi & Bone",
    sub: "Dramatic, dinner-table, evening",
    cream: "#F4ECE0",
    cream2: "#E5D8C3",
    ink: "#2A1418",
    ink2: "#3D1F24",
    accent: "#7A1F2B",
    accent2: "#C49A4D",
    muted: "#8A7763",
  },
  bone: {
    name: "Bone & Olive",
    sub: "Quiet luxury, gallery, modern artisan",
    cream: "#F2EDE2",
    cream2: "#E0D8C5",
    ink: "#1C1C1A",
    ink2: "#3A3A36",
    accent: "#5C6B3E",
    accent2: "#9C8B5E",
    muted: "#8B8675",
  },
  midnight: {
    name: "Midnight & Brass",
    sub: "Black-tie, fine-dining, evening market",
    cream: "#EDE4D2",
    cream2: "#D9CDB4",
    ink: "#0F1A2A",
    ink2: "#1E2A3D",
    accent: "#C8975A",
    accent2: "#8E6A3F",
    muted: "#6E7588",
  },
  terracotta: {
    name: "Terracotta & Sage",
    sub: "Sun-faded, market-stall, Mediterranean",
    cream: "#F7EFE0",
    cream2: "#EBDFC4",
    ink: "#3A2418",
    ink2: "#52352A",
    accent: "#C45A3A",
    accent2: "#7A8A66",
    muted: "#8E7A66",
  },
  butter: {
    name: "Butter & Hearth",
    sub: "Warm bakery window, creamy, nostalgic",
    cream: "#FBF2DC",
    cream2: "#F0E1B8",
    ink: "#2B1A0F",
    ink2: "#4A2F1C",
    accent: "#A8421C",
    accent2: "#D8A640",
    muted: "#9C8665",
  },
  slate: {
    name: "Slate & Lichen",
    sub: "Cool, editorial, minimalist creamery",
    cream: "#EEEBE2",
    cream2: "#D8D4C7",
    ink: "#22272A",
    ink2: "#3B4147",
    accent: "#6B8675",
    accent2: "#A8702E",
    muted: "#8A8E8B",
  },
};

window.PALETTES = PALETTES;

// ─── Palette swatch card ───────────────────────────────────────────────────
function PaletteCard({ palette, active }) {
  const swatches = [
    { name: "cream", hex: palette.cream, label: "Cream / Bg" },
    { name: "cream2", hex: palette.cream2, label: "Cream 2" },
    { name: "ink", hex: palette.ink, label: "Ink / Fg" },
    { name: "ink2", hex: palette.ink2, label: "Ink 2" },
    { name: "accent", hex: palette.accent, label: "Accent" },
    { name: "accent2", hex: palette.accent2, label: "Accent 2" },
    { name: "muted", hex: palette.muted, label: "Muted" },
  ];
  return (
    <div style={{
      width: 720,
      background: palette.cream,
      padding: 48,
      border: active ? `2px solid ${palette.accent}` : "1px solid rgba(0,0,0,0.08)",
      fontFamily: "Fraunces, serif",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 32, color: palette.ink, fontWeight: 400, letterSpacing: "-0.01em" }}>{palette.name}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: palette.muted, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 8 }}>{palette.sub}</div>
        </div>
        {active && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: palette.accent, letterSpacing: "0.24em" }}>● ACTIVE</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
        {swatches.map((s) => (
          <div key={s.name}>
            <div style={{ height: 90, background: s.hex, border: "1px solid rgba(0,0,0,0.06)" }} />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: palette.ink, letterSpacing: "0.06em", marginTop: 8 }}>{s.label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: palette.muted, marginTop: 2 }}>{s.hex}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.PaletteCard = PaletteCard;
