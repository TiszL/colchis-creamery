/* global React, ARTICLES, ArticleArt, ArticleCard */

function getSlugFromUrl() {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get("slug") || ARTICLES[0].slug;
  } catch { return ARTICLES[0].slug; }
}

// ─── ARTICLE BODY (long-form, drop cap, pull quote, sectioned) ───────────
function ArticleBody({ palette }) {
  const text = palette.ink2;
  const Para = ({ children, drop }) => (
    <p style={{ fontFamily: "Fraunces, serif", fontSize: 21, lineHeight: 1.65, color: text, margin: "0 0 26px" }}>
      {drop && <span style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: 84, lineHeight: 0.85, float: "left", marginRight: 14, marginTop: 6, color: palette.accent }}>{drop}</span>}
      {children}
    </p>
  );
  const H = ({ children }) => (
    <h2 style={{ fontFamily: "Fraunces, serif", fontWeight: 400, fontSize: 36, lineHeight: 1.15, letterSpacing: "-0.01em", color: palette.ink, margin: "48px 0 20px" }}>{children}</h2>
  );
  return (
    <>
      <Para drop="T">he stone weighs forty pounds and has a chip on one corner where my grandmother dropped it on the kitchen floor in 1974. She was making sulguni, the way her mother taught her, the way her mother's mother taught her — heat the curds in salted whey, knead with both hands, and then press, with a stone, until the shape holds.</Para>
      <Para>I have that stone now, in Dublin, Ohio. It sits on a shelf in our creamery between a digital pH meter and a stack of food-safety paperwork from the state of Ohio. We don't actually use it for production — we use a steel form that produces a more consistent wheel — but I look at it every morning when I come in.</Para>

      <H>What we mean by 'two thousand years'</H>
      <Para>Cheese has been made in the Caucasus for as long as people have kept domesticated cows. The earliest archaeological evidence — strainers and curd-pots, basically — goes back to the late Bronze Age, somewhere around 1500 BCE. By the time Greek and Roman writers were paying attention, the region we now call Georgia was famous for two things: its wine and its cheese.</Para>
      <Para>Sulguni is a pasta-filata cheese, which puts it in the same family as mozzarella, provolone, and the various string cheeses of the eastern Mediterranean. Imeruli is its older, simpler cousin — pulled from the same vat of curd, but pressed instead of stretched.</Para>

      <div style={{ borderLeft: `3px solid ${palette.accent}`, paddingLeft: 28, margin: "44px 0", fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 28, lineHeight: 1.4, color: palette.ink, letterSpacing: "-0.01em" }}>
        "We do not call this 'artisan' cheese. There is no other kind in Georgia. We just call it cheese, and we make it the way we have always made it."
      </div>

      <H>What we owe to the village</H>
      <Para>When my parents left Tbilisi in 1991, they took two suitcases. One was full of clothes; the other had a wedge of sulguni wrapped in cheesecloth, a jar of pickled jonjoli, and the stone. They moved to Ohio because my mother had a cousin in Cleveland. They never set out to start a creamery.</Para>
      <Para>For thirty years, they made sulguni in the kitchen, and they handed wheels of it to neighbors and to other Georgian families who had landed in the Midwest. It was good cheese. It was not a business. The business is the thing my brother and I started in 2024, in a leased commercial kitchen on Tuller Road. The cheese is the thing my grandmother taught my mother, and my mother taught me, and my mother's mother's mother had taught hers.</Para>

      <H>What 'fresh every day' actually means</H>
      <Para>Sulguni does not keep. The fresh kind, the kind we ship in vacuum-sealed brine, is best within ten days. After that the texture firms up and the flavor gets sharp and a little funky, which is fine, which is its own kind of good, but it is not what we want to put in front of a person who is trying sulguni for the first time.</Para>
      <Para>So we make it every morning. The milk arrives at six. The wheels go into brine at eleven. By five in the afternoon, the day's batch is in a cooler on its way to UPS or to a restaurant in German Village or to a household in New Jersey that placed an order on Sunday night.</Para>
      <Para>This is what we mean when we say <em>ancient heritage, fresh every day.</em> The recipe is two thousand years old. The cheese is six hours old.</Para>
    </>
  );
}

