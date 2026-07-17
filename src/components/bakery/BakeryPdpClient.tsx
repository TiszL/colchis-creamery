'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Check, MapPin, Loader2, Utensils } from 'lucide-react';
import type { DeliveryMethod } from '@prisma/client';
import { useCart } from '@/providers/CartProvider';
import { readGuestAddress, type ActiveAddress } from './AddressManager';
import { getAvailableBakeryProducts, type AvailabilityResult } from '@/app/actions/bakery-availability';
import { cartEligibleChannels } from '@/lib/fulfillment';

function channelMeta(c: DeliveryMethod): { label: string; eta: string } {
    switch (c) {
        case 'OWN_DELIVERY':       return { label: 'Hot delivery (own driver)', eta: '~25 min · 12 mi radius' };
        case 'DOORDASH_DRIVE':         return { label: 'DoorDash',                  eta: '~30–45 min · 20 mi radius' };
        case 'UBER_DIRECT':            return { label: 'Uber Eats',                 eta: '~30–45 min · 20 mi radius' };
        case 'IN_STORE_PICKUP':        return { label: 'In-store pickup',           eta: '~15 min ready' };
        case 'IN_STORE_DINE_IN':       return { label: 'Dine-in at the bakery',    eta: 'Fresh from the oven' };
        case 'UPS_2DAY':        return { label: 'UPS Ground 2-day',          eta: 'Not offered for bakery' };
        case 'DOORDASH_MARKETPLACE':   return { label: 'DoorDash Marketplace',      eta: '' };
        case 'UBER_EATS_MARKETPLACE':  return { label: 'Uber Eats Marketplace',     eta: '' };
        default:                       return { label: c, eta: '' };
    }
}

export type BakeryPdpProduct = {
    id: string;
    sku: string;
    slug: string;
    name: string;
    nameKa: string | null;
    description: string;
    weight: string | null;
    ingredients: string | null;
    priceB2c: string;
    priceB2b: string;
    tag: string | null;
    imageUrl: string;
    status: 'ACTIVE' | 'INACTIVE' | 'COMING_SOON';
    isMadeToOrder: boolean;
    isCartOrderable: boolean;
    // Phase 9b: was ProductKind enum; now category slug like 'hot-pastries' or 'frozen-bake-off'.
    categorySlug: string;
    /** Legacy denormalized stock total. Real per-location stock is summed in availability. */
    stockQuantity: number;
};

