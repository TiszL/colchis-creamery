import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/db";
import Image from "next/image";
import HeroCarousel from "./HeroCarousel";

interface HeroSectionProps {
  locale: string;
}

export async function HeroSection({ locale }: HeroSectionProps) {
  const t = await getTranslations({ locale, namespace: "home" });
  const prefix = locale === "en" ? "" : `/${locale}`;

  // Fetch all hero config from database
  let configs: { key: string; value: string }[] = [];
  try {
    configs = await prisma.siteConfig.findMany({
      where: { key: { startsWith: 'hero.' } }
    });
  } catch (err) {
    console.error('[HeroSection] DB unreachable, using translation defaults');
  }

  const g = (key: string, fallback: string) =>
    configs.find(c => c.key === key)?.value || fallback;

  // ─── Text ───────────────────────────────────────────────────────────────
  const heroTitle = g('hero.title', '');
  const heroSubtitle = g('hero.subtitle', '');
  const shopCta = g('hero.shopCta', '');
  const wholesaleCta = g('hero.wholesaleCta', '');
  const badgeText = g('hero.badgeText', 'Premium Artisanal Dairy');
  const videoUrl = g('hero.videoUrl', '');

  // ─── Visibility ─────────────────────────────────────────────────────────
  const showBadge = g('hero.showBadge', 'true') === 'true';
  const showTitle = g('hero.showTitle', 'true') === 'true';
  const showSubtitle = g('hero.showSubtitle', 'true') === 'true';
  const showBtnPrimary = g('hero.showBtnPrimary', 'true') === 'true';
  const showBtnSecondary = g('hero.showBtnSecondary', 'true') === 'true';

  // ─── Layout ──────────────────────────────────────────────────────────────
  const textSize = g('hero.textSize', 'lg');
  const posX = parseInt(g('hero.posX', '50'));
  const posY = parseInt(g('hero.posY', '50'));
  const badgeAlign = g('hero.badgeAlign', 'center');
  const titleAlign = g('hero.titleAlign', 'center');
  const subtitleAlign = g('hero.subtitleAlign', 'center');
  const btnAlign = g('hero.btnAlign', 'center');

  // ─── Overlay ────────────────────────────────────────────────────────────
  const overlayEnabled = g('hero.overlayEnabled', 'true') === 'true';
  const overlayOpacity = parseInt(g('hero.overlayOpacity', '50'));
  const overlayColor = g('hero.overlayColor', '#FDFBF7');

  // ─── Gradient ───────────────────────────────────────────────────────────
  const gradientEnabled = g('hero.gradientEnabled', 'true') === 'true';
  const gradientOpacity = parseInt(g('hero.gradientOpacity', '90'));

  // ─── Carousel ───────────────────────────────────────────────────────────
  const carouselInterval = parseInt(g('hero.carouselInterval', '6')) * 1000;
  const carouselTransition = g('hero.carouselTransition', 'fade') as 'fade' | 'slide' | 'zoom';
  const carouselTransitionDuration = parseInt(g('hero.carouselTransitionDuration', '1500'));

  // ─── Images ─────────────────────────────────────────────────────────────
  const singleImage = g('hero.imageUrl', '');
  const imagesRaw = g('hero.images', '');
  let heroImages: string[] = [];
  if (imagesRaw) heroImages = imagesRaw.split(',').map(u => u.trim()).filter(Boolean);
  if (heroImages.length === 0 && singleImage) heroImages = [singleImage];
  if (heroImages.length === 0) heroImages = ['https://u1on4xcfmtn0uyz6.public.blob.vercel-storage.com/products/1776099898316-seo1.webp'];

  // ─── Title parsing ──────────────────────────────────────────────────────
  const titleLine1 = heroTitle ? heroTitle.split(',')[0] || heroTitle : 'Ancient Heritage,';
  const titleLine2 = heroTitle ? heroTitle.split(',').slice(1).join(',').trim() || '' : 'Fresh Taste';

  // ─── Dynamic classes ────────────────────────────────────────────────────
  const titleSizes: Record<string, string> = {
    sm: 'text-3xl md:text-5xl', md: 'text-4xl md:text-6xl',
    lg: 'text-5xl md:text-8xl', xl: 'text-6xl md:text-9xl',
  };
  const subtitleSizes: Record<string, string> = {
    sm: 'text-sm md:text-base', md: 'text-base md:text-lg',
    lg: 'text-lg md:text-xl', xl: 'text-xl md:text-2xl',
  };

  // Smart transform: keeps content on-screen at edges
  const tx = posX < 25 ? '0%' : posX > 75 ? '-100%' : '-50%';
  const ty = posY < 25 ? '0%' : posY > 75 ? '-100%' : '-50%';

  const textAlignClass = (a: string) => a === 'left' ? 'text-left' : a === 'right' ? 'text-right' : 'text-center';
  const btnJustifyClass = (a: string) => a === 'left' ? 'justify-start' : a === 'right' ? 'justify-end' : 'justify-center';

  const hasAnyContent = showBadge || showTitle || showSubtitle || showBtnPrimary || showBtnSecondary;

  return (
    <section className="relative h-screen overflow-hidden bg-[#FDFBF7]">
      {/* Background Media */}
      <div className="absolute inset-0 z-0">
        {overlayEnabled && (
          <div className="absolute inset-0 z-[5]"
            style={{ backgroundColor: overlayColor, opacity: overlayOpacity / 100 }} />
        )}
        {gradientEnabled && (
          <div className="absolute inset-0 z-10"
            style={{
              background: `linear-gradient(to bottom, transparent 30%, ${overlayEnabled ? overlayColor : '#FDFBF7'} 100%)`,
              opacity: gradientOpacity / 100,
            }} />
        )}

        {videoUrl ? (
          <video autoPlay muted loop playsInline className="w-full h-full object-cover">
            <source src={videoUrl} type="video/mp4" />
          </video>
        ) : heroImages.length > 1 ? (
          <HeroCarousel images={heroImages} interval={carouselInterval} transition={carouselTransition} transitionDuration={carouselTransitionDuration} />
        ) : (
          <Image
            src={heroImages[0]}
            alt="Colchis Heritage Landscapes"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
      </div>

      {/* Content — positioned with percentage coordinates */}
      {hasAnyContent && (
        <div
          className="absolute z-20 max-w-4xl w-full px-6"
          style={{
            left: `${posX}%`,
            top: `${posY}%`,
            transform: `translate(${tx}, ${ty})`,
          }}
        >
          <div className="flex flex-col relative">
            {/* Invisible vignette for text legibility — no visible box */}
            <div className="absolute -inset-12 -z-10 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 50%, transparent 80%)' }} />

            {showBadge && (
              <div className={`flex w-full ${btnJustifyClass(badgeAlign)} mb-8`}>
                <div className="inline-block px-5 py-2 bg-white/10 border border-white/40 rounded-full text-white text-xs font-bold tracking-[0.2em] uppercase animate-fade-in backdrop-blur-sm" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                  {badgeText}
                </div>
              </div>
            )}

            {showTitle && (
              <h1
                className={`w-full ${titleSizes[textSize] || titleSizes.lg} font-serif mb-8 text-white leading-tight tracking-tight ${textAlignClass(titleAlign)}`}
                style={{ textShadow: '0 2px 16px rgba(0,0,0,0.6), 0 4px 32px rgba(0,0,0,0.3), 0 0 60px rgba(0,0,0,0.15)' }}
              >
                {titleLine1} <br />
                <span className="italic text-[#CBA153]" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.7), 0 4px 32px rgba(0,0,0,0.4), 0 0 60px rgba(0,0,0,0.2)' }}>{titleLine2}</span>
              </h1>
            )}

            {showSubtitle && (
              <p
                className={`${subtitleSizes[textSize] || subtitleSizes.lg} text-white/95 mb-10 max-w-2xl font-light leading-relaxed ${textAlignClass(subtitleAlign)} ${subtitleAlign === 'center' ? 'self-center' : subtitleAlign === 'right' ? 'self-end' : 'self-start'}`}
                style={{ textShadow: '0 1px 10px rgba(0,0,0,0.6), 0 2px 20px rgba(0,0,0,0.3)' }}
              >
                {heroSubtitle || t("heroSubtitle")}
              </p>
            )}

            {(showBtnPrimary || showBtnSecondary) && (
              <div className={`flex flex-col sm:flex-row gap-4 w-full ${btnJustifyClass(btnAlign)}`}>
                {showBtnPrimary && (
                  <Link href={`${prefix}/shop`} className="px-10 py-5 bg-[#CBA153] text-white font-bold rounded-sm tracking-widest uppercase hover:bg-[#B5922E] transition-all shadow-lg shadow-black/25 hover:shadow-xl">
                    {shopCta || t("shopCta")}
                  </Link>
                )}
                {showBtnSecondary && (
                  <Link href={`${prefix}/wholesale`} className="px-10 py-5 border-2 border-white/70 text-white font-bold rounded-sm tracking-widest uppercase hover:bg-white hover:text-[#2C2A29] hover:border-white transition-all backdrop-blur-sm" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.4)' }}>
                    {wholesaleCta || t("wholesaleCta")}
                  </Link>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </section>
  );
}
