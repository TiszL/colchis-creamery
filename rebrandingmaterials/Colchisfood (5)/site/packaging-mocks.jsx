/* global React, ColchisSeal */

// ─── PACKAGING MOCKS ─────────────────────────────────────────────────────
// 5 SKUs:
//   1. Sulguni Round Wheel — cream paper wrap, 250g/500g consumer
//   2. Sulguni Vacuum Slab — clear front, branded label, 250g/500g consumer
//   3. Sulguni 5kg Block — branded poly bag, foodservice
//   4. Shredded Imeruli Pouch — resealable stand-up, 500g consumer
//   5. Shredded Imeruli 5kg Bag — foodservice gusseted bag

// ── 1. SULGUNI ROUND WHEEL (paper-wrapped, twine, end-paper seal) ─────
function PackSulguniRound({ palette, weight = "500g", w = 320, h = 320 }) {
  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* shadow */}
      <div style={{ position: "absolute", bottom: 18, left: "8%", right: "8%", height: 16, background: `radial-gradient(ellipse, ${palette.ink}33 0%, transparent 70%)`, filter: "blur(6px)" }} />
      {/* wheel — cream paper wrap with crinkle texture */}
      <div style={{ width: "78%", height: "78%", borderRadius: "50%", background: palette.cream, border: `1px solid ${palette.ink}22`, boxShadow: `inset 0 -20px 40px ${palette.ink}11, inset 0 20px 40px ${palette.cream2}`, position: "relative", overflow: "hidden" }}>
        {/* crinkle */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 30% 30%, ${palette.cream2}66, transparent 60%), radial-gradient(circle at 70% 70%, ${palette.ink}08, transparent 50%)` }} />
        {/* twine cross */}
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 4, background: palette.accent, transform: "translateX(-50%)", boxShadow: `0 0 0 1px ${palette.ink}44` }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 4, background: palette.accent, transform: "translateY(-50%)", boxShadow: `0 0 0 1px ${palette.ink}44` }} />
        {/* center end-paper seal */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "62%", aspectRatio: "1", borderRadius: "50%", background: palette.cream, border: `1px solid ${palette.ink}55`, padding: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase" }}>EST · MMXXVI</div>
          <ColchisSeal palette={palette} size={42} />
          <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 18, color: palette.ink, marginTop: 4, lineHeight: 1 }}>Sulguni</div>
          <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 11, color: palette.accent, marginTop: 2 }}>სულგუნი</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 8 }}>{weight} · brined fresh</div>
        </div>
      </div>
    </div>
  );
}

// ── 2. SULGUNI VACUUM SLAB (clear front + branded label) ──────────────
function PackSulguniSlab({ palette, weight = "500g", w = 320, h = 380 }) {
  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ position: "absolute", bottom: 12, left: "12%", right: "12%", height: 14, background: `radial-gradient(ellipse, ${palette.ink}33, transparent 70%)`, filter: "blur(6px)" }} />
      {/* Vacuum pack — slight top curve */}
      <div style={{ width: "82%", height: "92%", background: `linear-gradient(180deg, ${palette.cream2} 0%, ${palette.cream} 25%, ${palette.cream} 75%, ${palette.cream2} 100%)`, position: "relative", borderRadius: "12px 12px 4px 4px", border: `1px solid ${palette.ink}22`, overflow: "hidden", boxShadow: `inset 0 0 40px ${palette.ink}08` }}>
        {/* vac wrinkles */}
        <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(110deg, transparent 0 18px, ${palette.ink}06 18px 19px)`, mixBlendMode: "multiply" }} />
        {/* vacuum-seal top notch */}
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 60, height: 18, background: palette.cream2, borderBottom: `1px dashed ${palette.ink}33` }} />
        {/* "cheese" silhouette behind label — visible cheese block */}
        <div style={{ position: "absolute", top: "12%", left: "10%", right: "10%", bottom: "44%", background: `linear-gradient(180deg, ${palette.cream} 0%, #F0E6D0 100%)`, border: `1px solid ${palette.cream2}`, borderRadius: 4 }}>
          <div style={{ position: "absolute", inset: 6, background: `radial-gradient(circle at 30% 40%, ${palette.cream2}88, transparent 50%), radial-gradient(circle at 70% 70%, ${palette.cream2}88, transparent 50%)` }} />
        </div>
        {/* label band */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "42%", background: palette.ink, color: palette.cream, padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase" }}>The Creamery</div>
              <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 24, color: palette.cream, marginTop: 4, lineHeight: 1 }}>Sulguni</div>
              <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 12, color: palette.accent2, marginTop: 2 }}>სულგუნი</div>
            </div>
            <ColchisSeal palette={{ ...palette, ink: palette.cream, cream: palette.ink }} size={32} invert />
          </div>
          <div>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 11, color: palette.cream, opacity: 0.8, lineHeight: 1.4 }}>Hand-pulled, vacuum-sealed in Dublin, Ohio.</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.24em", color: palette.cream, opacity: 0.7, textTransform: "uppercase" }}>
              <span>NET WT {weight}</span><span>EST · MMXXVI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 3. SULGUNI 5KG BLOCK (foodservice poly bag) ──────────────────────
