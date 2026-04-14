import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";

export const metadata: Metadata = {
  title: {
    default: "Colchis Creamery | Authentic Georgian A2 Dairy — Heritage Recipes, Made Fresh in Ohio",
    template: "%s | Colchis Creamery",
  },
  description:
    "Authentic Georgian dairy crafted exclusively from 100% Grass-Fed A2 Brown Swiss Milk. Heritage recipes from ancient Colchian traditions, made fresh in Ohio. Shop Colchis Reserve™ artisanal and Colchis Classic everyday collections.",
  keywords: [
    "A2 Brown Swiss milk",
    "Georgian cheese",
    "authentic Georgian dairy",
    "artisanal cheese Ohio",
    "grass-fed A2 cheese",
    "Colchis Reserve",
    "Colchis Classic",
    "pulled-curd cheese",
    "farmer's cheese",
    "A2 whey spread",
    "Colchis Creamery",
    "premium dairy",
    "handcrafted cheese",
    "Georgian heritage dairy",
  ],
  openGraph: {
    type: "website",
    siteName: "Colchis Creamery",
    title: "Colchis Creamery | Authentic Georgian A2 Dairy — Heritage Recipes, Made Fresh in Ohio",
    description:
      "Crafted exclusively from 100% Grass-Fed A2 Brown Swiss Milk. Authentic Georgian dairy traditions, made fresh in Ohio.",
  },
};
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Playfair_Display, Inter, Noto_Serif_Georgian, Noto_Sans_Georgian } from "next/font/google";
import { CartProvider } from "@/providers/CartProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "../globals.css";

const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const notoSerifGeorgian = Noto_Serif_Georgian({
  subsets: ["georgian"],
  variable: "--font-noto-serif-georgian",
  display: "swap",
});

const notoSansGeorgian = Noto_Sans_Georgian({
  subsets: ["georgian"],
  variable: "--font-noto-sans-georgian",
  display: "swap",
});

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <html
      lang={locale}
      className={`${playfair.variable} ${inter.variable} ${notoSerifGeorgian.variable} ${notoSansGeorgian.variable}`}
    >
      <body className="antialiased min-h-screen bg-cream text-charcoal" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <CartProvider>
            {children}
          </CartProvider>
        </NextIntlClientProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
