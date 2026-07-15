"use client";

import { useActionState, useState } from "react";
import { Link } from "@/i18n/routing";
import { submitWholesaleLead } from "@/actions/wholesale";
import { ColchisSeal } from "@/components/brand/ColchisSeal";

const tiers = [
  { tag: "01", name: "Restaurant", desc: "Standard line. Net 14. Free delivery in Ohio + 5-state ring.", who: "Restaurants, cafés, bakeries", check: ["Full Creamery & Bakery line", "Weekly cold-chain delivery", "Net 14 terms", "Menu support & training"] },
  { tag: "02", name: "Grocery", desc: "Retail-ready packaging with UPC, planogram support, in-store demo days.", who: "Independent grocers, co-ops", check: ["Retail-ready labels & UPC", "Planogram & POS materials", "Quarterly demo days", "Net 30 terms"] },
  { tag: "03", name: "Hospitality", desc: "Event-scale orders for hotels, caterers, and venues — cheese boards, bulk sulguni, and hot khachapuri delivered to your service window.", who: "Hotels, caterers, event venues", check: ["By-the-event or standing volume", "Curated cheese boards & platters", "Hot & cold delivery on your timeline", "Net 30 terms"] },
];

const skuList = [
  { code: "CRE-01", name: "Sulguni · Fresh", size: "340g wheel", pack: "12 / case", price: "$8.40 ea" },
  { code: "CRE-02", name: "Sulguni · Aged · Honey", size: "280g wheel", pack: "12 / case", price: "$11.20 ea" },
  { code: "CRE-03", name: "Imeruli", size: "320g round", pack: "12 / case", price: "$7.20 ea" },
  { code: "CRE-04", name: "Sulguni · Bulk loaf", size: "2.5 kg", pack: "4 / case", price: "$48.00 ea" },
  { code: "BAK-01", name: "Adjaruli · Frozen", size: "520g, 2 pk", pack: "6 cs / case", price: "$14.40 ea" },
  { code: "BAK-02", name: "Imeruli Khachapuri · Frozen", size: "480g, 2 pk", pack: "6 cs / case", price: "$12.60 ea" },
  { code: "BAK-03", name: "Megruli · Frozen", size: "500g, 2 pk", pack: "6 cs / case", price: "$15.20 ea" },
  { code: "BAK-04", name: "Lobiani · Frozen", size: "440g, 2 pk", pack: "6 cs / case", price: "$11.80 ea" },
];

