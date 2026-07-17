"use client";

import Image from "next/image";
import { useState } from "react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";

// ─── Star rating ──────────────────────────────────────────────────────
function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" style={{ display: "inline-block" }}>
      <path d="M8 1l2.09 4.26L15 6l-3.5 3.41.83 4.84L8 11.97 3.67 14.25 4.5 9.41 1 6l4.91-.74L8 1z"
        fill={filled ? "#B96A3D" : "transparent"} stroke="#B96A3D" strokeWidth="1" />
    </svg>
  );
}

// ─── Gallery with thumbnails, video/YouTube, and mobile swipe ─────
function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

type MediaItem = { type: 'image'; url: string } | { type: 'video'; url: string; ytId?: string };

export function ProductGalleryNew({ images, videos = [], productName }: { images: string[]; videos?: string[]; productName: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);

  // Build unified media list
  const mediaItems: MediaItem[] = [
    ...images.map(url => ({ type: 'image' as const, url })),
    ...videos.map(url => {
      const ytId = getYouTubeId(url);
      return { type: 'video' as const, url, ytId: ytId || undefined };
    }),
  ];

  const mediaCount = Math.max(mediaItems.length, 1);
  const activeItem = mediaItems[activeIdx] || mediaItems[0];

  // Swipe handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setTouchDelta(0);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    setTouchDelta(e.touches[0].clientX - touchStart);
  };
  const handleTouchEnd = () => {
    if (touchStart === null) return;
    const threshold = 50;
    if (touchDelta < -threshold && activeIdx < mediaItems.length - 1) {
      setActiveIdx(activeIdx + 1);
    } else if (touchDelta > threshold && activeIdx > 0) {
      setActiveIdx(activeIdx - 1);
    }
    setTouchStart(null);
    setTouchDelta(0);
  };

  return (
    <div className="ch-pdp-gallery" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Main display */}
      <div
        style={{ aspectRatio: "1", background: "#EAE2D2", border: "1px solid #1F302622", position: "relative", overflow: "hidden", touchAction: "pan-y" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {mediaItems.length === 0 ? (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>[ {productName} ]</div>
        ) : activeItem?.type === 'video' && activeItem.ytId ? (
          <iframe
            src={`https://www.youtube.com/embed/${activeItem.ytId}?autoplay=0&rel=0`}
            className="ch-pdp-yt-iframe"
            style={{ width: "100%", height: "100%", border: "none" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={`${productName} video`}
          />
        ) : activeItem?.type === 'video' ? (
          <video
            src={activeItem.url}
            controls
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : activeItem ? (
          <Image src={activeItem.url} alt={productName} fill sizes="(max-width: 768px) 100vw, 50vw" style={{ objectFit: "cover" }} />
        ) : null}

        {/* Counter badge */}
        <div style={{ position: "absolute", bottom: 16, right: 16, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: "#7A8278", background: "#F5F0E6DD", padding: "4px 10px", borderRadius: 999, textTransform: "uppercase", zIndex: 5 }}>
          {String(activeIdx + 1).padStart(2, "0")} / {String(mediaCount).padStart(2, "0")}
        </div>
      </div>

      {/* Thumbnail strip */}
      {mediaItems.length > 1 && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
          {mediaItems.map((item, i) => (
            <button key={i} onClick={() => setActiveIdx(i)} style={{
              width: 80, height: 80, flexShrink: 0, minWidth: 44, minHeight: 44,
              border: i === activeIdx ? "2px solid #B96A3D" : "1px solid #1F302622",
              background: "#EAE2D2", cursor: "pointer", padding: 0,
              opacity: i === activeIdx ? 1 : 0.55, transition: "all 200ms",
              overflow: "hidden", position: "relative",
            }}>
              {item.type === 'image' ? (
                <Image src={item.url} alt={`${productName} ${i + 1}`} fill sizes="96px" style={{ objectFit: "cover" }} />
              ) : item.ytId ? (
                <>
                  <img
                    src={`https://img.youtube.com/vi/${item.ytId}/default.jpg`}
                    alt={`Video ${i + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </>
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2C3D33" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#7A8278"><path d="M8 5v14l11-7z"/></svg>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Info Panel (badges, title, price, qty, CTA, specs) ──────────────
interface ProductForPanel {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  flavorProfile: string | null;
  pairsWith: string | null;
  weight: string | null;
  ingredients: string | null;
  imageUrl: string;
  priceB2c: number;
  priceB2b: number;
  stockQuantity: number;
  isActive: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'COMING_SOON';
  isCartOrderable?: boolean;
  productLineId: string | null;
  categoryId: string | null;
  productLine: { id: string; slug: string; name: string; tagline: string | null; description: string | null; badgeColor: string | null; sortOrder: number; isActive: boolean } | null;
  productCategory: { id: string; slug: string; name: string; description: string | null; imageUrl: string | null; productLineId: string | null; sections: string[]; sortOrder: number; isActive: boolean } | null;
}

// `unavailable` = no location offers this product (empty offered-channels list —
// e.g. an 86'd made-to-order item); the CTA must not let it into the cart.
export function InfoPanel({ product, unavailable = false }: { product: ProductForPanel; unavailable?: boolean }) {
  const isComingSoon = product.status === "COMING_SOON";
  const lineColor = product.productLine?.badgeColor || "#B96A3D";

  const specs: { label: string; value: string }[] = [];
  if (product.flavorProfile) specs.push({ label: "Tasting Notes", value: product.flavorProfile });
  if (product.weight) specs.push({ label: "Weight", value: product.weight });
  if (product.ingredients) specs.push({ label: "Ingredients", value: product.ingredients });
  // Allergen disclosure — always present (food business; an ingredients list
  // alone isn't a substitute for an allergen statement).
  specs.push({
    label: "Allergens",
    value: "Made in a creamery that handles milk, wheat (gluten) and eggs. Questions? Contact us before ordering.",
  });
  if (product.pairsWith) specs.push({ label: "Pairs With", value: product.pairsWith });

  return (
    <div className="ch-pdp-info" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Badges */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        {isComingSoon ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", padding: "6px 12px", background: "#D9A87622", color: "#B96A3D", border: "1px solid #D9A87655", borderRadius: 999, fontWeight: 500 }}>Coming Soon</span>
        ) : product.stockQuantity > 0 ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", padding: "6px 12px", background: "#B96A3D18", color: "#B96A3D", border: "1px solid #B96A3D44", borderRadius: 999, fontWeight: 500 }}>In Stock</span>
        ) : (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", padding: "6px 12px", background: "#A8312C22", color: "#A8312C", border: "1px solid #A8312C55", borderRadius: 999, fontWeight: 500 }}>Out of Stock</span>
        )}
        {product.productLine && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", padding: "6px 12px", background: `${lineColor}18`, color: lineColor, border: `1px solid ${lineColor}44`, borderRadius: 999, fontWeight: 500 }}>{product.productLine.name}</span>
        )}
      </div>

      {/* Category eyebrow */}
      {product.productCategory && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 8 }}>{product.productCategory.name}</div>
      )}

      {/* Title */}
      <h1 className="ch-pdp-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 64, lineHeight: 0.98, letterSpacing: "-0.025em", margin: 0, color: "#1F3026" }}>
        {product.name}
      </h1>

      {/* Price */}
      <div style={{ marginTop: 24, display: "flex", alignItems: "baseline", gap: 14 }}>
        {isComingSoon ? (
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 24, color: "#B96A3D" }}>Coming soon — pre-orders open later this season</div>
        ) : (
          <>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 38, color: "#1F3026", fontWeight: 400 }}>${product.priceB2c.toFixed(2)}</div>
            {product.weight && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase" }}>· {product.weight}</div>}
          </>
        )}
      </div>

      {/* Description */}
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 19, lineHeight: 1.6, color: "#2C3D33", marginTop: 28, marginBottom: 0 }}>{product.description}</p>

      {/* Specs grid */}
      {specs.length > 0 && (
        <div className="ch-pdp-specs" style={{ marginTop: 36, paddingTop: 28, borderTop: "1px solid #1F302622", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 32px" }}>
          {specs.map((s, i) => (
            <div key={i}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "#1F3026" }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* CTA — coming soon > wholesale-only > unavailable > standard add-to-cart */}
      <div className="ch-pdp-cta" style={{ marginTop: 36, display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
        {isComingSoon ? (
          <button style={{ flex: 1, minWidth: 220, height: 56, background: "#B96A3D22", border: "1px solid #B96A3D", color: "#B96A3D", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Notify Me When Available</button>
        ) : product.isCartOrderable === false ? (
          <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: 10, padding: 18, background: "#2C3D33", color: "#F5F0E6" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase" }}>Wholesale only</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, opacity: 0.85, lineHeight: 1.55 }}>This product isn&apos;t available for retail orders. Restaurants and shops — request a quote and we&apos;ll get back to you within one business day.</div>
            <a href="/wholesale" style={{ alignSelf: "flex-start", marginTop: 4, background: "#B96A3D", color: "#F5F0E6", padding: "12px 22px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Request a quote →</a>
          </div>
        ) : unavailable ? (
          <button disabled style={{ flex: 1, minWidth: 220, height: 56, background: "#7A8278", border: "none", color: "#F5F0E6", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "not-allowed", opacity: 0.6 }}>Unavailable right now</button>
        ) : (
          <AddToCartButton product={product} />
        )}
      </div>

      {/* Delivery guarantees */}
      <div className="ch-pdp-guarantees" style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #1F302622", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
        {[
          { eyebrow: "Ships in", value: "24-48h cold pack" },
          { eyebrow: "Best by", value: "14 days fresh" },
          { eyebrow: "Made in", value: "Dublin, Ohio" },
        ].map((g, i) => (
          <div key={i}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase" }}>{g.eyebrow}</div>
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 15, color: "#1F3026", marginTop: 4 }}>{g.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