// ─── ARTICLE PAGE ────────────────────────────────────────────────────────
function ArticlePage({ palette }) {
  const slug = getSlugFromUrl();
  const a = ARTICLES.find(x => x.slug === slug) || ARTICLES[0];
  const related = ARTICLES.filter(x => x.slug !== a.slug && x.kind === "essay").slice(0, 3);

  return (
    <article data-screen-label={`Article — ${a.title}`}>
      {/* Breadcrumb */}
      <div style={{ background: palette.cream, padding: "24px 56px 0" }} className="ch-breadcrumb">
        <div style={{ maxWidth: 920, margin: "0 auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>
          <a href="index.html" style={{ color: palette.muted, textDecoration: "none" }}>Colchis Food</a>
          <span style={{ margin: "0 10px" }}>/</span>
          <a href="Articles.html" style={{ color: palette.muted, textDecoration: "none" }}>The Journal</a>
          <span style={{ margin: "0 10px" }}>/</span>
          <span style={{ color: palette.ink }}>{a.category}</span>
        </div>
      </div>

      {/* Title block */}
      <header style={{ background: palette.cream, padding: "48px 56px 56px" }} className="ch-article-head">
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.32em", color: palette.accent, textTransform: "uppercase", marginBottom: 24 }}>
            № — {a.category}
          </div>
          <h1 className="ch-article-h1" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 76, lineHeight: 1.0, letterSpacing: "-0.025em", margin: 0, color: palette.ink, textWrap: "pretty" }}>
            {a.title}
          </h1>
          <p className="ch-article-dek" style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 24, lineHeight: 1.5, color: palette.ink2, marginTop: 28, marginBottom: 0, maxWidth: 760 }}>
            {a.dek}
          </p>
          <div style={{ display: "flex", gap: 22, marginTop: 36, paddingTop: 24, borderTop: `1px solid ${palette.ink}22`, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", flexWrap: "wrap" }} className="ch-article-meta">
            <span>By <span style={{ color: palette.ink }}>{a.author}</span></span>
            <span>{a.date}</span>
            <span>{a.readMin} min read</span>
            <span style={{ marginLeft: "auto" }}>Share · Save · Print</span>
          </div>
        </div>
      </header>

      {/* Hero image */}
      <div style={{ background: palette.cream, padding: "0 56px 56px" }} className="ch-article-hero-wrap">
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <ArticleArt kind={a.hero} palette={palette} ratio="16/8" />
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: palette.muted, textTransform: "uppercase", marginTop: 14 }}>
            Photograph — placeholder · replace with the real one
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ background: palette.cream, padding: "0 56px 96px" }} className="ch-article-body-wrap">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <ArticleBody palette={palette} />

          {/* End mark */}
          <div style={{ marginTop: 56, paddingTop: 36, borderTop: `1px solid ${palette.ink}22`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 18, color: palette.muted }}>— {a.author}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", color: palette.muted, textTransform: "uppercase" }}>END · {a.date}</div>
          </div>
        </div>
      </div>

      {/* Related */}
      <section style={{ background: palette.cream2, padding: "96px 56px" }} className="ch-section">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }} className="ch-section-header">
            <div className="ch-h2" style={{ fontFamily: "Fraunces, serif", fontWeight: 300, fontSize: 48, lineHeight: 1.05 }}>
              Keep <em style={{ color: palette.accent, fontWeight: 400 }}>reading.</em>
            </div>
            <a href="Articles.html" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", color: palette.ink, textTransform: "uppercase", textDecoration: "none", borderBottom: `1px solid ${palette.ink}` }}>All stories →</a>
          </div>
          <div className="ch-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
            {related.map(r => <ArticleCard key={r.slug} a={r} palette={palette} variant="standard" />)}
          </div>
        </div>
      </section>
    </article>
  );
}

window.ArticlePage = ArticlePage;
