import Link from "next/link";
import type { PrimaryLocation } from "@/lib/business-location";

interface VisitProps {
  primary: PrimaryLocation;
  /** Editorial overrides from SiteConfig.home.visit: description text + image
   *  override. Address/city/phone/hours/map_url all come from `primary`. */
  content?: { description?: string; image?: string } | null;
}

export function Visit({ primary, content }: VisitProps) {
  // Display rules:
  //   - Street address line: addressLine1 (+ line2 if set)
  //   - Subline italic: "City, ST"
  //   - Description: content override > primary.displayDescription > fallback string
  //   - Hours: primary.displayBakeryHours
  //   - Phone: primary.phone
  //   - Directions URL: primary.mapUrl
  const streetLine = primary.addressLine2
    ? `${primary.addressLine1}, ${primary.addressLine2}`
    : primary.addressLine1;
  const cityLine = `${primary.city}, ${primary.state}`;
  const description = content?.description
    || primary.displayDescription
    || 'The bakery is open Wednesday through Sunday. The creamery is by appointment.';
  const bakeryHours = primary.displayBakeryHours || 'Wed–Sun · 8a–9p';
  const phone = primary.phone || '';
  const image = content?.image || '';

  return (
    <section className="ch-section" style={{ background: "#EAE2D2", padding: "120px 56px" }}>
      <div className="ch-split" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
        <div style={{ aspectRatio: "4/5", background: "#2C3D33", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {image ? (
            <img src={image} alt="Visit Colchis" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#F5F0E6", opacity: 0.5, textTransform: "uppercase" }}>[ Founders portrait ]</div>
          )}
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ 07 — Visit us</div>
          <h2 className="ch-h2-large" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 64, lineHeight: 1.0, letterSpacing: "-0.02em", color: "#1F3026", marginTop: 16 }}>
            {streetLine}<br /><em style={{ color: "#B96A3D", fontWeight: 400 }}>{cityLine}</em>
          </h2>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, lineHeight: 1.6, color: "#2C3D33", marginTop: 28, maxWidth: 480 }}>
            {description}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 40, paddingTop: 32, borderTop: "1px solid #1F302622" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>Bakery hours</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "#1F3026", marginTop: 8 }}>{bakeryHours}</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>Phone</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "#1F3026", marginTop: 8 }}>{phone}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 36, flexWrap: "wrap" }}>
            <a href={primary.mapUrl} target="_blank" rel="noopener noreferrer" style={{ background: "#1F3026", color: "#F5F0E6", border: "none", padding: "16px 28px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none" }}>Get directions →</a>
            <Link href="/contact" style={{ background: "transparent", color: "#1F3026", border: "1px solid #1F3026", padding: "16px 28px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none" }}>Book a tour</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
