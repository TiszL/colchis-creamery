import { prisma } from "@/lib/db";
import { permanentRedirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { getOgImage, buildOgImages } from "@/lib/seo";
import Link from "next/link";
import CreameryClient from "@/components/shop/CreameryClient";
import { getSession } from "@/lib/session";
import { getMyAddresses } from "@/app/actions/addresses";
import { getPrimaryLocation } from "@/lib/business-location";
import { getSelectedLocation, productCatalogWhereForLocation } from "@/lib/customer-location";

// Phase 9b: was ProductKind.startsWith('CREAMERY'). Category.sections drives
// storefront placement now — admin tags categories with 'creamery' in CategoryManager.
const CREAMERY_SECTION = 'creamery';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';

interface ShopPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ line?: string; category?: string }>;
}

export async function generateMetadata({ params, searchParams }: ShopPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { line } = await searchParams;
  const t = await getTranslations({ locale, namespace: "shop" });
  const canonicalPath = locale === 'en' ? '/creamery' : `/${locale}/creamery`;
  const ogImage = await getOgImage('shop');

  let titleSuffix = '';
  if (line) {
    const lineData = await prisma.productLine.findUnique({ where: { slug: line } });
    if (lineData) titleSuffix = ` — ${lineData.name}`;
  }

  const title = `${t("title")}${titleSuffix}`;
  const description = 'Sulguni and Imeruli, hand-pulled in salted whey from the milk of three small Ohio dairies. Shop the creamery.';

  return {
    title,
    description,
    keywords: [
      'A2 Brown Swiss milk cheese', 'Georgian cheese shop', 'Colchis Food',
      'Sulguni', 'Imeruli', 'artisanal pulled-curd cheese', 'Ohio creamery',
    ],
    alternates: {
      canonical: `${SITE_URL}${canonicalPath}`,
      languages: {
        'en': `${SITE_URL}/creamery`,
        'ka': `${SITE_URL}/ka/creamery`,
        'ru': `${SITE_URL}/ru/creamery`,
        'es': `${SITE_URL}/es/creamery`,
        'x-default': `${SITE_URL}/creamery`,
      },
    },
    openGraph: {
      type: 'website',
      title: `${title} | Colchis Food`,
      description,
      url: `${SITE_URL}${canonicalPath}`,
      siteName: 'Colchis Food',
      ...(ogImage ? { images: buildOgImages(ogImage, title) } : {}),
    },
  };
}

