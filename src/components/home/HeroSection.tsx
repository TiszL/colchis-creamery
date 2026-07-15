"use client";

import { DeliverySelector } from "./DeliverySelector";
import HeroCarousel from "./HeroCarousel";
import Link from "next/link";

// Default content — used when no DB content exists
const DEFAULTS = {
  eyebrow: '№ 01 — From Colchis, est. MMXXVI',
  headline: 'Bread,\ncheese,\nand a country\nyou should know.',
  headline_accent: 'and a country',
  subheadline: 'Six thousand years of recipes, hand-pressed and hand-baked in Dublin, Ohio. Hot khachapuri to your door tonight, or aged sulguni shipped to all fifty states.',
  cta_primary: 'Shop the Creamery →',
  cta_primary_link: '/shop',
  cta_secondary: 'Read our story',
  cta_secondary_link: '/heritage',
  badge_label: 'HOT NOW',
  badge_value: '25 min',
  badge_location: 'DUBLIN OH',
};

const TICKER_DEFAULTS = {
  items: [
    '◐ The Bakery — open until 9 PM',
    '▸ Free UPS over $75',
    '● Made in Dublin, Ohio',
  ],
};

interface HeroMedia {
  images: string[];
  videoUrl: string;
  carouselInterval: number;
  carouselTransition: 'fade' | 'slide' | 'zoom';
  carouselTransitionDuration: number;
  overlayEnabled: boolean;
  overlayOpacity: number;
  overlayColor: string;
  gradientEnabled: boolean;
  gradientOpacity: number;
}

interface HeroSectionProps {
  locale: string;
  content?: typeof DEFAULTS | null;
  ticker?: typeof TICKER_DEFAULTS | null;
  heroMedia?: HeroMedia | null;
  /** NEXT_PUBLIC_GOOGLE_MAPS_KEY — threaded to DeliverySelector for ZIP/geo geocoding. */
  mapsApiKey?: string;
}

