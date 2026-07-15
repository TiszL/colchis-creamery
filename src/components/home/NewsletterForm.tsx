"use client";

export function NewsletterForm() {
  return (
    <form style={{ display: "flex", gap: 8, flex: "1 1 360px", maxWidth: 480 }} onSubmit={(e) => e.preventDefault()}>
      {/* Visually-hidden label — the placeholder alone is not an accessible name. */}
      <label htmlFor="newsletter-email" style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
        Email address for the newsletter
      </label>
      <input
        id="newsletter-email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="your@email"
        style={{ flex: 1, padding: "14px 16px", border: "1px solid #1F302633", fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.06em", background: "transparent", color: "#1F3026", outline: "none" }}
      />
      <button type="submit" style={{ background: "#1F3026", color: "#F5F0E6", border: "none", padding: "14px 24px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Subscribe →</button>
    </form>
  );
}
