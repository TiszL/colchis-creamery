import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com'),
  title: {
    default: "Colchis Food | Georgian Cheese & Bread — Heritage Recipes, Made Fresh in Dublin, Ohio",
    template: "%s | Colchis Food",
  },
  description:
    "Ancient heritage, fresh every day. Hand-pressed sulguni and imeruli cheese, hot khachapuri baked in Dublin, Ohio. The Creamery ships nationwide. The Bakery delivers in 25 minutes.",
  keywords: [
    "Georgian cheese",
    "sulguni",
    "imeruli",
    "khachapuri",
    "Georgian bakery",
    "artisanal cheese Ohio",
    "Colchis Food",
    "Georgian food",
    "adjaruli khachapuri",
    "pulled-curd cheese",
    "handcrafted cheese",
    "Georgian heritage",
    "Dublin Ohio",
    "hot delivery khachapuri",
    "frozen khachapuri",
  ],
  openGraph: {
    type: "website",
    siteName: "Colchis Food",
    title: "Colchis Food | Georgian Cheese & Bread — Heritage Recipes, Made Fresh in Dublin, Ohio",
    description:
      "Ancient heritage, fresh every day. Hand-pressed sulguni and hot khachapuri, made in Dublin, Ohio.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Colchis Food | Georgian Cheese & Bread",
    description:
      "Ancient heritage, fresh every day. Hand-pressed sulguni and hot khachapuri, made in Dublin, Ohio.",
  },
  icons: {
    icon: "/brand/favicon.svg",
    apple: "/brand/app-icon.svg",
  },
};
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Fraunces, Inter, JetBrains_Mono, Noto_Serif_Georgian, Noto_Sans_Georgian } from "next/font/google";
import { CartProvider } from "@/providers/CartProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import TestingBanner from "@/components/site/TestingBanner";
import { getTestingMode } from "@/lib/site-config";
import "../globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
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
  // Phase E1.2 — fetch the pre-launch testing-mode config server-side so the
  // strip + modal render on first paint. Admin toggle in /admin/website/settings.
  const testingMode = await getTestingMode();

  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} ${notoSerifGeorgian.variable} ${notoSansGeorgian.variable}`}
    >
      <body className="antialiased min-h-screen bg-cream text-ink" suppressHydrationWarning>
        <TestingBanner config={testingMode} />
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
