"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCart } from "@/providers/CartProvider";
import { formatCurrency } from "@/lib/utils";
import AddressManager, { type ActiveAddress } from "@/components/bakery/AddressManager";
import type { UserAddressDto } from "@/app/actions/addresses";
import { applyFreeShippingRule, freeShippingProgress, type FulfillmentPlan } from "@/lib/shipping";
import { planFulfillment } from "@/app/actions/shipping-plan";

function getThumbUrl(url: string): string {
    if (url && url.endsWith('.webp')) return url.replace(/\.webp$/, '-thumb.webp');
    return url;
}

interface CartClientProps {
    locale: string;
    apiKey: string;
    isLoggedIn: boolean;
    userAddresses: UserAddressDto[];
}

export default function CartClient({ locale, apiKey, isLoggedIn, userAddresses }: CartClientProps) {
    const t = useTranslations("cart");
    const { items, removeItem, updateQuantity, subtotal } = useCart();
    const prefix = locale === "en" ? "" : `/${locale}`;

    // Address state — same pattern as bakery/shop
    const [activeAddress, setActiveAddress] = useState<ActiveAddress | null>(null);
    const [plan, setPlan] = useState<FulfillmentPlan | null>(null);
    const [planning, setPlanning] = useState(false);

    // Refetch plan when items or address change. Server action call.
    const refetchPlan = useCallback(async () => {
        if (!activeAddress || items.length === 0) {
            setPlan(null);
            return;
        }
        setPlanning(true);
        try {
            const result = await planFulfillment(
                items.map(i => ({ productId: i.product.id, quantity: i.quantity })),
                activeAddress.lat,
                activeAddress.lng,
            );
            setPlan(result);
        } catch (e) {
            console.error('Cart planFulfillment failed:', e);
            setPlan(null);
        } finally {
            setPlanning(false);
        }
    }, [activeAddress, items]);

    useEffect(() => { refetchPlan(); }, [refetchPlan]);

    // Cheapest channel per group is the default. Sum gives the floor shipping estimate
    // the cart displays. Customer can override at checkout.
    const cheapestQuotes = plan
        ? plan.groups.map(g => g.availableChannels[0]).filter(q => q !== undefined)
        : [];
    const cheapestWithFreeShipping = applyFreeShippingRule(cheapestQuotes, subtotal);
    const shippingEstimate = cheapestWithFreeShipping.reduce((sum, q) => sum + q.shippingCost, 0);
    const total = subtotal + shippingEstimate;

    const fsProgress = plan ? freeShippingProgress(plan, subtotal) : null;

    // Per-item deliverability state for the items list
    const undeliverableIds = new Set((plan?.undeliverableItems ?? []).map(u => u.productId));
    const undeliverableReason = (productId: string) =>
        plan?.undeliverableItems.find(u => u.productId === productId)?.reason || null;

    // "Proceed to checkout" gate: at least one item; if address set, no undeliverables
    const hasUndeliverable = !!plan && plan.hasUndeliverable;
    const canProceedToCheckout = items.length > 0 && !hasUndeliverable;

    /* ─── EMPTY STATE ─────────────────────────────────────────────────── */

    if (items.length === 0) {
        return (
            <main style={{ background: "#F5F0E6", minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px" }}>
                <div style={{ textAlign: "center", maxWidth: 480 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ 00 — The Basket</div>
                    <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 72, color: "#1F3026", margin: "16px 0 12px", lineHeight: 0.95, letterSpacing: "-0.02em" }}>
                        The basket<br /><em style={{ color: "#B96A3D" }}>is empty.</em>
                    </h1>
                    <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontStyle: "italic", color: "#2C3D33", opacity: 0.8, marginBottom: 28 }}>
                        Wheels are pressing and bread is rising. Pick something up.
                    </p>
                    <Link href={`${prefix}/shop`} style={{ background: "#1F3026", color: "#F5F0E6", padding: "16px 28px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", textDecoration: "none" }}>
                        Browse the shop →
                    </Link>
                </div>
            </main>
        );
    }

    /* ─── MAIN CART ───────────────────────────────────────────────────── */

    return (
        <main className="ch-cart" style={{ background: "#F5F0E6", minHeight: "100vh" }}>
            {/* ─── BANNER ────────────────────────────────────────────── */}
            <section style={{ background: "#1F3026", color: "#F5F0E6", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#F5F0E606 1px, transparent 1px), linear-gradient(90deg, #F5F0E606 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none" }} />
                <div className="ch-cart-banner" style={{ maxWidth: 1440, margin: "0 auto", padding: "56px 56px 36px", position: "relative" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#D9A876", textTransform: "uppercase" }}>
                        № 00 — The Basket · {items.length} {items.length === 1 ? "item" : "items"}
                    </div>
                    <div className="ch-cart-banner-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18, gap: 32, flexWrap: "wrap" }}>
                        <h1 className="ch-cart-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 76, lineHeight: 0.95, letterSpacing: "-0.03em", margin: 0 }}>
                            Your basket,<br /><em style={{ color: "#D9A876", fontWeight: 300 }}>fresh from the bench.</em>
                        </h1>
                    </div>

                    {/* Free-shipping progress — only meaningful for UPS-only achievable carts */}
                    {fsProgress && (
                        <div style={{ marginTop: 36, padding: "18px 0 0", borderTop: "1px solid #F5F0E622" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", opacity: 0.8 }}>
                                <span>{fsProgress.thresholdMet ? <span style={{ color: "#D9A876" }}>Free UPS shipping unlocked ✓</span> : <>${fsProgress.remaining.toFixed(0)} until free UPS shipping</>}</span>
                                <span>${subtotal.toFixed(0)} / $100</span>
                            </div>
                            <div style={{ height: 3, background: "#F5F0E61A", marginTop: 10 }}>
                                <div style={{ width: `${Math.min(100, (subtotal / 100) * 100)}%`, height: "100%", background: "#B96A3D" }} />
                            </div>
                        </div>
                    )}
                    {!fsProgress && activeAddress && (
                        <div style={{ marginTop: 24, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#D9A876", textTransform: "uppercase", opacity: 0.7 }}>
                            ◐ Free shipping only available on UPS-only orders over $100 — this cart includes local-delivery items
                        </div>
                    )}
                </div>
            </section>

            <div className="ch-cart-body" style={{ maxWidth: 1440, margin: "0 auto", padding: "40px 56px 96px", display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(0, 1fr)", gap: 48, alignItems: "flex-start" }}>
                {/* ─── ITEMS COLUMN ───────────────────────────────────── */}
                <div>
                    {/* Address picker — same flow as /bakery and /shop */}
                    <div style={{ marginBottom: 24 }}>
                        <AddressManager
                            apiKey={apiKey}
                            isLoggedIn={isLoggedIn}
                            initialAddresses={userAddresses}
                            activeAddress={activeAddress}
                            onActiveAddressChange={setActiveAddress}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
                        <div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ 01 — Items</div>
                            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontStyle: "italic", fontSize: 28, color: "#1F3026", margin: "6px 0 0" }}>From the bench &amp; cellar</h2>
                        </div>
                        <Link href={`${prefix}/shop`} style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: "#1F3026", textDecoration: "none", borderBottom: "1px solid #1F3026" }}>+ Add more</Link>
                    </div>

                    {planning && (
                        <div style={{ marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>
                            ● Checking delivery options…
                        </div>
                    )}

                    <div style={{ background: "#fff", border: "1px solid #1F302622" }}>
                        {items.map((item, i) => {
                            const line = item.product.priceB2c * item.quantity;
                            const isUndeliverable = undeliverableIds.has(item.product.id);
                            const reason = undeliverableReason(item.product.id);
                            return (
                                <div key={item.product.id} className="ch-cart-row" style={{
                                    padding: "22px 28px",
                                    borderBottom: i === items.length - 1 ? "none" : "1px solid #1F302614",
                                    display: "grid",
                                    gridTemplateColumns: "96px minmax(0, 1fr) auto auto",
                                    gap: 24,
                                    alignItems: "center",
                                    background: isUndeliverable ? "#FBEAE9" : "transparent",
                                }}>
                                    {/* Image */}
                                    <div style={{ width: 96, height: 96, position: "relative", background: "#EAE2D2", border: "1px solid #1F302614", overflow: "hidden", opacity: isUndeliverable ? 0.55 : 1 }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={getThumbUrl(item.product.imageUrl)} alt={item.product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    </div>

                                    {/* Info */}
                                    <div>
                                        <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 24, color: "#1F3026", lineHeight: 1.1 }}>{item.product.name}</span>
                                        {isUndeliverable && reason && (
                                            <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#A8312C", textTransform: "uppercase" }}>
                                                ⚠ {reason}
                                            </div>
                                        )}
                                        <div style={{ display: "flex", gap: 14, marginTop: 10, alignItems: "center" }}>
                                            <button onClick={() => removeItem(item.product.id)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", borderBottom: "1px solid #7A827866" }}>Remove</button>
                                        </div>
                                    </div>

                                    {/* Quantity stepper */}
                                    <div style={{ display: "flex", alignItems: "center", border: "1px solid #1F302633" }}>
                                        <button onClick={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1))} aria-label="Decrease" style={{ width: 36, height: 36, background: "transparent", border: "none", cursor: "pointer", color: "#1F3026", fontFamily: "var(--font-serif)", fontSize: 18, padding: 0 }}>−</button>
                                        <div style={{ width: 36, height: 36, borderLeft: "1px solid #1F302622", borderRight: "1px solid #1F302622", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 13, color: "#1F3026" }}>{item.quantity}</div>
                                        <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} aria-label="Increase" style={{ width: 36, height: 36, background: "transparent", border: "none", cursor: "pointer", color: "#1F3026", fontFamily: "var(--font-serif)", fontSize: 18, padding: 0 }}>+</button>
                                    </div>

                                    {/* Price */}
                                    <div style={{ textAlign: "right", minWidth: 84 }}>
                                        <div style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 22, color: "#1F3026" }}>{formatCurrency(line)}</div>
                                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginTop: 2 }}>{formatCurrency(item.product.priceB2c)}/ea</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Per-location plan summary (shows when address is set + cart is deliverable somewhere) */}
                    {plan && plan.groups.length > 0 && (
                        <div style={{ marginTop: 16, padding: "12px 16px", background: "#EAE2D2", border: "1px solid #1F302614" }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 8 }}>
                                Your order will ship as {plan.groups.length} fulfillment{plan.groups.length === 1 ? '' : 's'}
                            </div>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                                {plan.groups.map(g => {
                                    const cheapest = g.availableChannels[0];
                                    return (
                                        <li key={g.locationId} style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-sans)", fontSize: 13, color: "#1F3026" }}>
                                            <span>
                                                <strong>{g.locationName}</strong> · {g.items.map(i => `${i.productName} ×${i.quantity}`).join(', ')}
                                            </span>
                                            {cheapest && (
                                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase" }}>
                                                    {cheapest.channel.replace(/_/g, ' ')} · {cheapest.shippingCost === 0 ? 'Free' : `$${cheapest.shippingCost.toFixed(2)}`}
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                            <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#7A8278" }}>
                                Pick your final delivery method per group at checkout.
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── SUMMARY COLUMN (sticky) ───────────────────────── */}
                <aside className="ch-cart-summary" style={{ position: "sticky", top: 100 }}>
                    <div style={{ background: "#fff", border: "1px solid #1F302622" }}>
                        <div style={{ padding: "20px 28px", borderBottom: "1px solid #1F302614" }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ 02</div>
                            <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontStyle: "italic", fontSize: 26, color: "#1F3026", margin: "4px 0 0" }}>The reckoning</h3>
                        </div>
                        <div style={{ padding: "22px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
                            <SumRow label={t("subtotal")} value={formatCurrency(subtotal)} />
                            <SumRow
                                label={t("shipping")}
                                value={activeAddress
                                    ? (cheapestWithFreeShipping.some(q => q.isFreeShipping) ? "Free (UPS over $100)" : formatCurrency(shippingEstimate))
                                    : "Add address"}
                                muted={!activeAddress}
                            />
                            <SumRow label="Sales tax" value="At checkout" muted />
                        </div>

                        <div style={{ padding: "18px 28px", borderTop: "1px solid #1F302622", background: "#F5F0E6", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase" }}>{activeAddress ? "Estimated total" : "Subtotal"}</div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", color: "#7A8278", marginTop: 4, textTransform: "uppercase" }}>USD · tax at checkout</div>
                            </div>
                            <div style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 44, color: "#1F3026", letterSpacing: "-0.02em", lineHeight: 1 }}>
                                {formatCurrency(activeAddress ? total : subtotal)}
                            </div>
                        </div>

                        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 10 }}>
                            {canProceedToCheckout ? (
                                <Link href={`${prefix}/checkout`} style={{ background: "#1F3026", color: "#F5F0E6", border: "none", padding: "18px 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", textAlign: "center", textDecoration: "none", display: "block" }}>
                                    {t("checkout")} →
                                </Link>
                            ) : (
                                <button disabled
                                    style={{ background: "#7A8278", color: "#F5F0E6", border: "none", padding: "18px 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", textAlign: "center", cursor: "not-allowed", opacity: 0.7 }}>
                                    {hasUndeliverable ? "Remove undeliverable items" : t("checkout")}
                                </button>
                            )}
                            <Link href={`${prefix}/shop`} style={{ background: "transparent", color: "#1F3026", border: "1px solid #1F302655", padding: "14px 0", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", textAlign: "center", textDecoration: "none", display: "block" }}>
                                {t("continueShopping")}
                            </Link>
                        </div>
                    </div>

                    {/* Promise card */}
                    <div style={{ marginTop: 18, padding: 24, background: "#EAE2D2", border: "1px solid #1F302614" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>Our promise</div>
                        <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
                            {[
                                ["Cold-chain.", "Wheels ship insulated, 2-day priority."],
                                ["Hot-pickup.", "Reserve a 25-min window at the Dublin bakery."],
                                ["The replace pledge.", "Anything not perfect on arrival — we'll re-press it."],
                            ].map(([title, desc], i) => (
                                <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "baseline" }}>
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>0{i + 1}</span>
                                    <div>
                                        <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 17, color: "#1F3026" }}>{title}</div>
                                        <div style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "#2C3D33", opacity: 0.8, marginTop: 2, lineHeight: 1.55 }}>{desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    );
}

function SumRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>{label}</span>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: muted ? "#7A8278" : "#1F3026", fontStyle: muted ? "italic" : "normal" }}>{value}</span>
        </div>
    );
}
