import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';
// Phase 9b: section drives placement; Category.sections has 'creamery' for cheese/butter/etc.
const CREAMERY_SECTION = 'creamery';

interface LinePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: LinePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const line = await prisma.productLine.findUnique({
    where: { slug },
    select: { name: true, tagline: true, description: true, isActive: true },
  });
  if (!line || !line.isActive) return { title: 'Line Not Found' };

  const canonicalPath = locale === 'en' ? `/creamery/line/${slug}` : `/${locale}/creamery/line/${slug}`;
  const title = `${line.name} Creamery`;
  const baseDescription = line.tagline || line.description || `${line.name} from Colchis Food, hand-pulled in salted whey from the milk of three small Ohio dairies.`;

  return {
    title,
    description: baseDescription.slice(0, 160),
    alternates: {
      canonical: `${SITE_URL}${canonicalPath}`,
      languages: {
        'en': `${SITE_URL}/creamery/line/${slug}`,
        'ka': `${SITE_URL}/ka/creamery/line/${slug}`,
        'ru': `${SITE_URL}/ru/creamery/line/${slug}`,
        'es': `${SITE_URL}/es/creamery/line/${slug}`,
        'x-default': `${SITE_URL}/creamery/line/${slug}`,
      },
    },
    openGraph: {
      type: 'website',
      title: `${line.name} — Colchis Food Creamery`,
      description: baseDescription.slice(0, 200),
      url: `${SITE_URL}${canonicalPath}`,
      siteName: 'Colchis Food',
    },
  };
}

export default async function CreameryLinePage({ params }: LinePageProps) {
  const { locale, slug } = await params;
  const prefix = locale === 'en' ? '' : `/${locale}`;

  const line = await prisma.productLine.findUnique({
    where: { slug },
    include: {
      products: {
        where: {
          status: { in: ['ACTIVE', 'COMING_SOON'] },
          isB2cVisible: true,
          productCategory: { sections: { has: CREAMERY_SECTION } },
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!line || !line.isActive) notFound();

  const products = line.products;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${line.name} — Colchis Food Creamery`,
    description: line.description || line.tagline || `${line.name} from Colchis Food.`,
    url: `${SITE_URL}${prefix}/creamery/line/${slug}`,
    isPartOf: { '@type': 'WebSite', name: 'Colchis Food', url: SITE_URL },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.map((p, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `${SITE_URL}${prefix}/creamery/${p.slug}`,
        name: p.name,
        image: p.imageUrl,
      })),
    },
  };

  const accent = line.badgeColor || '#B96A3D';

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ─── Breadcrumbs ──────────────────────────────────────────────── */}
      <nav className="ch-breadcrumbs" style={{ background: "#F5F0E6", padding: "20px 56px", borderBottom: "1px solid #1F302611", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link href={`${prefix}/`} style={{ color: "#7A8278", textDecoration: "none" }}>Colchis Food</Link>
          <span style={{ color: "#2C3D33", opacity: 0.5 }}>/</span>
          <Link href={`${prefix}/creamery`} style={{ color: "#7A8278", textDecoration: "none" }}>Creamery</Link>
          <span style={{ color: "#2C3D33", opacity: 0.5 }}>/</span>
          <span style={{ color: "#1F3026", fontWeight: 500 }}>{line.name}</span>
        </div>
      </nav>

      {/* ─── Line hero ─────────────────────────────────────────────────── */}
      <section className="ch-section" style={{ background: "#F5F0E6", padding: "100px 56px 60px", borderBottom: "1px solid #1F302622" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: accent, textTransform: "uppercase", marginBottom: 24 }}>
            Creamery · Line
          </div>
          <h1 className="ch-line-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: "clamp(56px, 9vw, 104px)", lineHeight: 0.94, letterSpacing: "-0.025em", margin: 0, color: "#1F3026" }}>
            {line.name}
          </h1>
          {line.tagline && (
            <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 21, lineHeight: 1.55, color: "#2C3D33", margin: "28px 0 0", maxWidth: 720 }}>
              {line.tagline}
            </p>
          )}
          {line.description && (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.7, color: "#2C3D33", margin: "20px 0 0", maxWidth: 720, opacity: 0.85 }}>
              {line.description}
            </p>
          )}
        </div>
      </section>

      {/* ─── Product grid ──────────────────────────────────────────────── */}
      <section className="ch-section" style={{ background: "#F5F0E6", padding: "60px 56px 120px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          {products.length === 0 ? (
            <div style={{ padding: "60px 0", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "#7A8278", textAlign: "center" }}>
              Products in this line are coming soon.
            </div>
          ) : (
            <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              {products.map(p => {
                const price = parseFloat(p.priceB2c) || 0;
                const isComingSoon = p.status === 'COMING_SOON';
                return (
                  <Link key={p.id} href={`${prefix}/creamery/${p.slug}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", background: "#EAE2D2", border: "1px solid #1F302614" }}>
                    <div style={{ aspectRatio: "4/3", position: "relative", borderBottom: "1px solid #1F302614", overflow: "hidden" }}>
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                      {isComingSoon && (
                        <div style={{ position: "absolute", top: 16, left: 16, padding: "6px 12px", background: accent, color: "#F5F0E6", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase" }}>Coming Soon</div>
                      )}
                    </div>
                    <div style={{ padding: 24, display: "flex", flexDirection: "column", flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                        <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 24, color: "#1F3026", lineHeight: 1.05 }}>{p.name}</div>
                        {!isComingSoon && price > 0 && (
                          <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: accent, fontWeight: 500, whiteSpace: "nowrap" }}>${price.toFixed(2)}</div>
                        )}
                      </div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#2C3D33", lineHeight: 1.55, marginTop: 12, flex: 1 }}>{p.description}</div>
                      {p.weight && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", color: "#7A8278", textTransform: "uppercase", marginTop: 14 }}>{p.weight}</div>}
                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #1F302622", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: accent, textTransform: "uppercase" }}>View product →</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
