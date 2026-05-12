/* global React, PALETTES, PaletteCard, TypeSpecimen, LogoAsomtavruli, LogoWordmark, LogoBorjgali, SubBrandLockup, PackagingMock, HomepageHero */

const { useState } = React;

function ApplicationsRow({ palette }) {
  return (
    <div style={{ width: 1280, background: palette.cream, padding: 64, fontFamily: "Fraunces, serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 40 }}>
        <div style={{ fontSize: 32, color: palette.ink, fontWeight: 400 }}>Applications</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>
          Stamp · Receipt · Tote · Sticker
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
        {/* Wax stamp */}
        <div style={{ aspectRatio: "1", background: palette.cream2, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 140, height: 140, borderRadius: "50%", background: palette.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `inset 0 0 0 4px ${palette.cream}, inset 0 0 0 5px ${palette.accent}, 0 8px 20px ${palette.ink}33` }}>
            <div style={{ fontFamily: "Fraunces, serif", color: palette.cream, fontSize: 36, fontWeight: 500 }}>CF</div>
          </div>
          <div style={{ position: "absolute", bottom: 12, left: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>Wax seal</div>
        </div>
        {/* Receipt */}
        <div style={{ aspectRatio: "1", background: palette.cream2, padding: 18, position: "relative" }}>
          <div style={{ background: palette.cream, height: "100%", padding: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: palette.ink, lineHeight: 1.6 }}>
            <div style={{ textAlign: "center", letterSpacing: "0.24em" }}>COLCHIS FOOD</div>
            <div style={{ textAlign: "center", opacity: 0.6, marginTop: 2 }}>DUBLIN · OH</div>
            <div style={{ borderTop: `1px dashed ${palette.ink}44`, margin: "10px 0" }} />
            <div>SULGUNI 340g · · 14.00</div>
            <div>IMERULI · · · · · 12.00</div>
            <div>ADJARULI HOT· · 16.00</div>
            <div style={{ borderTop: `1px dashed ${palette.ink}44`, margin: "10px 0" }} />
            <div>TOTAL · · · · · · 42.00</div>
          </div>
          <div style={{ position: "absolute", bottom: 4, left: 18, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>Receipt</div>
        </div>
        {/* Tote */}
        <div style={{ aspectRatio: "1", background: palette.cream2, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "75%", height: "82%", background: palette.cream, position: "relative", border: `1px solid ${palette.ink}33` }}>
            <div style={{ position: "absolute", top: -14, left: "20%", width: 14, height: 28, border: `2px solid ${palette.ink}`, borderBottom: "none", borderRadius: "10px 10px 0 0" }} />
            <div style={{ position: "absolute", top: -14, right: "20%", width: 14, height: 28, border: `2px solid ${palette.ink}`, borderBottom: "none", borderRadius: "10px 10px 0 0" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 22, color: palette.ink, lineHeight: 1 }}>Bread,<br />cheese,<br />country.</div>
              <div style={{ width: 24, height: 1, background: palette.accent, margin: "10px 0" }} />
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.28em", color: palette.accent, textTransform: "uppercase" }}>Colchis Food</div>
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 12, left: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>Tote</div>
        </div>
        {/* Sticker pack */}
        <div style={{ aspectRatio: "1", background: palette.cream2, position: "relative", padding: 24, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 70, height: 70, borderRadius: "50%", background: palette.ink, color: palette.cream, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", lineHeight: 1, transform: "rotate(-8deg)" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.2em" }}>HOT</div>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 14, marginTop: 2 }}>now</div>
          </div>
          <div style={{ width: 70, height: 70, borderRadius: "50%", background: palette.accent, color: palette.cream, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontSize: 22, transform: "rotate(6deg)" }}>CF</div>
          <div style={{ width: 80, padding: "8px 14px", background: palette.cream, color: palette.ink, fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", textAlign: "center", border: `1px solid ${palette.ink}`, transform: "rotate(-3deg)" }}>EAT WARM</div>
          <div style={{ position: "absolute", bottom: 12, left: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase" }}>Stickers</div>
        </div>
      </div>
    </div>
  );
}

window.ApplicationsRow = ApplicationsRow;

// ─── Brand intro / hero card ───────────────────────────────────────────────
function BrandIntro({ palette }) {
  return (
    <div style={{ width: 1280, background: palette.cream, padding: 80, fontFamily: "Fraunces, serif", color: palette.ink }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 24 }}>
            Brand Identity · v1 · May 2026
      </div>
      <div style={{ fontSize: 96, lineHeight: 0.95, fontWeight: 300, letterSpacing: "-0.025em", maxWidth: 1100 }}>
        Colchis <em style={{ fontWeight: 400 }}>Food</em>
      </div>
      <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 36, color: palette.accent, marginTop: 12, fontWeight: 400 }}>
        Ancient heritage, fresh every day.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 48, marginTop: 64, paddingTop: 40, borderTop: `1px solid ${palette.ink}22` }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase", marginBottom: 12 }}>The Idea</div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 15, lineHeight: 1.65, color: palette.ink2 }}>
            One parent house, two crafts. <strong>The Creamery</strong> hand-presses Imeruli & Sulguni; <strong>The Bakery</strong> bakes khachapuri hot. Both share a single seal — a stone-carved CF — and a vocabulary that reads like a Georgian ledger: numbered, precise, warm.
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase", marginBottom: 12 }}>The Audience</div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 15, lineHeight: 1.65, color: palette.ink2 }}>
            Curious American eaters who liked Diaspora Co. and Graza, who order Aesop and Le Labo, who know what bottarga is — and now want to know what sulguni is. We talk down to no one, and we never call the food "exotic."
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase", marginBottom: 12 }}>The Voice</div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 15, lineHeight: 1.65, color: palette.ink2 }}>
            Plainspoken, never precious. Specific over poetic ("brined 24 hours" beats "lovingly crafted"). Bilingual where it earns its keep. Numbers and ledgers — № 04, BATCH 12 — feel handmade and modern at once.
          </div>
        </div>
      </div>
    </div>
  );
}

window.BrandIntro = BrandIntro;
