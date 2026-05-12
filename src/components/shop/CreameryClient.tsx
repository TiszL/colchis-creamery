"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Minus, Plus, ShoppingBag, Check } from "lucide-react";
import { useCart } from "@/providers/CartProvider";
import AddressManager, { type ActiveAddress } from "@/components/bakery/AddressManager";
import type { UserAddressDto } from "@/app/actions/addresses";
import { getAvailableCreameryProducts, type CreameryAvailabilityResult } from "@/app/actions/creamery-availability";
import { cartEligibleChannels } from "@/lib/fulfillment";
import type { FulfillmentChannel } from "@prisma/client";

function channelLabel(c: FulfillmentChannel): string {
  switch (c) {
    case 'UPS_GROUND_2DAY': return 'UPS 2-day';
    case 'HOT_DELIVERY_OWN': return 'Hot delivery';
    case 'DOORDASH_DRIVE': return 'DoorDash';
    case 'UBER_DIRECT': return 'Uber Eats';
    case 'IN_STORE_PICKUP': return 'Pickup';
    case 'IN_STORE_DINE_IN': return 'Dine-in';
    default: return c.replace(/_/g, ' ');
  }
}

// ─── Cheese product illustrations (typographic SVGs, no photos) ────────
function CheeseVisual({ kind }: { kind: string }) {
  const cream = "#F5F0E6";
  const cream2 = "#EAE2D2";
  const ink = "#1F3026";
  const accent = "#B96A3D";
  const subtle = ink + "14";

  if (kind === "wheel") {
    return (
      <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%", display: "block", background: cream2 }}>
        <ellipse cx="200" cy="240" rx="120" ry="14" fill={ink} opacity="0.12" />
        <rect x="92" y="120" width="216" height="120" rx="6" fill={cream} stroke={subtle} />
        <path d="M92 120 Q100 100 130 100 L270 100 Q300 100 308 120" fill={cream} stroke={subtle} />
        <rect x="92" y="170" width="216" height="34" fill={accent} opacity="0.92" />
        <text x="200" y="192" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="10" letterSpacing="0.32em" fill={cream}>SULGUNI · FRESH</text>
        <circle cx="200" cy="138" r="14" fill="none" stroke={cream} strokeWidth="1.2" />
        <text x="200" y="142" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="14" fill={cream}>cf</text>
        <text x="200" y="225" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" letterSpacing="0.28em" fill={ink} opacity="0.7">340G · BATCH 12-A</text>
      </svg>
    );
  }
  if (kind === "aged") {
    return (
      <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%", display: "block", background: cream2 }}>
        <defs><radialGradient id="agedG" cx="50%" cy="35%" r="65%"><stop offset="0%" stopColor="#F2E3BE" /><stop offset="100%" stopColor="#C8A66A" /></radialGradient></defs>
        <ellipse cx="200" cy="245" rx="115" ry="12" fill={ink} opacity="0.14" />
        <path d="M120 80 L150 60 L195 50 L255 55 L290 78" stroke={accent} strokeWidth="2" fill="none" opacity="0.7" strokeLinecap="round" />
        <ellipse cx="200" cy="170" rx="115" ry="70" fill="url(#agedG)" stroke={ink} strokeWidth="1" opacity="0.95" />
        <path d="M150 130 Q160 145 155 165 Q150 180 165 195 Q172 205 168 220" stroke={accent} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M230 115 Q240 130 235 155 Q230 175 250 195" stroke={accent} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85" />
        <circle cx="168" cy="222" r="4" fill={accent} />
        <circle cx="250" cy="197" r="4" fill={accent} />
        <circle cx="200" cy="170" r="22" fill="none" stroke={ink} strokeWidth="0.8" opacity="0.55" />
        <text x="200" y="167" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="7" letterSpacing="0.32em" fill={ink} opacity="0.7">AGED · 7D</text>
        <text x="200" y="180" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="11" fill={ink} opacity="0.85">honey</text>
      </svg>
    );
  }
  if (kind === "slab") {
    return (
      <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%", display: "block", background: cream2 }}>
        <ellipse cx="200" cy="248" rx="130" ry="10" fill={ink} opacity="0.12" />
        <path d="M80 130 Q80 110 110 110 L290 110 Q320 110 320 130 L320 230 Q320 250 290 250 L110 250 Q80 250 80 230 Z" fill={cream} stroke={subtle} />
        <rect x="120" y="148" width="160" height="84" fill={ink} />
        <text x="200" y="170" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" letterSpacing="0.32em" fill={accent}>SULGUNI · SLAB</text>
        <text x="200" y="195" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="22" fill={cream}>500g</text>
        <line x1="140" y1="208" x2="260" y2="208" stroke={cream} strokeWidth="0.5" opacity="0.4" />
        <text x="200" y="222" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="7" letterSpacing="0.32em" fill={cream} opacity="0.7">VAC · 30 DAYS</text>
        <line x1="85" y1="180" x2="100" y2="180" stroke={subtle} strokeWidth="1" />
        <line x1="300" y1="180" x2="315" y2="180" stroke={subtle} strokeWidth="1" />
      </svg>
    );
  }
  if (kind === "block") {
    return (
      <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%", display: "block", background: cream2 }}>
        <ellipse cx="200" cy="252" rx="135" ry="10" fill={ink} opacity="0.16" />
        <path d="M80 90 L320 90 L350 110 L350 250 L110 250 L80 230 Z" fill={cream} stroke={subtle} />
        <path d="M320 90 L350 110 L350 250 L320 230 Z" fill={ink} opacity="0.08" />
        <path d="M80 90 L320 90 L350 110 L110 110 Z" fill={ink} opacity="0.04" />
        <rect x="105" y="145" width="210" height="64" fill={accent} />
        <text x="210" y="172" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="9" letterSpacing="0.36em" fill={cream}>FOODSERVICE</text>
        <text x="210" y="198" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="26" fill={cream}>5 kg</text>
        <text x="200" y="232" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" letterSpacing="0.3em" fill={ink} opacity="0.7">SULGUNI · BULK BLOCK</text>
      </svg>
    );
  }
  if (kind === "pouch") {
    return (
      <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%", display: "block", background: cream2 }}>
        <ellipse cx="200" cy="252" rx="100" ry="9" fill={ink} opacity="0.14" />
        <path d="M125 70 L275 70 Q295 70 295 95 L295 245 Q295 252 290 252 L110 252 Q105 252 105 245 L105 95 Q105 70 125 70 Z" fill={cream} stroke={subtle} />
        <line x1="115" y1="84" x2="285" y2="84" stroke={ink} strokeWidth="2" opacity="0.4" />
        <line x1="115" y1="90" x2="285" y2="90" stroke={ink} strokeWidth="0.5" opacity="0.4" />
        <rect x="130" y="110" width="140" height="125" fill={ink} />
        <text x="200" y="132" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="7" letterSpacing="0.32em" fill={accent}>SHREDDED</text>
        <text x="200" y="165" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="22" fill={cream}>Imeruli</text>
        <text x="200" y="184" textAnchor="middle" fontFamily="'Noto Serif Georgian', serif" fontSize="13" fill={cream} opacity="0.7">დაჩეჩილი</text>
        <line x1="150" y1="200" x2="250" y2="200" stroke={cream} strokeWidth="0.5" opacity="0.4" />
        <text x="200" y="218" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="7" letterSpacing="0.32em" fill={cream} opacity="0.8">500 g · RESEALABLE</text>
      </svg>
    );
  }
  if (kind === "bag") {
    return (
      <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%", display: "block", background: cream2 }}>
        <ellipse cx="200" cy="252" rx="135" ry="10" fill={ink} opacity="0.16" />
        <path d="M90 70 L310 70 L320 88 L320 250 L80 250 L80 88 Z" fill={cream} stroke={subtle} />
        <path d="M310 70 L320 88 L320 250 L310 232 Z" fill={ink} opacity="0.06" />
        <rect x="90" y="74" width="220" height="14" fill={ink} opacity="0.7" />
        <rect x="115" y="115" width="170" height="120" fill={accent} />
        <text x="200" y="138" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" letterSpacing="0.34em" fill={cream}>SHREDDED IMERULI</text>
        <text x="200" y="178" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="40" fill={cream}>5 kg</text>
        <line x1="140" y1="195" x2="260" y2="195" stroke={cream} strokeWidth="0.5" opacity="0.5" />
        <text x="200" y="215" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" letterSpacing="0.3em" fill={cream}>FOODSERVICE · NSF</text>
      </svg>
    );
  }
  return null;
}

