/* global React, ColchisSeal */
const { useState } = React;

// ─── Cheese product illustrations (typographic, no photos) ─────────────
function CheeseVisual({ kind, palette }) {
  // kind: 'wheel' | 'aged' | 'slab' | 'block' | 'pouch' | 'bag'
  const base = palette.cream2;
  const ink = palette.ink;
  const accent = palette.accent;
  const cream = palette.cream;
  const subtle = ink + "14";

  if (kind === "wheel") {
    return (
      <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%", display: "block", background: base }}>
        <defs>
          <radialGradient id="wheelG" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#FBF6EA" />
            <stop offset="100%" stopColor="#E9DFC6" />
          </radialGradient>
        </defs>
        {/* paper wrap shadow */}
        <ellipse cx="200" cy="240" rx="120" ry="14" fill={ink} opacity="0.12" />
        {/* paper wrap base */}
        <rect x="92" y="120" width="216" height="120" rx="6" fill={cream} stroke={subtle} />
        {/* paper twist top */}
        <path d="M92 120 Q100 100 130 100 L270 100 Q300 100 308 120" fill={cream} stroke={subtle} />
        {/* belly band */}
        <rect x="92" y="170" width="216" height="34" fill={accent} opacity="0.92" />
        <text x="200" y="192" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="10" letterSpacing="0.32em" fill={cream}>SULGUNI · FRESH</text>
        {/* seal mark */}
        <circle cx="200" cy="138" r="14" fill="none" stroke={cream} strokeWidth="1.2" />
        <text x="200" y="142" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="14" fill={cream}>cf</text>
        {/* batch tag */}
        <text x="200" y="225" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" letterSpacing="0.28em" fill={ink} opacity="0.7">340G · BATCH 12-A</text>
      </svg>
    );
  }
  if (kind === "aged") {
    return (
      <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%", display: "block", background: base }}>
        <ellipse cx="200" cy="245" rx="115" ry="12" fill={ink} opacity="0.14" />
        {/* honey drip cracks */}
        <path d="M120 80 L150 60 L195 50 L255 55 L290 78" stroke={accent} strokeWidth="2" fill="none" opacity="0.7" strokeLinecap="round" />
        {/* aged wheel */}
        <ellipse cx="200" cy="170" rx="115" ry="70" fill="url(#agedG)" stroke={ink} strokeWidth="1" opacity="0.95" />
        <defs>
          <radialGradient id="agedG" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#F2E3BE" />
            <stop offset="100%" stopColor="#C8A66A" />
          </radialGradient>
        </defs>
        {/* honey drizzle */}
        <path d="M150 130 Q160 145 155 165 Q150 180 165 195 Q172 205 168 220" stroke={accent} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M230 115 Q240 130 235 155 Q230 175 250 195" stroke={accent} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85" />
        <circle cx="168" cy="222" r="4" fill={accent} />
        <circle cx="250" cy="197" r="4" fill={accent} />
        {/* stamp */}
        <circle cx="200" cy="170" r="22" fill="none" stroke={ink} strokeWidth="0.8" opacity="0.55" />
        <text x="200" y="167" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="7" letterSpacing="0.32em" fill={ink} opacity="0.7">AGED · 7D</text>
        <text x="200" y="180" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="11" fill={ink} opacity="0.85">honey</text>
      </svg>
    );
  }
  if (kind === "slab") {
    return (
      <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%", display: "block", background: base }}>
        <ellipse cx="200" cy="248" rx="130" ry="10" fill={ink} opacity="0.12" />
        {/* vacuum slab — flat pillow */}
        <path d="M80 130 Q80 110 110 110 L290 110 Q320 110 320 130 L320 230 Q320 250 290 250 L110 250 Q80 250 80 230 Z" fill={cream} stroke={subtle} />
        {/* label panel */}
        <rect x="120" y="148" width="160" height="84" fill={ink} />
        <text x="200" y="170" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" letterSpacing="0.32em" fill={accent}>SULGUNI · SLAB</text>
        <text x="200" y="195" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="22" fill={cream}>500g</text>
        <line x1="140" y1="208" x2="260" y2="208" stroke={cream} strokeWidth="0.5" opacity="0.4" />
        <text x="200" y="222" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="7" letterSpacing="0.32em" fill={cream} opacity="0.7">VAC · 30 DAYS</text>
        {/* vacuum seal lines */}
        <line x1="85" y1="180" x2="100" y2="180" stroke={subtle} strokeWidth="1" />
        <line x1="300" y1="180" x2="315" y2="180" stroke={subtle} strokeWidth="1" />
      </svg>
    );
  }
  if (kind === "block") {
    return (
      <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%", display: "block", background: base }}>
        <ellipse cx="200" cy="252" rx="135" ry="10" fill={ink} opacity="0.16" />
        {/* large block with depth */}
        <path d="M80 90 L320 90 L350 110 L350 250 L110 250 L80 230 Z" fill={cream} stroke={subtle} />
        <path d="M320 90 L350 110 L350 250 L320 230 Z" fill={ink} opacity="0.08" />
        <path d="M80 90 L320 90 L350 110 L110 110 Z" fill={ink} opacity="0.04" />
        {/* large stamp band */}
        <rect x="105" y="145" width="210" height="64" fill={accent} />
        <text x="210" y="172" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="9" letterSpacing="0.36em" fill={cream}>FOODSERVICE</text>
        <text x="210" y="198" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="26" fill={cream}>5 kg</text>
        <text x="200" y="232" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" letterSpacing="0.3em" fill={ink} opacity="0.7">SULGUNI · BULK BLOCK</text>
      </svg>
    );
  }
  if (kind === "pouch") {
    return (
      <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%", display: "block", background: base }}>
        <ellipse cx="200" cy="252" rx="100" ry="9" fill={ink} opacity="0.14" />
        {/* stand-up pouch */}
        <path d="M125 70 L275 70 Q295 70 295 95 L295 245 Q295 252 290 252 L110 252 Q105 252 105 245 L105 95 Q105 70 125 70 Z" fill={cream} stroke={subtle} />
        {/* top zipper */}
        <line x1="115" y1="84" x2="285" y2="84" stroke={ink} strokeWidth="2" opacity="0.4" />
        <line x1="115" y1="90" x2="285" y2="90" stroke={ink} strokeWidth="0.5" opacity="0.4" />
        {/* label */}
        <rect x="130" y="110" width="140" height="125" fill={ink} />
        <text x="200" y="132" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="7" letterSpacing="0.32em" fill={accent}>SHREDDED</text>
        <text x="200" y="165" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="22" fill={cream}>Imeruli</text>
        <text x="200" y="184" textAnchor="middle" fontFamily="'Noto Serif Georgian', serif" fontSize="13" fill={cream} opacity="0.7">დაჩეჩილი</text>
        <line x1="150" y1="200" x2="250" y2="200" stroke={cream} strokeWidth="0.5" opacity="0.4" />
        <text x="200" y="218" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="7" letterSpacing="0.32em" fill={cream} opacity="0.8">500 g · RESEALABLE</text>
      </svg>
    );
  }
  if (kind === "bag") {
    return (
      <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%", display: "block", background: base }}>
        <ellipse cx="200" cy="252" rx="135" ry="10" fill={ink} opacity="0.16" />
        {/* large foodservice bag */}
        <path d="M90 70 L310 70 L320 88 L320 250 L80 250 L80 88 Z" fill={cream} stroke={subtle} />
        <path d="M310 70 L320 88 L320 250 L310 232 Z" fill={ink} opacity="0.06" />
        {/* tape seal */}
        <rect x="90" y="74" width="220" height="14" fill={ink} opacity="0.7" />
        {/* label */}
        <rect x="115" y="115" width="170" height="120" fill={accent} />
        <text x="200" y="138" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" letterSpacing="0.34em" fill={cream}>SHREDDED IMERULI</text>
        <text x="200" y="178" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="40" fill={cream}>5 kg</text>
        <line x1="140" y1="195" x2="260" y2="195" stroke={cream} strokeWidth="0.5" opacity="0.5" />
        <text x="200" y="215" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" letterSpacing="0.3em" fill={cream}>FOODSERVICE · NSF</text>
      </svg>
    );
  }
  return null;
}

