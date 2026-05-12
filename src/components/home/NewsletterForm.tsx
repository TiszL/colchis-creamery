"use client";

export function NewsletterForm() {
  return (
    <form style={{ display: "flex", gap: 8, flex: "1 1 360px", maxWidth: 480 }} onSubmit={(e) => e.preventDefault()}>
      <input placeholder="your@email" style={{ flex: 1, padding: "14px 16px", border: "1px solid #1F302633", fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.06em", background: "transparent", color: "#1F3026", outline: "none" }} />
      <button style={{ background: "#1F3026", color: "#F5F0E6", border: "none", padding: "14px 24px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Subscribe →</button>
    </form>
  );
}