function parseJSON(value: string | undefined | null) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const { locale } = await params;
  const { line } = await searchParams;
  const prefix = locale === "en" ? "" : `/${locale}`;

  // Legacy ?line=<slug> URLs → 301 to the dedicated line route. The old
  // query-string filter was a near-duplicate of /creamery (only the <title>
  // differed) and triggered Google's "Duplicate canonical" flag; the dedicated
  // route has line-specific content and is the proper indexable target.
  if (line) {
    permanentRedirect(`${prefix}/creamery/line/${line}`);
  }

  // Phase 1 (1f) — scope catalog to the customer's selected location.
  const selectedLocation = await getSelectedLocation();
  const locationFilter = productCatalogWhereForLocation(selectedLocation);

  const [dbProducts, creameryConfigs, primary] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: { in: ['ACTIVE', 'COMING_SOON'] },
        isB2cVisible: true,
        productCategory: { sections: { has: CREAMERY_SECTION } }, // creamery-section products only; bakery has its own page
        ...locationFilter,
      },
      orderBy: { name: 'asc' },
      include: {
        productLine: { select: { id: true, slug: true, name: true, tagline: true, badgeColor: true } },
        productCategory: { select: { id: true, slug: true, name: true } },

      },
    }),
    prisma.siteConfig.findMany({ where: { key: { startsWith: 'creamery.' } } }).catch(() => []),
    getPrimaryLocation(),
  ]);

  const session = await getSession();
  const isLoggedIn = !!session?.userId;
  const userAddresses = isLoggedIn ? await getMyAddresses() : [];

  const cm: Record<string, string> = {};
  for (const c of creameryConfigs) cm[c.key] = c.value;
  const heroContent = parseJSON(cm['creamery.hero']);
  const methodContent = parseJSON(cm['creamery.method']);
  const deliveryContent = parseJSON(cm['creamery.delivery']);
  const subContent = parseJSON(cm['creamery.subscription']);

  const products = dbProducts.map(p => ({
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    description: p.description,
    weight: p.weight,
    imageUrl: p.imageUrl,
    priceB2c: parseFloat(p.priceB2c) || 0,
    stockQuantity: p.stockQuantity,
    status: p.status,
    isCartOrderable: p.isCartOrderable,
    productLine: p.productLine ? { name: p.productLine.name, badgeColor: p.productLine.badgeColor } : null,
    offeredChannels: [],
  }));

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Colchis Food — The Creamery',
    description: 'Sulguni and Imeruli, hand-pulled in salted whey from the milk of three small Ohio dairies.',
    url: `${SITE_URL}${prefix}/creamery`,
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ─── CREAMERY HERO ────────────────────────────────────────────── */}
      {(() => {
        const h = heroContent || {
          eyebrow: 'House No 01 · The Creamery · ყველის სახლი',
          headline: 'Cheese made',
          headline_accent: 'this morning.',
          subheadline: 'Sulguni and Imeruli, hand-pulled in salted whey from the milk of three small Ohio dairies. The recipe is two thousand years old; the cheese is six hours old.',
          stats: [
            { num: '6h', text: 'From milk truck to brine bath. No cheese sits overnight.' },
            { num: '3', text: 'Family dairies in Ohio, within four hours of milking.' },
            { num: '100%', text: 'Cow milk. Pasteurized, microbial rennet, no shortcuts.' },
          ],
        };
        return (
          <section className="ch-section ch-cm-hero" style={{ background: "#F5F0E6", color: "#1F3026", padding: "100px 56px 80px", borderBottom: "1px solid #1F302622" }}>
            <div className="ch-cm-hero-grid" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 56, alignItems: "end" }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 24 }}>{h.eyebrow}</div>
                <h1 className="ch-cm-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 104, lineHeight: 0.94, letterSpacing: "-0.025em", margin: 0, color: "#1F3026" }}>
                  {h.headline} <em style={{ color: "#B96A3D", fontWeight: 300 }}>{h.headline_accent}</em>
                </h1>
                <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 21, lineHeight: 1.55, color: "#2C3D33", margin: "28px 0 0", maxWidth: 560 }}>
                  {h.subheadline}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 14 }}>
                {h.stats.map((s: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, borderBottom: i < h.stats.length - 1 ? "1px solid #1F302622" : "none" }}>
                    <div style={{ fontFamily: "var(--font-serif)", fontSize: 56, fontWeight: 300, color: "#B96A3D", lineHeight: 1, letterSpacing: "-0.03em" }}>{s.num}</div>
                    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 15, color: "#2C3D33", lineHeight: 1.35 }}>{s.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ─── SHOP + BATCH (client — tabs, interactivity) ──────────────── */}
      <CreameryClient
        products={products}
        locale={locale}
        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}
        isLoggedIn={isLoggedIn}
        userAddresses={userAddresses}
      />

      {/* ─── THE METHOD (4-step dark grid) ────────────────────────────── */}
      {(() => {
        const m = methodContent || {
          eyebrow: '№ 02 — The method · მეთოდი',
          heading: 'Eleven hours,',
          heading_accent: 'three pairs of hands,',
          heading_suffix: 'and a brine bath.',
          steps: [
            { n: '01', t: 'Milk arrives · 6 AM', d: 'Three Ohio dairies, within four hours of milking. We taste every churn — sweet, balanced, never sour.', time: '06:00–07:00' },
            { n: '02', t: 'Curds, cut by hand', d: 'Warmed to 86°F. We cut, pull, and knead in salted whey — the same motions for two thousand years.', time: '07:30–09:30' },
            { n: '03', t: 'Salt brine · 24 hours', d: 'Cold brine, just under 5% salinity. Fresh Sulguni ships at hour 24. Aged rests seven days with raw Ohio honey.', time: '09:30 → next day' },
            { n: '04', t: 'Out the door · 5 PM', d: 'Wheels weighed, packed cold, labelled with the batch number, off to UPS or onto a Doordash for Dublin.', time: '16:30–17:30' },
          ],
        };
        return (
          <section className="ch-section" style={{ background: "#1F3026", color: "#F5F0E6", padding: "120px 56px" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
              <div style={{ marginBottom: 56 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#8B4A28", textTransform: "uppercase" }}>{m.eyebrow}</div>
                <div className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 64, lineHeight: 1.05, marginTop: 14, color: "#F5F0E6", letterSpacing: "-0.02em", maxWidth: 800 }}>
                  {m.heading} <em style={{ color: "#8B4A28", fontWeight: 400 }}>{m.heading_accent}</em> {m.heading_suffix}
                </div>
              </div>
              <div className="ch-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 36 }}>
                {m.steps.map((s: any) => (
                  <div key={s.n} style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 18, borderTop: "1px solid #F5F0E633" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 56, fontWeight: 300, color: "#8B4A28", lineHeight: 1, letterSpacing: "-0.03em" }}>{s.n}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", color: "#F5F0E6", opacity: 0.55, textTransform: "uppercase" }}>{s.time}</div>
                    </div>
                    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "#F5F0E6", lineHeight: 1.2 }}>{s.t}</div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#F5F0E6", opacity: 0.78, lineHeight: 1.6 }}>{s.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ─── DELIVERY ─────────────────────────────────────────────────── */}
      {(() => {
        const dl = deliveryContent || {
          eyebrow: '№ 03 — How it gets to you',
          heading: 'Cold all the way',
          heading_accent: "or it doesn't go.",
          cards: [
            { tag: `${primary.city} ${primary.state}`, title: 'Same-day · Doordash', body: 'Order before 3 PM. A driver picks it up from the creamery cooler within the hour. $7 flat, free over $40.', price: '$7 flat' },
            { tag: 'Continental US', title: 'UPS · Cold ship · 1–2 days', body: 'Vacuum-packed, ice gel, insulated liner. We only ship Mon–Wed so nothing sleeps in a warehouse over a weekend.', price: '$12 → $18' },
            { tag: 'Pickup', title: 'Walk in · 9 AM–6 PM', body: `${primary.addressLine1}, ${primary.city}. Tasting plate on the counter every morning. Park out front; we'll carry it to the car.`, price: 'Free' },
          ],
        };
        return (
          <section className="ch-section" style={{ background: "#F5F0E6", padding: "96px 56px" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
              <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 44 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>{dl.eyebrow}</div>
                  <div className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, lineHeight: 1.05, marginTop: 14, color: "#1F3026", letterSpacing: "-0.02em" }}>
                    {dl.heading} <em style={{ color: "#B96A3D", fontWeight: 400 }}>{dl.heading_accent}</em>
                  </div>
                </div>
              </div>
              <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
                {dl.cards.map((c: any) => (
                  <div key={c.title} style={{ background: "#EAE2D2", border: "1px solid #1F30261a", padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: "#B96A3D", textTransform: "uppercase" }}>{c.tag}</div>
                    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 26, color: "#1F3026", lineHeight: 1.1 }}>{c.title}</div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "#2C3D33", lineHeight: 1.6 }}>{c.body}</div>
                    <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid #1F302622", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#1F3026", textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
                      <span>Shipping</span><span>{c.price}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ─── SUBSCRIPTION (cheese club) ───────────────────────────────── */}
      {(() => {
        const sub = subContent || {
          eyebrow: '№ 04 — The cheese club',
          heading: 'One box,',
          heading_accent: 'every month.',
          description: 'Three rotating cheeses, a printed recipe card, and a postcard from whichever dairy our milk came from this month. Pause anytime.',
          cta_primary: 'Start subscription',
          cta_secondary: 'One-time gift box',
          box_name: 'The Brine Box',
          box_price: '$48',
          box_period: '/mo',
          box_features: [
            'Three hand-cut cheeses · ~900g total',
            'One feature: aged Sulguni or seasonal',
            'Recipe card from our test kitchen',
            'Postcard from the dairy of the month',
            'Free cold shipping in the US',
            'Skip, pause, or cancel any month',
          ],
        };
        return (
          <section className="ch-section" style={{ background: "#1F3026", color: "#F5F0E6", padding: "120px 56px" }}>
            <div className="ch-cm-sub-grid" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#8B4A28", textTransform: "uppercase" }}>{sub.eyebrow}</div>
                <div className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 64, lineHeight: 1, marginTop: 14, color: "#F5F0E6", letterSpacing: "-0.025em" }}>
                  {sub.heading} <em style={{ color: "#8B4A28", fontWeight: 400 }}>{sub.heading_accent}</em>
                </div>
                <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 19, lineHeight: 1.55, color: "#F5F0E6", opacity: 0.82, marginTop: 22, maxWidth: 520 }}>
                  {sub.description}
                </p>
                <div className="ch-cm-sub-ctas" style={{ marginTop: 32, display: "flex", gap: 14 }}>
                  <Link href={`${prefix}/creamery`} style={{ background: "#8B4A28", color: "#1F3026", padding: "16px 30px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>{sub.cta_primary}</Link>
                  <Link href={`${prefix}/creamery`} style={{ background: "transparent", color: "#F5F0E6", border: "1px solid #F5F0E655", padding: "16px 30px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>{sub.cta_secondary}</Link>
                </div>
              </div>
              <div style={{ background: "#2C3D33", border: "1px solid #F5F0E622", padding: 36 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 14, borderBottom: "1px solid #F5F0E622" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 26, color: "#F5F0E6" }}>{sub.box_name}</div>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 32, color: "#8B4A28", fontWeight: 300, lineHeight: 1 }}>{sub.box_price}<span style={{ fontSize: 13, opacity: 0.6, letterSpacing: "0.16em", marginLeft: 8 }}>{sub.box_period}</span></div>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
                  {sub.box_features.map((l: string) => (
                    <li key={l} style={{ display: "flex", alignItems: "flex-start", gap: 12, fontFamily: "var(--font-serif)", fontSize: 15, lineHeight: 1.4, color: "#F5F0E6", opacity: 0.9 }}>
                      <span style={{ color: "#8B4A28", fontFamily: "var(--font-mono)", fontSize: 11 }}>→</span>{l}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        );
      })()}
    </>
  );
}