interface CreameryProduct {
  id: string;
  sku?: string;
  slug: string;
  name: string;
  description: string;
  weight: string | null;
  priceB2c: number;
  imageUrl: string;
  stockQuantity: number;
  status: string;
  productLine?: { name: string; badgeColor: string | null } | null;
  /** All channels configured for this product server-side. */
  offeredChannels?: FulfillmentChannel[];
  /** Address-filtered channels for the current customer (set after availability fetch). */
  eligibleChannels?: FulfillmentChannel[];
  /** Available stock summed across reachable locations (null = unknown / made-to-order). */
  stockAvailable?: number | null;
  /** Locations stocking this product that reach the customer (multi-location attribution). */
  sources?: Array<{ locationId: string; locationName: string; distanceMiles: number }>;
}

interface CreameryClientProps {
  products: CreameryProduct[];
  locale: string;
  apiKey: string;
  isLoggedIn: boolean;
  userAddresses: UserAddressDto[];
}

// Map product slugs/names to visual kinds
function guessVisualKind(name: string, weight: string | null): string {
  const n = (name + " " + (weight || "")).toLowerCase();
  if (n.includes("5 kg") || n.includes("5kg") || n.includes("foodservice") || n.includes("bulk")) return "block";
  if (n.includes("aged") || n.includes("reserve") || n.includes("honey")) return "aged";
  if (n.includes("slab") || n.includes("vacuum")) return "slab";
  if (n.includes("shredded") && n.includes("5")) return "bag";
  if (n.includes("shredded") || n.includes("pouch")) return "pouch";
  return "wheel";
}

