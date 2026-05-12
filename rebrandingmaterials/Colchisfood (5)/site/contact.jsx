/* global React */
const { useState } = React;

// ─── CONTACT PAGE ──────────────────────────────────────────────────────────
function ContactPage({ palette }) {
  const mono = "'JetBrains Mono', monospace";
  const serif = "Fraunces, serif";
  const sans = "Inter, sans-serif";

  const [topic, setTopic] = useState("order");
  const [sent, setSent] = useState(false);

  const topics = [
    { id: "order", label: "An order", desk: "Customer care", time: "Replies in < 4h, M–F" },
    { id: "wholesale", label: "Wholesale", desk: "Trade desk", time: "Replies in 1 business day" },
    { id: "press", label: "Press & stories", desk: "Editorial", time: "Replies within the week" },
    { id: "kitchen", label: "The kitchen", desk: "Bake-house notes", time: "Hand-answered by Levan" },
  ];

  return (
    <main className="ch-contact" style={{ background: palette.cream, minHeight: "100vh" }}>
      {/* HERO */}
      <section style={{ background: palette.ink, color: palette.cream, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${palette.cream}06 1px, transparent 1px), linear-gradient(90deg, ${palette.cream}06 1px, transparent 1px)`, backgroundSize: "80px 80px", pointerEvents: "none" }} />
        <div className="ch-contact-hero" style={{ maxWidth: 1440, margin: "0 auto", padding: "80px 56px 56px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48, alignItems: "end", position: "relative" }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase" }}>№ 00 — The Switchboard</div>
            <h1 className="ch-contact-h1" style={{ fontFamily: serif, fontWeight: 300, fontSize: 104, lineHeight: 0.92, letterSpacing: "-0.03em", margin: "18px 0 0" }}>
              Write us<br /><em style={{ color: palette.accent2, fontWeight: 300 }}>a postcard.</em>
            </h1>
            <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 20, marginTop: 22, maxWidth: 560, opacity: 0.82, lineHeight: 1.55 }}>
              Or an email. Or call the bakery line — Levan picks up when the oven's resting. We answer every note that lands on the counter.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", opacity: 0.85 }}>
            {[
              ["Email", "hello@colchisfood.com"],
              ["Phone", "+1 (614) 555 0142"],
              ["Hours", "Tue–Sat · 9am – 7pm EST"],
              ["Address", "5340 Tuller Rd, Dublin OH"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 16, paddingBottom: 12, borderBottom: `1px solid ${palette.cream}1A` }}>
                <span style={{ color: palette.cream, opacity: 0.5 }}>{k}</span>
                <span style={{ color: palette.cream, opacity: 0.95 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DESKS */}
      <section style={{ background: palette.cream2, borderBottom: `1px solid ${palette.ink}14` }}>
        <div className="ch-contact-desks" style={{ maxWidth: 1440, margin: "0 auto", padding: "0 56px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {topics.map((t, i) => {
            const on = topic === t.id;
            return (
              <button key={t.id} onClick={() => setTopic(t.id)} style={{
                background: on ? "#fff" : "transparent", border: "none", borderLeft: i === 0 ? "none" : `1px solid ${palette.ink}14`,
                cursor: "pointer", padding: "26px 24px", textAlign: "left", position: "relative",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: on ? palette.accent : "transparent" }} />
                <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: on ? palette.accent : palette.muted, textTransform: "uppercase" }}>{`0${i + 1} · ${t.desk}`}</div>
                <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 26, color: palette.ink, marginTop: 6 }}>{t.label}</div>
                <div style={{ fontFamily: sans, fontSize: 12.5, color: palette.ink2, opacity: 0.7, marginTop: 4 }}>{t.time}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* BODY */}
      <div className="ch-contact-body" style={{ maxWidth: 1440, margin: "0 auto", padding: "56px 56px 64px", display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: 48, alignItems: "flex-start" }}>

        {/* FORM */}
        <div style={{ background: "#fff", border: `1px solid ${palette.ink}22` }}>
          <div style={{ padding: "22px 32px", borderBottom: `1px solid ${palette.ink}14` }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 01 — A note to the kitchen</div>
            <h2 style={{ fontFamily: serif, fontWeight: 400, fontStyle: "italic", fontSize: 30, color: palette.ink, margin: "6px 0 0" }}>Send a message</h2>
          </div>

          {sent ? (
            <div style={{ padding: "56px 32px", textAlign: "center" }}>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>Received ✓</div>
              <div style={{ fontFamily: serif, fontSize: 38, color: palette.ink, marginTop: 10, fontWeight: 300, letterSpacing: "-0.02em" }}>Thank you — we'll write back.</div>
              <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 17, color: palette.ink2, opacity: 0.8, marginTop: 10, maxWidth: 420, margin: "10px auto 0", lineHeight: 1.5 }}>
                A copy is on its way to your inbox. Most replies land within a few hours during the bake.
              </div>
              <button onClick={() => setSent(false)} style={{ marginTop: 22, background: "transparent", color: palette.ink, border: `1px solid ${palette.ink}`, padding: "12px 20px", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Send another</button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} style={{ padding: 32, display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="ch-contact-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field palette={palette} label="Name" placeholder="Nino Beridze" />
                <Field palette={palette} label="Email" type="email" placeholder="you@colchisfood.com" />
              </div>
              <div className="ch-contact-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field palette={palette} label="Phone (optional)" placeholder="+1 (614) 555 0142" />
                <div>
                  <label style={{ display: "block", fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase", marginBottom: 8 }}>Order # (if any)</label>
                  <input placeholder="CH-XXXX-XX" style={inp(palette)} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase", marginBottom: 8 }}>About</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {topics.map(t => {
                    const on = topic === t.id;
                    return (
                      <button type="button" key={t.id} onClick={() => setTopic(t.id)} style={{
                        background: on ? palette.ink : "transparent",
                        color: on ? palette.cream : palette.ink,
                        border: `1px solid ${on ? palette.ink : palette.ink + "55"}`,
                        padding: "8px 14px", fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer",
                      }}>{t.label}</button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase", marginBottom: 8 }}>Message</label>
                <textarea rows={6} placeholder="A short note, an idea, a baker's question…" style={{ ...inp(palette), resize: "vertical", lineHeight: 1.6 }} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <input id="ok" type="checkbox" defaultChecked style={{ accentColor: palette.ink, width: 16, height: 16 }} />
                <label htmlFor="ok" style={{ fontFamily: sans, fontSize: 12.5, color: palette.ink2 }}>
                  Send me an occasional dispatch about new wheels &amp; bake days.
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 12 }}>
                <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>Signed by 1 baker · TLS 1.3</div>
                <button type="submit" style={{ background: palette.ink, color: palette.cream, border: "none", padding: "16px 28px", fontFamily: mono, fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", cursor: "pointer" }}>Send the note →</button>
              </div>
            </form>
          )}
        </div>

        {/* SIDE */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Address card */}
          <div style={{ background: "#fff", border: `1px solid ${palette.ink}22`, padding: 28 }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>The bakery</div>
            <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 28, color: palette.ink, marginTop: 8, lineHeight: 1.15 }}>The Tuller Rd Counter</div>
            <div style={{ fontFamily: sans, fontSize: 14, color: palette.ink2, marginTop: 10, lineHeight: 1.65 }}>
              5340 Tuller Road, Suite 200<br />Dublin, OH 43017<br /><span style={{ color: palette.muted }}>Door 4 · ring twice</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <a href="#map" style={{ background: "transparent", color: palette.ink, border: `1px solid ${palette.ink}`, padding: "10px 14px", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Directions →</a>
              <a href="tel:+16145550142" style={{ background: "transparent", color: palette.ink, border: `1px solid ${palette.ink}33`, padding: "10px 14px", fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Call</a>
            </div>
          </div>

          {/* Hours */}
          <div style={{ background: palette.cream2, border: `1px solid ${palette.ink}14`, padding: 28 }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>Counter hours</div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Mon", "Closed · cellar day"],
                ["Tue – Thu", "9 am – 6 pm"],
                ["Fri", "9 am – 8 pm · hot bake"],
                ["Sat", "10 am – 7 pm"],
                ["Sun", "11 am – 4 pm"],
              ].map(([d, h]) => (
                <div key={d} style={{ display: "flex", justifyContent: "space-between", fontFamily: serif, fontSize: 17, color: palette.ink, paddingBottom: 8, borderBottom: `1px solid ${palette.ink}14` }}>
                  <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>{d}</span>
                  <span style={{ fontStyle: "italic" }}>{h}</span>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ shortcut */}
          <div style={{ background: palette.ink, color: palette.cream, padding: 28 }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent2, textTransform: "uppercase" }}>Try the FAQ first</div>
            <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 26, marginTop: 8, lineHeight: 1.2 }}>Most answers live here.</div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {["Shipping & cold-chain", "Replace pledge", "Wholesale minimums", "Pickup windows"].map(q => (
                <a key={q} href="#" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${palette.cream}1A`, fontFamily: serif, fontStyle: "italic", fontSize: 17, color: palette.cream, textDecoration: "none" }}>
                  <span>{q}</span><span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.24em", color: palette.accent2 }}>→</span>
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* MAP */}
      <section id="map" style={{ borderTop: `1px solid ${palette.ink}14`, background: palette.cream2 }}>
        <div className="ch-contact-map-wrap" style={{ maxWidth: 1440, margin: "0 auto", padding: "56px 56px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, gap: 18, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase" }}>№ 02 — Find us</div>
              <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 56, color: palette.ink, margin: "10px 0 0", letterSpacing: "-0.02em" }}>Tuller Road, <em style={{ color: palette.accent }}>Dublin OH.</em></h2>
            </div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase", maxWidth: 320 }}>
              Free parking out back · 6 min from I-270 exit 17B
            </div>
          </div>
        </div>
        <div className="ch-contact-map" style={{ maxWidth: 1440, margin: "0 auto", padding: "0 56px 80px" }}>
          <div style={{ width: "100%", height: 460, border: `1px solid ${palette.ink}22`, overflow: "hidden", background: "#fff" }}>
            <iframe
              src="https://maps.google.com/maps?q=5340+Tuller+Rd+Dublin+OH&z=13&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0, filter: "grayscale(0.4) sepia(0.1)" }}
              loading="lazy"
              title="Colchis Food — 5340 Tuller Rd, Dublin OH"
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ palette, label, type = "text", placeholder }) {
  const mono = "'JetBrains Mono', monospace";
  return (
    <div>
      <label style={{ display: "block", fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", color: palette.muted, textTransform: "uppercase", marginBottom: 8 }}>{label}</label>
      <input type={type} placeholder={placeholder} style={inp(palette)} />
    </div>
  );
}

function inp(palette) {
  return { width: "100%", padding: "13px 14px", background: palette.cream, border: `1px solid ${palette.ink}33`, color: palette.ink, fontFamily: "Inter, sans-serif", fontSize: 14, outline: "none" };
}
