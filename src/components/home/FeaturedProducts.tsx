"use client";

import Link from "next/link";
import type { Product } from "@/types";

interface FeaturedProductsProps {
  products: (Product & { section?: "bakery" | "creamery" })[];
  locale: string;
}

export function FeaturedProducts({ products, locale }: FeaturedProductsProps) {
  const prefix = locale === "en" ? "" : `/${locale}`;

  // Map db products to the new card format. `section` (from Category.sections)
  // drives BOTH the house label and the PDP route — Product.house was dropped
  // in 1i, and there is no /shop/[slug] route (PDPs live at /bakery|/creamery).
  const displayItems = products.length > 0
    ? products.map((p) => ({
        house: p.section === "bakery" ? "Bakery" : "Creamery",
        section: p.section === "bakery" ? "bakery" : "creamery",
        name: p.name,
        ka: "",
        price: `$${p.priceB2c.toFixed(0)}`,
        note: p.description?.slice(0, 80) || "",
        tag: p.status === "COMING_SOON" ? "Coming Soon" : "",
        slug: p.slug,
        imageUrl: p.imageUrl,
      }))
    : [
        { house: "Creamery", section: "creamery", name: "Sulguni · Fresh", ka: "სულგუნი", price: "$14", note: "100% cow milk · 340g · brined fresh", tag: "Bestseller", slug: "sulguni-fresh", imageUrl: "" },
        { house: "Creamery", section: "creamery", name: "Sulguni · Aged", ka: "სულგუნი", price: "$18", note: "Cow milk · honey-cured · 7 days · 280g", tag: "Limited", slug: "sulguni-aged", imageUrl: "" },
        { house: "Creamery", section: "creamery", name: "Imeruli", ka: "იმერული", price: "$12", note: "Cow milk · pulled in salted whey · 320g", tag: "", slug: "imeruli", imageUrl: "" },
        { house: "Bakery", section: "bakery", name: "Adjaruli Khachapuri", ka: "აჭარული", price: "$16", note: "Boat-shape · egg yolk · butter · 520g", tag: "Hot · 25 min", slug: "adjaruli", imageUrl: "" },
        { house: "Bakery", section: "bakery", name: "Imeruli Khachapuri", ka: "იმერული", price: "$14", note: "Round, sulguni-stuffed · 480g", tag: "", slug: "imeruli-khachapuri", imageUrl: "" },
        { house: "Bakery", section: "bakery", name: "Frozen Adjaruli · 2-pk", ka: "აჭარული", price: "$24", note: "Ships nationwide · bake in 18 min", tag: "Ships", slug: "frozen-adjaruli", imageUrl: "" },
      ];

  return (
    <section className="ch-section" style={{ background: "#EAE2D2", padding: "120px 56px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        {/* Header */}
        <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 56 }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ 04 — The Shop</div>
            <h2 className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 64, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#1F3026", marginTop: 14 }}>
              What&apos;s <em style={{ color: "#B96A3D", fontWeight: 400 }}>made today.</em>
            </h2>
          </div>
          <Link href={`${prefix}/shop`} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "#1F3026", textDecoration: "none", borderBottom: "1px solid #1F3026" }}>
            See all items →
          </Link>
        </div>

        {/* Product grid — matches rebrand spec exactly */}
        <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {displayItems.map((p, i) => (
            <Link key={i} href={`${prefix}/${p.section}/${p.slug}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", background: "#F5F0E6", border: "1px solid #1F302614", overflow: "hidden", transition: "transform 200ms, box-shadow 200ms" }}>
              {/* Image area */}
              <div style={{ aspectRatio: "4/3", background: "#EAE2D2", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid #1F302614" }}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", color: "#7A8278", opacity: 0.6, textTransform: "uppercase" }}>[ {p.name} photo ]</div>
                )}
                {/* Tag badge */}
                {p.tag && (
                  <div style={{ position: "absolute", top: 16, left: 16, padding: "6px 12px", background: p.tag.includes("Hot") ? "#B96A3D" : "#1F3026", color: "#F5F0E6", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase" }}>{p.tag}</div>
                )}
                {/* House label */}
                <div style={{ position: "absolute", top: 16, right: 16, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase" }}>{p.house}</div>
              </div>

              {/* Card body */}
              <div style={{ padding: "24px 24px 28px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 26, color: "#1F3026", lineHeight: 1 }}>{p.name}</div>
                    {p.ka && <div style={{ fontFamily: "var(--font-serif-ka, 'Noto Serif Georgian', serif)", fontSize: 14, color: "#1F3026", opacity: 0.5, marginTop: 4 }}>{p.ka}</div>}
                  </div>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "#B96A3D", fontWeight: 500 }}>{p.price}</div>
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#2C3D33", lineHeight: 1.5, marginTop: 12, flex: 1 }}>{p.note}</div>
                <div
                  style={{
                    marginTop: 20,
                    background: "transparent",
                    color: "#1F3026",
                    border: "1px solid #1F3026",
                    padding: "12px 0",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  View details →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
