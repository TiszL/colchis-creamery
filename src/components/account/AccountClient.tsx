"use client";

import { useState } from "react";
import Link from "next/link";
import { AccountProfileForm } from "./AccountProfileForm";
import { AccountPasswordForm } from "./AccountPasswordForm";
import AddressManager, { type ActiveAddress } from "@/components/bakery/AddressManager";
import type { UserAddressDto } from "@/app/actions/addresses";
import { formatCurrency } from "@/lib/utils";

interface OrderItem { product: { name: string }; quantity: number }
interface Order { id: string; createdAt: string; orderStatus: string; totalAmount: number; orderItems: OrderItem[] }
interface UserData { id: string; name: string | null; email: string; phone: string | null; createdAt: string }

interface Props {
    user: UserData;
    orders: Order[];
    locale: string;
    apiKey: string;
    userAddresses: UserAddressDto[];
}

const tabDefs = [
    { id: "overview", label: "Overview" },
    { id: "orders", label: "Orders" },
    { id: "addresses", label: "Addresses" },
    { id: "preferences", label: "Preferences" },
    { id: "security", label: "Security" },
] as const;

type TabId = typeof tabDefs[number]["id"];

export default function AccountClient({ user, orders, locale, apiKey, userAddresses }: Props) {
    const [tab, setTab] = useState<TabId>("overview");
    const prefix = locale === "en" ? "" : `/${locale}`;
    const firstName = user.name?.split(" ")[0] || "Customer";
    const initials = (user.name?.split(" ").map(w => w[0]).join("") || "C").toUpperCase().slice(0, 2);

    return (
        <main className="ch-account" style={{ background: "#F5F0E6", minHeight: "100vh" }}>
            {/* ─── BANNER ────────────────────────────────────────────── */}
            <section style={{ background: "#1F3026", color: "#F5F0E6", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#F5F0E606 1px, transparent 1px), linear-gradient(90deg, #F5F0E606 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none" }} />
                <div className="ch-account-banner" style={{ maxWidth: 1440, margin: "0 auto", padding: "64px 56px 48px", display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 48, alignItems: "end", position: "relative" }}>
                    <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#D9A876", textTransform: "uppercase" }}>
                            № 00 — The Pantry · Customer
                        </div>
                        <h1 className="ch-account-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 84, lineHeight: 0.95, letterSpacing: "-0.03em", margin: "18px 0 0", color: "#F5F0E6" }}>
                            Welcome back,<br /><em style={{ color: "#D9A876", fontWeight: 300 }}>{firstName}.</em>
                        </h1>
                        <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, marginTop: 22, opacity: 0.78, maxWidth: 540 }}>
                            Check your orders, manage addresses, and update preferences from your pantry dashboard.
                        </p>
                    </div>

                    {/* Profile card */}
                    <div style={{ background: "#2C3D33", border: "1px solid #F5F0E622", padding: 28, position: "relative" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", color: "#D9A876", textTransform: "uppercase" }}>Profile</div>
                            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#B96A3D", color: "#F5F0E6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 500 }}>{initials}</div>
                        </div>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontStyle: "italic", color: "#F5F0E6", marginTop: 12 }}>{user.name || "Customer"}</div>
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#F5F0E6", opacity: 0.65, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                        <div style={{ marginTop: 18, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#D9A876", textTransform: "uppercase", borderTop: "1px solid #F5F0E622", paddingTop: 14 }}>
                            Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ borderTop: "1px solid #F5F0E61A", position: "relative" }}>
                    <div className="ch-account-tabs" style={{ maxWidth: 1440, margin: "0 auto", padding: "0 56px", display: "flex", gap: 0, overflowX: "auto" }}>
                        {tabDefs.map(t => {
                            const on = tab === t.id;
                            return (
                                <button key={t.id} onClick={() => setTab(t.id)} style={{
                                    background: "transparent", border: "none", color: "#F5F0E6", opacity: on ? 1 : 0.55,
                                    fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase",
                                    padding: "20px 24px 22px", cursor: "pointer", borderBottom: on ? "2px solid #B96A3D" : "2px solid transparent", whiteSpace: "nowrap",
                                }}>{t.label}</button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ─── TAB CONTENT ───────────────────────────────────────── */}
            <div style={{ maxWidth: 1440, margin: "0 auto", padding: "56px 56px 96px" }}>
                {tab === "overview" && <OverviewTab orders={orders} prefix={prefix} setTab={setTab} />}
                {tab === "orders" && <OrdersTab orders={orders} prefix={prefix} />}
                {tab === "addresses" && <AddressesTab apiKey={apiKey} userAddresses={userAddresses} />}
                {tab === "preferences" && <PreferencesTab user={user} />}
                {tab === "security" && <SecurityTab user={user} />}
            </div>
        </main>
    );
}

/* ─── CARD ATOM ────────────────────────────────────────────────────────── */
function Card({ number, title, subtitle, action, children }: { number: string; title: string; subtitle?: string; action?: { label: string; onClick?: () => void }; children: React.ReactNode }) {
    return (
        <div style={{ background: "#fff", border: "1px solid #1F302622" }}>
            <div style={{ padding: "20px 28px", borderBottom: "1px solid #1F302614", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ {number}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 4 }}>
                        <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 22, color: "#1F3026", margin: 0, fontStyle: "italic" }}>{title}</h3>
                        {subtitle && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>{subtitle}</span>}
                    </div>
                </div>
                {action && (
                    <button onClick={action.onClick} style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#1F3026", textTransform: "uppercase", borderBottom: "1px solid #1F3026" }}>{action.label}</button>
                )}
            </div>
            <div>{children}</div>
        </div>
    );
}

