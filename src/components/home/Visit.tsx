import Link from "next/link";

const DEFAULTS = {
  address: '5340 Tuller Rd',
  city: 'Dublin, OH',
  description: 'The bakery is open Wednesday through Sunday, 8 AM to 9 PM. The creamery is by appointment — we\'d love to show you the cheese cellar.',
  bakery_hours: 'Wed–Sun · 8a–9p',
  phone: '(614) 555-0142',
  map_url: 'https://maps.google.com/?q=5340+Tuller+Rd+Dublin+OH',
  image: '',
};

interface VisitProps {
  content?: (typeof DEFAULTS & { image?: string }) | null;
}

export function Visit({ content }: VisitProps) {
  const d = content || DEFAULTS;

  return (
    <section className="ch-section" style={{ background: "#EAE2D2", padding: "120px 56px" }}>
      <div className="ch-split" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
        <div style={{ aspectRatio: "4/5", background: "#2C3D33", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {d.image ? (
            <img src={d.image} alt="Visit Colchis" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#F5F0E6", opacity: 0.5, textTransform: "uppercase" }}>[ Founders portrait ]</div>
          )}
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ 07 — Visit us</div>
          <div className="ch-h2-large" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 64, lineHeight: 1.0, letterSpacing: "-0.02em", color: "#1F3026", marginTop: 16 }}>
            {d.address}<br /><em style={{ color: "#B96A3D", fontWeight: 400 }}>{d.city}</em>
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, lineHeight: 1.6, color: "#2C3D33", marginTop: 28, maxWidth: 480 }}>
            {d.description}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 40, paddingTop: 32, borderTop: "1px solid #1F302622" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>Bakery hours</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "#1F3026", marginTop: 8 }}>{d.bakery_hours}</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>Phone</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "#1F3026", marginTop: 8 }}>{d.phone}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 36, flexWrap: "wrap" }}>
            <a href={d.map_url} target="_blank" rel="noopener noreferrer" style={{ background: "#1F3026", color: "#F5F0E6", border: "none", padding: "16px 28px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none" }}>Get directions →</a>
            <Link href="/contact" style={{ background: "transparent", color: "#1F3026", border: "1px solid #1F3026", padding: "16px 28px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none" }}>Book a tour</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
