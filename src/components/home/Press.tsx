const DEFAULTS = {
  outlets: ['Columbus Monthly', 'Eater Midwest', 'Cherry Bombe', 'Bon Appétit'],
  review_score: '4.9',
  review_count: '312',
  quote: 'I grew up eating khachapuri on the Black Sea. This tastes exactly like the bakery on the corner where I was a kid. Somehow they did it in Ohio.',
  quote_author: '— Nia G. · Brooklyn NY · ★★★★★',
};

interface PressProps {
  content?: typeof DEFAULTS | null;
}

export function Press({ content }: PressProps) {
  const d = content || DEFAULTS;

  return (
    <section className="ch-section" style={{ background: "#F5F0E6", padding: "120px 56px" }}>
      <div className="ch-split" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 32 }}>№ 06 — In good company</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {d.outlets.map((p: string) => (
              <div key={p} style={{ aspectRatio: "16/7", background: "#EAE2D2", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #1F302614", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "#1F3026", opacity: 0.55 }}>{p}</div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 32 }}>★ {d.review_score} / {d.review_count} reviews</div>
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 300, fontSize: 36, lineHeight: 1.3, color: "#1F3026", letterSpacing: "-0.01em" }}>
            &ldquo;{d.quote}&rdquo;
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginTop: 28 }}>{d.quote_author}</div>
        </div>
      </div>
    </section>
  );
}
