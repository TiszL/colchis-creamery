"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthProvider";
import CartDropdown from "@/components/cart/CartDropdown";
import { LocationPicker } from "@/components/location/LocationPicker";
import { useState, useEffect, useRef } from "react";

function initials(name = "") {
  return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase() || "·";
}

interface HeaderProps {
  /** Primary business street line shown in the mobile drawer footer. Server-fetched
   *  by the layout (public + protected) and passed in so the client component
   *  doesn't have to call the DB. */
  primaryAddressShort?: string;
}

export function Header({ primaryAddressShort }: HeaderProps = {}) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const { itemCount } = useCart();
  const { user, isLoggedIn, isLoading, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const prefix = locale === "en" ? "" : `/${locale}`;

  // Nav label "Creamery" (per messages/en.json "shop": "Creamery") routes to
  // /creamery — the dedicated creamery section page. The Order CTA below
  // separately points to /shop (the unified all-products index).
  const links = [
    { href: `${prefix}/creamery`, label: t("shop") },
    { href: `${prefix}/bakery`, label: "Bakery" },
    { href: `${prefix}/journal`, label: "Journal" },
    { href: `${prefix}/recipes`, label: "Recipes" },
    { href: `${prefix}/heritage`, label: t("heritage") },
    { href: `${prefix}/wholesale`, label: "Wholesale" },
    { href: `${prefix}/contact`, label: "Contact" },
  ];

  useEffect(() => {
    if (drawerOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.overflow = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (!cartOpen) return;
    const onDoc = (e: MouseEvent) => { if (cartRef.current && !cartRef.current.contains(e.target as Node)) setCartOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [cartOpen]);

  const handleLogout = async () => { setMenuOpen(false); setDrawerOpen(false); await logout(); };

  const menuItemStyle: React.CSSProperties = {
    display: "block", padding: "14px 20px",
    fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.22em",
    color: "#1F3026", textDecoration: "none", textTransform: "uppercase",
    border: "none", background: "transparent", width: "100%", textAlign: "left",
    cursor: "pointer",
  };

  return (
    <>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "#F5F0E6F2", backdropFilter: "blur(12px)", borderBottom: "1px solid #1F302614" }}>
        <div className="ch-header-inner" style={{ maxWidth: 1440, margin: "0 auto", padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
          {/* Logo — seal scales down on mobile via .ch-logo-seal in globals.css;
              wordmark hides on mobile via .ch-logo-wordmark (the CF seal already
              conveys identity, no need to duplicate). */}
          <Link href={`${prefix}/`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", flexShrink: 0 }}>
            <img className="ch-logo-seal" src="/brand/seal-primary.svg" alt="Colchis Food" width={88} height={88} style={{ display: "block", flexShrink: 0 }} />
            <div className="ch-logo-wordmark" style={{ fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 15, letterSpacing: "0.18em", textTransform: "uppercase", color: "#1F3026", whiteSpace: "nowrap" }}>Colchis Food</div>
          </Link>

          {/* Desktop nav — flexShrink:0 + nowrap so links are never clipped or
              wrapped; the compact location chip (no "Ordering from" prose) keeps
              the row within budget. Below 900px the whole nav collapses into the
              burger (globals.css .ch-nav-desktop). */}
          <nav className="ch-nav ch-nav-desktop" style={{ display: "flex", gap: 18, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", alignItems: "center", flexShrink: 0, whiteSpace: "nowrap" }}>
            {links.map(l => (
              <Link key={l.href} href={l.href} style={{ color: "#1F3026", textDecoration: "none", whiteSpace: "nowrap" }}>{l.label}</Link>
            ))}
          </nav>

          {/* Right cluster — wrapping CTA + Cart + Burger in one tight flex
              group keeps the cart visually adjacent to the rest instead of
              floating off to the viewport edge under justify-content: space-between. */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>

          {/* Phase 1 — sticky location picker. Outside ch-header-cta so it
              shows on mobile too (the catalog filter scopes to this choice). */}
          <LocationPicker />

          {/* Desktop CTA + auth */}
          <div className="ch-header-cta" style={{ display: "flex", gap: 14, alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", flexShrink: 0 }}>
            <LocaleSwitcher />

            {/* Auth — fixed-footprint slot so signed-in (avatar) and signed-out
                ("Sign In" pill) occupy an identical width and never reflow the
                row. isLoading is false on first paint when SSR-seeded, so the
                correct element shows immediately (no pop-in). */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, minWidth: 38, minHeight: 38 }}>
            {!isLoading && (
              isLoggedIn && user ? (
                <div ref={menuRef} style={{ position: "relative" }}>
                  <button onClick={() => setMenuOpen(m => !m)} aria-label="Account menu" aria-expanded={menuOpen} style={{ width: 38, height: 38, borderRadius: "50%", background: "#B96A3D", color: "#F5F0E6", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    {initials(user.name || user.email)}
                  </button>
                  {menuOpen && (
                    <div role="menu" style={{ position: "absolute", top: "calc(100% + 14px)", right: 0, width: 280, background: "#F5F0E6", border: "1px solid #1F302622", boxShadow: "0 18px 40px rgba(31,48,38,0.14)", zIndex: 60 }}>
                      <div style={{ padding: "18px 20px", borderBottom: "1px solid #1F302614" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", color: "#1F3026", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name || "Customer"}</div>
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#7A8278", marginTop: 4, textTransform: "none", letterSpacing: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                      </div>
                      <Link href={`${prefix}/account`} onClick={() => setMenuOpen(false)} style={menuItemStyle} role="menuitem">My Account</Link>
                      <Link href={`${prefix}/account`} onClick={() => setMenuOpen(false)} style={menuItemStyle} role="menuitem">Orders</Link>
                      <button onClick={handleLogout} style={{ ...menuItemStyle, color: "#B96A3D", borderTop: "1px solid #1F302614" }} role="menuitem">Sign Out</button>
                    </div>
                  )}
                </div>
              ) : (
                <Link href={`${prefix}/login`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 38, padding: "0 16px", color: "#1F3026", textDecoration: "none", whiteSpace: "nowrap", border: "1px solid #1F302633", borderRadius: 999 }}>Sign In</Link>
              )
            )}
            </div>{/* /auth slot */}

            {/* Order CTA */}
            <Link href={`${prefix}/shop`} style={{ background: "#1F3026", color: "#F5F0E6", border: "none", padding: "11px 20px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", textDecoration: "none", whiteSpace: "nowrap" }}>Order →</Link>
          </div>

          {/* Cart — opens mini-cart dropdown anchored below. Lives OUTSIDE
              .ch-header-cta so it stays visible on mobile (that container is
              display:none below the desktop breakpoint). */}
          <div ref={cartRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setCartOpen(o => !o)}
              aria-label={t("cart")}
              aria-expanded={cartOpen}
              aria-haspopup="dialog"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, color: "#1F3026", background: "transparent", border: "none", cursor: "pointer", padding: 0, position: "relative" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}>
                <path d="M5 7h14l-1.5 11a2 2 0 0 1-2 1.75H8.5A2 2 0 0 1 6.5 18L5 7z" />
                <path d="M9 7V5a3 3 0 0 1 6 0v2" />
              </svg>
              {itemCount > 0 && (
                <span style={{ position: "absolute", top: -2, right: -2, background: "#B96A3D", color: "#F5F0E6", fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{itemCount}</span>
              )}
            </button>
            <CartDropdown open={cartOpen} onClose={() => setCartOpen(false)} locale={locale} />
          </div>

          {/* Burger button (mobile) */}
          <button className="ch-burger" onClick={() => setDrawerOpen(true)} aria-label="Open menu" style={{ display: "none", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 5, width: 42, height: 42, background: "transparent", border: "1px solid #1F302633", cursor: "pointer", padding: 0 }}>
            <span style={{ display: "block", width: 18, height: 1.5, background: "#1F3026" }} />
            <span style={{ display: "block", width: 18, height: 1.5, background: "#1F3026" }} />
            <span style={{ display: "block", width: 18, height: 1.5, background: "#1F3026" }} />
          </button>

          </div>{/* /right cluster */}
        </div>
      </header>

      {/* Mobile Drawer */}
      <div className={`ch-drawer-backdrop ${drawerOpen ? "open" : ""}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`ch-drawer ${drawerOpen ? "open" : ""}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #1F302614" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/brand/seal-primary.svg" alt="Colchis Food" width={64} height={64} style={{ display: "block", flexShrink: 0 }} />
            <div style={{ fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: "#1F3026" }}>Colchis Food</div>
          </div>
          <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" style={{ width: 36, height: 36, background: "transparent", border: "1px solid #1F302633", cursor: "pointer", fontFamily: "var(--font-serif)", fontSize: 18, color: "#1F3026", padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <nav style={{ flex: 1, padding: "32px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
          {links.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setDrawerOpen(false)} style={{ display: "block", padding: "18px 4px", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 32, color: "#1F3026", textDecoration: "none", borderBottom: "1px solid #1F302614" }}>{l.label}</Link>
          ))}
        </nav>
        <div style={{ padding: "20px 24px", borderTop: "1px solid #1F302614", display: "flex", flexDirection: "column", gap: 14 }}>
          {!isLoading && isLoggedIn && user ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
                <span style={{ width: 38, height: 38, borderRadius: "50%", background: "#B96A3D", color: "#F5F0E6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 11 }}>{initials(user.name || user.email)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", color: "#1F3026", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name || user.email.split("@")[0]}</div>
                  <Link href={`${prefix}/account`} onClick={() => setDrawerOpen(false)} style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#B96A3D", textDecoration: "none" }}>My account →</Link>
                </div>
                <button onClick={handleLogout} style={{ background: "transparent", border: "1px solid #1F302633", color: "#1F3026", padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer" }}>Sign out</button>
              </div>
            </>
          ) : (
            <Link href={`${prefix}/login`} onClick={() => setDrawerOpen(false)} style={{ display: "block", textAlign: "center", background: "transparent", color: "#1F3026", border: "1px solid #1F3026", padding: "14px 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Sign In</Link>
          )}
          <Link href={`${prefix}/shop`} onClick={() => setDrawerOpen(false)} style={{ display: "block", textAlign: "center", background: "#1F3026", color: "#F5F0E6", border: "none", padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Order →</Link>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "#7A8278" }}>
            <span>EN / ქართული</span>
            <span>{primaryAddressShort || ''}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
