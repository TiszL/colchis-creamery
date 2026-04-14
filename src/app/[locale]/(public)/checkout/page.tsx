import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface CheckoutPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CheckoutPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });

  return {
    title: t("title"),
    robots: { index: false, follow: true },
  };
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  const prefix = locale === "en" ? "" : `/${locale}`;

  return (
    <div className="bg-cream min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        {/* Placeholder checkout */}
        <div className="bg-white rounded-lg p-10 shadow-sm border border-border-light">
          <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="font-serif text-3xl text-charcoal mb-4">
            {t("comingSoon")}
          </h1>

          <p className="text-charcoal/60 mb-8 leading-relaxed max-w-md mx-auto">
            {t("comingSoonText")}
          </p>

          <Link href={`${prefix}/contact`}>
            <Button variant="primary" size="lg">
              {t("contactUs")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