export default function BakeryPdpClient({
    product,
    offeredChannels,
    soldOutToday = false,
    locale,
    initialAddress,
    isLoggedIn,
}: {
    product: BakeryPdpProduct;
    offeredChannels: DeliveryMethod[];
    /** Unavailable specifically because every carrying Stock row is 86'd for the day. */
    soldOutToday?: boolean;
    locale: string;
    initialAddress: ActiveAddress | null;
    isLoggedIn: boolean;
}) {
    const router = useRouter();
    const { addItem } = useCart();
    const prefix = locale === 'en' ? '' : `/${locale}`;

    const [activeAddress, setActiveAddress] = useState<ActiveAddress | null>(initialAddress);
    const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [qty, setQty] = useState(1);
    const [justAdded, setJustAdded] = useState(false);

    // Hydrate guest address from localStorage on mount if no logged-in default
    useEffect(() => {
        if (activeAddress || isLoggedIn) return;
        const guest = readGuestAddress();
        if (guest) {
            setActiveAddress({
                id: 'guest',
                label: null,
                formatted: guest.formatted,
                lat: guest.lat,
                lng: guest.lng,
                googlePlaceId: guest.googlePlaceId,
            });
        }
    }, [activeAddress, isLoggedIn]);

    // Fetch availability whenever active address changes
    const fetchAvailability = useCallback(async (lat: number, lng: number) => {
        setLoadingAvailability(true);
        try {
            const result = await getAvailableBakeryProducts(lat, lng);
            setAvailability(result);
        } catch (e) {
            console.error('PDP availability fetch failed:', e);
            setAvailability(null);
        } finally {
            setLoadingAvailability(false);
        }
    }, []);

    useEffect(() => {
        if (activeAddress) fetchAvailability(activeAddress.lat, activeAddress.lng);
        else setAvailability(null);
    }, [activeAddress, fetchAvailability]);

    // Find THIS product in the availability result → its eligible channels + stock for the customer
    const customerMatch = (() => {
        if (!availability) return null;
        const all = [...availability.hotProducts, ...availability.frozenProducts, ...availability.otherProducts];
        return all.find(p => p.id === product.id) || null;
    })();
    const customerEligibleChannels = customerMatch ? customerMatch.eligibleChannels : (availability ? [] : null);

    // Cap: customer's reachable stock if known; else legacy denormalized total; ∞ for MTO.
    const cap = product.isMadeToOrder
        ? Infinity
        : customerMatch && typeof customerMatch.stockAvailable === 'number'
            ? Math.max(0, customerMatch.stockAvailable)
            : product.stockQuantity > 0 ? product.stockQuantity : Infinity;
    const soldOut = !product.isMadeToOrder && cap <= 0;

    // Dine-in-only: every configured (or address-reachable) channel is IN_STORE_DINE_IN.
    // Such products cannot be ordered for online cart — only consumed at the bakery.
    const channelsForCart = customerEligibleChannels ?? offeredChannels;
    const dineInOnly = channelsForCart.length > 0 && cartEligibleChannels(channelsForCart).length === 0;
    // 86'd everywhere: no location has an enabled Stock row for this product, so
    // nothing offers it. Catches MTO items, whose cap is Infinity → soldOut never trips.
    const unavailable = offeredChannels.length === 0;
    const cartDisabled = soldOut || dineInOnly || unavailable;

    const isHot = product.categorySlug === 'hot-pastries';
    const isFrozen = product.categorySlug === 'frozen-bake-off';
    const priceNum = parseFloat(product.priceB2c);
    const priceFmt = isNaN(priceNum) ? `$${product.priceB2c}` : Number.isInteger(priceNum) ? `$${priceNum}` : `$${priceNum.toFixed(2)}`;

    const handleAddToCart = () => {
        if (cartDisabled) return;
        const finalQty = Math.min(qty, cap);
        const cartStock = product.isMadeToOrder
            ? 999
            : customerMatch && typeof customerMatch.stockAvailable === 'number'
                ? customerMatch.stockAvailable
                : product.stockQuantity;
        addItem(
            {
                id: product.id,
                sku: product.sku,
                name: product.name,
                slug: product.slug,
                description: product.description,
                flavorProfile: null,
                pairsWith: null,
                weight: product.weight,
                ingredients: product.ingredients,
                imageUrl: product.imageUrl,
                priceB2c: isNaN(priceNum) ? 0 : priceNum,
                priceB2b: parseFloat(product.priceB2b) || 0,
                stockQuantity: cartStock,
                isActive: true,
                status: product.status,
            },
            finalQty,
        );
        setJustAdded(true);
        // Brief confirmation, then go to /cart
        setTimeout(() => router.push(`${prefix}/cart`), 600);
    };

    return (
        <div>
            {/* Status badges */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                {product.tag && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", padding: "6px 12px", background: product.tag === "Vegan" ? "#2C3D33" : "#B96A3D", color: "#F5F0E6", fontWeight: 500 }}>{product.tag}</span>
                )}
                {product.isMadeToOrder && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", padding: "6px 12px", background: "#1F302618", color: "#1F3026", border: "1px solid #1F302644", fontWeight: 500 }}>Made to order</span>
                )}
                {isFrozen && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", padding: "6px 12px", background: "#8B9DAF22", color: "#1F3026", border: "1px solid #8B9DAF66", fontWeight: 500 }}>Frozen · Heat at home</span>
                )}
                {product.status === 'COMING_SOON' && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", padding: "6px 12px", background: "#D9A87622", color: "#B96A3D", border: "1px solid #D9A87655", fontWeight: 500 }}>Coming soon</span>
                )}
            </div>

            <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, lineHeight: 1.0, letterSpacing: "-0.02em", color: "#1F3026", margin: 0 }}>
                {product.name}
            </h1>
            {product.nameKa && (
                <div style={{ fontFamily: "var(--font-serif-ka, 'Noto Serif Georgian', serif)", fontSize: 28, color: "#1F3026", opacity: 0.55, marginTop: 8 }}>
                    {product.nameKa}
                </div>
            )}

            {/* Price + weight */}
            <div style={{ marginTop: 24, paddingTop: 22, borderTop: "1px solid #1F302622", display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 16 }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 38, color: "#B96A3D", fontWeight: 500 }}>{priceFmt}</div>
                {product.weight && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>{product.weight}</div>
                )}
            </div>

            {/* Description */}
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.65, color: "#2C3D33", marginTop: 24 }}>
                {product.description}
            </p>

            {/* Ingredients */}
            {product.ingredients && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #1F302622" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>Ingredients</div>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "#2C3D33", marginTop: 6 }}>{product.ingredients}</p>
                </div>
            )}

            {/* Allergen disclosure — always shown (food business; ingredients alone
                aren't a substitute for an allergen statement) */}
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, lineHeight: 1.55, color: "#7A8278", marginTop: product.ingredients ? 10 : 24 }}>
                <strong style={{ color: "#2C3D33" }}>Allergens:</strong> made in a kitchen that handles milk, wheat (gluten) and eggs.
                Questions about allergens? Contact us before ordering.
            </p>

            {/* Address-aware delivery options */}
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #1F302622" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase" }}>
                        How you can get it
                    </div>
                    {activeAddress && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase" }}>
                            <MapPin className="w-3 h-3" /> {activeAddress.formatted.split(',').slice(0, 2).join(',')}
                        </div>
                    )}
                </div>

                {loadingAvailability && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase", marginBottom: 10 }}>
                        <Loader2 className="w-3 h-3 animate-spin" /> Checking availability…
                    </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {offeredChannels.length === 0 && (
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "#7A8278", fontStyle: "italic" }}>
                            No delivery channels configured yet for this product.
                        </div>
                    )}
                    {offeredChannels.map(ch => {
                        const meta = channelMeta(ch);
                        const reachable = customerEligibleChannels === null
                            ? true                                        // unknown — show as configured
                            : customerEligibleChannels.includes(ch);      // known — filter
                        return (
                            <div
                                key={ch}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    padding: "10px 14px",
                                    background: "#EAE2D2",
                                    border: "1px solid #1F302614",
                                    opacity: reachable ? 1 : 0.45,
                                }}
                            >
                                <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "#1F3026" }}>
                                    {meta.label}
                                    {!reachable && customerEligibleChannels !== null && (
                                        <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#A8312C", textTransform: "uppercase" }}>
                                            Out of range
                                        </span>
                                    )}
                                </span>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", color: "#7A8278", textTransform: "uppercase", whiteSpace: "nowrap" }}>{meta.eta}</span>
                            </div>
                        );
                    })}
                </div>

                {!activeAddress && (
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#7A8278", marginTop: 12, lineHeight: 1.5 }}>
                        <Link href={`${prefix}/bakery`} style={{ color: "#B96A3D", textDecoration: "underline" }}>Set your delivery address</Link> on the bakery menu to see which of these reach you.
                    </p>
                )}
            </div>

            {/* Cart-eligibility branches. Order: wholesale-only > dine-in > standard */}
            {!product.isCartOrderable ? (
                <div style={{ marginTop: 28, padding: "20px 22px", background: "#2C3D33", color: "#F5F0E6", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase" }}>Wholesale only</div>
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, opacity: 0.85 }}>This product isn&apos;t available for retail orders. Restaurants and shops — get in touch.</div>
                    </div>
                    <Link href={`${prefix}/wholesale`} style={{ background: "#B96A3D", color: "#F5F0E6", padding: "12px 22px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none", whiteSpace: "nowrap" }}>Request a quote →</Link>
                </div>
            ) : dineInOnly ? (
                <div style={{ marginTop: 28, padding: "20px 22px", background: "#1F3026", color: "#F5F0E6", display: "flex", alignItems: "center", gap: 14 }}>
                    <Utensils className="w-5 h-5 shrink-0" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase" }}>Dine-in only</div>
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, opacity: 0.85 }}>This dish is best the moment it leaves the oven — eat with us at the bakery.</div>
                    </div>
                </div>
            ) : (
                <div style={{ marginTop: 28, display: "flex", alignItems: "stretch", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "stretch", border: "1px solid #1F302633", background: "#F5F0E6" }}>
                        <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => setQty(q => Math.max(1, q - 1))}
                            disabled={qty <= 1 || cartDisabled}
                            style={{ width: 52, height: 52, border: "none", background: "transparent", cursor: (qty <= 1 || cartDisabled) ? "not-allowed" : "pointer", color: (qty <= 1 || cartDisabled) ? "#7A827855" : "#1F3026", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                        <div style={{ minWidth: 44, height: 52, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 16, color: "#1F3026", borderLeft: "1px solid #1F302622", borderRight: "1px solid #1F302622" }}>
                            {qty}
                        </div>
                        <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => setQty(q => Math.min(cap, q + 1))}
                            disabled={qty >= cap || cartDisabled}
                            style={{ width: 52, height: 52, border: "none", background: "transparent", cursor: (qty >= cap || cartDisabled) ? "not-allowed" : "pointer", color: (qty >= cap || cartDisabled) ? "#7A827855" : "#1F3026", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={cartDisabled}
                        style={{
                            flex: 1,
                            height: 52,
                            background: cartDisabled ? "#7A8278" : justAdded ? "#2C3D33" : (isHot ? "#B96A3D" : "#1F3026"),
                            color: "#F5F0E6",
                            border: "none",
                            cursor: cartDisabled ? "not-allowed" : "pointer",
                            fontFamily: "var(--font-mono)",
                            fontSize: 12,
                            letterSpacing: "0.28em",
                            textTransform: "uppercase",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            transition: "background-color 200ms",
                            opacity: cartDisabled ? 0.6 : 1,
                        }}
                    >
                        {unavailable ? (soldOutToday ? 'Sold out today' : 'Unavailable right now') : soldOut ? 'Sold out' : justAdded ? (
                            <><Check className="w-4 h-4" /> Added — going to cart…</>
                        ) : (
                            <><ShoppingBag className="w-4 h-4" /> {isHot ? 'Order hot' : 'Add to box'}</>
                        )}
                    </button>
                </div>
            )}
            {!product.isMadeToOrder && cap > 0 && cap <= 5 && Number.isFinite(cap) && (
                <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#A8312C", textTransform: "uppercase" }}>
                    Only {cap} left
                </div>
            )}
        </div>
    );
}
