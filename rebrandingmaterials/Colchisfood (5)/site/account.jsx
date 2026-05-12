/* global React */
const { useState } = React;

// ─── ACCOUNT PAGE ──────────────────────────────────────────────────────────
function AccountPage({ palette }) {
  const [tab, setTab] = useState("overview");
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  const sans = "Inter, sans-serif";

  const user = {
    name: "Nino Beridze",
    first: "Nino",
    initials: "NB",
    email: "nino.beridze@gmail.com",
    phone: "+1 (614) 555 0142",
    member: "Member since March 2024",
    tier: "Cellar Reserve",
    points: 1840,
    nextTier: 2500,
    handle: "Customer · No. 00742",
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "orders", label: "Orders" },
    { id: "addresses", label: "Addresses" },
    { id: "subscriptions", label: "Standing Orders" },
    { id: "preferences", label: "Preferences" },
    { id: "security", label: "Security" },
  ];

  return (
    <main className="ch-account" style={{ background: palette.cream, minHeight: "100vh", position: "relative" }}>
      {/* ─── BANNER ─────────────────────────────────────────────────── */}
      <section style={{ background: palette.ink, color: palette.cream, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${palette.cream}06 1px, transparent 1px), linear-gradient(90deg, ${palette.cream}06 1px, transparent 1px)`, backgroundSize: "80px 80px", pointerEvents: "none" }} />
        <div className="ch-account-banner" style={{ maxWidth: 1440, margin: "0 auto", padding: "64px 56px 48px", display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 48, alignItems: "end", position: "relative" }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase" }}>
              № 00 — The Pantry · {user.handle}
            </div>
            <h1 className="ch-account-h1" style={{ fontFamily: serif, fontWeight: 300, fontSize: 84, lineHeight: 0.95, letterSpacing: "-0.03em", margin: "18px 0 0", color: palette.cream }}>
              Welcome back,<br /><em style={{ color: palette.accent2, fontWeight: 300 }}>{user.first}.</em>
            </h1>
            <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 18, marginTop: 22, opacity: 0.78, maxWidth: 540 }}>
              Three wheels are aging for you in the cellar, your standing bread order ships Friday, and there's a fresh batch of sulguni pulled this morning.
            </p>
          </div>

          {/* Loyalty card */}
          <div style={{ background: palette.ink2, border: `1px solid ${palette.cream}22`, padding: 28, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase" }}>Tier</div>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: palette.accent, color: palette.cream, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: 15, fontWeight: 500 }}>{user.initials}</div>
            </div>
            <div style={{ fontFamily: serif, fontSize: 30, fontStyle: "italic", color: palette.cream, marginTop: 12 }}>{user.tier}</div>
            <div style={{ marginTop: 24, fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.cream, opacity: 0.55, textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
              <span>{user.points} pts</span><span>{user.nextTier} for Hearth</span>
            </div>
            <div style={{ height: 4, background: `${palette.cream}1A`, marginTop: 8 }}>
              <div style={{ width: `${(user.points / user.nextTier) * 100}%`, height: "100%", background: palette.accent }} />
            </div>
            <div style={{ marginTop: 18, fontFamily: sans, fontSize: 12.5, lineHeight: 1.55, color: palette.cream, opacity: 0.75 }}>
              660 points until Hearth — early access to seasonal bakes & a complimentary 4-month aged wheel each year.
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderTop: `1px solid ${palette.cream}1A`, position: "relative" }}>
          <div className="ch-account-tabs" style={{ maxWidth: 1440, margin: "0 auto", padding: "0 56px", display: "flex", gap: 0, overflowX: "auto" }}>
            {tabs.map(t => {
              const on = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  background: "transparent", border: "none", color: on ? palette.cream : palette.cream, opacity: on ? 1 : 0.55,
                  fontFamily: mono, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase",
                  padding: "20px 24px 22px", cursor: "pointer", borderBottom: on ? `2px solid ${palette.accent}` : "2px solid transparent", whiteSpace: "nowrap",
                }}>{t.label}</button>
              );
            })}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "56px 56px 96px" }}>
        {tab === "overview" && <OverviewTab palette={palette} user={user} setTab={setTab} />}
        {tab === "orders" && <OrdersTab palette={palette} />}
        {tab === "addresses" && <AddressesTab palette={palette} />}
        {tab === "subscriptions" && <SubscriptionsTab palette={palette} />}
        {tab === "preferences" && <PreferencesTab palette={palette} />}
        {tab === "security" && <SecurityTab palette={palette} user={user} />}
      </div>
    </main>
  );
}

// ─── OVERVIEW ──────────────────────────────────────────────────────────────
function OverviewTab({ palette, user, setTab }) {
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  const sans = "Inter, sans-serif";

  const summary = [
    { label: "Lifetime orders", value: "23", note: "since Mar '24" },
    { label: "Pantry value", value: "$1,284", note: "shipped + picked up" },
    { label: "Wheels in cellar", value: "3", note: "aging for you" },
    { label: "Next ship", value: "Fri", note: "Mar 14 · standing order" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 36 }}>
      <div>
        {/* Summary tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, border: `1px solid ${palette.ink}22`, marginBottom: 36, background: "#fff" }}>
          {summary.map((s, i) => (
            <div key={i} style={{ padding: "24px 20px", borderLeft: i === 0 ? "none" : `1px solid ${palette.ink}14` }}>
              <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>{s.label}</div>
              <div style={{ fontFamily: serif, fontSize: 38, color: palette.ink, marginTop: 6, lineHeight: 1, fontWeight: 300, letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", color: palette.accent, textTransform: "uppercase", marginTop: 8 }}>{s.note}</div>
            </div>
          ))}
        </div>

        {/* Active order banner */}
        <div style={{ background: palette.ink, color: palette.cream, padding: 28, marginBottom: 36, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase" }}>In transit · Order #CH-0742-22</div>
              <div style={{ fontFamily: serif, fontSize: 30, marginTop: 10, fontStyle: "italic" }}>Aged Sulguni Reserve · 2× wheels</div>
              <div style={{ fontFamily: sans, fontSize: 13.5, opacity: 0.8, marginTop: 6 }}>Shipped from Dublin, OH · expected Wed, Mar 12 · 9pm</div>
            </div>
            <button style={{ background: palette.accent, color: palette.cream, border: "none", padding: "12px 18px", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer", flexShrink: 0 }}>Track →</button>
          </div>
          {/* Progress */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginTop: 24 }}>
            {["Pressed", "Brined", "Shipped", "Delivered"].map((s, i) => (
              <div key={s}>
                <div style={{ height: 3, background: i <= 2 ? palette.accent : `${palette.cream}22` }} />
                <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", marginTop: 8, opacity: i <= 2 ? 1 : 0.4 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <Card palette={palette} number="01" title="Recent orders" action={{ label: "All orders →", onClick: () => setTab("orders") }}>
          <OrderRow palette={palette} id="CH-0742-22" date="Mar 09" items="2× Aged Sulguni Reserve · 1× Imeruli Khachapuri" total="$58.00" status="Shipped" />
          <OrderRow palette={palette} id="CH-0742-21" date="Feb 24" items="1× Adjaruli Khachapuri · 1× Frozen 2-pk" total="$40.00" status="Delivered" />
          <OrderRow palette={palette} id="CH-0742-20" date="Feb 02" items="3× Imeruli · 1× Adjika" total="$48.00" status="Delivered" />
          <OrderRow palette={palette} id="CH-0742-19" date="Jan 18" items="Cheese flight — winter edition" total="$72.00" status="Delivered" last />
        </Card>
      </div>

      {/* Right column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Cellar reserve */}
        <div style={{ background: palette.cream2, padding: 28, border: `1px solid ${palette.ink}14` }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ Aging for you</div>
          <div style={{ fontFamily: serif, fontSize: 30, color: palette.ink, fontStyle: "italic", marginTop: 8, lineHeight: 1.05 }}>The cellar.</div>
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { name: "Sulguni · 9-mo", date: "ready May 14", pct: 78 },
              { name: "Sulguni · 12-mo", date: "ready Sep 02", pct: 42 },
              { name: "Imeruli · honey-cured", date: "ready Apr 02", pct: 91 },
            ].map((c, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: serif, fontStyle: "italic", fontSize: 17, color: palette.ink }}>
                  <span>{c.name}</span><span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", color: palette.muted, textTransform: "uppercase" }}>{c.date}</span>
                </div>
                <div style={{ height: 2, background: `${palette.ink}1A`, marginTop: 8 }}>
                  <div style={{ width: `${c.pct}%`, height: "100%", background: palette.accent }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Standing order */}
        <div style={{ background: "#fff", padding: 28, border: `1px solid ${palette.ink}22` }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>Standing order · Active</div>
          <div style={{ fontFamily: serif, fontSize: 24, color: palette.ink, fontStyle: "italic", marginTop: 10, lineHeight: 1.15 }}>Bread &amp; cheese box, every other Friday.</div>
          <div style={{ fontFamily: sans, fontSize: 13, color: palette.ink2, marginTop: 10, lineHeight: 1.55 }}>
            2× Adjaruli (frozen) · 1× Sulguni fresh · 1× Imeruli loaf · ships to Dublin, OH 43017.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button style={btn(palette, "ghost")}>Skip next</button>
            <button style={btn(palette, "ghost")}>Edit</button>
          </div>
          <div style={{ marginTop: 18, fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase", borderTop: `1px solid ${palette.ink}14`, paddingTop: 14 }}>
            Next charge · Fri Mar 14 · $58
          </div>
        </div>

        {/* Pickup window */}
        <div style={{ background: palette.accent, color: palette.cream, padding: 28 }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", opacity: 0.85 }}>Hot now · Dublin OH</div>
          <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 26, marginTop: 8 }}>Reserve a khachapuri</div>
          <div style={{ fontFamily: sans, fontSize: 13, opacity: 0.9, marginTop: 8, lineHeight: 1.55 }}>Pickup windows open every 25 minutes from the wood-fired oven on Tuller Rd. Local zip in file.</div>
          <button style={{ marginTop: 16, background: palette.cream, color: palette.ink, border: "none", padding: "12px 18px", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Choose window →</button>
        </div>
      </div>
    </div>
  );
}

// ─── ORDERS ────────────────────────────────────────────────────────────────
function OrdersTab({ palette }) {
  const orders = [
    { id: "CH-0742-22", date: "Mar 09, 2026", items: "2× Aged Sulguni Reserve · 1× Imeruli Khachapuri", total: "$58.00", status: "Shipped" },
    { id: "CH-0742-21", date: "Feb 24, 2026", items: "1× Adjaruli Khachapuri · 1× Frozen 2-pk", total: "$40.00", status: "Delivered" },
    { id: "CH-0742-20", date: "Feb 02, 2026", items: "3× Imeruli · 1× Adjika", total: "$48.00", status: "Delivered" },
    { id: "CH-0742-19", date: "Jan 18, 2026", items: "Cheese flight — winter edition", total: "$72.00", status: "Delivered" },
    { id: "CH-0742-18", date: "Jan 04, 2026", items: "2× Sulguni · Fresh · 1× Tarragon Lemonade", total: "$32.00", status: "Delivered" },
    { id: "CH-0742-17", date: "Dec 12, 2025", items: "Holiday hamper · 6-piece", total: "$148.00", status: "Delivered" },
  ];
  return (
    <Card palette={palette} number="02" title="All orders" subtitle="23 lifetime · 1 in transit">
      {orders.map((o, i) => (
        <OrderRow key={o.id} palette={palette} id={o.id} date={o.date} items={o.items} total={o.total} status={o.status} last={i === orders.length - 1} />
      ))}
    </Card>
  );
}

// ─── ADDRESSES ─────────────────────────────────────────────────────────────
function AddressesTab({ palette }) {
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  const sans = "Inter, sans-serif";
  const addrs = [
    { tag: "Default", name: "Nino Beridze", line1: "412 Indian Run Drive", line2: "Dublin, OH 43017", country: "United States", phone: "+1 (614) 555 0142", primary: true },
    { tag: "Office", name: "Nino · c/o Forge Co.", line1: "5340 Tuller Rd, Suite 200", line2: "Dublin, OH 43017", country: "United States", phone: "+1 (614) 555 0142", primary: false },
  ];
  return (
    <Card palette={palette} number="03" title="Addresses" subtitle="Shipping and pickup" action={{ label: "+ Add address" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        {addrs.map((a, i) => (
          <div key={i} style={{ padding: 28, borderRight: i === 0 ? `1px solid ${palette.ink}14` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: a.primary ? palette.accent : palette.muted, textTransform: "uppercase" }}>{a.tag}</span>
              <div style={{ display: "flex", gap: 12, fontFamily: mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                <button style={lnk(palette)}>Edit</button>
                {!a.primary && <button style={lnk(palette)}>Remove</button>}
              </div>
            </div>
            <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 26, color: palette.ink, marginTop: 14, lineHeight: 1.15 }}>{a.name}</div>
            <div style={{ fontFamily: sans, fontSize: 14, color: palette.ink2, marginTop: 8, lineHeight: 1.6 }}>
              {a.line1}<br />{a.line2}<br />{a.country}<br /><span style={{ color: palette.muted }}>{a.phone}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── SUBSCRIPTIONS ─────────────────────────────────────────────────────────
function SubscriptionsTab({ palette }) {
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  const sans = "Inter, sans-serif";
  const subs = [
    { name: "Bread & cheese box", cadence: "Every other Friday", items: "2× Adjaruli · 1× Sulguni · 1× Imeruli loaf", next: "Mar 14", price: "$58/cycle", active: true },
    { name: "Cellar release", cadence: "Quarterly", items: "1× aged wheel from the current release", next: "May 02", price: "$84/cycle", active: true },
    { name: "Khachapuri Friday", cadence: "Weekly · local pickup", items: "1× hot Adjaruli — reserved for you", next: "Paused", price: "$16/cycle", active: false },
  ];
  return (
    <Card palette={palette} number="04" title="Standing orders" subtitle="2 active · 1 paused">
      {subs.map((s, i) => (
        <div key={i} style={{ padding: 28, borderBottom: i === subs.length - 1 ? "none" : `1px solid ${palette.ink}14`, display: "grid", gridTemplateColumns: "1.5fr 1fr auto", gap: 32, alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.active ? palette.accent : palette.muted }} />
              <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: s.active ? palette.accent : palette.muted, textTransform: "uppercase" }}>{s.active ? "Active" : "Paused"}</span>
            </div>
            <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 26, color: palette.ink, marginTop: 8 }}>{s.name}</div>
            <div style={{ fontFamily: sans, fontSize: 13, color: palette.ink2, marginTop: 4, opacity: 0.85 }}>{s.items}</div>
          </div>
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>{s.cadence}</div>
            <div style={{ fontFamily: serif, fontSize: 22, color: palette.ink, marginTop: 4 }}>{s.price}</div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", color: palette.accent, textTransform: "uppercase", marginTop: 4 }}>Next · {s.next}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn(palette, "ghost")}>{s.active ? "Pause" : "Resume"}</button>
            <button style={btn(palette, "ghost")}>Edit</button>
          </div>
        </div>
      ))}
    </Card>
  );
}

// ─── PREFERENCES ───────────────────────────────────────────────────────────
function PreferencesTab({ palette }) {
  const [prefs, setPrefs] = useState({
    newsletter: true,
    bakedays: true,
    cellar: true,
    sms: false,
    georgian: false,
    units: "us",
  });
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  const sans = "Inter, sans-serif";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      {/* Profile */}
      <Card palette={palette} number="05" title="Profile" subtitle="Your name, contact & language">
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
          <Field palette={palette} label="First name" defaultValue="Nino" />
          <Field palette={palette} label="Last name" defaultValue="Beridze" />
          <Field palette={palette} label="Email" defaultValue="nino.beridze@gmail.com" />
          <Field palette={palette} label="Phone" defaultValue="+1 (614) 555 0142" />
          <div>
            <label style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase" }}>Language</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginTop: 8, border: `1px solid ${palette.ink}33` }}>
              {[{ id: "en", l: "English" }, { id: "ka", l: "ქართული" }].map(o => {
                const on = (o.id === "ka") === prefs.georgian;
                return (
                  <button key={o.id} onClick={() => setPrefs(p => ({ ...p, georgian: o.id === "ka" }))} style={{ background: on ? palette.ink : "transparent", color: on ? palette.cream : palette.ink, border: "none", padding: "12px 0", fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer" }}>{o.l}</button>
                );
              })}
            </div>
          </div>
          <button style={{ ...btn(palette, "solid"), alignSelf: "flex-start", marginTop: 4 }}>Save profile →</button>
        </div>
      </Card>

      {/* Notifications & dietary */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <Card palette={palette} number="06" title="Dispatches" subtitle="What lands in your inbox">
          <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
            <Toggle palette={palette} on={prefs.newsletter} onChange={v => setPrefs(p => ({ ...p, newsletter: v }))} label="Monthly journal" sub="Recipes, harvest notes, the occasional essay." />
            <Toggle palette={palette} on={prefs.bakedays} onChange={v => setPrefs(p => ({ ...p, bakedays: v }))} label="Bake-day alerts" sub="The oven is hot — usually 3hr notice." />
            <Toggle palette={palette} on={prefs.cellar} onChange={v => setPrefs(p => ({ ...p, cellar: v }))} label="Cellar reserve drops" sub="Aged wheels released 4 times a year." />
            <Toggle palette={palette} on={prefs.sms} onChange={v => setPrefs(p => ({ ...p, sms: v }))} label="SMS for hot pickup" sub="Text me when my khachapuri is boxed." />
          </div>
        </Card>

        <Card palette={palette} number="07" title="Dietary notes" subtitle="Shown to the bakers">
          <div style={{ padding: 28 }}>
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase", marginBottom: 8 }}>Notes</div>
            <textarea defaultValue="No nuts in the box please — partner is allergic. Always include extra adjika." rows={4} style={{ width: "100%", padding: 14, background: palette.cream, border: `1px solid ${palette.ink}33`, color: palette.ink, fontFamily: sans, fontSize: 14, lineHeight: 1.55, outline: "none", resize: "vertical" }} />
            <button style={{ ...btn(palette, "solid"), marginTop: 14 }}>Save notes →</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── SECURITY ──────────────────────────────────────────────────────────────
function SecurityTab({ palette, user }) {
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  const sans = "Inter, sans-serif";
  const sessions = [
    { device: "MacBook Pro · Safari", where: "Dublin, OH", time: "Active now", current: true },
    { device: "iPhone 15 · Colchis app", where: "Dublin, OH", time: "12 min ago", current: false },
    { device: "Chrome · Windows", where: "Columbus, OH", time: "3 days ago", current: false },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <Card palette={palette} number="08" title="Password" subtitle="Last changed 6 months ago">
          <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <Field palette={palette} label="Current password" type="password" placeholder="••••••••" />
            <Field palette={palette} label="New password" type="password" placeholder="Min. 8 characters" />
            <Field palette={palette} label="Confirm new password" type="password" placeholder="Repeat new" />
            <button style={{ ...btn(palette, "solid"), alignSelf: "flex-start", marginTop: 4 }}>Update password →</button>
          </div>
        </Card>

        <Card palette={palette} number="09" title="Two-factor" subtitle="Authenticator app · Enabled">
          <div style={{ padding: 28, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
            <div>
              <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 22, color: palette.ink }}>1Password · enrolled Apr 2025</div>
              <div style={{ fontFamily: sans, fontSize: 13, color: palette.ink2, opacity: 0.8, marginTop: 4 }}>You'll be asked for a 6-digit code at every new sign-in.</div>
            </div>
            <button style={btn(palette, "ghost")}>Regenerate codes</button>
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <Card palette={palette} number="10" title="Active sessions" subtitle="Sign out devices you don't recognize">
          {sessions.map((s, i) => (
            <div key={i} style={{ padding: "20px 28px", borderBottom: i === sessions.length - 1 ? "none" : `1px solid ${palette.ink}14`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 20, color: palette.ink }}>{s.device}</div>
                <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase", marginTop: 4 }}>{s.where} · {s.time}</div>
              </div>
              {s.current
                ? <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.28em", color: palette.accent, textTransform: "uppercase" }}>This device</span>
                : <button style={lnk(palette)}>Sign out</button>}
            </div>
          ))}
        </Card>

        <Card palette={palette} number="11" title="Danger" subtitle="Account closure">
          <div style={{ padding: 28 }}>
            <div style={{ fontFamily: sans, fontSize: 13.5, color: palette.ink2, lineHeight: 1.6 }}>Close your account and we'll fulfill any open standing orders, then erase your file. This cannot be undone.</div>
            <button style={{ ...btn(palette, "ghost"), marginTop: 16, borderColor: "#A8312C", color: "#A8312C" }}>Close account</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── ATOMS ─────────────────────────────────────────────────────────────────
function Card({ palette, number, title, subtitle, action, children }) {
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  return (
    <div style={{ background: "#fff", border: `1px solid ${palette.ink}22`, marginBottom: 0 }}>
      <div style={{ padding: "20px 28px", borderBottom: `1px solid ${palette.ink}14`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ {number}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 4 }}>
            <h3 style={{ fontFamily: serif, fontWeight: 400, fontSize: 22, color: palette.ink, margin: 0, fontStyle: "italic" }}>{title}</h3>
            {subtitle && <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>{subtitle}</span>}
          </div>
        </div>
        {action && (
          <button onClick={action.onClick} style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", color: palette.ink, textTransform: "uppercase", borderBottom: `1px solid ${palette.ink}` }}>{action.label}</button>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function OrderRow({ palette, id, date, items, total, status, last }) {
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  const sans = "Inter, sans-serif";
  const statusColor = status === "Shipped" ? palette.accent : status === "Delivered" ? palette.ink : palette.muted;
  return (
    <div style={{ padding: "20px 28px", borderBottom: last ? "none" : `1px solid ${palette.ink}14`, display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 24, alignItems: "center" }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>{id}</div>
      <div>
        <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 17, color: palette.ink, lineHeight: 1.3 }}>{items}</div>
        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 4 }}>{date}</div>
      </div>
      <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.28em", color: statusColor, textTransform: "uppercase", border: `1px solid ${statusColor}55`, padding: "5px 10px" }}>{status}</span>
      <span style={{ fontFamily: serif, fontSize: 20, color: palette.ink, fontWeight: 500 }}>{total}</span>
      <a href="#" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", color: palette.ink, textTransform: "uppercase", textDecoration: "none", borderBottom: `1px solid ${palette.ink}` }}>View →</a>
    </div>
  );
}

function Toggle({ palette, on, onChange, label, sub }) {
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  const sans = "Inter, sans-serif";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18 }}>
      <div>
        <div style={{ fontFamily: serif, fontSize: 18, color: palette.ink, fontStyle: "italic" }}>{label}</div>
        <div style={{ fontFamily: sans, fontSize: 13, color: palette.ink2, opacity: 0.75, marginTop: 2 }}>{sub}</div>
      </div>
      <button onClick={() => onChange(!on)} aria-pressed={on} style={{ flexShrink: 0, width: 46, height: 26, background: on ? palette.ink : `${palette.ink}22`, border: "none", cursor: "pointer", padding: 0, position: "relative", transition: "background 200ms" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, background: on ? palette.accent : palette.cream, transition: "left 200ms" }} />
      </button>
    </div>
  );
}

function btn(palette, variant) {
  const mono = "'JetBrains Mono', monospace";
  if (variant === "solid") {
    return { background: palette.ink, color: palette.cream, border: "none", padding: "12px 20px", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" };
  }
  return { background: "transparent", color: palette.ink, border: `1px solid ${palette.ink}55`, padding: "10px 16px", fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer" };
}

function lnk(palette) {
  return { background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.accent, textTransform: "uppercase" };
}
