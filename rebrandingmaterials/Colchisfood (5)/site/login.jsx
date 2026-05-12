/* global React */
const { useState } = React;

// ─── LOGIN PAGE ────────────────────────────────────────────────────────────
function LoginPage({ palette, mode: initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode); // "login" | "register"
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const isReg = mode === "register";

  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  const sans = "Inter, sans-serif";

  return (
    <main className="ch-auth" style={{ background: palette.cream, minHeight: "calc(100vh - 80px)", position: "relative", overflow: "hidden" }}>
      {/* Faint grid background */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${palette.ink}06 1px, transparent 1px), linear-gradient(90deg, ${palette.ink}06 1px, transparent 1px)`, backgroundSize: "80px 80px", pointerEvents: "none" }} />

      <div className="ch-auth-grid" style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "calc(100vh - 80px)", position: "relative" }}>

        {/* ─── LEFT — Editorial column ─────────────────────────────────── */}
        <aside className="ch-auth-left" style={{ borderRight: `1px solid ${palette.ink}14`, padding: "72px 64px 64px", display: "flex", flexDirection: "column", justifyContent: "space-between", background: palette.cream }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 18 }}>
              № 00 — The Pantry
            </div>
            <h1 className="ch-auth-h1" style={{ fontFamily: serif, fontWeight: 300, fontSize: 92, lineHeight: 0.92, letterSpacing: "-0.03em", color: palette.ink, margin: 0 }}>
              {isReg ? (
                <>Set a place<br /><em style={{ color: palette.accent, fontWeight: 300 }}>at the table.</em></>
              ) : (
                <>Welcome<br /><em style={{ color: palette.accent, fontWeight: 300 }}>back to the&nbsp;table.</em></>
              )}
            </h1>
            <p className="ch-auth-lead" style={{ marginTop: 28, fontFamily: serif, fontSize: 19, fontStyle: "italic", lineHeight: 1.55, color: palette.ink2, opacity: 0.85, maxWidth: 460 }}>
              Sign in to track standing orders, save addresses for the cheese cellar, and reserve hot khachapuri for pickup before it leaves the oven.
            </p>
          </div>

          {/* Bottom — three-up reasons */}
          <div className="ch-auth-reasons" style={{ marginTop: 80, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28, paddingTop: 36, borderTop: `1px solid ${palette.ink}22` }}>
            {[
              { n: "i.", t: "Standing orders", d: "Auto-ship sulguni and frozen khachapuri on your cadence." },
              { n: "ii.", t: "Local pickup", d: "Reserve hot bread before the oven cools. Tuller Rd, Dublin." },
              { n: "iii.", t: "Cellar reserve", d: "First access to the 12-month aged wheels we only press once." },
            ].map(r => (
              <div key={r.n}>
                <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", color: palette.accent, textTransform: "uppercase" }}>{r.n}</div>
                <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 20, color: palette.ink, marginTop: 8 }}>{r.t}</div>
                <div style={{ fontFamily: sans, fontSize: 13, color: palette.ink2, opacity: 0.75, lineHeight: 1.55, marginTop: 6 }}>{r.d}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* ─── RIGHT — Form column ─────────────────────────────────────── */}
        <section className="ch-auth-right" style={{ padding: "72px 64px 64px", background: palette.cream2, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div className="ch-auth-card" style={{ width: "100%", maxWidth: 440, margin: "0 auto" }}>

            {/* Tab toggle */}
            <div role="tablist" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: `1px solid ${palette.ink}33`, marginBottom: 36 }}>
              {[
                { id: "login", label: "Sign In" },
                { id: "register", label: "Create Account" },
              ].map(t => {
                const on = mode === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setMode(t.id)}
                    role="tab"
                    aria-selected={on}
                    style={{
                      background: on ? palette.ink : "transparent",
                      color: on ? palette.cream : palette.ink,
                      border: "none", cursor: "pointer",
                      fontFamily: mono, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase",
                      padding: "16px 0",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Greeting */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase" }}>
                {isReg ? "Step 01 / 01 — your details" : "Members entrance"}
              </div>
              <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 38, color: palette.ink, margin: "10px 0 0", letterSpacing: "-0.01em" }}>
                {isReg ? "Open an account." : "Sign in."}
              </h2>
            </div>

            {/* Social */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SocialBtn palette={palette} provider="google" label={isReg ? "Sign up with Google" : "Continue with Google"} />
              <SocialBtn palette={palette} provider="apple" label={isReg ? "Sign up with Apple" : "Continue with Apple"} />
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "26px 0" }}>
              <span style={{ flex: 1, height: 1, background: `${palette.ink}22` }} />
              <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase" }}>or with email</span>
              <span style={{ flex: 1, height: 1, background: `${palette.ink}22` }} />
            </div>

            {/* Form */}
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const first = fd.get("first") || "Tornike";
              const last = fd.get("last") || "Shergelashvili";
              const email = fd.get("email") || "tornike@colchisfood.com";
              const name = isReg ? `${first} ${last}`.trim() : "Tornike Shergelashvili";
              if (window.__ch_signIn) window.__ch_signIn({ name, email: String(email) });
              window.location.href = "Account.html";
            }} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {isReg && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <Field palette={palette} label="First name" placeholder="Nino" />
                  <Field palette={palette} label="Last name" placeholder="Beridze" />
                </div>
              )}
              <Field palette={palette} label="Email address" type="email" placeholder="you@colchisfood.com" />

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase" }}>Password</label>
                  {!isReg && <a href="#" style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.16em", color: palette.accent, textDecoration: "none", textTransform: "uppercase" }}>Forgot?</a>}
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder={isReg ? "Min. 8 characters" : "••••••••"}
                    style={{ width: "100%", padding: "13px 56px 13px 14px", background: palette.cream, border: `1px solid ${palette.ink}33`, color: palette.ink, fontFamily: sans, fontSize: 14, outline: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    style={{ position: "absolute", right: 6, top: 6, bottom: 6, padding: "0 12px", background: "transparent", border: "none", cursor: "pointer", fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", color: palette.muted, textTransform: "uppercase" }}
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
                {isReg && (
                  <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                    <div style={{ flex: 1, height: 3, background: palette.accent }} />
                    <div style={{ flex: 1, height: 3, background: palette.accent2 }} />
                    <div style={{ flex: 1, height: 3, background: `${palette.ink}22` }} />
                    <div style={{ flex: 1, height: 3, background: `${palette.ink}22` }} />
                  </div>
                )}
              </div>

              {/* Remember / terms */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 2 }}>
                <button
                  type="button"
                  onClick={() => setRemember(r => !r)}
                  aria-pressed={remember}
                  style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, border: `1px solid ${palette.ink}55`, background: remember ? palette.ink : "transparent", cursor: "pointer", padding: 0, position: "relative" }}
                >
                  {remember && <span style={{ position: "absolute", inset: 0, color: palette.cream, fontSize: 12, lineHeight: "16px", textAlign: "center" }}>✓</span>}
                </button>
                <label style={{ fontFamily: sans, fontSize: 12.5, lineHeight: 1.5, color: palette.ink2 }}>
                  {isReg
                    ? <>I agree to the <a href="#" style={{ color: palette.accent, textDecoration: "underline" }}>terms</a> and the occasional dispatch about new wheels and bake days.</>
                    : <>Keep me signed in on this device.</>}
                </label>
              </div>

              <button type="submit" style={{ background: palette.ink, color: palette.cream, border: "none", padding: "18px 0", fontFamily: mono, fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", cursor: "pointer", marginTop: 6 }}>
                {isReg ? "Create my account →" : "Sign in →"}
              </button>

              {!isReg && (
                <div style={{ display: "flex", justifyContent: "center", gap: 6, fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 6 }}>
                  <span>New to Colchis?</span>
                  <button type="button" onClick={() => setMode("register")} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: palette.accent, fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", borderBottom: `1px solid ${palette.accent}` }}>Open an account</button>
                </div>
              )}
            </form>

            {/* Footnote */}
            <div style={{ marginTop: 40, paddingTop: 22, borderTop: `1px solid ${palette.ink}14`, display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 9, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>
              <span>EN / ქართული</span>
              <span>Secure · TLS 1.3</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

// ─── SHARED FIELD ──────────────────────────────────────────────────────────
function Field({ palette, label, type = "text", placeholder, defaultValue }) {
  return (
    <div>
      <label style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase", marginBottom: 8 }}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        style={{ width: "100%", padding: "13px 14px", background: palette.cream, border: `1px solid ${palette.ink}33`, color: palette.ink, fontFamily: "Inter, sans-serif", fontSize: 14, outline: "none" }}
      />
    </div>
  );
}

// ─── SOCIAL BUTTON ─────────────────────────────────────────────────────────
function SocialBtn({ palette, provider, label }) {
  const icons = {
    google: (
      <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
    ),
    apple: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={palette.ink}><path d="M17.05 12.04c-.03-3.02 2.47-4.48 2.58-4.55-1.41-2.06-3.6-2.34-4.38-2.37-1.86-.19-3.64 1.1-4.59 1.1-.95 0-2.41-1.08-3.97-1.05-2.04.03-3.92 1.19-4.97 3.01-2.12 3.67-.54 9.1 1.52 12.08 1.01 1.46 2.2 3.1 3.77 3.04 1.52-.06 2.09-.98 3.92-.98 1.83 0 2.35.98 3.95.95 1.63-.03 2.66-1.49 3.66-2.96 1.15-1.69 1.62-3.33 1.65-3.42-.04-.02-3.16-1.21-3.19-4.85zM14.31 3.27c.84-1.02 1.41-2.44 1.25-3.85-1.21.05-2.68.81-3.55 1.83-.78.9-1.46 2.34-1.28 3.73 1.36.1 2.74-.69 3.58-1.71z"/></svg>
    ),
  };
  return (
    <a href="#" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, border: `1px solid ${palette.ink}33`, background: palette.cream, padding: "13px 16px", fontFamily: "Inter, sans-serif", fontSize: 13.5, fontWeight: 500, color: palette.ink, textDecoration: "none" }}>
      {icons[provider]} {label}
    </a>
  );
}
