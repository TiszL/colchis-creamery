const DEFAULTS = {
  heading: 'One day, start to finish.',
  heading_accent: 'start to finish.',
  steps: [
    { n: "01", t: "Milk arrives 6 AM", d: "From three Ohio dairies, within 4 hours of milking. Cow only — never sheep." },
    { n: "02", t: "Curds, cut by hand", d: "Heated to 86°F, cut, pulled, kneaded. The same motions for six thousand years." },
    { n: "03", t: "Brine 24 hours", d: "Cold salt brine. Fresh sulguni ships at hour 24. Aged sulguni rests 7 days with raw honey." },
    { n: "04", t: "Out the door by 5 PM", d: "Packed cold, into UPS for the country, or onto Doordash for Dublin." },
  ],
};

interface ProcessProps {
  content?: typeof DEFAULTS | null;
}

export function Process({ content }: ProcessProps) {
  const d = content || DEFAULTS;

  const renderHeading = () => {
    if (!d.heading_accent || !d.heading.includes(d.heading_accent)) return d.heading;
    const parts = d.heading.split(d.heading_accent);
    return <>{parts[0]}<em style={{ color: "#8B4A28", fontWeight: 400 }}>{d.heading_accent}</em>{parts[1]}</>;
  };

  return (
    <section className="ch-section" style={{ background: "#1F3026", color: "#F5F0E6", padding: "120px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div className="ch-section-grid" style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 64, marginBottom: 72 }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#8B4A28", textTransform: "uppercase" }}>№ 05</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#F5F0E6", opacity: 0.5, textTransform: "uppercase", marginTop: 8 }}>How we make it</div>
          </div>
          <div className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#F5F0E6", maxWidth: 880 }}>
            {renderHeading()}
          </div>
        </div>
        <div className="ch-process-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "rgba(245,240,230,0.14)" }}>
          {d.steps.map((s: { n: string; t: string; d: string }) => (
            <div key={s.n} className="ch-process-step" style={{ background: "#1F3026", padding: 36 }}>
              <div className="ch-process-num" style={{ fontFamily: "var(--font-serif)", fontSize: 64, fontWeight: 300, color: "#8B4A28", lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 26, color: "#F5F0E6", marginTop: 20, lineHeight: 1.1 }}>{s.t}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "#F5F0E6", opacity: 0.7, lineHeight: 1.6, marginTop: 14 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
