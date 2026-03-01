import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface HeroSectionProps {
  locale: string;
}

export function HeroSection({ locale }: HeroSectionProps) {
  const t = useTranslations("home");
  const prefix = locale === "en" ? "" : `/${locale}`;

  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden bg-[#FDFBF7]">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#FDFBF7]/90 z-10"></div>
        <img
          src="https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80"
          className="w-full h-full object-cover opacity-50 scale-105"
          alt="Colchis Heritage Landscapes"
        />
      </div>

      <div className="relative z-20 text-center px-6 max-w-4xl mx-auto">
        <div className="inline-block px-4 py-1 border border-[#CBA153] rounded-full text-[#CBA153] text-xs font-bold tracking-[0.2em] mb-8 uppercase animate-fade-in">
          Premium Artisanal Dairy
        </div>
        <h1 className="text-5xl md:text-8xl font-serif mb-8 text-[#2C2A29] leading-tight tracking-tight">
          Ancient Heritage, <br />
          <span className="italic text-[#CBA153]">Fresh Taste</span>
        </h1>
        <p className="text-lg md:text-xl text-[#2C2A29]/70 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
          {t("heroSubtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={`${prefix}/shop`} className="px-10 py-5 bg-[#CBA153] text-white font-bold rounded-sm tracking-widest uppercase hover:bg-[#b88e44] transition-all shadow-xl shadow-[#CBA153]/20">
            {t("shopCta")}
          </Link>
          <Link href={`${prefix}/wholesale`} className="px-10 py-5 border-2 border-[#2C2A29] text-[#2C2A29] font-bold rounded-sm tracking-widest uppercase hover:bg-[#2C2A29] hover:text-white transition-all">
            {t("wholesaleCta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
