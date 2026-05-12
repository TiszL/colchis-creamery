/* global React */
const { useState } = React;

// ─── CART PAGE ─────────────────────────────────────────────────────────────
function CartPage({ palette }) {
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  const sans = "Inter, sans-serif";

  const [items, setItems] = useState([
    { id: "sulguni-aged", house: "Creamery", name: "Sulguni · Aged", ka: "სულგუნი", note: "Cow milk · honey-cured · 7 days · 280g", price: 18, qty: 2, badge: "Limited", ship: "Ships in 1 day" },
    { id: "adjaruli", house: "Bakery", name: "Adjaruli Khachapuri", ka: "აჭარული", note: "Boat-shape · egg yolk · butter · 520g", price: 16, qty: 1, badge: "Hot · pickup", ship: "Pickup Friday 5:30pm" },
    { id: "imeruli", house: "Creamery", name: "Imeruli", ka: "იმერული", note: "Cow milk · pulled in salted whey · 320g", price: 12, qty: 1, badge: "", ship: "Ships in 2 days" },
    { id: "adjika", house: "Pantry", name: "Adjika · Red", ka: "აჯიკა", note: "Hot red pepper paste · 120g jar · small batch", price: 9, qty: 2, badge: "", ship: "Ships in 2 days" },
  ]);
  const [code, setCode] = useState("");
  const [gift, setGift] = useState(false);

  const setQty = (id, q) => setItems(arr => arr.map(it => it.id === id ? { ...it, qty: Math.max(1, q) } : it));
  const remove = (id) => setItems(arr => arr.filter(it => it.id !== id));

  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const cellarCredit = 18; // applied loyalty credit
  const shipping = subtotal >= 75 ? 0 : 9;
  const giftFee = gift ? 4 : 0;
  const total = subtotal - cellarCredit + shipping + giftFee;
  const freeAt = 75;
  const toFree = Math.max(0, freeAt - subtotal);

  if (items.length === 0) {
    return (
      <main style={{ background: palette.cream, minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 00 — The Basket</div>
          <h1 style={{ fontFamily: serif, fontWeight: 300, fontSize: 72, color: palette.ink, margin: "16px 0 12px", lineHeight: 0.95, letterSpacing: "-0.02em" }}>The basket<br /><em style={{ color: palette.accent }}>is empty.</em></h1>
          <p style={{ fontFamily: serif, fontSize: 18, fontStyle: "italic", color: palette.ink2, opacity: 0.8, marginBottom: 28 }}>Wheels are pressing and bread is rising. Pick something up.</p>
          <a href="Creamery.html" style={{ background: palette.ink, color: palette.cream, padding: "16px 28px", fontFamily: mono, fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", textDecoration: "none" }}>Browse the shop →</a>
        </div>
      </main>
    );
  }

  return (
    <main className="ch-cart" style={{ background: palette.cream, minHeight: "100vh" }}>
      {/* ─── BANNER ─────────────────────────────────────────────────── */}
      <section style={{ background: palette.ink, color: palette.cream, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${palette.cream}06 1px, transparent 1px), linear-gradient(90deg, ${palette.cream}06 1px, transparent 1px)`, backgroundSize: "80px 80px", pointerEvents: "none" }} />
        <div className="ch-cart-banner" style={{ maxWidth: 1440, margin: "0 auto", padding: "56px 56px 36px", position: "relative" }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase" }}>
            № 00 — The Basket · {items.length} items
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18, gap: 32, flexWrap: "wrap" }}>
            <h1 className="ch-cart-h1" style={{ fontFamily: serif, fontWeight: 300, fontSize: 76, lineHeight: 0.95, letterSpacing: "-0.03em", margin: 0 }}>
              Your basket,<br /><em style={{ color: palette.accent2, fontWeight: 300 }}>fresh from the bench.</em>
            </h1>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", color: palette.cream, opacity: 0.55, textTransform: "uppercase", textAlign: "right" }}>
              Ship to · Dublin, OH 43017<br />
              <span style={{ color: palette.accent2, opacity: 1 }}>Local pickup available</span>
            </div>
          </div>

          {/* Free-shipping progress */}
          <div style={{ marginTop: 36, padding: "18px 0 0", borderTop: `1px solid ${palette.cream}22` }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", opacity: 0.8 }}>
              <span>{toFree > 0 ? <>${toFree.toFixed(0)} until free shipping</> : <span style={{ color: palette.accent2 }}>Free shipping unlocked ✓</span>}</span>
              <span>${subtotal.toFixed(0)} / ${freeAt}</span>
            </div>
            <div style={{ height: 3, background: `${palette.cream}1A`, marginTop: 10 }}>
              <div style={{ width: `${Math.min(100, (subtotal / freeAt) * 100)}%`, height: "100%", background: palette.accent }} />
            </div>
          </div>
        </div>
      </section>

      <div className="ch-cart-body" style={{ maxWidth: 1440, margin: "0 auto", padding: "56px 56px 96px", display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(0, 1fr)", gap: 48, alignItems: "flex-start" }}>

        {/* ─── ITEMS COLUMN ─────────────────────────────────────────── */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 01 — items</div>
              <h2 style={{ fontFamily: serif, fontWeight: 400, fontStyle: "italic", fontSize: 28, color: palette.ink, margin: "6px 0 0" }}>From the bench &amp; cellar</h2>
            </div>
            <a href="Creamery.html" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: palette.ink, textDecoration: "none", borderBottom: `1px solid ${palette.ink}` }}>+ Add more</a>
          </div>

          {/* Items */}
          <div style={{ background: "#fff", border: `1px solid ${palette.ink}22` }}>
            {items.map((it, i) => (
              <CartRow key={it.id} palette={palette} item={it} last={i === items.length - 1} setQty={setQty} remove={remove} />
            ))}
          </div>

          {/* Gift / notes */}
          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <label style={{ background: palette.cream2, border: `1px solid ${palette.ink}22`, padding: 22, display: "flex", gap: 14, cursor: "pointer", alignItems: "flex-start" }}>
              <input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} style={{ marginTop: 4, accentColor: palette.ink, width: 16, height: 16 }} />
              <div>
                <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 20, color: palette.ink }}>Make it a gift</div>
                <div style={{ fontFamily: sans, fontSize: 13, color: palette.ink2, opacity: 0.8, marginTop: 4, lineHeight: 1.5 }}>Letterpressed card, kraft tie, handwritten note. <span style={{ color: palette.accent }}>+$4</span></div>
              </div>
            </label>
            <div style={{ background: palette.cream2, border: `1px solid ${palette.ink}22`, padding: 22 }}>
              <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase" }}>Note to the bakers</div>
              <input type="text" placeholder="Extra adjika please." style={{ width: "100%", marginTop: 8, padding: "10px 0", background: "transparent", border: "none", borderBottom: `1px solid ${palette.ink}33`, color: palette.ink, fontFamily: serif, fontSize: 17, fontStyle: "italic", outline: "none" }} />
            </div>
          </div>

          {/* Recommended */}
          <div style={{ marginTop: 48 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 02 — Pairs well</div>
                <h2 style={{ fontFamily: serif, fontWeight: 400, fontStyle: "italic", fontSize: 28, color: palette.ink, margin: "6px 0 0" }}>From the same shelf</h2>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {[
                { name: "Tarragon Lemonade", ka: "ტარხუნა", price: "$6", note: "11oz · 6-pk", house: "Pantry" },
                { name: "Walnut & Pomegranate", ka: "ნიგვზიანი", price: "$11", note: "Spread · 180g", house: "Pantry" },
                { name: "Lobiani Loaf", ka: "ლობიანი", price: "$13", note: "Bean-filled bread · 420g", house: "Bakery" },
              ].map((p, i) => (
                <div key={i} style={{ background: "#fff", border: `1px solid ${palette.ink}22`, padding: 18, display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 72, height: 72, flexShrink: 0, background: `repeating-linear-gradient(45deg, ${palette.cream2}, ${palette.cream2} 1px, ${palette.cream} 1px, ${palette.cream} 7px)`, border: `1px solid ${palette.ink}14` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.24em", color: palette.accent, textTransform: "uppercase" }}>{p.house}</div>
                    <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 18, color: palette.ink, lineHeight: 1.15, marginTop: 4 }}>{p.name}</div>
                    <div style={{ fontFamily: sans, fontSize: 12, color: palette.muted, marginTop: 2 }}>{p.note}</div>
                  </div>
                  <button style={{ background: "transparent", border: `1px solid ${palette.ink}55`, padding: "8px 12px", fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer", color: palette.ink, whiteSpace: "nowrap" }}>+ {p.price}</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── SUMMARY COLUMN ───────────────────────────────────────── */}
        <aside className="ch-cart-summary" style={{ position: "sticky", top: 100 }}>
          <div style={{ background: "#fff", border: `1px solid ${palette.ink}22` }}>
            <div style={{ padding: "20px 28px", borderBottom: `1px solid ${palette.ink}14` }}>
              <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 03</div>
              <h3 style={{ fontFamily: serif, fontWeight: 400, fontStyle: "italic", fontSize: 26, color: palette.ink, margin: "4px 0 0" }}>The reckoning</h3>
            </div>
            <div style={{ padding: "22px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
              <SumRow palette={palette} label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
              <SumRow palette={palette} label="Cellar credit · 1840 pts" value={`−$${cellarCredit.toFixed(2)}`} accent />
              <SumRow palette={palette} label="Shipping" value={shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`} />
              {gift && <SumRow palette={palette} label="Gift wrap" value={`$${giftFee.toFixed(2)}`} />}
              <SumRow palette={palette} label="Sales tax" value="At checkout" muted />
            </div>

            <div style={{ padding: "12px 28px 20px", borderTop: `1px solid ${palette.ink}14` }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Promo code" style={{ flex: 1, padding: "12px 14px", background: palette.cream, border: `1px solid ${palette.ink}33`, color: palette.ink, fontFamily: sans, fontSize: 13, outline: "none" }} />
                <button style={{ background: "transparent", color: palette.ink, border: `1px solid ${palette.ink}`, padding: "0 18px", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Apply</button>
              </div>
            </div>

            <div style={{ padding: "18px 28px", borderTop: `1px solid ${palette.ink}22`, background: palette.cream, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase" }}>Total</div>
                <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.24em", color: palette.muted, marginTop: 4, textTransform: "uppercase" }}>USD · incl. credits</div>
              </div>
              <div style={{ fontFamily: serif, fontWeight: 400, fontSize: 44, color: palette.ink, letterSpacing: "-0.02em", lineHeight: 1 }}>${total.toFixed(2)}</div>
            </div>

            <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 10 }}>
              <a href="#" style={{ background: palette.ink, color: palette.cream, border: "none", padding: "18px 0", fontFamily: mono, fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", cursor: "pointer", textAlign: "center", textDecoration: "none" }}>Checkout →</a>
              <a href="#" style={{ background: "transparent", color: palette.ink, border: `1px solid ${palette.ink}55`, padding: "14px 0", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", textAlign: "center", textDecoration: "none" }}>Save basket for later</a>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10, fontFamily: mono, fontSize: 9, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>
                <span>Visa</span><span>·</span><span>MC</span><span>·</span><span>Amex</span><span>·</span><span>Apple Pay</span><span>·</span><span>Shop Pay</span>
              </div>
            </div>
          </div>

          {/* Promise card */}
          <div style={{ marginTop: 18, padding: 24, background: palette.cream2, border: `1px solid ${palette.ink}14` }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>Our promise</div>
            <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
              {[
                ["Cold-chain.", "Wheels ship insulated, 2-day priority."],
                ["Hot-pickup.", "Reserve a 25-min window at Tuller Rd."],
                ["The replace pledge.", "Anything not perfect on arrival — we'll re-press it."],
              ].map(([t, d], i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "baseline" }}>
                  <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>0{i + 1}</span>
                  <div>
                    <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 17, color: palette.ink }}>{t}</div>
                    <div style={{ fontFamily: sans, fontSize: 12.5, color: palette.ink2, opacity: 0.8, marginTop: 2, lineHeight: 1.55 }}>{d}</div>
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

// ─── ROW ───────────────────────────────────────────────────────────────────
function CartRow({ palette, item, last, setQty, remove }) {
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  const sans = "Inter, sans-serif";
  const line = item.price * item.qty;
  const isHot = item.badge && item.badge.toLowerCase().includes("hot");

  return (
    <div className="ch-cart-row" style={{ padding: "22px 28px", borderBottom: last ? "none" : `1px solid ${palette.ink}14`, display: "grid", gridTemplateColumns: "96px minmax(0, 1fr) auto auto", gap: 24, alignItems: "center" }}>
      {/* Image */}
      <div style={{ width: 96, height: 96, position: "relative", background: `repeating-linear-gradient(45deg, ${palette.cream2}, ${palette.cream2} 1px, ${palette.cream} 1px, ${palette.cream} 7px)`, border: `1px solid ${palette.ink}14` }}>
        <div style={{ position: "absolute", top: 6, left: 6, fontFamily: mono, fontSize: 8, letterSpacing: "0.2em", color: palette.muted, textTransform: "uppercase" }}>{item.house}</div>
        {item.badge && <div style={{ position: "absolute", bottom: 6, left: 6, padding: "3px 6px", background: isHot ? palette.accent : palette.ink, color: palette.cream, fontFamily: mono, fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase" }}>{item.badge}</div>}
      </div>

      {/* Info */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 24, color: palette.ink, lineHeight: 1.1 }}>{item.name}</span>
          <span style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 14, color: palette.ink, opacity: 0.45 }}>{item.ka}</span>
        </div>
        <div style={{ fontFamily: sans, fontSize: 13, color: palette.ink2, opacity: 0.8, marginTop: 4, lineHeight: 1.5 }}>{item.note}</div>
        <div style={{ display: "flex", gap: 14, marginTop: 10, alignItems: "center" }}>
          <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.28em", color: palette.accent, textTransform: "uppercase" }}>{item.ship}</span>
          <button onClick={() => remove(item.id)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: mono, fontSize: 9, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", borderBottom: `1px solid ${palette.muted}66` }}>Remove</button>
          <button style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: mono, fontSize: 9, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", borderBottom: `1px solid ${palette.muted}66` }}>Save for later</button>
        </div>
      </div>

      {/* Quantity stepper */}
      <div style={{ display: "flex", alignItems: "center", border: `1px solid ${palette.ink}33` }}>
        <button onClick={() => setQty(item.id, item.qty - 1)} aria-label="Decrease" style={{ width: 36, height: 36, background: "transparent", border: "none", cursor: "pointer", color: palette.ink, fontFamily: serif, fontSize: 18, padding: 0 }}>−</button>
        <input type="text" value={item.qty} onChange={(e) => setQty(item.id, Number(e.target.value.replace(/\D/g, "")) || 1)} style={{ width: 36, height: 36, border: "none", borderLeft: `1px solid ${palette.ink}22`, borderRight: `1px solid ${palette.ink}22`, textAlign: "center", background: "transparent", color: palette.ink, fontFamily: mono, fontSize: 13, outline: "none" }} />
        <button onClick={() => setQty(item.id, item.qty + 1)} aria-label="Increase" style={{ width: 36, height: 36, background: "transparent", border: "none", cursor: "pointer", color: palette.ink, fontFamily: serif, fontSize: 18, padding: 0 }}>+</button>
      </div>

      {/* Price */}
      <div style={{ textAlign: "right", minWidth: 84 }}>
        <div style={{ fontFamily: serif, fontWeight: 400, fontSize: 22, color: palette.ink }}>${line.toFixed(2)}</div>
        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 2 }}>${item.price}/ea</div>
      </div>
    </div>
  );
}

function SumRow({ palette, label, value, muted, accent }) {
  const mono = "'JetBrains Mono', monospace";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: accent ? palette.accent : muted ? palette.muted : palette.ink, fontStyle: muted ? "italic" : "normal" }}>{value}</span>
    </div>
  );
}