// ─── CREAMERY HERO ─────────────────────────────────────────────────────
function CreameryHero({ palette }) {
  return (
    <section className="ch-section ch-cm-hero" style={{ background: palette.cream, color: palette.ink, padding: "100px 56px 80px", borderBottom: `1px solid ${palette.ink}22` }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 56, alignItems: "end" }} className="ch-cm-hero-grid">
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 24 }}>House No 01 · The Creamery · ყველის სახლი</div>
          <h1 className="ch-cm-h1" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 104, lineHeight: 0.94, letterSpacing: "-0.025em", margin: 0, color: palette.ink }}>
            Cheese made <em style={{ color: palette.accent, fontWeight: 300 }}>this morning.</em>
          </h1>
          <p style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 21, lineHeight: 1.55, color: palette.ink2, margin: "28px 0 0", maxWidth: 560 }}>
            Sulguni and Imeruli, hand-pulled in salted whey from the milk of three small Ohio dairies. The recipe is two thousand years old; the cheese is six hours old.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, borderBottom: `1px solid ${palette.ink}22` }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 56, fontWeight: 300, color: palette.accent, lineHeight: 1, letterSpacing: "-0.03em" }}>6h</div>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 15, color: palette.ink2, lineHeight: 1.35 }}>From milk truck to brine bath. No cheese sits overnight.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, borderBottom: `1px solid ${palette.ink}22` }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 56, fontWeight: 300, color: palette.accent, lineHeight: 1, letterSpacing: "-0.03em" }}>3</div>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 15, color: palette.ink2, lineHeight: 1.35 }}>Family dairies in Ohio, within four hours of milking.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 56, fontWeight: 300, color: palette.accent, lineHeight: 1, letterSpacing: "-0.03em" }}>100%</div>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 15, color: palette.ink2, lineHeight: 1.35 }}>Cow milk. Pasteurized, microbial rennet, no shortcuts.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── PRODUCT SHOP (full cheese D2C grid w/ visuals + tabs) ─────────────
