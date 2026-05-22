import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { JsonLdProduct } from "@/components/seo/JsonLdProduct";
import Link from "next/link";
import type { Metadata } from "next";
import { ProductGalleryNew, InfoPanel } from "@/components/shop/ProductDetailClient";
import ProductReviews from "@/components/reviews/ProductReviews";
import CreameryDeliveryOptions from "@/components/shop/CreameryDeliveryOptions";
import { getSession } from "@/lib/session";
import { getMyAddresses } from "@/app/actions/addresses";
import type { ActiveAddress } from "@/components/bakery/AddressManager";
import type { DeliveryMethod } from "@prisma/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';

interface ProductPageProps {
  params: Promise<{ locale: string; productId: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale, productId } = await params;
  const product = await prisma.product.findFirst({
    where: { OR: [{ slug: productId }, { id: productId }], status: { in: ['ACTIVE', 'COMING_SOON'] } },
    include: { productLine: true, productCategory: true },
  });

  if (!product) return { title: "Product Not Found" };

  const slug = product.slug;
  const canonicalPath = locale === 'en' ? `/creamery/${slug}` : `/${locale}/creamery/${slug}`;
  const lineName = product.productLine?.name || '';

  return {
    title: `${product.name}${lineName ? ` — ${lineName}` : ''}`,
    description: `${product.description} Crafted from 100% Grass-Fed A2 Brown Swiss Milk. Made fresh in Ohio.`,
    alternates: {
      canonical: `${SITE_URL}${canonicalPath}`,
      languages: {
        'en': `${SITE_URL}/creamery/${slug}`,
        'ka': `${SITE_URL}/ka/creamery/${slug}`,
        'ru': `${SITE_URL}/ru/creamery/${slug}`,
        'es': `${SITE_URL}/es/creamery/${slug}`,
        'x-default': `${SITE_URL}/creamery/${slug}`,
      },
    },
    openGraph: {
      type: 'website',
      title: `${product.name} | Colchis Food`,
      description: `${product.description} Made exclusively from 100% Grass-Fed A2 Brown Swiss Milk.`,
      url: `${SITE_URL}${canonicalPath}`,
      siteName: 'Colchis Food',
      images: product.imageUrl ? [{ url: product.imageUrl, width: 800, height: 600, alt: product.name }] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, productId } = await params;
  const prefix = locale === "en" ? "" : `/${locale}`;

  const product = await prisma.product.findFirst({
    where: { OR: [{ slug: productId }, { id: productId }], status: { in: ['ACTIVE', 'COMING_SOON'] }, isB2cVisible: true },
    include: { productLine: true, productCategory: true },
  });
  if (!product) notFound();

  // Prime initial address for logged-in users so the PDP delivery section doesn't flicker.
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
  const offeredChannels = [] as DeliveryMethod[];

  // 301 redirect UUID URLs to slug URLs
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (UUID_REGEX.test(productId) && product.slug && product.slug !== productId) {
    redirect(`${prefix}/creamery/${product.slug}`);
  }

  // Build gallery images and videos
  const allImages = [product.imageUrl, ...(product.images || [])].filter(Boolean);
  const allVideos = (product.videoUrls || []).filter(Boolean);

  // Product object for cart/info panel
  const productForCart = {
    id: product.id, sku: product.sku, name: product.name, slug: product.slug,
    description: product.description, flavorProfile: product.flavorProfile,
    pairsWith: product.pairsWith, weight: product.weight, ingredients: product.ingredients,
    imageUrl: product.imageUrl, priceB2c: parseFloat(product.priceB2c) || 0,
    priceB2b: parseFloat(product.priceB2b) || 0, stockQuantity: product.stockQuantity,
    isActive: product.isActive, status: product.status as 'ACTIVE' | 'INACTIVE' | 'COMING_SOON',
    isCartOrderable: product.isCartOrderable,
    productLineId: product.productLineId, categoryId: product.categoryId,
    productLine: product.productLine, productCategory: product.productCategory,
  };

  // Related products
  const relatedWhere: any = { id: { not: product.id }, status: { in: ['ACTIVE', 'COMING_SOON'] }, isB2cVisible: true };
  if (product.categoryId) relatedWhere.categoryId = product.categoryId;
  else if (product.productLineId) relatedWhere.productLineId = product.productLineId;

  const relatedProducts = await prisma.product.findMany({
    where: relatedWhere, take: 3, orderBy: { name: 'asc' },
    include: { productLine: true, productCategory: true },
  });

  // Pairings from product data
  const pairings = product.pairsWith ? product.pairsWith.split(",").map(p => p.trim()).filter(Boolean).slice(0, 4) : [];

  return (
    <>
      <JsonLdProduct product={productForCart} url={`${SITE_URL}${prefix}/creamery/${product.slug}`} productId={product.id} />

      {/* ─── Breadcrumbs ──────────────────────────────────────────────── */}
      <nav className="ch-breadcrumbs" style={{ background: "#F5F0E6", padding: "20px 56px", borderBottom: "1px solid #1F302611", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link href={`${prefix}/`} style={{ color: "#7A8278", textDecoration: "none" }}>Colchis Food</Link>
          <span style={{ color: "#2C3D33", opacity: 0.5 }}>/</span>
          <Link href={`${prefix}/creamery`} style={{ color: "#7A8278", textDecoration: "none" }}>Creamery</Link>
          <span style={{ color: "#2C3D33", opacity: 0.5 }}>/</span>
          {product.productCategory && (
            <>
              <Link href={`${prefix}/creamery?cat=${product.productCategory.slug}`} style={{ color: "#7A8278", textDecoration: "none" }}>{product.productCategory.name}</Link>
              <span style={{ color: "#2C3D33", opacity: 0.5 }}>/</span>
            </>
          )}
          <span style={{ color: "#1F3026", fontWeight: 500 }}>{product.name}</span>
        </div>
      </nav>

      {/* ─── Hero: Gallery + Info ─────────────────────────────────────── */}
      <section className="ch-section" style={{ background: "#F5F0E6", padding: "60px 56px 80px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="ch-pdp-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "flex-start" }}>
            <ProductGalleryNew images={allImages} videos={allVideos} productName={product.name} />
            <InfoPanel product={productForCart} />
          </div>
        </div>
      </section>

      {/* ─── Address-aware delivery options ───────────────────────────── */}
      <CreameryDeliveryOptions
        productId={product.id}
        offeredChannels={offeredChannels}
        locale={locale}
        initialAddress={initialAddress}
        isLoggedIn={!!session?.userId}
      />

      {/* ─── Pairings ─────────────────────────────────────────────────── */}
      {pairings.length > 0 && (
        <section className="ch-section" style={{ background: "#1F3026", color: "#F5F0E6", padding: "80px 56px" }}>
          <div className="ch-pdp-pairings-grid" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 56, alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#8B4A28", textTransform: "uppercase" }}>How we&apos;d eat it</div>
              <h2 className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, lineHeight: 1.05, marginTop: 16, color: "#F5F0E6" }}>
                Pairs with <em style={{ color: "#8B4A28", fontWeight: 400 }}>everything.</em>
              </h2>
              {product.flavorProfile && (
                <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, lineHeight: 1.6, color: "#F5F0E6", opacity: 0.78, marginTop: 16, maxWidth: 540 }}>{product.flavorProfile}</p>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {pairings.map((p, i) => (
                <div key={i} style={{ padding: "20px", background: "#2C3D33", border: "1px solid #F5F0E622", minHeight: 100, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, lineHeight: 1.1, color: "#F5F0E6" }}>{p}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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

      {/* ─── Related Products ─────────────────────────────────────────── */}
      {relatedProducts.length > 0 && (
        <section className="ch-section" style={{ background: "#EAE2D2", padding: "96px 56px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 44 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>Also in this collection</div>
                <h2 className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 48, lineHeight: 1.05, marginTop: 14, color: "#1F3026" }}>
                  You might <em style={{ color: "#B96A3D", fontWeight: 400 }}>also love</em>
                </h2>
              </div>
              <Link href={`${prefix}/creamery`} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", color: "#1F3026", textTransform: "uppercase", textDecoration: "none", borderBottom: "1px solid #1F3026" }}>Browse all →</Link>
            </div>
            <div className="ch-pdp-related-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
              {relatedProducts.map(rp => (
                <Link key={rp.id} href={`${prefix}/creamery/${rp.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block", background: "#F5F0E6", border: "1px solid #1F302622", transition: "transform 200ms, box-shadow 200ms" }}>
                  <div style={{ aspectRatio: "1", background: "#EAE2D2", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {rp.imageUrl ? (
                      <img src={rp.imageUrl} alt={rp.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>[ {rp.name} ]</div>
                    )}
                    {rp.productLine && (
                      <div style={{ position: "absolute", top: 14, left: 14 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", padding: "6px 12px", background: `${rp.productLine.badgeColor || "#B96A3D"}18`, color: rp.productLine.badgeColor || "#B96A3D", border: `1px solid ${rp.productLine.badgeColor || "#B96A3D"}44`, borderRadius: 999, fontWeight: 500 }}>{rp.productLine.name}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: 20 }}>
                    {rp.productCategory && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>{rp.productCategory.name}</div>}
                    <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "#1F3026", marginTop: 6, lineHeight: 1.15 }}>{rp.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14 }}>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "#1F3026" }}>${(parseFloat(rp.priceB2c) || 0).toFixed(2)}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#B96A3D", textTransform: "uppercase" }}>Add →</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
