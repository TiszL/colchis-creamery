import Link from "next/link";
import { ColchisSeal } from "@/components/brand/ColchisSeal";
import { prisma } from "@/lib/db";

const DEFAULT_COLUMNS = [
  { t: "The Creamery", l: [{ label: "Sulguni Fresh", href: "/shop" }, { label: "Sulguni Aged", href: "/shop" }, { label: "Imeruli", href: "/shop" }, { label: "Cheese boards", href: "/shop" }, { label: "Subscriptions", href: "/shop" }] },
  { t: "The Bakery", l: [{ label: "Hot delivery", href: "/bakery" }, { label: "Pickup", href: "/bakery" }, { label: "Frozen ship", href: "/bakery" }, { label: "Catering", href: "/contact" }, { label: "Today's menu", href: "/bakery" }] },
  { t: "Company", l: [{ label: "Heritage", href: "/heritage" }, { label: "Wholesale", href: "/wholesale" }, { label: "Press", href: "/contact" }, { label: "Contact", href: "/contact" }, { label: "Careers", href: "/contact" }] },
];

const DEFAULT_FOOTER = {
  tagline: 'Ancient heritage, fresh every day.',
  address: '5340 Tuller Rd\nDublin, Ohio 43017\nMade by hand, since 2026',
  columns: DEFAULT_COLUMNS,
};

function parseJSON(value: string | null | undefined) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

export async function Footer() {
  // Fetch footer content from DB
  let footerData = DEFAULT_FOOTER;
  try {
    const configs = await prisma.siteConfig.findMany({
      where: { key: { startsWith: 'footer.' } },
    });
    const map: Record<string, string> = {};
    for (const c of configs) map[c.key] = c.value;

    if (map['footer.tagline']) footerData = { ...footerData, tagline: map['footer.tagline'] };
    if (map['footer.address']) footerData = { ...footerData, address: map['footer.address'] };

    const columnsData = parseJSON(map['footer.columns']);
    if (columnsData) footerData = { ...footerData, columns: columnsData };
  } catch {
    // Use defaults silently
  }

  const columns = footerData.columns || DEFAULT_COLUMNS;

  return (
    <footer className="ch-footer" style={{ background: "#1F3026", color: "#F5F0E6", padding: "80px 56px 40px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div className="ch-footer-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 1.2fr", gap: 56, paddingBottom: 56, borderBottom: "1px solid rgba(245,240,230,0.14)" }}>
          {/* Brand column */}
          <div className="ch-footer-brand">
            <ColchisSeal size={64} invert />
            <div style={{ fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 16, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 18 }}>Colchis Food</div>
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, color: "#8B4A28", marginTop: 12 }}>{footerData.tagline}</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, opacity: 0.6, marginTop: 24, lineHeight: 1.6, maxWidth: 280, whiteSpace: "pre-line" }}>
              {footerData.address}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col: any) => (
            <div key={col.t}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#8B4A28", textTransform: "uppercase", marginBottom: 18 }}>{col.t}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {col.l.map((link: any) => (
                  <li key={link.label}>
                    <Link href={link.href} style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#F5F0E6", opacity: 0.75, textDecoration: "none" }}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="ch-footer-bottom" style={{ display: "flex", justifyContent: "space-between", marginTop: 36, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#F5F0E6", opacity: 0.5, textTransform: "uppercase" }}>
          <span>© {new Date().getFullYear()} Colchis Food LLC · Dublin OH</span>
          <span>EN / ქართული</span>
          <span>colchisfood.com</span>
        </div>
      </div>
    </footer>
  );
}