function CreameryShop({ palette }) {
  const [tab, setTab] = useState("retail");
  const items = {
    retail: [
      { kind: "wheel", name: "Sulguni · Fresh", ka: "სულგუნი", desc: "The classic — milky, springy, salt-bright. Pulled this morning, brined six hours.", weight: "340g · paper-wrapped wheel", price: "$14", tag: "Fresh today", state: "primary" },
      { kind: "aged", name: "Aged Sulguni · Honey", ka: "სულგუნი ნაცადი", desc: "Seven days in cold brine, finished with raw Ohio wildflower honey. Caramel & cultured cream.", weight: "280g · stamped round", price: "$18", tag: "Limited", state: "limited" },
      { kind: "slab", name: "Sulguni · Vacuum Slab", ka: "სულგუნი", desc: "Same cheese, vacuum-sealed for 30-day fridge life. The everyday block.", weight: "500g · vacuum-sealed", price: "$22", tag: "Best value", state: "primary" },
      { kind: "pouch", name: "Shredded Imeruli", ka: "დაჩეჩილი იმერული", desc: "Hand-shredded the morning of shipping. Khachapuri-ready, salad-ready, omelette-ready.", weight: "500g · resealable pouch", price: "$16", tag: "", state: "primary" },
      { kind: "wheel", name: "Imeruli · Fresh", ka: "იმერული", desc: "Younger, milder, drier than Sulguni — the cheese inside every khachapuri.", weight: "320g · paper-wrapped round", price: "$12", tag: "Fresh today", state: "primary" },
      { kind: "block", name: "Sulguni · Foodservice", ka: "სულგუნი", desc: "Restaurant-size block for cafés, pizzerias, and serious home cooks.", weight: "5 kg · foodservice block", price: "$98", tag: "Wholesale OK", state: "bulk" },
    ],
    bulk: [
      { kind: "block", name: "Sulguni · 5kg Block", ka: "სულგუნი", desc: "Hand-pulled, brined, vacuum-sealed. Restaurant pricing on case-quantity orders.", weight: "5 kg block · case of 4", price: "$98 ea", tag: "Wholesale", state: "bulk" },
      { kind: "bag", name: "Shredded Imeruli · 5kg", ka: "დაჩეჩილი", desc: "Daily-shredded, bagged for kitchens. Ships fresh on Mondays only.", weight: "5 kg bag · case of 2", price: "$78 ea", tag: "Wholesale", state: "bulk" },
      { kind: "slab", name: "Sulguni Slab · 12-pack", ka: "სულგუნი", desc: "Twelve 500g vacuum slabs — for grocery shelves and cheese counters.", weight: "12 × 500g case", price: "$215 case", tag: "Wholesale", state: "bulk" },
      { kind: "pouch", name: "Shredded Imeruli · 24-pack", ka: "დაჩეჩილი", desc: "Twenty-four 500g resealable pouches. The grocery starter case.", weight: "24 × 500g case", price: "$340 case", tag: "Wholesale", state: "bulk" },
    ],
  };

  return (
    <section className="ch-section" style={{ background: palette.cream, padding: "120px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 56 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 01 — The Shop</div>
            <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", color: palette.ink, marginTop: 14 }}>
              Six cheeses, <em style={{ color: palette.accent, fontWeight: 400 }}>two ways to buy.</em>
            </div>
          </div>
          <div className="ch-tab-row" style={{ display: "flex", gap: 0, border: `1px solid ${palette.ink}44` }}>
            <button onClick={() => setTab("retail")} style={{ padding: "14px 26px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", background: tab === "retail" ? palette.ink : "transparent", color: tab === "retail" ? palette.cream : palette.ink, border: "none", cursor: "pointer" }}>◐ Retail</button>
            <button onClick={() => setTab("bulk")} style={{ padding: "14px 26px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", background: tab === "bulk" ? palette.ink : "transparent", color: tab === "bulk" ? palette.cream : palette.ink, border: "none", cursor: "pointer", borderLeft: `1px solid ${palette.ink}44` }}>▸ Foodservice · Bulk</button>
          </div>
        </div>
        <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {items[tab].map((p, i) => (
            <a key={i} href="Product - Aged Sulguni Reserve.html" style={{ textDecoration: "none", color: "inherit", background: palette.cream2, border: `1px solid ${palette.ink}14`, display: "flex", flexDirection: "column" }}>
              <div style={{ aspectRatio: "4/3", position: "relative", borderBottom: `1px solid ${palette.ink}14` }}>
                <CheeseVisual kind={p.kind} palette={palette} />
                {p.tag && <div style={{ position: "absolute", top: 16, left: 16, padding: "6px 12px", background: p.state === "limited" ? palette.accent : p.state === "bulk" ? palette.ink2 : palette.ink, color: palette.cream, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase" }}>{p.tag}</div>}
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 26, color: palette.ink, lineHeight: 1.05 }}>{p.name}</div>
                    <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 14, color: palette.ink, opacity: 0.5, marginTop: 4 }}>{p.ka}</div>
                  </div>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: palette.accent, fontWeight: 500 }}>{p.price}</div>
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: palette.ink2, lineHeight: 1.55, marginTop: 12 }}>{p.desc}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: palette.muted, textTransform: "uppercase", marginTop: 14 }}>{p.weight}</div>
                <div style={{ marginTop: "auto", paddingTop: 18 }}>
                  <div style={{ width: "100%", background: tab === "retail" ? palette.accent : palette.ink, color: palette.cream, padding: "12px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", textAlign: "center" }}>
                    {tab === "retail" ? "Add to cart →" : "Request quote →"}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── TODAY'S BATCH (live availability strip — short) ───────────────────
