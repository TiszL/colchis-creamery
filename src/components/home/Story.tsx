const DEFAULTS = {
  heading: 'Six thousand years ago, Colchis was the kingdom Greek sailors called the edge of the known world — a black-sea coast of vine and wheat, of cheese aged in clay and bread baked in earth ovens.',
  heading_accent: 'the edge of the known world',
  subheading: 'We make those foods, here, with milk from Ohio dairies and the same recipes our grandmothers taught.',
  image: '',
  stats: [
    { val: '6,000', label: 'Years of recipe' },
    { val: '04', label: 'Generations' },
    { val: '1', label: 'Cafe & Bakery in Dublin OH' },
    { val: '50', label: 'States we ship' },
  ],
};

interface StoryProps {
  content?: (typeof DEFAULTS & { image?: string }) | null;
}

export function Story({ content }: StoryProps) {
  const d = content || DEFAULTS;

  const renderHeading = () => {
    if (!d.heading_accent || !d.heading.includes(d.heading_accent)) {
      return d.heading;
    }
    const parts = d.heading.split(d.heading_accent);
    return (
      <>
        {parts[0]}
        <em style={{ color: "#B96A3D", fontWeight: 400 }}>{d.heading_accent}</em>
        {parts[1]}
      </>
    );
  };

  return (
    <section className="ch-section" style={{ background: "#F5F0E6", padding: "140px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div className="ch-section-grid" style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 64, alignItems: "start" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ 02</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginTop: 8 }}>Our Story</div>
          </div>
          <div>
            {d.image && (
              <div style={{ marginBottom: 40, overflow: "hidden" }}>
                <img src={d.image} alt="Our Story" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
              </div>
            )}
            <h2 className="ch-h2-large" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 64, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#1F3026", maxWidth: 980 }}>
              {renderHeading()}
            </h2>
            <div className="ch-lede" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 300, fontSize: 36, lineHeight: 1.2, color: "#2C3D33", marginTop: 40, maxWidth: 880 }}>
              {d.subheading}
            </div>
            <div className="ch-stats" style={{ display: "flex", gap: 56, marginTop: 64, paddingTop: 40, borderTop: "1px solid #1F302622" }}>
              {d.stats.map((s: { val: string; label: string }) => (
                <div key={s.label}>
                  <div className="ch-stat-num" style={{ fontFamily: "var(--font-serif)", fontSize: 56, fontWeight: 400, color: "#B96A3D", lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginTop: 8 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
