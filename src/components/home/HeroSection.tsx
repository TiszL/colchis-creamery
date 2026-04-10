import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/db";
import HeroCarousel from "./HeroCarousel";

interface HeroSectionProps {
  locale: string;
}

export async function HeroSection({ locale }: HeroSectionProps) {
  const t = await getTranslations({ locale, namespace: "home" });
  const prefix = locale === "en" ? "" : `/${locale}`;

  // Fetch hero config from database
  const configs = await prisma.siteConfig.findMany({
    where: {
      key: { in: ['hero.title', 'hero.subtitle', 'hero.shopCta', 'hero.wholesaleCta', 'hero.imageUrl', 'hero.images', 'hero.videoUrl'] }
    }
  });

  const getVal = (key: string, fallback: string) =>
    configs.find(c => c.key === key)?.value || fallback;

  const heroTitle = getVal('hero.title', '');
  const heroSubtitle = getVal('hero.subtitle', '');
  const shopCta = getVal('hero.shopCta', '');
  const wholesaleCta = getVal('hero.wholesaleCta', '');
  const singleImage = getVal('hero.imageUrl', '');
  const imagesRaw = getVal('hero.images', '');
  const videoUrl = getVal('hero.videoUrl', '');

  // Parse images: either from hero.images (comma-separated) or hero.imageUrl (single)
  let heroImages: string[] = [];
  if (imagesRaw) {
    heroImages = imagesRaw.split(',').map(u => u.trim()).filter(Boolean);
  }
  if (heroImages.length === 0 && singleImage) {
    heroImages = [singleImage];
  }
  // Fallback to default
  if (heroImages.length === 0) {
    heroImages = ['https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80'];
  }

  // Determine title parts (split on comma or newline for styled display)
  const titleLine1 = heroTitle ? heroTitle.split(',')[0] || heroTitle : 'Ancient Heritage,';
  const titleLine2 = heroTitle ? heroTitle.split(',').slice(1).join(',').trim() || '' : 'Fresh Taste';

  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden bg-[#FDFBF7]">
      {/* Background Media */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#FDFBF7]/90 z-10"></div>
        {videoUrl ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover opacity-50 scale-105"
          >
            <source src={videoUrl} type="video/mp4" />
          </video>
        ) : heroImages.length > 1 ? (
          <HeroCarousel images={heroImages} />
        ) : (
          <img
            src={heroImages[0]}
            className="w-full h-full object-cover opacity-50 scale-105"
            alt="Colchis Heritage Landscapes"
          />
        )}
      </div>

      <div className="relative z-20 text-center px-6 max-w-4xl mx-auto">
        <div className="inline-block px-4 py-1 border border-[#CBA153] rounded-full text-[#CBA153] text-xs font-bold tracking-[0.2em] mb-8 uppercase animate-fade-in">
          Premium Artisanal Dairy
        </div>
        <h1 className="text-5xl md:text-8xl font-serif mb-8 text-[#2C2A29] leading-tight tracking-tight">
          {titleLine1} <br />
          <span className="italic text-[#CBA153]">{titleLine2}</span>
        </h1>
        <p className="text-lg md:text-xl text-[#2C2A29]/70 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
          {heroSubtitle || t("heroSubtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={`${prefix}/shop`} className="px-10 py-5 bg-[#CBA153] text-white font-bold rounded-sm tracking-widest uppercase hover:bg-[#b88e44] transition-all shadow-xl shadow-[#CBA153]/20">
            {shopCta || t("shopCta")}
          </Link>
          <Link href={`${prefix}/wholesale`} className="px-10 py-5 border-2 border-[#2C2A29] text-[#2C2A29] font-bold rounded-sm tracking-widest uppercase hover:bg-[#2C2A29] hover:text-white transition-all">
            {wholesaleCta || t("wholesaleCta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