/* ─── OVERVIEW TAB ─────────────────────────────────────────────────────── */
function OverviewTab({ orders, prefix, setTab }: { orders: Order[]; prefix: string; setTab: (t: TabId) => void }) {
    const summary = [
        { label: "Total orders", value: String(orders.length), note: "all time" },
        { label: "Latest status", value: orders[0]?.orderStatus || "—", note: orders[0] ? new Date(orders[0].createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "" },
    ];

    return (
        <div className="ch-account-overview" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 36 }}>
            <div>
                {/* Summary tiles */}
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${summary.length}, 1fr)`, gap: 0, border: "1px solid #1F302622", marginBottom: 36, background: "#fff" }}>
                    {summary.map((s, i) => (
                        <div key={i} style={{ padding: "24px 20px", borderLeft: i === 0 ? "none" : "1px solid #1F302614" }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>{s.label}</div>
                            <div style={{ fontFamily: "var(--font-serif)", fontSize: 38, color: "#1F3026", marginTop: 6, lineHeight: 1, fontWeight: 300, letterSpacing: "-0.02em" }}>{s.value}</div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", color: "#B96A3D", textTransform: "uppercase", marginTop: 8 }}>{s.note}</div>
                        </div>
                    ))}
                </div>

                {/* Recent orders */}
                <Card number="01" title="Recent orders" action={{ label: "All orders →", onClick: () => setTab("orders") }}>
                    {orders.length > 0 ? orders.slice(0, 4).map((o, i) => (
                        <OrderRow key={o.id} order={o} last={i === Math.min(orders.length, 4) - 1} prefix={prefix} />
                    )) : (
                        <div style={{ padding: 28, textAlign: "center" }}>
                            <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 16, color: "#7A8278" }}>No orders yet.</p>
                            <Link href={`${prefix}/shop`} style={{ display: "inline-block", marginTop: 14, padding: "12px 20px", background: "#1F3026", color: "#F5F0E6", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Browse the shop →</Link>
                        </div>
                    )}
                </Card>
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ background: "#B96A3D", color: "#F5F0E6", padding: 28 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", opacity: 0.85 }}>Shop · Colchis Food</div>
                    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 26, marginTop: 8 }}>Explore the creamery</div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, opacity: 0.9, marginTop: 8, lineHeight: 1.55 }}>Fresh sulguni, aged wheels, and artisan khachapuri — from Dublin, Ohio.</div>
                    <Link href={`${prefix}/shop`} style={{ display: "inline-block", marginTop: 16, background: "#F5F0E6", color: "#1F3026", border: "none", padding: "12px 18px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Browse →</Link>
                </div>
            </div>
        </div>
    );
}

/* ─── ORDERS TAB ───────────────────────────────────────────────────────── */
function OrdersTab({ orders, prefix }: { orders: Order[]; prefix: string }) {
    return (
        <Card number="02" title="All orders" subtitle={`${orders.length} total`}>
            {orders.length > 0 ? orders.map((o, i) => (
                <OrderRow key={o.id} order={o} last={i === orders.length - 1} prefix={prefix} />
            )) : (
                <div style={{ padding: 28, textAlign: "center" }}>
                    <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 16, color: "#7A8278" }}>No orders yet. Start shopping!</p>
                </div>
            )}
        </Card>
    );
}

function OrderRow({ order, last, prefix }: { order: Order; last: boolean; prefix: string }) {
    const items = order.orderItems.map(i => `${i.quantity}× ${i.product.name}`).join(" · ");
    const date = new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const statusColor =
        order.orderStatus === "CONFIRMED" || order.orderStatus === "DELIVERED" ? "#1F3026"
        : order.orderStatus === "PROCESSING" ? "#B96A3D"
        : order.orderStatus === "CANCELLED" ? "#A8312C"
        : "#7A8278";

    return (
        <Link
            href={`${prefix}/account/orders/${order.id}`}
            className="ch-order-row"
            style={{
                padding: "20px 28px",
                borderBottom: last ? "none" : "1px solid #1F302614",
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                gap: 24,
                alignItems: "center",
                textDecoration: "none",
                color: "inherit",
            }}
        >
            <div>
                <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 17, color: "#1F3026", lineHeight: 1.3 }}>{items || "Order"}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginTop: 4 }}>{date}</div>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: statusColor, textTransform: "uppercase", border: `1px solid ${statusColor}55`, padding: "5px 10px" }}>{order.orderStatus}</span>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "#1F3026", fontWeight: 500 }}>{formatCurrency(order.totalAmount)}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase" }}>View →</span>
        </Link>
    );
}

/* ─── ADDRESSES TAB ────────────────────────────────────────────────────── */
// Phase 7b: now uses AddressManager — same component + UX as /shop, /bakery,
// /cart, /checkout. Single source of truth (UserAddress[] table). Adding an
// address here shows up everywhere; switching the active address here
// propagates via the shared localStorage cache.
function AddressesTab({ apiKey, userAddresses }: { apiKey: string; userAddresses: UserAddressDto[] }) {
    const [activeAddress, setActiveAddress] = useState<ActiveAddress | null>(null);
    return (
        <Card number="03" title="Addresses" subtitle="Manage your saved shipping addresses">
            <div style={{ padding: 24 }}>
                <AddressManager
                    apiKey={apiKey}
                    isLoggedIn={true}
                    initialAddresses={userAddresses}
                    activeAddress={activeAddress}
                    onActiveAddressChange={setActiveAddress}
                />
            </div>
        </Card>
    );
}

/* ─── PREFERENCES TAB ──────────────────────────────────────────────────── */
function PreferencesTab({ user }: { user: UserData }) {
    return (
        <div className="ch-prefs-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <Card number="04" title="Profile" subtitle="Your name & contact">
                <AccountProfileForm userId={user.id} initialName={user.name || ""} initialPhone={user.phone || ""} />
            </Card>
            <Card number="05" title="Account info" subtitle="Email & membership">
                <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase" }}>Email</div>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "#1F3026", marginTop: 4 }}>{user.email}</div>
                    </div>
                    <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase" }}>Member since</div>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "#1F3026", marginTop: 4 }}>
                            {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}

/* ─── SECURITY TAB ─────────────────────────────────────────────────────── */
function SecurityTab({ user }: { user: UserData }) {
    return (
        <div className="ch-security-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <Card number="06" title="Password" subtitle="Change your password">
                <AccountPasswordForm userId={user.id} />
            </Card>
            <Card number="07" title="Account" subtitle="Danger zone">
                <div style={{ padding: 28 }}>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: "#2C3D33", lineHeight: 1.6 }}>
                        If you close your account, we&apos;ll fulfill any open orders, then erase your data. This cannot be undone.
                    </div>
                    <button style={{ marginTop: 16, background: "transparent", color: "#A8312C", border: "1px solid #A8312C55", padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer" }}>Close account</button>
                </div>
            </Card>
        </div>
    );
}
