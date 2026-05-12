import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ProductGalleryNew } from "@/components/shop/ProductDetailClient";
import ProductReviews from "@/components/reviews/ProductReviews";
import BakeryPdpClient from "@/components/bakery/BakeryPdpClient";
import { getSession } from "@/lib/session";
import { getMyAddresses } from "@/app/actions/addresses";
import type { ActiveAddress } from "@/components/bakery/AddressManager";
import { ProductKind } from "@prisma/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';

interface BakeryPdpProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: BakeryPdpProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, status: { in: ['ACTIVE', 'COMING_SOON'] }, kind: { in: [ProductKind.BAKERY_HOT, ProductKind.BAKERY_FROZEN] } },
  });
  if (!product) return { title: "Product Not Found" };

  const canonicalPath = locale === 'en' ? `/bakery/${slug}` : `/${locale}/bakery/${slug}`;
  return {
    title: `${product.name} | Colchis Food Bakery`,
    description: product.description.slice(0, 160),
    alternates: {
      canonical: `${SITE_URL}${canonicalPath}`,
      languages: { 'en': `${SITE_URL}/bakery/${slug}`, 'ka': `${SITE_URL}/ka/bakery/${slug}` },
    },
    openGraph: {
      type: 'website',
      title: `${product.name} | Colchis Food Bakery`,
      description: product.description.slice(0, 200),
      url: `${SITE_URL}${canonicalPath}`,
      siteName: 'Colchis Food',
      images: product.imageUrl ? [{ url: product.imageUrl, width: 800, height: 600, alt: product.name }] : [],
    },
  };
}