function PackSulguni5kg({ palette, w = 360, h = 380 }) {
  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ position: "absolute", bottom: 12, left: "8%", right: "8%", height: 16, background: `radial-gradient(ellipse, ${palette.ink}40, transparent 70%)`, filter: "blur(8px)" }} />
      {/* Big cube-shaped bag */}
      <div style={{ width: "92%", height: "94%", background: palette.ink, position: "relative", borderRadius: "10px 10px 6px 6px", border: `1px solid ${palette.ink}`, overflow: "hidden", boxShadow: `inset 0 0 60px ${palette.cream}08` }}>
        {/* fold line */}
        <div style={{ position: "absolute", left: 0, right: 0, top: "8%", height: 2, background: palette.ink2, opacity: 0.6 }} />
        {/* FRONT label area */}
        <div style={{ position: "absolute", inset: "14% 12% 16% 12%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {/* Top row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase" }}>Foodservice · The Creamery</div>
              <div style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 36, color: palette.cream, marginTop: 6, lineHeight: 0.95, letterSpacing: "-0.02em" }}>Sulguni<br /><em style={{ color: palette.accent2, fontWeight: 300, fontSize: 28 }}>Block</em></div>
              <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 14, color: palette.accent2, marginTop: 6 }}>სულგუნი</div>
            </div>
            <ColchisSeal palette={{ ...palette, ink: palette.cream, cream: palette.ink }} size={48} invert />
          </div>
          {/* Middle: weight slab */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 96, fontWeight: 300, color: palette.cream, lineHeight: 1, letterSpacing: "-0.04em" }}>5</div>
            <div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 32, fontWeight: 300, color: palette.cream, lineHeight: 1 }}>kg</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", color: palette.cream, opacity: 0.55, textTransform: "uppercase", marginTop: 4 }}>NET WT · 11 lb</div>
            </div>
          </div>
          {/* Bottom row */}
          <div>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 13, color: palette.cream, opacity: 0.78, lineHeight: 1.45 }}>For pizzerias, supras, and people who put cheese in everything. Hand-pulled, vacuum-sealed in Dublin, Ohio.</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${palette.cream}33`, fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.24em", color: palette.cream, opacity: 0.7, textTransform: "uppercase" }}>
              <span>BATCH 12 · LOT 2026-05-08</span>
              <span>colchisfood.com</span>
            </div>
          </div>
        </div>
        {/* Side seam */}
        <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 14, background: `repeating-linear-gradient(0deg, ${palette.ink2} 0 6px, ${palette.ink} 6px 8px)`, opacity: 0.6 }} />
      </div>
    </div>
  );
}

// ── 4. SHREDDED IMERULI POUCH (consumer 500g, resealable stand-up) ──
function PackShredPouch({ palette, weight = "500g", w = 320, h = 380 }) {
  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ position: "absolute", bottom: 10, left: "14%", right: "14%", height: 12, background: `radial-gradient(ellipse, ${palette.ink}33, transparent 70%)`, filter: "blur(6px)" }} />
      <div style={{ width: "78%", height: "94%", background: palette.cream, position: "relative", borderRadius: "20px 20px 6px 6px", border: `1px solid ${palette.ink}33`, overflow: "hidden", boxShadow: `inset 0 0 50px ${palette.cream2}88` }}>
        {/* zip seal at top */}
        <div style={{ position: "absolute", top: 14, left: 18, right: 18, height: 8, background: `repeating-linear-gradient(90deg, ${palette.ink}33 0 4px, transparent 4px 7px)`, borderRadius: 2 }} />
        <div style={{ position: "absolute", top: 28, left: 0, right: 0, height: 1, background: palette.ink + "22" }} />
        {/* tear notch */}
        <div style={{ position: "absolute", top: 30, right: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.2em", color: palette.muted, textTransform: "uppercase" }}>← tear</div>
        {/* content */}
        <div style={{ position: "absolute", top: 56, left: 22, right: 22, bottom: 16, display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>The Creamery · No 03</div>
          <div style={{ fontFamily: "Fraunces, serif", fontWeight: 400, fontSize: 28, color: palette.ink, marginTop: 8, lineHeight: 0.98, letterSpacing: "-0.02em" }}>
            Imeruli<br /><em style={{ color: palette.accent }}>Shredded</em>
          </div>
          <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 13, color: palette.muted, marginTop: 4 }}>დაჩეჩილი იმერული</div>
          {/* preview window */}
          <div style={{ marginTop: 16, height: 110, border: `1px solid ${palette.ink}33`, background: palette.cream2, position: "relative", overflow: "hidden", borderRadius: 4 }}>
            {/* shred texture */}
            {[...Array(40)].map((_, i) => {
              const x = (i * 17) % 230;
              const y = (i * 13) % 90;
              const rot = (i * 47) % 180 - 90;
              return <div key={i} style={{ position: "absolute", left: x, top: y + 6, width: 28, height: 4, background: i % 3 === 0 ? "#F2E5C8" : "#E8D4A8", transform: `rotate(${rot}deg)`, borderRadius: 2, boxShadow: `0 1px 0 ${palette.ink}11` }} />;
            })}
            <div style={{ position: "absolute", bottom: 6, right: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>Window — actual product</div>
          </div>
          <div style={{ marginTop: 12, fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 12, color: palette.ink2, lineHeight: 1.45 }}>
            Shredded ready for the pan. Melts in 90 seconds.
          </div>
          <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: `1px solid ${palette.ink}22` }}>
            <ColchisSeal palette={palette} size={28} />
            <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", color: palette.ink, textTransform: "uppercase" }}>NET {weight}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 5. SHREDDED IMERULI 5KG BAG (foodservice gusseted) ──────────────
function PackShred5kg({ palette, w = 360, h = 360 }) {
  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ position: "absolute", bottom: 12, left: "10%", right: "10%", height: 14, background: `radial-gradient(ellipse, ${palette.ink}40, transparent 70%)`, filter: "blur(8px)" }} />
      <div style={{ width: "94%", height: "92%", background: palette.cream2, position: "relative", borderRadius: "8px 8px 4px 4px", border: `1px solid ${palette.ink}33`, overflow: "hidden" }}>
        {/* gusset shadow */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "16%", width: 1, background: palette.ink + "22" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, right: "16%", width: 1, background: palette.ink + "22" }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 22, background: `linear-gradient(180deg, ${palette.ink2} 0%, ${palette.ink} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.4em", color: palette.cream, textTransform: "uppercase" }}>HEAT-SEAL · TEAR HERE</div>
        <div style={{ position: "absolute", top: 36, left: 26, right: 26, bottom: 18, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>Foodservice · No 04</div>
              <div style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 36, color: palette.ink, marginTop: 8, lineHeight: 0.95, letterSpacing: "-0.02em" }}>
                Shredded<br /><em style={{ color: palette.accent, fontWeight: 400, fontSize: 30 }}>Imeruli</em>
              </div>
              <div style={{ fontFamily: "'Noto Serif Georgian', serif", fontSize: 13, color: palette.muted, marginTop: 6 }}>დაჩეჩილი იმერული</div>
            </div>
            <ColchisSeal palette={palette} size={42} />
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 96, fontWeight: 300, color: palette.ink, lineHeight: 1, letterSpacing: "-0.04em" }}>5</div>
            <div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 32, fontWeight: 300, color: palette.ink, lineHeight: 1 }}>kg</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase", marginTop: 4 }}>NET WT · 11 lb</div>
              <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 12, color: palette.ink2, marginTop: 8, lineHeight: 1.4 }}>~50 servings of khachapuri</div>
            </div>
          </div>
          <div style={{ paddingTop: 10, borderTop: `1px solid ${palette.ink}22`, fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
            <span>Wholesale · colchisfood.com</span>
            <span>Made in Dublin, OH</span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PackSulguniRound = PackSulguniRound;
window.PackSulguniSlab = PackSulguniSlab;
window.PackSulguni5kg = PackSulguni5kg;
window.PackShredPouch = PackShredPouch;
window.PackShred5kg = PackShred5kg;