function CreameryBatch({ palette }) {
  const items = [
    { name: "Sulguni · Fresh", batch: "12-A", made: "Today · 06:40", remain: "84 wheels", state: "now" },
    { name: "Aged · Honey", batch: "07-D", made: "May 4 · 7d rest", remain: "26 rounds", state: "limited" },
    { name: "Imeruli · Fresh", batch: "08-C", made: "Today · 07:15", remain: "62 rounds", state: "now" },
    { name: "Shredded Imeruli", batch: "03-B", made: "Today · 08:20", remain: "48 pouches", state: "now" },
  ];
  return (
    <section className="ch-section" style={{ background: palette.cream2, padding: "80px 56px", borderTop: `1px solid ${palette.ink}14`, borderBottom: `1px solid ${palette.ink}14` }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>● Live · On the brine table now</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>Updated 09:14 · Dublin OH</div>
        </div>
        <div className="ch-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          {items.map((it) => (
            <div key={it.batch} style={{ background: palette.cream, border: `1px solid ${palette.ink}1a`, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>Batch {it.batch}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", padding: "3px 8px", background: it.state === "limited" ? palette.accent : palette.ink2, color: palette.cream }}>{it.state === "limited" ? "Limited" : "Fresh"}</div>
              </div>
              <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 20, color: palette.ink, lineHeight: 1.1, marginTop: 2 }}>{it.name}</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: palette.ink2, lineHeight: 1.5 }}>{it.made} · {it.remain} left</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── THE METHOD (4-step process) ───────────────────────────────────────
function CreameryMethod({ palette }) {
  const steps = [
    { n: "01", t: "Milk arrives · 6 AM", d: "Three Ohio dairies, within four hours of milking. We taste every churn — sweet, balanced, never sour.", time: "06:00–07:00" },
    { n: "02", t: "Curds, cut by hand", d: "Warmed to 86°F. We cut, pull, and knead in salted whey — the same motions for two thousand years.", time: "07:30–09:30" },
    { n: "03", t: "Salt brine · 24 hours", d: "Cold brine, just under 5% salinity. Fresh Sulguni ships at hour 24. Aged rests seven days with raw Ohio honey.", time: "09:30 → next day" },
    { n: "04", t: "Out the door · 5 PM", d: "Wheels weighed, packed cold, labelled with the batch number, off to UPS or onto a Doordash for Dublin.", time: "16:30–17:30" },
  ];
  return (
    <section className="ch-section" style={{ background: palette.ink, color: palette.cream, padding: "120px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase" }}>№ 02 — The method · მეთოდი</div>
          <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 64, lineHeight: 1.05, marginTop: 14, color: palette.cream, letterSpacing: "-0.02em", maxWidth: 800 }}>
            Eleven hours, <em style={{ color: palette.accent2, fontWeight: 400 }}>three pairs of hands,</em> and a brine bath.
          </div>
        </div>
        <div className="ch-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 36 }}>
          {steps.map((s) => (
            <div key={s.n} style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 18, borderTop: `1px solid ${palette.cream}33` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 56, fontWeight: 300, color: palette.accent2, lineHeight: 1, letterSpacing: "-0.03em" }}>{s.n}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", color: palette.cream, opacity: 0.55, textTransform: "uppercase" }}>{s.time}</div>
              </div>
              <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, color: palette.cream, lineHeight: 1.2 }}>{s.t}</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: palette.cream, opacity: 0.78, lineHeight: 1.6 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── DELIVERY / SHIP (cheese-specific) ─────────────────────────────────