function getTag(product: CreameryProduct): { label: string; state: string } {
  if (product.status === "COMING_SOON") return { label: "Coming Soon", state: "limited" };
  const n = product.name.toLowerCase();
  if (n.includes("aged") || n.includes("reserve") || n.includes("honey")) return { label: "Limited", state: "limited" };
  if (n.includes("5 kg") || n.includes("5kg") || n.includes("foodservice") || n.includes("bulk")) return { label: "Wholesale OK", state: "bulk" };
  if (product.stockQuantity > 0) return { label: "Fresh today", state: "primary" };
  return { label: "", state: "primary" };
}

export default function CreameryClient({ products, locale, apiKey, isLoggedIn, userAddresses }: CreameryClientProps) {
  const [tab, setTab] = useState<"retail" | "bulk">("retail");
  const prefix = locale === "en" ? "" : `/${locale}`;
  const { addItem } = useCart();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);

  // Address-gated availability (same pattern as bakery)
  const [activeAddress, setActiveAddress] = useState<ActiveAddress | null>(null);
  const [availability, setAvailability] = useState<CreameryAvailabilityResult | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const refetchAvailability = useCallback(async (lat: number, lng: number) => {
    setLoadingAvailability(true);
    try {
      const result = await getAvailableCreameryProducts(lat, lng);
      setAvailability(result);
    } catch (e) {
      console.error('Creamery availability fetch failed:', e);
      setAvailability(null);
    } finally {
      setLoadingAvailability(false);
    }
  }, []);

  useEffect(() => {
    if (activeAddress) refetchAvailability(activeAddress.lat, activeAddress.lng);
    else setAvailability(null);
  }, [activeAddress, refetchAvailability]);

  const getQty = (id: string) => quantities[id] ?? 1;
  const bumpQty = (id: string, delta: number, cap: number) => {
    setQuantities(prev => {
      const next = Math.max(1, Math.min(cap, (prev[id] ?? 1) + delta));
      return { ...prev, [id]: next };
    });
  };

  const handleAddToCart = (p: CreameryProduct) => {
    // Prefer address-aware stockAvailable; fall back to legacy denormalized stockQuantity.
    const stock = typeof p.stockAvailable === 'number' ? p.stockAvailable : p.stockQuantity;
    const cap = stock > 0 ? stock : 0;
    if (cap <= 0) return;
    const qty = Math.min(getQty(p.id), cap);
    if (qty <= 0) return;
    addItem(
      {
        id: p.id,
        sku: p.sku || p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        flavorProfile: null,
        pairsWith: null,
        weight: p.weight,
        ingredients: null,
        imageUrl: p.imageUrl,
        priceB2c: p.priceB2c,
        priceB2b: p.priceB2c,
        stockQuantity: stock,
        isActive: true,
        status: p.status as 'ACTIVE' | 'INACTIVE' | 'COMING_SOON',
      },
      qty,
    );
    setJustAdded(p.id);
    setTimeout(() => setJustAdded(curr => (curr === p.id ? null : curr)), 1600);
    setQuantities(prev => ({ ...prev, [p.id]: 1 }));
  };

  // Split products into retail and bulk
  const retailProducts = products.filter(p => {
    const w = (p.weight || "").toLowerCase();
    const n = p.name.toLowerCase();
    return !(n.includes("foodservice") || n.includes("bulk") || w.includes("5 kg") || w.includes("5kg"));
  });
  const bulkProducts = products.filter(p => {
    const w = (p.weight || "").toLowerCase();
    const n = p.name.toLowerCase();
    return n.includes("foodservice") || n.includes("bulk") || w.includes("5 kg") || w.includes("5kg");
  });

  // Phase 6.x — show ALL retail products always (conversion-first). When the customer
  // sets an address, MERGE availability data into the static list instead of filtering.
  // Products not reachable for the customer get eligibleChannels=[] and a clear
  // "Not available at your address" message on the card.
  const enrichedRetail: CreameryProduct[] = retailProducts.map(p => {
    if (!availability) return p;
    const ap = availability.products.find(x => x.id === p.id);
    if (!ap) return { ...p, eligibleChannels: [], stockAvailable: 0 };
    return {
      ...p,
      eligibleChannels: ap.eligibleChannels,
      stockAvailable: ap.stockAvailable,
      sources: ap.sources,
    };
  });

  const items = tab === "retail" ? enrichedRetail : bulkProducts;
  // If no bulk products configured, the bulk tab falls back to all products (existing behavior).
  const displayItems = tab === "bulk" && bulkProducts.length === 0 ? products : items;

  // "No coverage" = address set but customer reaches NO location at all. Pure address
  // check — does NOT trigger when products are 0-stock / COMING_SOON.
  const noCoverage = !!availability && !availability.inServiceArea;

  // Batch strip data
  const batchItems = products.slice(0, 4).map((p, i) => ({
    name: p.name.split("·")[0].trim(),
    batch: `${String(i + 1).padStart(2, "0")}-${String.fromCharCode(65 + i)}`,
    made: i === 1 ? "May 4 · 7d rest" : `Today · 0${6 + i}:${15 + i * 5}`,
    remain: `${Math.max(12, p.stockQuantity)} units`,
    state: p.name.toLowerCase().includes("aged") ? "limited" : "now",
  }));

  return (
    <>
      {/* ─── THE SHOP (product grid with tabs) ─────────────────────────── */}
      <section className="ch-section" style={{ background: "#F5F0E6", padding: "120px 56px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ 01 — The Shop</div>
              <div className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#1F3026", marginTop: 14 }}>
                Six cheeses, <em style={{ color: "#B96A3D", fontWeight: 400 }}>two ways to buy.</em>
              </div>
            </div>
            <div className="ch-tab-row" style={{ display: "flex", gap: 0, border: "1px solid #1F302644" }}>
              <button onClick={() => setTab("retail")} style={{ padding: "14px 26px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", background: tab === "retail" ? "#1F3026" : "transparent", color: tab === "retail" ? "#F5F0E6" : "#1F3026", border: "none", cursor: "pointer" }}>◐ Retail</button>
              <button onClick={() => setTab("bulk")} style={{ padding: "14px 26px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", background: tab === "bulk" ? "#1F3026" : "transparent", color: tab === "bulk" ? "#F5F0E6" : "#1F3026", border: "none", cursor: "pointer", borderLeft: "1px solid #1F302644" }}>▸ Foodservice · Bulk</button>
            </div>
          </div>

          {/* Address manager — only for retail tab; bulk is a wholesale enquiry flow */}
          {tab === "retail" && (
            <>
              <div style={{ marginBottom: 32 }}>
                <AddressManager
                  apiKey={apiKey}
                  isLoggedIn={isLoggedIn}
                  initialAddresses={userAddresses}
                  activeAddress={activeAddress}
                  onActiveAddressChange={setActiveAddress}
                />
              </div>
              {loadingAvailability && (
                <div style={{ marginBottom: 24, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>
                  ● Checking what we can ship to you…
                </div>
              )}
              {activeAddress && noCoverage && !loadingAvailability && (
                <div style={{ marginBottom: 32, padding: "32px 28px", background: "#EAE2D2", border: "1px solid #1F302622", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase" }}>Out of delivery range</div>
                  <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 28, color: "#1F3026", lineHeight: 1.15 }}>
                    We don&apos;t ship creamery to this address yet.
                  </div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "#2C3D33", lineHeight: 1.6 }}>
                    Our UPS cold-chain reaches ~20 hours&apos; drive from Columbus, OH. Try a different address — most of the continental US is covered.
                  </div>
                </div>
              )}
              {availability && !noCoverage && availability.coveringLocations.length > 0 && (
                <div style={{ marginBottom: 32, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>
                  ● Ships from {availability.coveringLocations.join(" · ")}
                </div>
              )}
              {!activeAddress && (
                <div style={{ marginBottom: 32, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>
                  ◐ Browse freely · Add your address above to confirm delivery options for your area
                </div>
              )}
            </>
          )}
          <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {displayItems.map(p => {
              const kind = guessVisualKind(p.name, p.weight);
              const tag = getTag(p);
              const isComingSoon = p.status === 'COMING_SOON';
              // Stock cap prefers address-aware stockAvailable; else legacy stockQuantity.
              const effectiveStock = typeof p.stockAvailable === 'number' ? p.stockAvailable : p.stockQuantity;
              // Distinguish UI states (same as bakery):
              //   - dineInOnly: product configured only for IN_STORE_DINE_IN (intrinsic)
              //   - outOfRange: address set + product not reachable for this customer
              //   - isOutOfStock: real stock issue
              const offered = p.offeredChannels ?? null;
              const canBeCartOrdered = offered === null ? true : cartEligibleChannels(offered).length > 0;
              const dineInOnly = offered !== null && offered.length > 0 && !canBeCartOrdered;
              const outOfRange = canBeCartOrdered
                && !!availability
                && Array.isArray(p.eligibleChannels)
                && p.eligibleChannels.length === 0;
              const isOutOfStock = !outOfRange && effectiveStock <= 0;
              const cartDisabled = isComingSoon || isOutOfStock || dineInOnly || outOfRange;
              const qty = getQty(p.id);
              const cap = (isOutOfStock || outOfRange) ? 0 : effectiveStock;
              const atMax = qty >= cap;
              const recentlyAdded = justAdded === p.id;
              const isBulk = tab === "bulk";
              return (
                <div key={p.id} style={{ background: "#EAE2D2", border: "1px solid #1F302614", display: "flex", flexDirection: "column" }}>
                  <Link href={`${prefix}/shop/${p.slug}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}>
                    <div style={{ aspectRatio: "4/3", position: "relative", borderBottom: "1px solid #1F302614" }}>
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <CheeseVisual kind={kind} />
                      )}
                      {tag.label && (
                        <div style={{ position: "absolute", top: 16, left: 16, padding: "6px 12px", background: tag.state === "limited" ? "#B96A3D" : tag.state === "bulk" ? "#2C3D33" : "#1F3026", color: "#F5F0E6", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase" }}>{tag.label}</div>
                      )}
                    </div>
                    <div style={{ padding: "24px 24px 16px", display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <div>
                          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 26, color: "#1F3026", lineHeight: 1.05 }}>{p.name}</div>
                        </div>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "#B96A3D", fontWeight: 500 }}>${p.priceB2c.toFixed(2)}</div>
                      </div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#2C3D33", lineHeight: 1.55, marginTop: 12 }}>{p.description}</div>
                      {p.weight && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", color: "#7A8278", textTransform: "uppercase", marginTop: 14 }}>{p.weight}</div>}
                      {p.eligibleChannels && p.eligibleChannels.length > 0 && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", color: "#B96A3D", textTransform: "uppercase", marginTop: 8, lineHeight: 1.5 }}>
                          ◐ {p.eligibleChannels.map(channelLabel).join(" · ")}
                        </div>
                      )}
                      {/* Source attribution — only when multiple locations cover the customer */}
                      {p.sources && p.sources.length > 0 && availability && availability.coveringLocations.length > 1 && (() => {
                        const closest = [...p.sources].sort((a, b) => a.distanceMiles - b.distanceMiles)[0];
                        return (
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", color: "#7A8278", textTransform: "uppercase", marginTop: 4 }}>
                            From {closest.locationName} · {closest.distanceMiles.toFixed(1)} mi
                          </div>
                        );
                      })()}
                    </div>
                  </Link>

                  {/* Cart controls — outside Link so clicks don't navigate */}
                  <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
                    {isBulk ? (
                      // Bulk products use the wholesale enquiry flow, not the cart.
                      <Link href={`${prefix}/wholesale`} style={{
                        textDecoration: "none",
                        background: "#1F3026",
                        color: "#F5F0E6",
                        padding: "12px 0",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        letterSpacing: "0.24em",
                        textTransform: "uppercase",
                        textAlign: "center",
                      }}>Request quote →</Link>
                    ) : outOfRange ? (
                      // Address set, but product not reachable. Don't hide it — explain why instead.
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", background: "#EAE2D2", border: "1px solid #1F302622" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#A8312C", textTransform: "uppercase" }}>
                          Not available at your address
                        </div>
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#2C3D33" }}>
                          Try a different delivery address to see this product.
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "stretch", border: "1px solid #1F302633", background: "#F5F0E6" }}>
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => bumpQty(p.id, -1, cap)}
                            disabled={qty <= 1 || cartDisabled}
                            style={{ width: 44, height: 44, border: "none", background: "transparent", cursor: (qty <= 1 || cartDisabled) ? "not-allowed" : "pointer", color: (qty <= 1 || cartDisabled) ? "#7A827855" : "#1F3026", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <div style={{ minWidth: 36, height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 14, color: "#1F3026", borderLeft: "1px solid #1F302622", borderRight: "1px solid #1F302622" }}>
                            {qty}
                          </div>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => bumpQty(p.id, 1, cap)}
                            disabled={atMax || cartDisabled}
                            style={{ width: 44, height: 44, border: "none", background: "transparent", cursor: (atMax || cartDisabled) ? "not-allowed" : "pointer", color: (atMax || cartDisabled) ? "#7A827855" : "#1F3026", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddToCart(p)}
                          disabled={cartDisabled}
                          style={{
                            flex: 1,
                            height: 44,
                            background: cartDisabled ? "#7A8278" : recentlyAdded ? "#2C3D33" : "#B96A3D",
                            color: "#F5F0E6",
                            border: "none",
                            cursor: cartDisabled ? "not-allowed" : "pointer",
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            letterSpacing: "0.24em",
                            textTransform: "uppercase",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            transition: "background-color 200ms",
                            opacity: cartDisabled ? 0.6 : 1,
                          }}
                        >
                          {isComingSoon ? 'Soon' : isOutOfStock ? 'Sold out' : recentlyAdded ? (
                            <><Check className="w-3.5 h-3.5" /> Added</>
                          ) : (
                            <><ShoppingBag className="w-3.5 h-3.5" /> Add</>
                          )}
                        </button>
                      </div>
                    )}
                    {!isBulk && !isOutOfStock && effectiveStock > 0 && effectiveStock <= 5 && (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#A8312C", textTransform: "uppercase" }}>
                        Only {effectiveStock} left
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

    </>
  );
}