export default function WholesalePage() {
  const [state, formAction, isPending] = useActionState(submitWholesaleLead, null);
  const [loadTime] = useState(() => Date.now());

  return (
    <>
      {/* Wholesale Hero */}
      <section className="ch-section" style={{ background: "#1F3026", color: "#F5F0E6", padding: "120px 56px 100px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(#F5F0E606 1px, transparent 1px), linear-gradient(90deg, #F5F0E606 1px, transparent 1px)`, backgroundSize: "80px 80px", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#8B4A28", textTransform: "uppercase" }}>
              For Restaurants, Grocers & Specialty Markets
            </div>
            {/* Returning partners look top-right for "log in" — clearly visible on the dark hero. */}
            <Link href="/b2b/login" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 22px", border: "1px solid rgba(245,240,230,0.35)", borderRadius: 999, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: "#F5F0E6", textDecoration: "none", background: "rgba(245,240,230,0.05)", whiteSpace: "nowrap" }}>
              Partner login <span style={{ color: "#D98A5E" }}>→</span>
            </Link>
          </div>
          <h1 className="ch-bakery-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: "clamp(56px, 8vw, 124px)", lineHeight: 0.9, letterSpacing: "-0.03em", margin: 0, maxWidth: 1100 }}>
            Stock the only <em style={{ color: "#8B4A28", fontWeight: 300 }}>Georgian cheese</em><br />made in the Midwest.
          </h1>
          <div className="ch-section-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 48, marginTop: 80, paddingTop: 48, borderTop: "1px solid rgba(245,240,230,0.14)" }}>
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "clamp(16px, 2vw, 22px)", lineHeight: 1.5, opacity: 0.85 }}>
              Wholesale partners get cold-chain delivery within a 10-hour drive radius and full access to the Creamery & Bakery line — fresh, aged, and frozen.
            </div>
            <div>
              <div className="ch-stat-num" style={{ fontFamily: "var(--font-serif)", fontSize: 56, fontWeight: 400, color: "#8B4A28", lineHeight: 1 }}>40+</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#F5F0E6", opacity: 0.6, textTransform: "uppercase", marginTop: 8 }}>Active accounts in 6 states</div>
            </div>
            <div>
              <div className="ch-stat-num" style={{ fontFamily: "var(--font-serif)", fontSize: 56, fontWeight: 400, color: "#8B4A28", lineHeight: 1 }}>72h</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#F5F0E6", opacity: 0.6, textTransform: "uppercase", marginTop: 8 }}>From order to your dock</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="ch-section" style={{ background: "#F5F0E6", padding: "140px 56px" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto" }}>
          <div className="ch-section-grid" style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 64, marginBottom: 72 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ 01</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginTop: 8 }}>Three ways to partner</div>
            </div>
            <div className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#1F3026", maxWidth: 800 }}>
              Pick the relationship <em style={{ color: "#B96A3D", fontWeight: 400 }}>that fits.</em>
            </div>
          </div>
          <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {tiers.map((t) => (
              <div key={t.name} style={{ background: "#EAE2D2", padding: "44px 36px 40px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 44, fontWeight: 300, color: "#B96A3D", lineHeight: 1 }}>{t.tag}</div>
                  <ColchisSeal size={44} />
                </div>
                <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 36, color: "#1F3026", lineHeight: 1, fontWeight: 400 }}>{t.name}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.6, color: "#2C3D33", marginTop: 20 }}>{t.desc}</div>
                <div style={{ height: 1, background: "#1F302622", margin: "28px 0" }} />
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                  {t.check.map((c) => (
                    <li key={c} style={{ display: "flex", gap: 12, fontFamily: "var(--font-sans)", fontSize: 13, color: "#1F3026", lineHeight: 1.5 }}>
                      <span style={{ color: "#B96A3D", fontFamily: "var(--font-mono)" }}>+</span>{c}
                    </li>
                  ))}
                </ul>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginTop: 28 }}>For · {t.who}</div>
                <a href="#apply-form" style={{ marginTop: 24, background: "#1F3026", color: "#F5F0E6", border: "none", padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none", textAlign: "center", display: "block" }}>Apply →</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Catalog Table */}
      <section className="ch-section" style={{ background: "#EAE2D2", padding: "120px 56px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="ch-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 48 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ 02 — Catalog</div>
              <div className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#1F3026", marginTop: 14 }}>
                Wholesale <em style={{ color: "#B96A3D", fontWeight: 400 }}>SKUs.</em>
              </div>
            </div>
          </div>
          <div style={{ background: "#F5F0E6", border: "1px solid #1F302614" }}>
            <div className="ch-table-header" style={{ display: "grid", gridTemplateColumns: "120px 1fr 200px 160px", padding: "20px 32px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", borderBottom: "1px solid #1F302622" }}>
              <span>SKU</span><span>Product</span><span className="ch-hide-mobile">Size</span><span className="ch-hide-mobile">Pack</span>
            </div>
            {skuList.map((s, i) => (
              <div key={s.code} className="ch-table-row" style={{ display: "grid", gridTemplateColumns: "120px 1fr 200px 160px", padding: "22px 32px", borderBottom: i < skuList.length - 1 ? "1px solid #1F302611" : "none", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#B96A3D", letterSpacing: "0.16em" }}>{s.code}</span>
                <span className="ch-product-name" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "#1F3026" }}>{s.name}</span>
                <span className="ch-hide-mobile" style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#2C3D33" }}>{s.size}</span>
                <span className="ch-hide-mobile" style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#2C3D33" }}>{s.pack}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Apply Form */}
      <section id="apply-form" className="ch-section" style={{ background: "#F5F0E6", padding: "120px 56px" }}>
        <div className="ch-split" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 80, alignItems: "start" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>№ 03 — Apply</div>
            <div className="ch-h2-large" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 64, lineHeight: 1.0, letterSpacing: "-0.02em", color: "#1F3026", marginTop: 16 }}>
              Tell us about <em style={{ color: "#B96A3D", fontWeight: 400 }}>your shop.</em>
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, lineHeight: 1.6, color: "#2C3D33", marginTop: 28, fontStyle: "italic" }}>
              We review applications every Tuesday. Most accounts are onboarded within 10 days.
            </div>
            <div style={{ marginTop: 40, paddingTop: 28, borderTop: "1px solid #1F302622" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase" }}>Or email directly</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 26, color: "#1F3026", marginTop: 8 }}>sales@colchisfood.com</div>
            </div>
          </div>
          <form action={formAction} style={{ background: "#EAE2D2", padding: 40 }}>
            <input type="text" name="website_url" style={{ position: "absolute", left: "-9999px", opacity: 0 }} tabIndex={-1} autoComplete="off" />
            <input type="hidden" name="_loadTime" value={loadTime} />

            {state?.success && (
              <div style={{ background: "#2E7D3211", border: "1px solid #2E7D3244", padding: "16px 20px", marginBottom: 22, fontFamily: "var(--font-sans)", fontSize: 14, color: "#2E7D32", lineHeight: 1.5 }}>
                ✓ {state.success}
              </div>
            )}
            {state?.error && (
              <div style={{ background: "#C0392B11", border: "1px solid #C0392B44", padding: "16px 20px", marginBottom: 22, fontFamily: "var(--font-sans)", fontSize: 14, color: "#C0392B", lineHeight: 1.5 }}>
                {state.error}
              </div>
            )}

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Business name</div>
              <input name="companyName" required placeholder="Your restaurant or shop" style={{ width: "100%", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, background: "transparent", border: "none", borderBottom: "1px solid #1F302644", padding: "10px 0", color: "#1F3026", outline: "none" }} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Contact name</div>
              <input name="contactName" required style={{ width: "100%", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, background: "transparent", border: "none", borderBottom: "1px solid #1F302644", padding: "10px 0", color: "#1F3026", outline: "none" }} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Email</div>
              <input name="email" type="email" required style={{ width: "100%", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, background: "transparent", border: "none", borderBottom: "1px solid #1F302644", padding: "10px 0", color: "#1F3026", outline: "none" }} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Phone</div>
              <input name="phone" type="tel" required style={{ width: "100%", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, background: "transparent", border: "none", borderBottom: "1px solid #1F302644", padding: "10px 0", color: "#1F3026", outline: "none" }} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Address</div>
              <input name="address" required placeholder="Street, City, State" style={{ width: "100%", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, background: "transparent", border: "none", borderBottom: "1px solid #1F302644", padding: "10px 0", color: "#1F3026", outline: "none" }} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Zip code</div>
              <input name="zipCode" required placeholder="e.g. 43017" style={{ width: "100%", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, background: "transparent", border: "none", borderBottom: "1px solid #1F302644", padding: "10px 0", color: "#1F3026", outline: "none" }} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Expected weekly volume</div>
              <select name="volume" style={{ width: "100%", fontFamily: "var(--font-sans)", fontSize: 16, background: "transparent", border: "none", borderBottom: "1px solid #1F302644", padding: "10px 0", color: "#1F3026", outline: "none" }}>
                <option>Under 50 lbs</option>
                <option>50–200 lbs</option>
                <option>200–500 lbs</option>
                <option>500+ lbs</option>
              </select>
            </div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Tell us about your business</div>
              <textarea name="message" rows={3} style={{ width: "100%", fontFamily: "var(--font-sans)", fontSize: 14, background: "transparent", border: "1px solid #1F302644", padding: 12, color: "#1F3026", outline: "none", resize: "vertical" }} />
            </div>
            <button type="submit" disabled={isPending} style={{ width: "100%", background: isPending ? "#7A8278" : "#1F3026", color: "#F5F0E6", border: "none", padding: "18px 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: isPending ? "wait" : "pointer", marginTop: 12 }}>
              {isPending ? "Submitting..." : "Submit application →"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
