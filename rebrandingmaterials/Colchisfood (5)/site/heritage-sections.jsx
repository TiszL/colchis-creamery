/* global React, ColchisSeal */

function HeritageHero({ palette }) {
  return (
    <section className="ch-section" style={{ background: palette.cream, padding: "140px 56px 100px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 32 }}>Heritage · მემკვიდრეობა</div>
        <h1 className="ch-heritage-h1" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 144, lineHeight: 0.88, letterSpacing: "-0.035em", margin: 0, color: palette.ink, maxWidth: 1200 }}>
          A country at <em style={{ color: palette.accent, fontWeight: 300 }}>the edge of</em><br />the known world.
        </h1>
        <div className="ch-heritage-lead" style={{ marginTop: 48, fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 28, lineHeight: 1.45, color: palette.ink2, maxWidth: 800 }}>
          Two thousand years ago, Colchis was the kingdom Greek sailors called the edge of the known world — a black-sea coast of vine and wheat, of cheese aged in clay and bread baked in earth ovens. We make those foods, here, with milk from Ohio dairies and the same recipes our grandmothers taught.
        </div>
      </div>
    </section>
  );
}

function HeritageTimeline({ palette }) {
  const events = [
    { year: "1200 BC", t: "The Golden Fleece", d: "Jason and the Argonauts sail east to Colchis to retrieve the fleece. The land is already known for its wool, wine, and cheese." },
    { year: "500 BC", t: "Qvevri wine begins", d: "Georgians ferment grapes in beeswax-lined clay vessels buried underground. The method is now UNESCO-protected." },
    { year: "1100 AD", t: "Khachapuri, written down", d: "The bread-with-cheese appears in monastery cookbooks. Each region develops its own shape." },
    { year: "1990s", t: "Family recipes leave Georgia", d: "Our grandmothers carry sulguni technique to the diaspora. The pots, the brine, the patience." },
    { year: "2026", t: "Dublin, Ohio", d: "We open the creamery and bakery on Tuller Road. Cow-milk sulguni, Adjaruli khachapuri, Ohio dairies." },
  ];
  return (
    <section className="ch-section" style={{ background: palette.cream2, padding: "120px 56px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 48 }}>№ 01 — A short timeline</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {events.map((e, i) => (
            <div key={e.year} className="ch-timeline-row" style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 48, padding: "36px 0", borderTop: `1px solid ${palette.ink}22`, borderBottom: i === events.length - 1 ? `1px solid ${palette.ink}22` : "none" }}>
              <div className="ch-timeline-year" style={{ fontFamily: "Fraunces, serif", fontSize: 36, fontWeight: 400, color: palette.accent, lineHeight: 1 }}>{e.year}</div>
              <div>
                <div className="ch-timeline-title" style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 32, color: palette.ink, lineHeight: 1.1 }}>{e.t}</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 16, lineHeight: 1.6, color: palette.ink2, marginTop: 12, maxWidth: 720 }}>{e.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeritageGlossary({ palette }) {
  const words = [
    { ka: "სულგუნი", en: "Sulguni", d: "Cow-milk pulled cheese, brined or honey-aged." },
    { ka: "იმერული", en: "Imeruli", d: "Salted-whey cheese from Imereti region." },
    { ka: "ხაჭაპური", en: "Khachapuri", d: "Cheese-bread. The shape changes with the region." },
    { ka: "აჭარული", en: "Adjaruli", d: "The boat. Egg yolk, butter, melt." },
    { ka: "ქვევრი", en: "Qvevri", d: "Clay vessel buried for fermenting wine." },
    { ka: "მარანი", en: "Marani", d: "The wine cellar." },
  ];
  return (
    <section className="ch-section" style={{ background: palette.cream, padding: "120px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 16 }}>№ 02 — A small glossary</div>
        <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", color: palette.ink, marginBottom: 56 }}>
          Six Georgian words <em style={{ color: palette.accent, fontWeight: 400 }}>worth knowing.</em>
        </div>
        <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
          {words.map((w) => (
            <div key={w.en} style={{ padding: "28px 0", borderTop: `1px solid ${palette.ink}33` }}>
              <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 40, color: palette.ink, lineHeight: 1 }}>{w.ka}</div>
              <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 24, color: palette.accent, marginTop: 8 }}>{w.en}</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: palette.ink2, lineHeight: 1.55, marginTop: 10 }}>{w.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeritageFleece({ palette }) {
  return (
    <section className="ch-section" style={{ background: palette.ink, color: palette.cream, padding: "140px 56px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <ColchisSeal palette={palette} size={120} invert />
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase", marginTop: 36 }}>The mark</div>
        <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 64, lineHeight: 1.1, letterSpacing: "-0.02em", marginTop: 20 }}>
          The fleece, the C, the F.
        </div>
        <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, lineHeight: 1.5, color: palette.cream, opacity: 0.8, marginTop: 28, maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
          Our seal carries a stone-carved CF — Colchis Food — wrapped in a faint copper arc: the Golden Fleece, the wool that brought Greek sailors to our shores. The dot above is the ram's horn. Look closely.
        </div>
      </div>
    </section>
  );
}

window.HeritageHero = HeritageHero;
window.HeritageTimeline = HeritageTimeline;
window.HeritageGlossary = HeritageGlossary;
window.HeritageFleece = HeritageFleece;
