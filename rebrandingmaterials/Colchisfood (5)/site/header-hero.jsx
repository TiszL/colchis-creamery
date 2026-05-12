/* global React, ColchisSeal */
const { useState, useEffect, useRef } = React;

// ─── AUTH (demo) ───────────────────────────────────────────────────────────
function readUser() {
  try { return JSON.parse(localStorage.getItem("ch_user") || "null"); } catch { return null; }
}
function writeUser(u) {
  if (u) localStorage.setItem("ch_user", JSON.stringify(u));
  else localStorage.removeItem("ch_user");
  window.dispatchEvent(new Event("ch_user_change"));
}
window.__ch_signIn = (u) => writeUser(u || { name: "Tornike Shergelashvili", email: "tornike@colchisfood.com" });
window.__ch_signOut = () => writeUser(null);

function useUser() {
  const [u, setU] = useState(typeof localStorage !== "undefined" ? readUser() : null);
  useEffect(() => {
    const sync = () => setU(readUser());
    window.addEventListener("ch_user_change", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("ch_user_change", sync); window.removeEventListener("storage", sync); };
  }, []);
  return u;
}

function initials(name = "") {
  return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase() || "·";
}

// ─── HEADER ────────────────────────────────────────────────────────────────
function SiteHeader({ palette }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const user = useUser();
  const menuRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menu]);

  const links = [
    { label: "Creamery", href: "Creamery.html" },
    { label: "Bakery", href: "Bakery.html" },
    { label: "Recipes", href: "Recipes.html" },
    { label: "Stories", href: "Articles.html" },
    { label: "Heritage", href: "Heritage.html" },
    { label: "Wholesale", href: "Wholesale.html" },
  ];

  return (
    <>
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: palette.cream + "F2", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${palette.ink}14`,
      }}>
        <div className="ch-header-inner" style={{ maxWidth: 1440, margin: "0 auto", padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
          <a href="#" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", flexShrink: 0 }}>
            <ColchisSeal palette={palette} size={40} />
            <div style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: 15, letterSpacing: "0.18em", textTransform: "uppercase", color: palette.ink, whiteSpace: "nowrap" }}>Colchis Food</div>
          </a>
          <nav className="ch-nav ch-nav-desktop" style={{ display: "flex", gap: 22, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", alignItems: "center" }}>
            {links.map(l => (
              <a key={l.label} href={l.href} style={{ color: palette.ink, textDecoration: "none" }}>{l.label}</a>
            ))}
          </nav>
          <div className="ch-header-cta" style={{ display: "flex", gap: 14, alignItems: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", flexShrink: 0 }}>
            <span style={{ color: palette.ink, opacity: 0.55, whiteSpace: "nowrap" }}>EN<span style={{ margin: "0 6px" }}>/</span>ქარ</span>
            <a href="Cart.html" aria-label="Cart" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, color: palette.ink, textDecoration: "none", position: "relative" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 7h14l-1.5 11a2 2 0 0 1-2 1.75H8.5A2 2 0 0 1 6.5 18L5 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>
            </a>
            {user ? (
              <div ref={menuRef} style={{ position: "relative" }}>
                <button onClick={() => setMenu(m => !m)} aria-label="Account menu" aria-expanded={menu} style={{ width: 38, height: 38, borderRadius: "50%", background: palette.accent, color: palette.cream, border: "none", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.08em", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  {initials(user.name)}
                </button>
                {menu && (
                  <div role="menu" style={{ position: "absolute", top: "calc(100% + 14px)", right: 0, width: 280, background: palette.cream, border: `1px solid ${palette.ink}22`, boxShadow: "0 18px 40px rgba(31,48,38,0.14)", zIndex: 60 }}>
                    <div style={{ padding: "18px 20px", borderBottom: `1px solid ${palette.ink}14` }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.18em", color: palette.ink, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: palette.muted, marginTop: 4, textTransform: "none", letterSpacing: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                    </div>
                    <a href="Account.html" onClick={() => setMenu(false)} style={menuItem(palette)} role="menuitem">My Account</a>
                    <a href="Account.html#orders" onClick={() => setMenu(false)} style={menuItem(palette)} role="menuitem">Orders</a>
                    <a href="Account.html#standing" onClick={() => setMenu(false)} style={menuItem(palette)} role="menuitem">Standing orders</a>
                    <button onClick={() => { window.__ch_signOut(); setMenu(false); }} style={{ ...menuItem(palette), color: palette.accent, borderTop: `1px solid ${palette.ink}14`, background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }} role="menuitem">Sign Out</button>
                  </div>
                )}
              </div>
            ) : (
              <a href="Login.html" style={{ color: palette.ink, textDecoration: "none", padding: "11px 4px", whiteSpace: "nowrap", borderBottom: `1px solid ${palette.ink}33` }}>Sign In</a>
            )}
            <button onClick={() => { window.location.href = "Cart.html"; }} style={{ background: palette.ink, color: palette.cream, border: "none", padding: "11px 20px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>Order →</button>
          </div>
          {/* Hamburger */}
          <button
            className="ch-burger"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            style={{ display: "none", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 5, width: 42, height: 42, background: "transparent", border: `1px solid ${palette.ink}33`, cursor: "pointer", padding: 0 }}
          >
            <span style={{ display: "block", width: 18, height: 1.5, background: palette.ink }} />
            <span style={{ display: "block", width: 18, height: 1.5, background: palette.ink }} />
            <span style={{ display: "block", width: 18, height: 1.5, background: palette.ink }} />
          </button>
        </div>
      </header>

      {/* Drawer */}
      <div className={`ch-drawer-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`ch-drawer ${open ? "open" : ""}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: `1px solid ${palette.ink}14` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ColchisSeal palette={palette} size={32} />
            <div style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: palette.ink }}>Colchis Food</div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close menu" style={{ width: 36, height: 36, background: "transparent", border: `1px solid ${palette.ink}33`, cursor: "pointer", fontFamily: "Fraunces, serif", fontSize: 18, color: palette.ink, padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <nav style={{ flex: 1, padding: "32px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
          {links.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)} style={{ display: "block", padding: "18px 4px", fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 32, color: palette.ink, textDecoration: "none", borderBottom: `1px solid ${palette.ink}14` }}>{l.label}</a>
          ))}
        </nav>
        <div style={{ padding: "20px 24px", borderTop: `1px solid ${palette.ink}14`, display: "flex", flexDirection: "column", gap: 14 }}>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
              <span style={{ width: 38, height: 38, borderRadius: "50%", background: palette.accent, color: palette.cream, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{initials(user.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: palette.ink, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                <a href="Account.html" onClick={() => setOpen(false)} style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: palette.accent, textDecoration: "none" }}>My account →</a>
              </div>
              <button onClick={() => { window.__ch_signOut(); setOpen(false); }} style={{ background: "transparent", border: `1px solid ${palette.ink}33`, color: palette.ink, padding: "8px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer" }}>Sign out</button>
            </div>
          ) : (
            <a href="Login.html" onClick={() => setOpen(false)} style={{ display: "block", textAlign: "center", background: "transparent", color: palette.ink, border: `1px solid ${palette.ink}`, padding: "14px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Sign In</a>
          )}
          <a href="Cart.html" onClick={() => setOpen(false)} style={{ display: "block", textAlign: "center", background: palette.ink, color: palette.cream, border: "none", padding: "16px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none" }}>Order →</a>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: palette.muted }}>
            <span>EN / ქართული</span>
            <span>5340 Tuller Rd</span>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── HERO ──────────────────────────────────────────────────────────────────
function Hero({ palette }) {
  const [zip, setZip] = useState("43017");
  const [mode, setMode] = useState("hot");
  const isLocal = ["43016", "43017", "43002", "43026", "43221"].includes(zip);
  return (
    <section style={{ background: palette.ink, color: palette.cream, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${palette.cream}06 1px, transparent 1px), linear-gradient(90deg, ${palette.cream}06 1px, transparent 1px)`, backgroundSize: "80px 80px", pointerEvents: "none" }} />
      <div className="ch-hero-grid" style={{ maxWidth: 1440, margin: "0 auto", padding: "120px 56px 100px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 72, position: "relative" }}>
        {/* Left */}
        <div>
          <div className="ch-hero-eyebrow" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase", marginBottom: 28 }}>
            № 01 — From Colchis, est. MMXXVI
          </div>
          <h1 className="ch-hero-h1" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 128, lineHeight: 0.9, letterSpacing: "-0.03em", color: palette.cream, margin: 0 }}>
            Bread,<br />cheese,<br /><em style={{ color: palette.accent2, fontWeight: 300 }}>and a country</em><br />you should know.
          </h1>
          <p className="ch-hero-lead" style={{ marginTop: 36, fontFamily: "Fraunces, serif", fontSize: 20, lineHeight: 1.55, color: palette.cream, opacity: 0.78, maxWidth: 540, fontStyle: "italic" }}>
            Two thousand years of recipes, hand-pressed and hand-baked in Dublin, Ohio. Hot khachapuri to your door tonight, or aged sulguni shipped to all fifty states.
          </p>
          <div className="ch-hero-ctas" style={{ display: "flex", gap: 14, marginTop: 40 }}>
            <button style={{ background: palette.accent, color: palette.cream, border: "none", padding: "16px 30px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Shop the Creamery →</button>
            <button style={{ background: "transparent", color: palette.cream, border: `1px solid ${palette.cream}55`, padding: "16px 30px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Read our story</button>
          </div>
        </div>
        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ width: "100%", aspectRatio: "4/3", background: `repeating-linear-gradient(45deg, ${palette.ink2}, ${palette.ink2} 1px, ${palette.ink} 1px, ${palette.ink} 8px)`, border: `1px solid ${palette.cream}22`, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.cream, opacity: 0.5, textTransform: "uppercase", textAlign: "center" }}>
              [ Hero photo ]<br /><span style={{ opacity: 0.7 }}>Adjaruli khachapuri, still steaming</span>
            </div>
            <div className="ch-hero-badge" style={{ position: "absolute", top: 20, right: 20, width: 110, height: 110, borderRadius: "50%", background: palette.accent, color: palette.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 1.1 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.24em" }}>HOT NOW</div>
              <div className="ch-hero-badge-min" style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 26, marginTop: 4 }}>25 min</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.16em", marginTop: 4 }}>DUBLIN OH</div>
            </div>
          </div>
          {/* Smart delivery */}
          <div style={{ background: palette.cream, color: palette.ink, padding: 24, fontFamily: "Inter, sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>Deliver to</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: isLocal ? palette.accent : palette.ink, textTransform: "uppercase" }}>{isLocal ? "● Local zone" : "○ Ships nationwide"}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <input value={zip} onChange={(e) => setZip(e.target.value)} maxLength={5} style={{ flex: "1 1 140px", minWidth: 100, fontFamily: "'JetBrains Mono', monospace", fontSize: 18, letterSpacing: "0.2em", background: "transparent", border: `1px solid ${palette.ink}44`, padding: "12px 14px", color: palette.ink, outline: "none" }} />
              <button style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", background: palette.ink, color: palette.cream, border: "none", padding: "12px 18px", cursor: "pointer", flex: "0 0 auto" }}>Use location</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => setMode("hot")} disabled={!isLocal} style={{ textAlign: "left", padding: 14, cursor: isLocal ? "pointer" : "not-allowed", background: mode === "hot" && isLocal ? palette.ink : "transparent", color: mode === "hot" && isLocal ? palette.cream : palette.ink, opacity: isLocal ? 1 : 0.4, border: `1px solid ${palette.ink}44` }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", opacity: 0.7 }}>◐ Hot · 25 min</div>
                <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, marginTop: 6 }}>Bakery</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Khachapuri, fresh from oven</div>
              </button>
              <button onClick={() => setMode("ship")} style={{ textAlign: "left", padding: 14, cursor: "pointer", background: mode === "ship" ? palette.ink : "transparent", color: mode === "ship" ? palette.cream : palette.ink, border: `1px solid ${palette.ink}44` }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", opacity: 0.7 }}>▸ UPS · 1–2 days</div>
                <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, marginTop: 6 }}>Creamery</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Cheese & frozen, US-wide</div>
              </button>
            </div>
            <div style={{ marginTop: 14, padding: "10px 14px", background: palette.cream2, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.16em", color: palette.ink, textTransform: "uppercase" }}>
              {isLocal && mode === "hot" && "→ Doordash · Uber Eats · ETA 25 min · until 9 PM"}
              {isLocal && mode === "ship" && "→ UPS Ground · arrives Wed, May 6 · free over $75"}
              {!isLocal && "→ UPS Ground · 1–2 days · free shipping over $75"}
            </div>
          </div>
        </div>
      </div>
      {/* Ticker */}
      <div className="ch-ticker" style={{ borderTop: `1px solid ${palette.cream}22`, padding: "18px 56px", display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: palette.cream, opacity: 0.6 }}>
        <span>◐ The Bakery — open until 9 PM</span>
        <span>▸ Free UPS over $75</span>
        <span>● Made in Dublin, Ohio</span>
        <span>★ 4.9 / 312 reviews</span>
      </div>
    </section>
  );
}

function menuItem(palette) {
  return {
    display: "block",
    padding: "14px 20px",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.22em",
    color: palette.ink,
    textDecoration: "none",
    textTransform: "uppercase",
    border: "none",
  };
}

window.SiteHeader = SiteHeader;
window.Hero = Hero;
