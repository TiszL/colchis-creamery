"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ColchisSeal } from "@/components/brand/ColchisSeal";
import AddressManager, { type ActiveAddress } from "./AddressManager";
import type { UserAddressDto } from "@/app/actions/addresses";
import { getAvailableBakeryProducts, type AvailabilityResult } from "@/app/actions/bakery-availability";
import type { DeliveryMethod } from "@prisma/client";
import { useCart } from "@/providers/CartProvider";
import { Minus, Plus, ShoppingBag, Check, Utensils } from "lucide-react";
import { cartEligibleChannels } from "@/lib/fulfillment";

// Hardcoded DEFAULT_HOT / DEFAULT_FROZEN removed in Phase 6.x.
// Bakery products now live in DB and are seeded via prisma/seed-bakery-products.ts.
// If the DB query returns zero results, the UI shows an empty state instead of stale demo data.

// DB-driven item shape (Phase 4). Legacy `ka` and `tag` fields are kept optional so the
// existing hardcoded constants below still satisfy the type.
export interface BakeryItem {
  id?: string;
  sku?: string;
  slug?: string;
  name: string;
  ka?: string;
  desc: string;
  weight: string;
  price: string;
  tag?: string;
  imageUrl?: string;
  isMadeToOrder?: boolean;
  /** Phase 10: when false, the item is listed but Add-to-cart is replaced with
   *  a wholesale-quote CTA. */
  isCartOrderable?: boolean;
  /** Stock available across reachable locations. null = made-to-order / unknown (no cap). */
  stockAvailable?: number | null;
  /** All channels configured for this product server-side (used pre-availability for dine-in check). */
  offeredChannels?: DeliveryMethod[];
  /** Channels deliverable to the current customer (only set when availability is loaded). */
  eligibleChannels?: DeliveryMethod[];
  /** Locations stocking this product that reach the customer (multi-bakery attribution). */
  sources?: Array<{ locationId: string; locationName: string; distanceMiles: number }>;
}

export interface HeroContent {
  eyebrow: string;
  headline: string;
  headline_accent: string;
  headline_suffix: string;
  today_items: string;
  delivery_time: string;
  pickup_time: string;
  delivery_platforms: string;
  pickup_address: string;
}

export interface MenuContent {
  eyebrow: string;
  heading: string;
  heading_accent: string;
  hot_tab_label: string;
  frozen_tab_label: string;
  hot_items?: BakeryItem[];
  frozen_items?: BakeryItem[];
}

export interface DeliveryZone {
  label: string;
  cities: string;
  description: string;
}

export interface DeliveryContent {
  eyebrow: string;
  heading: string;
  heading_accent: string;
  hot_zone: DeliveryZone;
  ship_zone: DeliveryZone;
}

interface BakeryClientProps {
  heroContent?: HeroContent | null;
  menuContent?: MenuContent | null;
  deliveryContent?: DeliveryContent | null;
  hotItems?: BakeryItem[];      // from DB (Phase 4) — takes precedence
  frozenItems?: BakeryItem[];   // from DB (Phase 4) — takes precedence
  /** Stage 4: when a Category chip is active on /bakery, the page passes the
   *  filtered items here. BakeryClient then renders a single grid (no hot/
   *  frozen tabs) using the section label below. When undefined, falls back
   *  to the legacy hot/frozen tab UX. */
  singleSectionItems?: BakeryItem[];
  singleSectionLabel?: string;
  apiKey: string;               // Google Maps key for Places Autocomplete (Phase 5)
  isLoggedIn?: boolean;         // Phase 5.5 — drives guest vs logged-in address UX
  userAddresses?: UserAddressDto[]; // Phase 5.5 — saved addresses for logged-in user
  /** Primary business address fields (street + city/state). Sourced server-side
   *  from the primary Location row. Used for hero pickup line + page decorations. */
  primaryAddressLine1?: string;
  primaryCityState?: string;
}

// Channel → human label for product card meta line
function channelMeta(ch: DeliveryMethod): string {
  switch (ch) {
    case 'OWN_DELIVERY': return 'Hot delivery';
    case 'DOORDASH_DRIVE': return 'DoorDash';
    case 'UBER_DIRECT': return 'Uber Eats';
    case 'IN_STORE_PICKUP': return 'Pickup';
    case 'IN_STORE_DINE_IN': return 'Dine-in';
    default: return ch.replace(/_/g, ' ');
  }
}