export function HeroSection({ locale, content, ticker, heroMedia, mapsApiKey }: HeroSectionProps) {
  const prefix = locale === "en" ? "" : `/${locale}`;
  const d = content || DEFAULTS;
  const t = ticker || TICKER_DEFAULTS;
  const media = heroMedia || null;

  const hasImages = media && media.images.length > 0;
  const hasVideo = media && media.videoUrl && media.videoUrl.trim().length > 0;

  // Build headline with accent highlighting
  const renderHeadline = () => {
    const lines = d.headline.split('\n');
    return lines.map((line: string, i: number) => {
      const isAccent = d.headline_accent && line.includes(d.headline_accent);
      return (
        <span key={i}>
          {isAccent ? (
            <>
              {line.replace(d.headline_accent, '')}
              <em style={{ color: "#8B4A28", fontWeight: 300 }}>{d.headline_accent}</em>
            </>
          ) : line}
          {i < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  // Render media area (images, video, or placeholder)
  const renderMedia = () => {
    if (hasVideo) {
      return (
        <div style={{ width: "100%", aspectRatio: "4/3", position: "relative", overflow: "hidden", border: "1px solid rgba(245,240,230,0.14)" }}>
          <video
            src={media!.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {media!.overlayEnabled && (
            <div style={{
              position: "absolute", inset: 0,
              backgroundColor: media!.overlayColor,
              opacity: media!.overlayOpacity / 100,
              pointerEvents: "none",
            }} />
          )}
          {media!.gradientEnabled && (
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(to top, #1F3026 0%, transparent 50%)`,
              opacity: media!.gradientOpacity / 100,
              pointerEvents: "none",
            }} />
          )}
        </div>
      );
    }

    if (hasImages) {
      return (
        <div style={{ width: "100%", aspectRatio: "4/3", position: "relative", overflow: "hidden", border: "1px solid rgba(245,240,230,0.14)" }}>
          <HeroCarousel
            images={media!.images}
            interval={media!.carouselInterval}
            transition={media!.carouselTransition}
            transitionDuration={media!.carouselTransitionDuration}
          />
          {media!.overlayEnabled && (
            <div style={{
              position: "absolute", inset: 0,
              backgroundColor: media!.overlayColor,
              opacity: media!.overlayOpacity / 100,
              pointerEvents: "none",
              zIndex: 5,
            }} />
          )}
          {media!.gradientEnabled && (
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(to top, #1F3026 0%, transparent 50%)`,
              opacity: media!.gradientOpacity / 100,
              pointerEvents: "none",
              zIndex: 5,
            }} />
          )}
        </div>
      );
    }

    // Placeholder fallback
    return (
      <div style={{ width: "100%", aspectRatio: "4/3", background: `repeating-linear-gradient(45deg, #2C3D33, #2C3D33 1px, #1F3026 1px, #1F3026 8px)`, border: "1px solid rgba(245,240,230,0.14)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#F5F0E6", opacity: 0.5, textTransform: "uppercase", textAlign: "center" }}>
          [ Hero photo ]<br /><span style={{ opacity: 0.7 }}>Adjaruli khachapuri, still steaming</span>
        </div>
      </div>
    );
  };

  return (
    <section style={{ background: "#1F3026", color: "#F5F0E6", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(#F5F0E606 1px, transparent 1px), linear-gradient(90deg, #F5F0E606 1px, transparent 1px)`, backgroundSize: "80px 80px", pointerEvents: "none" }} />

      <div className="ch-hero-grid" style={{ maxWidth: 1440, margin: "0 auto", padding: "120px 56px 100px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 72, position: "relative" }}>
        <div>
          <div className="ch-hero-eyebrow" style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#8B4A28", textTransform: "uppercase", marginBottom: 28 }}>
            {d.eyebrow}
          </div>

          <h1 className="ch-hero-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 128, lineHeight: 0.9, letterSpacing: "-0.03em", color: "#F5F0E6", margin: 0 }}>
            {renderHeadline()}
          </h1>

          <p className="ch-hero-lead" style={{ marginTop: 36, fontFamily: "var(--font-serif)", fontSize: 20, lineHeight: 1.55, color: "#F5F0E6", opacity: 0.78, maxWidth: 540, fontStyle: "italic" }}>
            {d.subheadline}
          </p>

          <div className="ch-hero-ctas" style={{ display: "flex", gap: 14, marginTop: 40 }}>
            <Link href={`${prefix}${d.cta_primary_link}`} style={{ background: "#B96A3D", color: "#F5F0E6", border: "none", padding: "16px 30px", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
              {d.cta_primary}
            </Link>
            <Link href={`${prefix}${d.cta_secondary_link}`} style={{ background: "transparent", color: "#F5F0E6", border: "1px solid rgba(245,240,230,0.33)", padding: "16px 30px", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
              {d.cta_secondary}
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ position: "relative" }}>
            {renderMedia()}
            <div className="ch-hero-badge" style={{ position: "absolute", top: 20, right: 20, width: 110, height: 110, borderRadius: "50%", background: "#B96A3D", color: "#F5F0E6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 1.1, zIndex: 10 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.24em" }}>{d.badge_label}</div>
              <div className="ch-hero-badge-min" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 26, marginTop: 4 }}>{d.badge_value}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.16em", marginTop: 4 }}>{d.badge_location}</div>
            </div>
          </div>
          <DeliverySelector apiKey={mapsApiKey} linkPrefix={prefix} />
        </div>
      </div>

      <div className="ch-ticker" style={{ borderTop: "1px solid rgba(245,240,230,0.14)", padding: "18px 56px", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "#F5F0E6", opacity: 0.6 }}>
        {t.items.map((item: string, i: number) => (
          <span key={i}>{item}</span>
        ))}
      </div>
    </section>
  );
}