export default async function BakeryPdp({ params }: BakeryPdpProps) {
  const { locale, slug } = await params;
  const prefix = locale === "en" ? "" : `/${locale}`;

  const product = await prisma.product.findFirst({
    where: {
      slug,
      status: { in: ['ACTIVE', 'COMING_SOON'] },
      isB2cVisible: true,
      kind: { in: [ProductKind.BAKERY_HOT, ProductKind.BAKERY_FROZEN] },
    },
    include: {
      channels: true,
    },
  });
  if (!product) notFound();

  const allImages = [product.imageUrl, ...(product.images || [])].filter(Boolean);
  const allVideos = (product.videoUrls || []).filter(Boolean);

  // All channels this product is configured for (server-rendered). BakeryPdpClient
  // filters them against the customer's address once it loads on the client.
  const offeredChannels = product.channels.map(c => c.channel);

  // Prime initial address for logged-in users so the client doesn't flicker.
  const session = await getSession();
  let initialAddress: ActiveAddress | null = null;
  if (session?.userId) {
    const addrs = await getMyAddresses();
    const def = addrs.find(a => a.isDefault) || addrs[0];
    if (def && def.latitude !== null && def.longitude !== null) {
      const line2 = def.addressLine2 ? `, ${def.addressLine2}` : '';
      initialAddress = {
        id: def.id,
        label: def.label,
        formatted: `${def.addressLine1}${line2}, ${def.city}, ${def.state} ${def.postalCode}`,
        lat: def.latitude,
        lng: def.longitude,
        googlePlaceId: def.googlePlaceId,
      };
    }
  }

  // Related bakery products (same kind), exclude self, take 3
  const relatedProducts = await prisma.product.findMany({
    where: {
      id: { not: product.id },
      status: { in: ['ACTIVE', 'COMING_SOON'] },
      isB2cVisible: true,
      kind: product.kind,
    },
    take: 3,
    orderBy: { name: 'asc' },
  });

  return (
    <>
      {/* ─── Breadcrumbs ──────────────────────────────────────────────── */}
      <nav className="ch-breadcrumbs" style={{ background: "#F5F0E6", padding: "20px 56px", borderBottom: "1px solid #1F302611", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link href={`${prefix}/`} style={{ color: "#7A8278", textDecoration: "none" }}>Colchis Food</Link>
          <span style={{ color: "#2C3D33", opacity: 0.5 }}>/</span>
          <Link href={`${prefix}/bakery`} style={{ color: "#7A8278", textDecoration: "none" }}>Bakery</Link>
          <span style={{ color: "#2C3D33", opacity: 0.5 }}>/</span>
          <span style={{ color: "#7A8278" }}>{product.kind === ProductKind.BAKERY_HOT ? 'Hot' : 'Frozen'}</span>
          <span style={{ color: "#2C3D33", opacity: 0.5 }}>/</span>
          <span style={{ color: "#1F3026", fontWeight: 500 }}>{product.name}</span>
        </div>
      </nav>

      {/* ─── Hero: Gallery + Info ─────────────────────────────────────── */}
      <section className="ch-section" style={{ background: "#F5F0E6", padding: "60px 56px 80px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="ch-pdp-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "flex-start" }}>
            <ProductGalleryNew images={allImages} videos={allVideos} productName={product.name} />

            {/* Bakery Info Panel — client component (cart + address-aware channels) */}
            <BakeryPdpClient
              product={{
                id: product.id,
                sku: product.sku,
                slug: product.slug,
                name: product.name,
                nameKa: product.nameKa,
                description: product.description,
                weight: product.weight,
                ingredients: product.ingredients,
                priceB2c: product.priceB2c,
                priceB2b: product.priceB2b,
                tag: product.tag,
                imageUrl: product.imageUrl,
                status: product.status,
                isMadeToOrder: product.isMadeToOrder,
                kind: product.kind,
                stockQuantity: product.stockQuantity,
              }}
              offeredChannels={offeredChannels}
              locale={locale}
              initialAddress={initialAddress}
              isLoggedIn={!!session?.userId}
            />
          </div>
        </div>
      </section>

      {/* ─── Reviews ──────────────────────────────────────────────────── */}
      <section className="ch-section" style={{ background: "#F5F0E6", padding: "96px 56px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 44 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>What people say</div>
              <h2 className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 48, lineHeight: 1.05, marginTop: 14, color: "#1F3026" }}>
                Reviews <em style={{ color: "#B96A3D", fontWeight: 400 }}>&amp; notes</em>
              </h2>
            </div>
          </div>
          <ProductReviews productId={product.id} productSlug={product.slug} />
        </div>
      </section>

      {/* ─── Related bakery products ───────────────────────────────────── */}
      {relatedProducts.length > 0 && (
        <section className="ch-section" style={{ background: "#EAE2D2", padding: "96px 56px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 44 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>Also from our bakery</div>
                <h2 className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 48, lineHeight: 1.05, marginTop: 14, color: "#1F3026" }}>
                  You might <em style={{ color: "#B96A3D", fontWeight: 400 }}>also love</em>
                </h2>
              </div>
              <Link href={`${prefix}/bakery`} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", color: "#1F3026", textTransform: "uppercase", textDecoration: "none", borderBottom: "1px solid #1F3026" }}>Browse menu →</Link>
            </div>
            <div className="ch-pdp-related-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
              {relatedProducts.map(rp => {
                const rpPrice = (() => {
                  const n = parseFloat(rp.priceB2c);
                  if (isNaN(n)) return `$${rp.priceB2c}`;
                  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
                })();
                return (
                  <Link key={rp.id} href={`${prefix}/bakery/${rp.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block", background: "#F5F0E6", border: "1px solid #1F302622" }}>
                    <div style={{ aspectRatio: "1", background: "#EAE2D2", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {rp.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={rp.imageUrl} alt={rp.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>[ {rp.name} ]</div>
                      )}
                      {rp.tag && (
                        <div style={{ position: "absolute", top: 14, left: 14 }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", padding: "6px 12px", background: rp.tag === "Vegan" ? "#2C3D33" : "#B96A3D", color: "#F5F0E6" }}>{rp.tag}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: 20 }}>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "#1F3026", lineHeight: 1.15 }}>{rp.name}</div>
                      {rp.nameKa && <div style={{ fontFamily: "var(--font-serif-ka, 'Noto Serif Georgian', serif)", fontSize: 14, color: "#1F3026", opacity: 0.5, marginTop: 4 }}>{rp.nameKa}</div>}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14 }}>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "#B96A3D" }}>{rpPrice}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase" }}>View →</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