export default function BakeryClient({ heroContent, menuContent, deliveryContent, hotItems: hotItemsProp, frozenItems: frozenItemsProp, singleSectionItems, singleSectionLabel, apiKey, isLoggedIn = false, userAddresses = [], primaryAddressLine1, primaryCityState }: BakeryClientProps) {
  const [tab, setTab] = useState<"hot" | "frozen">("hot");
  // Phase 5.5: address-gated availability (guest localStorage OR logged-in UserAddress)
  const [activeAddress, setActiveAddress] = useState<ActiveAddress | null>(null);
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Phase 6.x — inline cart controls per card
  const { addItem } = useCart();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const getQty = (id: string) => quantities[id] ?? 1;
  // Cap = stockAvailable for tracked items, Infinity for made-to-order / unknown.
  const getCap = (item: BakeryItem): number => {
    if (item.isMadeToOrder) return Infinity;
    if (typeof item.stockAvailable === 'number') return Math.max(0, item.stockAvailable);
    return Infinity; // unknown stock (no address set yet) — don't gate locally; cart/checkout will
  };
  const bumpQty = (id: string, delta: number, cap: number) => {
    setQuantities(prev => {
      const next = Math.max(1, Math.min(cap, (prev[id] ?? 1) + delta));
      return { ...prev, [id]: next };
    });
  };

  const handleAddToCart = (item: BakeryItem) => {
    if (!item.id) return;
    const cap = getCap(item);
    const qty = Math.min(getQty(item.id), cap);
    if (qty <= 0) return;
    const priceNum = parseFloat((item.price || '').replace(/[^0-9.]/g, ''));
    // Stock for cart: real number for tracked, 999 placeholder for MTO/unknown.
    // (Cart UI doesn't enforce caps yet — checkout in Phase 7 will.)
    const cartStock = item.isMadeToOrder
      ? 999
      : typeof item.stockAvailable === 'number' ? item.stockAvailable : 999;
    addItem(
      {
        id: item.id,
        sku: item.sku || item.id,
        name: item.name,
        slug: item.slug || item.id,
        description: item.desc,
        flavorProfile: null,
        pairsWith: null,
        weight: item.weight || null,
        ingredients: null,
        imageUrl: item.imageUrl || '',
        priceB2c: isNaN(priceNum) ? 0 : priceNum,
        priceB2b: isNaN(priceNum) ? 0 : priceNum,
        stockQuantity: cartStock,
        isActive: true,
        status: 'ACTIVE',
      },
      qty,
    );
    setJustAdded(item.id);
    setTimeout(() => setJustAdded(curr => (curr === item.id ? null : curr)), 1600);
    // Reset qty back to 1 after adding (so a re-tap doesn't accidentally re-add 5 etc.)
    setQuantities(prev => ({ ...prev, [item.id!]: 1 }));
  };

  // Re-fetch availability whenever the active address changes
  const refetchAvailability = useCallback(async (lat: number, lng: number) => {
    setLoadingAvailability(true);
    try {
      const result = await getAvailableBakeryProducts(lat, lng);
      setAvailability(result);
    } catch (e) {
      console.error('Failed to load bakery availability:', e);
      setAvailability(null);
    } finally {
      setLoadingAvailability(false);
    }
  }, []);

  useEffect(() => {
    if (activeAddress) refetchAvailability(activeAddress.lat, activeAddress.lng);
    else setAvailability(null);
  }, [activeAddress, refetchAvailability]);

  // Merge DB content with defaults. The pickup_address default pulls from the
  // primary business location (server-fetched), so a fresh deploy without DB
  // overrides never shows a stale hardcoded street.
  const hero = heroContent || {
    eyebrow: 'The Bakery · საცხობი · Open until 9 PM',
    headline: 'Hot from',
    headline_accent: 'the oven',
    headline_suffix: primaryCityState ? `in ${primaryCityState}.` : 'in Dublin, Ohio.',
    today_items: 'Adjaruli · Imeruli\nMegruli · Lobiani',
    delivery_time: 'Hot delivery · 25 min',
    pickup_time: 'Pickup · 15 min',
    delivery_platforms: 'Doordash · Uber Eats',
    pickup_address: primaryAddressLine1 || '84 N High St',
  };

  const menu = menuContent || {
    eyebrow: '№ 01 — The Menu',
    heading: 'Six khachapuri,',
    heading_accent: 'two ways.',
    hot_tab_label: '◐ Hot · Dublin',
    frozen_tab_label: '▸ Frozen · Local delivery',
    // hot_items / frozen_items intentionally omitted — products now load from DB
    // (Phase 4) through the `hotItems` / `frozenItems` props on this component.
  };

  const del = deliveryContent || {
    eyebrow: '№ 02 — Local delivery, two ways',
    heading: 'Hot or frozen,',
    heading_accent: 'delivered fresh.',
    hot_zone: {
      label: '◐ Hot zone · 12 mi radius',
      cities: 'Dublin · Hilliard · Powell · Worthington',
      description: 'Doordash & Uber Eats. ETA 25-40 min until close. Adding new locations as we grow.',
    },
    ship_zone: {
      label: '▸ Frozen zone · 20 mi radius',
      cities: 'Doordash & Uber Eats only',
      description: 'Frozen at peak. Bake from frozen at home. Delivered cold within the bakery’s metro range.',
    },
  };

  // Phase 6.x — show ALL products always (conversion-first). When an address is set,
  // merge availability data INTO the static list (don't filter it). Products out of
  // range for the customer get empty eligibleChannels; cards render them with an
  // "out of range" message instead of hiding them.
  const enrichWithAvailability = useCallback((item: BakeryItem): BakeryItem => {
    if (!availability || !item.id) return item;
    const all = [...availability.hotProducts, ...availability.frozenProducts];
    const match = all.find(p => p.id === item.id);
    if (!match) {
      // Address set, product not in availability → not reachable for this customer
      return { ...item, eligibleChannels: [], stockAvailable: 0 };
    }
    return {
      ...item,
      eligibleChannels: match.eligibleChannels,
      stockAvailable: match.stockAvailable,
      sources: match.sources,
    };
  }, [availability]);

  const hotItems: BakeryItem[] = (hotItemsProp ?? menu.hot_items ?? []).map(enrichWithAvailability);
  const frozenItems: BakeryItem[] = (frozenItemsProp ?? menu.frozen_items ?? []).map(enrichWithAvailability);
  // Stage 4: when /bakery applies a Category chip filter, singleSectionItems
  // replaces the hot/frozen split with a single flat list. The hot/frozen
  // tab UI hides itself in this mode (see below).
  const isFilteredView = Array.isArray(singleSectionItems);
  const items = isFilteredView
      ? singleSectionItems.map(enrichWithAvailability)
      : (tab === "hot" ? hotItems : frozenItems);
  // "No coverage" = address is set but NO location is in delivery range. This is purely
  // address-based; it does NOT trigger when products are merely out of stock / coming-soon.
  const noCoverage = !!availability && !availability.inServiceArea;

  return (
    <>
      {/* Bakery Hero */}
      <section className="ch-bakery-hero" style={{ background: "#1F3026", color: "#F5F0E6", padding: "100px 56px 80px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(#F5F0E606 1px, transparent 1px), linear-gradient(90deg, #F5F0E606 1px, transparent 1px)`, backgroundSize: "80px 80px", pointerEvents: "none" }} />
        <div className="ch-bakery-hero-grid" style={{ maxWidth: 1280, margin: "0 auto", position: "relative", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 64, alignItems: "end" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#8B4A28", textTransform: "uppercase", marginBottom: 24 }}>{hero.eyebrow}</div>
            <h1 className="ch-bakery-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 124, lineHeight: 0.9, letterSpacing: "-0.03em", margin: 0 }}>
              {hero.headline} <em style={{ color: "#8B4A28", fontWeight: 300 }}>{hero.headline_accent}</em><br />{hero.headline_suffix}
            </h1>
          </div>
          {/* Today's card */}
          <div style={{ background: "#F5F0E6", color: "#1F3026", padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "#7A8278" }}>Today · {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "#B96A3D" }}>● Baking now</span>
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 32, color: "#1F3026", lineHeight: 1.1, whiteSpace: "pre-line" }}>{hero.today_items}</div>
            <div style={{ height: 1, background: "#1F302622", margin: "20px 0" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "#2C3D33" }}>
              <span>{hero.delivery_time}</span>
              <span style={{ textAlign: "right" }}>{hero.pickup_time}</span>
              <span>{hero.delivery_platforms}</span>
              <span style={{ textAlign: "right" }}>{hero.pickup_address}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Menu Section */}
      <section className="ch-section" style={{ background: "#F5F0E6", padding: "120px 56px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>{menu.eyebrow}</div>
              <div className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#1F3026", marginTop: 14 }}>
                {menu.heading} <em style={{ color: "#B96A3D", fontWeight: 400 }}>{menu.heading_accent}</em>
              </div>
            </div>
            {isFilteredView ? (
              // Stage 4: when /bakery is filtered to a single Category, swap
              // the hot/frozen tabs for a static label that names the filter.
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 22px", border: "1px solid #1F302644", background: "#1F3026", color: "#F5F0E6", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase" }}>
                <span>{singleSectionLabel ?? "Filtered"}</span>
                <span style={{ opacity: 0.55 }}>{items.length}</span>
              </div>
            ) : (
              <div className="ch-tab-row" style={{ display: "flex", gap: 0, border: "1px solid #1F302644" }}>
                <button onClick={() => setTab("hot")} style={{ padding: "14px 26px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", background: tab === "hot" ? "#1F3026" : "transparent", color: tab === "hot" ? "#F5F0E6" : "#1F3026", border: "none", cursor: "pointer" }}>{menu.hot_tab_label}</button>
                <button onClick={() => setTab("frozen")} style={{ padding: "14px 26px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", background: tab === "frozen" ? "#1F3026" : "transparent", color: tab === "frozen" ? "#F5F0E6" : "#1F3026", border: "none", cursor: "pointer", borderLeft: "1px solid #1F302644" }}>{menu.frozen_tab_label}</button>
              </div>
            )}
          </div>

          {/* Phase 5.5 — Address manager (guest + logged-in flows, multi-address) */}
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
              ● Checking what we can deliver…
            </div>
          )}
          {activeAddress && noCoverage && !loadingAvailability && (
            <div style={{ marginBottom: 32, padding: "32px 28px", background: "#EAE2D2", border: "1px solid #1F302622", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase" }}>
                Out of delivery range
              </div>
              <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 28, color: "#1F3026", lineHeight: 1.15 }}>
                We don&apos;t deliver bakery items to this address yet.
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "#2C3D33", lineHeight: 1.6 }}>
                Our Dublin OH bakery covers ~20 mi for frozen and 12 mi for hot. For nationwide cheese delivery, browse{" "}
                <Link href="/creamery" style={{ color: "#B96A3D", textDecoration: "underline" }}>the Creamery shop</Link>.
              </div>
            </div>
          )}
          {availability && !noCoverage && availability.coveringLocations.length > 0 && (
            <div style={{ marginBottom: 32, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>
              ● Available from {availability.coveringLocations.join(" · ")}
            </div>
          )}

          {!activeAddress && (
            <div style={{ marginTop: 8, marginBottom: 16, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>
              ◐ Browse freely · Add your address above to confirm delivery options for your area
            </div>
          )}

          <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {items.map((p: BakeryItem, i: number) => {
              const qty = p.id ? getQty(p.id) : 1;
              const cap = getCap(p);
              const atMax = qty >= cap;
              // Distinguish three "can't add to cart" states (each gets its own UI):
              //   - dineInOnly: product is configured only for IN_STORE_DINE_IN (intrinsic — true regardless of address)
              //   - outOfRange: address is set + product has non-dine-in offered channels, but customer reaches none
              //   - soldOut:    real stock issue (per-location or legacy total = 0)
              const offered = p.offeredChannels ?? null;
              const canBeCartOrdered = offered === null
                ? true                                          // unknown: assume yes until proven otherwise
                : cartEligibleChannels(offered).length > 0;     // product has at least one non-dine-in channel
              const dineInOnly = offered !== null && offered.length > 0 && !canBeCartOrdered;
              const outOfRange = canBeCartOrdered
                && !!availability
                && Array.isArray(p.eligibleChannels)
                && p.eligibleChannels.length === 0;
              const soldOut = !p.isMadeToOrder
                && !outOfRange  // don't show "Sold out" when the real issue is "out of range"
                && typeof p.stockAvailable === 'number'
                && p.stockAvailable <= 0;
              const isWholesaleOnly = p.isCartOrderable === false;
              const cartDisabled = soldOut || dineInOnly || outOfRange || isWholesaleOnly;
              const recentlyAdded = p.id && justAdded === p.id;
              const closestSource = (p.sources && p.sources.length > 0 && availability && availability.coveringLocations.length > 1)
                ? [...p.sources].sort((a, b) => a.distanceMiles - b.distanceMiles)[0]
                : null;
              // Image + textual info is the clickable link; cart controls live outside.
              const HeaderLink: React.ElementType = p.slug ? Link : 'div';
              const headerLinkProps = p.slug
                ? { href: `/bakery/${p.slug}`, style: { textDecoration: 'none', color: 'inherit', display: 'block' } }
                : {};
              return (
                <div key={p.id || i} style={{ background: "#EAE2D2", border: "1px solid #1F302614", display: "flex", flexDirection: "column", height: "100%" }}>
                  <HeaderLink {...headerLinkProps}>
                    <div style={{ aspectRatio: "4/3", background: "#1F302608", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid #1F302614", overflow: "hidden" }}>
                      {p.imageUrl && p.imageUrl.trim() !== '' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", color: "#7A8278", opacity: 0.6, textTransform: "uppercase" }}>[ {p.name} photo ]</div>
                      )}
                      {p.tag && (
                        <div style={{ position: "absolute", top: 16, left: 16, padding: "6px 12px", background: p.tag === "Vegan" ? "#2C3D33" : "#B96A3D", color: "#F5F0E6", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", zIndex: 1 }}>{p.tag}</div>
                      )}
                    </div>
                    <div style={{ padding: "24px 24px 16px", display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <div>
                          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 28, color: "#1F3026", lineHeight: 1 }}>{p.name}</div>
                          <div style={{ fontFamily: "var(--font-serif-ka, 'Noto Serif Georgian', serif)", fontSize: 16, color: "#1F3026", opacity: 0.5, marginTop: 4 }}>{p.ka}</div>
                        </div>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "#B96A3D", fontWeight: 500 }}>{p.price}</div>
                      </div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#2C3D33", lineHeight: 1.55, marginTop: 12 }}>{p.desc}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", color: "#7A8278", textTransform: "uppercase", marginTop: 14 }}>{p.weight}</div>
                      {p.eligibleChannels && p.eligibleChannels.length > 0 && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", color: "#B96A3D", textTransform: "uppercase", marginTop: 8, lineHeight: 1.5 }}>
                          ◐ {p.eligibleChannels.map(channelMeta).join(" · ")}
                        </div>
                      )}
                      {closestSource && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", color: "#7A8278", textTransform: "uppercase", marginTop: 4 }}>
                          From {closestSource.locationName} · {closestSource.distanceMiles.toFixed(1)} mi
                        </div>
                      )}
                    </div>
                  </HeaderLink>

                  {/* Cart controls — outside the Link so clicks don't navigate to PDP */}
                  {p.id && (
                    <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
                      {isWholesaleOnly ? (
                        // Wholesale-only: listed publicly but not retail-orderable.
                        // Route customer to wholesale enquiry instead.
                        <Link href="/wholesale" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 44, background: "#2C3D33", color: "#F5F0E6", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", textDecoration: "none" }}>
                          Request a quote →
                        </Link>
                      ) : dineInOnly ? (
                        // Dine-in-only product: can't be cart-ordered. Show clear messaging instead of cart UI.
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#1F3026", color: "#F5F0E6", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>
                          <Utensils className="w-3.5 h-3.5" />
                          Dine-in only · visit the bakery
                        </div>
                      ) : outOfRange ? (
                        // Address set, but no reachable channel for this customer.
                        // Show the product (don't hide) but explain why it can't be added.
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
                          {/* Quantity stepper */}
                          <div style={{ display: "flex", alignItems: "stretch", border: "1px solid #1F302633", background: "#F5F0E6" }}>
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              onClick={() => bumpQty(p.id!, -1, cap)}
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
                              onClick={() => bumpQty(p.id!, 1, cap)}
                              disabled={atMax || cartDisabled}
                              style={{ width: 44, height: 44, border: "none", background: "transparent", cursor: (atMax || cartDisabled) ? "not-allowed" : "pointer", color: (atMax || cartDisabled) ? "#7A827855" : "#1F3026", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* Add to cart button */}
                          <button
                            type="button"
                            onClick={() => handleAddToCart(p)}
                            disabled={cartDisabled}
                            style={{
                              flex: 1,
                              height: 44,
                              background: cartDisabled ? "#7A8278" : recentlyAdded ? "#2C3D33" : (tab === "hot" ? "#B96A3D" : "#1F3026"),
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
                            {soldOut ? 'Sold out' : recentlyAdded ? (
                              <><Check className="w-3.5 h-3.5" /> Added</>
                            ) : (
                              <><ShoppingBag className="w-3.5 h-3.5" /> Add</>
                            )}
                          </button>
                        </div>
                      )}
                      {!p.isMadeToOrder && typeof p.stockAvailable === 'number' && p.stockAvailable > 0 && p.stockAvailable <= 5 && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#A8312C", textTransform: "uppercase" }}>
                          Only {p.stockAvailable} left
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Delivery Zones */}
      <section className="ch-section" style={{ background: "#EAE2D2", padding: "120px 56px" }}>
        <div className="ch-split" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>{del.eyebrow}</div>
            <div className="ch-h2-large" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, lineHeight: 1.0, letterSpacing: "-0.02em", color: "#1F3026", marginTop: 16 }}>
              {del.heading} <em style={{ color: "#B96A3D", fontWeight: 400 }}>{del.heading_accent}</em>
            </div>
            <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 28 }}>
              <div style={{ paddingLeft: 20, borderLeft: "2px solid #B96A3D" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase" }}>{del.hot_zone.label}</div>
                <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 28, color: "#1F3026", marginTop: 6 }}>{del.hot_zone.cities}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "#2C3D33", marginTop: 8 }}>{del.hot_zone.description}</div>
              </div>
              <div style={{ paddingLeft: 20, borderLeft: "2px solid #1F3026" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#1F3026", textTransform: "uppercase" }}>{del.ship_zone.label}</div>
                <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 28, color: "#1F3026", marginTop: 6 }}>{del.ship_zone.cities}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "#2C3D33", marginTop: 8 }}>{del.ship_zone.description}</div>
              </div>
            </div>
          </div>

          {/* Zone map placeholder */}
          <div style={{ aspectRatio: "1", background: "#F5F0E6", position: "relative", border: "1px solid #1F302622", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(#1F302611 1px, transparent 1px), linear-gradient(90deg, #1F302611 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "85%", height: "85%", borderRadius: "50%", border: "1px dashed #1F302633" }} />
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "55%", height: "55%", borderRadius: "50%", border: "2px solid rgba(185,106,61,0.4)", background: "rgba(185,106,61,0.07)" }} />
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 16, height: 16, borderRadius: "50%", background: "#1F3026", boxShadow: "0 0 0 6px #F5F0E6, 0 0 0 8px #1F3026" }} />
            <div style={{ position: "absolute", top: "calc(50% - 80px)", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#1F3026", textTransform: "uppercase", padding: "4px 10px", background: "#F5F0E6" }}>HOT · 25 min</div>
            <div style={{ position: "absolute", bottom: 28, left: 28, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>● {primaryCityState || 'Dublin OH'} · {primaryAddressLine1 || '84 N High St'}</div>
            <div style={{ position: "absolute", top: 28, right: 28, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>▸ Local frozen · 20 mi</div>
          </div>
        </div>
      </section>
    </>
  );
}
