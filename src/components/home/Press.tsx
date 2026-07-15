// Social proof — press mentions + a customer review. LAUNCH FIX: this used to
// ship FABRICATED proof by default (named outlets like "Bon Appétit" the store
// was never in, a specific "4.9 / 312 reviews" count, and an invented
// testimonial) — false advertising on a pre-launch store. Now everything is
// DB-driven and the section renders NOTHING until the owner adds real press /
// reviews in admin. Each sub-block is independently gated.

interface PressContent {
  outlets?: string[];
  review_score?: string;
  review_count?: string;
  quote?: string;
  quote_author?: string;
}

interface PressProps {
  content?: PressContent | null;
}

export function Press({ content }: PressProps) {
  const d = content || {};
  const outlets = (d.outlets ?? []).filter(Boolean);
  const hasReviews = !!(d.review_score && d.review_count);
  const hasQuote = !!d.quote;

  // Nothing real to show → don't render the section at all.
  if (outlets.length === 0 && !hasReviews && !hasQuote) return null;

  return (
    <section className="ch-section" style={{ background: "#F5F0E6", padding: "120px 56px" }}>
      <div className="ch-split" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 32 }}>№ 06 — In good company</div>
          {outlets.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {outlets.map((p) => (
                <div key={p} style={{ aspectRatio: "16/7", background: "#EAE2D2", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #1F302614", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "#1F3026", opacity: 0.55 }}>{p}</div>
              ))}
            </div>
          )}
        </div>
        {(hasReviews || hasQuote) && (
          <div>
            {hasReviews && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 32 }}>★ {d.review_score} / {d.review_count} reviews</div>
            )}
            {hasQuote && (
              <>
                <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 300, fontSize: 36, lineHeight: 1.3, color: "#1F3026", letterSpacing: "-0.01em" }}>
                  &ldquo;{d.quote}&rdquo;
                </div>
                {d.quote_author && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginTop: 28 }}>{d.quote_author}</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
