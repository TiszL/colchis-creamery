/* global React */

function TypeSpecimen({ palette }) {
  return (
    <div style={{ width: 1280, background: palette.cream, padding: 64, fontFamily: "Fraunces, serif", color: palette.ink }}>
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 48, borderBottom: `1px solid ${palette.ink}22`, paddingBottom: 40 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: palette.muted }}>
          Display
          <div style={{ marginTop: 4, fontSize: 10 }}>Fraunces · 96/0.92</div>
        </div>
        <div style={{ fontSize: 96, lineHeight: 0.95, fontWeight: 400, letterSpacing: "-0.025em" }}>
          From <em style={{ fontWeight: 300 }}>Colchis</em>,<br />
          with bread &amp; cheese.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 48, borderBottom: `1px solid ${palette.ink}22`, padding: "40px 0" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: palette.muted }}>
          Headline
          <div style={{ marginTop: 4, fontSize: 10 }}>Fraunces · 56/1.0</div>
        </div>
        <div style={{ fontSize: 56, lineHeight: 1.0, fontWeight: 400, letterSpacing: "-0.018em" }}>
          Imeruli &amp; Sulguni, hand-pressed daily in Dublin, Ohio
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 48, borderBottom: `1px solid ${palette.ink}22`, padding: "40px 0" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: palette.muted }}>
          Body
          <div style={{ marginTop: 4, fontSize: 10 }}>Inter · 18/1.6</div>
        </div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 18, lineHeight: 1.6, maxWidth: 780, color: palette.ink2 }}>
          Two thousand years ago, Colchis was the kingdom Greek sailors called the edge of the known world — a black-sea coast of vine and wheat, of cheese aged in clay and bread baked in earth ovens. We make those foods, here, with milk from Ohio dairies and the same recipes our grandmothers taught.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 48, borderBottom: `1px solid ${palette.ink}22`, padding: "40px 0" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: palette.muted }}>
          Eyebrow
          <div style={{ marginTop: 4, fontSize: 10 }}>JetBrains Mono · 12/0.32em</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.32em", textTransform: "uppercase", color: palette.accent }}>
            № 04 — The Bakery
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.32em", textTransform: "uppercase", color: palette.muted }}>
            Hot delivery · Dublin OH · until 9PM
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 48, padding: "40px 0 0" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: palette.muted }}>
          Bilingual
          <div style={{ marginTop: 4, fontSize: 10 }}>Noto Serif Georgian</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 56, lineHeight: 1, fontWeight: 400 }}>კოლხეთი</div>
          <div style={{ fontFamily: "'Noto Sans Georgian', sans-serif", fontSize: 18, lineHeight: 1.5, color: palette.ink2 }}>
            ხაჭაპური, სულგუნი, იმერული — დუბლინში, ოჰაიოში
          </div>
        </div>
      </div>
    </div>
  );
}

window.TypeSpecimen = TypeSpecimen;
