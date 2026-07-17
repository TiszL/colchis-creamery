import Link from "next/link";
import { ColchisSeal } from "@/components/brand/ColchisSeal";

const DEFAULTS = {
  heading: 'One parent house, two crafts.',
  heading_accent: 'two crafts.',
  houses: [
    { name: "The Creamery", ka: "ყველის სახლი", num: "I", tag: "Imeruli & Sulguni, hand-pressed", cta: "Shop cheese →", href: "/creamery", desc: "Cow-milk Sulguni, brined fresh or aged with honey. Imeruli pulled in salted whey. Aged in our Dublin facility, shipped fresh nationwide.", dark: false },
    { name: "The Cafe & Bakery", ka: "კაფე", num: "II", tag: "Khachapuri, hot from the oven", cta: "Order hot delivery →", href: "/bakery", desc: "Adjaruli, Imeruli, Megruli — pulled apart at 25 minutes via Doordash and Uber Eats inside Dublin. Frozen bake-off delivered locally.", dark: true },
  ],
};

interface ThreeHousesProps {
  content?: typeof DEFAULTS | null;
}

export function ThreeHouses({ content }: ThreeHousesProps) {
  const d = content || DEFAULTS;

  const renderHeading = () => {
    if (!d.heading_accent || !d.heading.includes(d.heading_accent)) return d.heading;
    const parts = d.heading.split(d.heading_accent);
    return <>{parts[0]}<em style={{ color: "#B96A3D", fontWeight: 400 }}>{d.heading_accent}</em>{parts[1]}</>;
  };

  // Map DB houses to full objects (DB may not store dark/num)
  const houses = d.houses.map((h: any, i: number) => ({
    ...h,
    num: h.num || (i === 0 ? "I" : "II"),
    dark: h.dark !== undefined ? h.dark : i === 1,
  }));

  return (
    <section style={{ background: "#F5F0E6" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 32px", borderTop: "1px solid #1F302622" }}>
        <div className="ch-section-grid" style={{ padding: "100px 24px 60px", display: "grid", gridTemplateColumns: "200px 1fr", gap: 64 }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ 03</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginTop: 8 }}>Two Houses</div>
          </div>
          <h2 className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#1F3026", maxWidth: 900 }}>
            {renderHeading()}
          </h2>
        </div>
      </div>
      <div className="ch-houses" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {houses.map((h: any) => {
          const bg = h.dark ? "#1F3026" : "#EAE2D2";
          const fg = h.dark ? "#F5F0E6" : "#1F3026";
          const accentColor = h.dark ? "#8B4A28" : "#B96A3D";
          return (
            <div key={h.name} className="ch-house" style={{ background: bg, color: fg, padding: "64px 48px 56px", minHeight: 560, display: "flex", flexDirection: "column", justifyContent: "space-between", borderRight: `1px solid ${h.dark ? "rgba(245,240,230,0.14)" : "#1F302622"}` }}>
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
                  <ColchisSeal size={56} invert={h.dark} />
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 56, fontWeight: 300, color: accentColor, lineHeight: 1 }}>{h.num}</div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", color: accentColor, textTransform: "uppercase" }}>{h.tag}</div>
                <div className="ch-house-name" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 56, fontWeight: 400, lineHeight: 1, marginTop: 16, letterSpacing: "-0.01em" }}>{h.name}</div>
                <div style={{ fontFamily: "var(--font-serif-ka, 'Noto Serif Georgian', serif)", fontSize: 18, opacity: 0.55, marginTop: 8 }}>{h.ka}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.65, opacity: h.dark ? 0.8 : 1, marginTop: 24, maxWidth: 360, color: h.dark ? "#F5F0E6" : "#2C3D33" }}>{h.desc}</div>
              </div>
              <div style={{ marginTop: 32 }}>
                <div style={{ width: "100%", aspectRatio: "16/10", background: h.dark ? "#2C3D33" : "#F5F0E6", border: `1px solid ${h.dark ? "rgba(245,240,230,0.14)" : "#1F302622"}`, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                  {h.image ? (
                    <img src={h.image} alt={h.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", color: h.dark ? "#F5F0E6" : "#7A8278", opacity: 0.6, textTransform: "uppercase" }}>
                      [ {h.name} photo ]
                    </div>
                  )}
                </div>
                <Link href={h.href} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: accentColor, textDecoration: "none", borderBottom: `1px solid ${accentColor}` }}>{h.cta}</Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
