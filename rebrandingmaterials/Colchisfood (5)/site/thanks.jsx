/* global React */
const { useState, useEffect } = React;

// ─── THANK YOU / ORDER CONFIRMATION ────────────────────────────────────────
function ThankYouPage({ palette }) {
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  const sans = "Inter, sans-serif";

  const order = {
    id: "CH-0742-23",
    placed: "Today · 10:42 AM",
    name: "Nino",
    email: "nino.beridze@gmail.com",
    ship: {
      method: "Cold-chain · 2-day priority",
      eta: "Wed, Mar 12",
      window: "by 9pm",
      addr: ["Nino Beridze", "412 Indian Run Drive", "Dublin, OH 43017"],
    },
    pickup: { where: "5340 Tuller Rd, Dublin OH", when: "Fri, Mar 14 · 5:30–5:55pm" },
    items: [
      { house: "Creamery", name: "Sulguni · Aged", ka: "სულგუნი", qty: 2, price: 18, note: "Cow milk · honey-cured · 7 days · 280g" },
      { house: "Bakery", name: "Adjaruli Khachapuri", ka: "აჭარული", qty: 1, price: 16, note: "Boat-shape · egg yolk · butter · 520g" },
      { house: "Creamery", name: "Imeruli", ka: "იმერული", qty: 1, price: 12, note: "Cow milk · pulled in salted whey · 320g" },
      { house: "Pantry", name: "Adjika · Red", ka: "აჯიკა", qty: 2, price: 9, note: "Hot red pepper paste · 120g · small batch" },
    ],
    subtotal: 82,
    credit: 18,
    shipping: 0,
    gift: 4,
    tax: 5.34,
    total: 73.34,
    card: "Visa · •• 4421",
  };

  // Tiny confetti — a slow drift of muted color dots
  const [drops] = useState(() => Array.from({ length: 18 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 4,
    duration: 8 + Math.random() * 6,
    size: 4 + Math.random() * 6,
    color: [palette.accent, palette.accent2, palette.cream2][i % 3],
  })));

  return (
    <main className="ch-thanks" style={{ background: palette.cream, minHeight: "100vh" }}>
      {/* ─── HERO ───────────────────────────────────────────────────── */}
      <section style={{ background: palette.ink, color: palette.cream, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${palette.cream}06 1px, transparent 1px), linear-gradient(90deg, ${palette.cream}06 1px, transparent 1px)`, backgroundSize: "80px 80px", pointerEvents: "none" }} />

        {/* drift dots */}
        <style>{`@keyframes ch-drift { 0% { transform: translateY(-40px); opacity: 0 } 10% { opacity: .9 } 90% { opacity: .9 } 100% { transform: translateY(110%); opacity: 0 } }`}</style>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          {drops.map((d, i) => (
            <span key={i} style={{ position: "absolute", top: 0, left: `${d.left}%`, width: d.size, height: d.size, background: d.color, opacity: 0.7, animation: `ch-drift ${d.duration}s linear ${d.delay}s infinite` }} />
          ))}
        </div>

        <div className="ch-thanks-hero" style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 56px 64px", position: "relative", textAlign: "center" }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase" }}>
            № 00 — Order received · {order.id}
          </div>
          <h1 className="ch-thanks-h1" style={{ fontFamily: serif, fontWeight: 300, fontSize: 112, lineHeight: 0.92, letterSpacing: "-0.03em", margin: "22px 0 0" }}>
            Thank&nbsp;you,<br /><em style={{ color: palette.accent2, fontWeight: 300 }}>{order.name}.</em>
          </h1>
          <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 22, marginTop: 26, maxWidth: 640, marginLeft: "auto", marginRight: "auto", opacity: 0.82, lineHeight: 1.5 }}>
            The bakers have the docket. Wheels are being pulled from brine, the oven's heating, and a receipt is on its way to {order.email}.
          </p>

          <div style={{ marginTop: 36, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase" }}>
            <a href="#" style={{ background: palette.accent, color: palette.cream, padding: "14px 24px", textDecoration: "none" }}>Track order →</a>
            <a href="Account.html" style={{ background: "transparent", color: palette.cream, padding: "14px 24px", textDecoration: "none", border: `1px solid ${palette.cream}55` }}>View in pantry</a>
            <a href="Creamery.html" style={{ background: "transparent", color: palette.cream, padding: "14px 24px", textDecoration: "none", border: `1px solid ${palette.cream}55` }}>Keep shopping</a>
          </div>
        </div>
      </section>

      {/* ─── BODY ───────────────────────────────────────────────────── */}
      <div className="ch-thanks-body" style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 56px 96px", display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 48, alignItems: "flex-start" }}>

        {/* LEFT */}
        <div>
          {/* Progress */}
          <Card palette={palette} number="01" title="What happens next" subtitle="Four steps · roughly 36 hours">
            <div style={{ padding: 28 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {[
                  { label: "Pressed", note: "Today · 11 am", active: true, done: true },
                  { label: "Brined", note: "Tonight · 8 pm", active: true, done: false },
                  { label: "Shipped", note: "Tue · 9 am", active: false, done: false },
                  { label: "Delivered", note: "Wed · 9 pm", active: false, done: false },
                ].map((s, i) => (
                  <div key={s.label}>
                    <div style={{ height: 3, background: s.active ? palette.accent : `${palette.ink}1A` }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", border: `1px solid ${s.active ? palette.accent : `${palette.ink}33`}`, background: s.done ? palette.accent : "transparent", flexShrink: 0, position: "relative" }}>
                        {s.done && <span style={{ position: "absolute", inset: 0, color: palette.cream, fontSize: 11, lineHeight: "14px", textAlign: "center" }}>✓</span>}
                      </span>
                      <div>
                        <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 17, color: palette.ink }}>{s.label}</div>
                        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", color: palette.muted, textTransform: "uppercase", marginTop: 2 }}>{s.note}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Items */}
          <div style={{ marginTop: 28 }}>
            <Card palette={palette} number="02" title="In your order" subtitle={`${order.items.length} items · ${order.items.reduce((s, i) => s + i.qty, 0)} units`}>
              {order.items.map((it, i) => (
                <div key={i} style={{ padding: "20px 28px", borderBottom: i === order.items.length - 1 ? "none" : `1px solid ${palette.ink}14`, display: "grid", gridTemplateColumns: "72px minmax(0, 1fr) auto auto", gap: 20, alignItems: "center" }} className="ch-thanks-row">
                  <div style={{ width: 72, height: 72, position: "relative", background: `repeating-linear-gradient(45deg, ${palette.cream2}, ${palette.cream2} 1px, ${palette.cream} 1px, ${palette.cream} 7px)`, border: `1px solid ${palette.ink}14` }}>
                    <div style={{ position: "absolute", top: 5, left: 5, fontFamily: mono, fontSize: 8, letterSpacing: "0.2em", color: palette.muted, textTransform: "uppercase" }}>{it.house}</div>
                  </div>
                  <div>
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                      <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 21, color: palette.ink, lineHeight: 1.1 }}>{it.name}</span>
                      <span style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 13, color: palette.ink, opacity: 0.45 }}>{it.ka}</span>
                    </div>
                    <div style={{ fontFamily: sans, fontSize: 13, color: palette.ink2, opacity: 0.8, marginTop: 4, lineHeight: 1.5 }}>{it.note}</div>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>× {it.qty}</div>
                  <div style={{ fontFamily: serif, fontSize: 19, color: palette.ink }}>${(it.price * it.qty).toFixed(2)}</div>
                </div>
              ))}
            </Card>
          </div>

          {/* Reckoning */}
          <div style={{ marginTop: 28 }}>
            <Card palette={palette} number="03" title="The reckoning" subtitle={`Charged to ${order.card}`}>
              <div style={{ padding: "22px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
                <Row palette={palette} l="Subtotal" v={`$${order.subtotal.toFixed(2)}`} />
                <Row palette={palette} l="Cellar credit" v={`−$${order.credit.toFixed(2)}`} color={palette.accent} />
                <Row palette={palette} l="Shipping · cold-chain" v={order.shipping === 0 ? "Free" : `$${order.shipping.toFixed(2)}`} />
                <Row palette={palette} l="Gift wrap" v={`$${order.gift.toFixed(2)}`} />
                <Row palette={palette} l="Sales tax · OH" v={`$${order.tax.toFixed(2)}`} />
              </div>
              <div style={{ padding: "18px 28px", borderTop: `1px solid ${palette.ink}22`, background: palette.cream, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase" }}>Total paid</div>
                <div style={{ fontFamily: serif, fontSize: 38, color: palette.ink, letterSpacing: "-0.02em", lineHeight: 1 }}>${order.total.toFixed(2)}</div>
              </div>
            </Card>
          </div>
        </div>

        {/* RIGHT */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Shipping */}
          <div style={{ background: "#fff", border: `1px solid ${palette.ink}22`, padding: 26 }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>Cold-chain dispatch</div>
            <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 26, color: palette.ink, marginTop: 6 }}>{order.ship.eta}</div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase", marginTop: 4 }}>{order.ship.window} · {order.ship.method}</div>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${palette.ink}14`, fontFamily: sans, fontSize: 13.5, color: palette.ink2, lineHeight: 1.65 }}>
              {order.ship.addr.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>

          {/* Pickup */}
          <div style={{ background: palette.accent, color: palette.cream, padding: 26 }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", opacity: 0.85, textTransform: "uppercase" }}>Hot pickup · reserved</div>
            <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 26, marginTop: 6 }}>{order.pickup.when}</div>
            <div style={{ fontFamily: sans, fontSize: 13.5, opacity: 0.92, marginTop: 8, lineHeight: 1.55 }}>{order.pickup.where}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <a href="#" style={{ background: palette.cream, color: palette.ink, padding: "10px 14px", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Add to calendar</a>
              <a href="#" style={{ background: "transparent", color: palette.cream, padding: "10px 14px", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none", border: `1px solid ${palette.cream}88` }}>Directions</a>
            </div>
          </div>

          {/* Loyalty earned */}
          <div style={{ background: palette.cream2, border: `1px solid ${palette.ink}14`, padding: 26 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>Cellar reserve</div>
              <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 22, color: palette.ink }}>+74 pts</div>
            </div>
            <div style={{ fontFamily: serif, fontSize: 22, color: palette.ink, marginTop: 8, lineHeight: 1.25 }}>You're 586 points from <em style={{ color: palette.accent }}>Hearth.</em></div>
            <div style={{ height: 3, background: `${palette.ink}1A`, marginTop: 14 }}>
              <div style={{ width: "76%", height: "100%", background: palette.accent }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: mono, fontSize: 9, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>
              <span>1914 pts</span><span>2500 pts</span>
            </div>
          </div>

          {/* Help */}
          <div style={{ background: "#fff", border: `1px solid ${palette.ink}22`, padding: 26 }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>Something off?</div>
            <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 22, color: palette.ink, marginTop: 6 }}>We'll re-press it.</div>
            <div style={{ fontFamily: sans, fontSize: 13, color: palette.ink2, opacity: 0.85, marginTop: 8, lineHeight: 1.6 }}>
              You have 60 minutes to edit or cancel before the bakers start. After that, our replace pledge stands — anything not perfect on arrival, we'll send a fresh one.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button style={{ background: "transparent", border: `1px solid ${palette.ink}`, color: palette.ink, padding: "10px 14px", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Edit order</button>
              <button style={{ background: "transparent", border: `1px solid ${palette.ink}33`, color: palette.muted, padding: "10px 14px", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Contact us</button>
            </div>
          </div>
        </aside>
      </div>

      {/* ─── EDITORIAL FOOTER ────────────────────────────────────────── */}
      <section style={{ borderTop: `1px solid ${palette.ink}14`, background: palette.cream2 }}>
        <div className="ch-thanks-after" style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 56px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 36 }}>
          {[
            { n: "i.", t: "Bake a hot khachapuri", d: "While you wait — our 18-minute frozen Adjaruli recipe.", cta: "Read recipe", href: "Recipe.html" },
            { n: "ii.", t: "The road to the cellar", d: "How sulguni gets pressed in Dublin, OH, the long way.", cta: "Read the story", href: "Articles.html" },
            { n: "iii.", t: "Tell a friend", d: "Give them $10 off; we'll add $10 to your cellar credit.", cta: "Copy your link" },
          ].map((c, i) => (
            <div key={i}>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>{c.n}</div>
              <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 28, color: palette.ink, marginTop: 10, lineHeight: 1.15 }}>{c.t}</div>
              <div style={{ fontFamily: sans, fontSize: 14, color: palette.ink2, opacity: 0.8, marginTop: 8, lineHeight: 1.55 }}>{c.d}</div>
              <a href={c.href || "#"} style={{ display: "inline-block", marginTop: 14, fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", color: palette.ink, textTransform: "uppercase", textDecoration: "none", borderBottom: `1px solid ${palette.ink}` }}>{c.cta} →</a>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Card({ palette, number, title, subtitle, children }) {
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  return (
    <div style={{ background: "#fff", border: `1px solid ${palette.ink}22` }}>
      <div style={{ padding: "18px 28px", borderBottom: `1px solid ${palette.ink}14` }}>
        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ {number}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
          <h3 style={{ fontFamily: serif, fontWeight: 400, fontStyle: "italic", fontSize: 22, color: palette.ink, margin: 0 }}>{title}</h3>
          {subtitle && <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>{subtitle}</span>}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ palette, l, v, color }) {
  const mono = "'JetBrains Mono', monospace";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>{l}</span>
      <span style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: color || palette.ink }}>{v}</span>
    </div>
  );
}
