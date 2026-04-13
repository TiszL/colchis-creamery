import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";

export const metadata: Metadata = {
  title: {
    default: "Colchis Creamery | Ancient Heritage, Fresh Taste",
    template: "%s | Colchis Creamery",
  },
  description:
    "Authentic Georgian artisanal cheese, handcrafted in Ohio with premium local milk. Shop Sulguni, Imeretian, and more.",
  keywords: [
    "Georgian cheese",
    "artisanal cheese",
    "Sulguni",
    "Imeretian cheese",
    "Ohio cheese",
    "Colchis Creamery",
    "premium cheese",
    "handcrafted cheese",
  ],
  openGraph: {
    type: "website",
    siteName: "Colchis Creamery",
    title: "Colchis Creamery | Ancient Heritage, Fresh Taste",
    description:
      "Authentic Georgian artisanal cheese, handcrafted in Ohio with premium local milk.",
  },
};
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Playfair_Display, Inter, Noto_Serif_Georgian, Noto_Sans_Georgian } from "next/font/google";
import { CartProvider } from "@/providers/CartProvider";
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
        <Analytics />
      </body>
    </html>
  );
}