function CreameryDelivery({ palette }) {
  return (
    <section className="ch-section" style={{ background: palette.cream, padding: "96px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 44 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 03 — How it gets to you</div>
            <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 56, lineHeight: 1.05, marginTop: 14, color: palette.ink, letterSpacing: "-0.02em" }}>
              Cold all the way <em style={{ color: palette.accent, fontWeight: 400 }}>or it doesn't go.</em>
            </div>
          </div>
        </div>
        <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { tag: "Dublin OH", title: "Same-day · Doordash", body: "Order before 3 PM. A driver picks it up from the creamery cooler within the hour. $7 flat, free over $40.", price: "$7 flat" },
            { tag: "Continental US", title: "UPS · Cold ship · 1–2 days", body: "Vacuum-packed, ice gel, insulated liner. We only ship Mon–Wed so nothing sleeps in a warehouse over a weekend.", price: "$12 → $18" },
            { tag: "Pickup", title: "Walk in · 9 AM–6 PM", body: "5340 Tuller Rd, Dublin. Tasting plate on the counter every morning. Park out front; we'll carry it to the car.", price: "Free" },
          ].map((c) => (
            <div key={c.title} style={{ background: palette.cream2, border: `1px solid ${palette.ink}1a`, padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", color: palette.accent, textTransform: "uppercase" }}>{c.tag}</div>
              <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 26, color: palette.ink, lineHeight: 1.1 }}>{c.title}</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: palette.ink2, lineHeight: 1.6 }}>{c.body}</div>
              <div style={{ marginTop: "auto", paddingTop: 14, borderTop: `1px solid ${palette.ink}22`, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.ink, textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
                <span>Shipping</span><span>{c.price}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SUBSCRIPTION (monthly cheese box) ─────────────────────────────────
function CreamerySubscription({ palette }) {
  return (
    <section className="ch-section" style={{ background: palette.ink, color: palette.cream, padding: "120px 56px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }} className="ch-cm-sub-grid">
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase" }}>№ 04 — The cheese club</div>
          <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 64, lineHeight: 1, marginTop: 14, color: palette.cream, letterSpacing: "-0.025em" }}>
            One box, <em style={{ color: palette.accent2, fontWeight: 400 }}>every month.</em>
          </div>
          <p style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 19, lineHeight: 1.55, color: palette.cream, opacity: 0.82, marginTop: 22, maxWidth: 520 }}>
            Three rotating cheeses, a printed recipe card, and a postcard from whichever dairy our milk came from this month. Pause anytime.
          </p>
          <div style={{ marginTop: 32, display: "flex", gap: 14 }} className="ch-cm-sub-ctas">
            <a href="#" style={{ background: palette.accent2, color: palette.ink, padding: "16px 30px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Start subscription</a>
            <a href="#" style={{ background: "transparent", color: palette.cream, border: `1px solid ${palette.cream}55`, padding: "16px 30px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>One-time gift box</a>
          </div>
        </div>
        <div style={{ background: palette.ink2, border: `1px solid ${palette.cream}22`, padding: 36 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 14, borderBottom: `1px solid ${palette.cream}22` }}>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 26, color: palette.cream }}>The Brine Box</div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 32, color: palette.accent2, fontWeight: 300, lineHeight: 1 }}>$48<span style={{ fontSize: 13, opacity: 0.6, letterSpacing: "0.16em", marginLeft: 8 }}>/mo</span></div>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
            {[
              "Three hand-cut cheeses · ~900g total",
              "One feature: aged Sulguni or seasonal",
              "Recipe card from our test kitchen",
              "Postcard from the dairy of the month",
              "Free cold shipping in the US",
              "Skip, pause, or cancel any month",
            ].map((l) => (
              <li key={l} style={{ display: "flex", alignItems: "flex-start", gap: 12, fontFamily: "Fraunces, serif", fontSize: 15, lineHeight: 1.4, color: palette.cream, opacity: 0.9 }}>
                <span style={{ color: palette.accent2, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>→</span>{l}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

window.CreameryHero = CreameryHero;
window.CreameryShop = CreameryShop;
window.CreameryBatch = CreameryBatch;
window.CreameryMethod = CreameryMethod;
window.CreameryDelivery = CreameryDelivery;
window.CreamerySubscription = CreamerySubscription;
