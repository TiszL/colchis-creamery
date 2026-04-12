import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/db";

export async function Footer() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const locale = await getLocale();
  const prefix = locale === "en" ? "" : `/${locale}`;
  const year = new Date().getFullYear();

  let emailConfig = 'sales@colchiscreamery.com';
  let phoneConfig = '+1 (614) 555-0123';
  let addressConfig = 'Columbus, Ohio, USA';
  try {
    const configs = await prisma.siteConfig.findMany({
      where: { key: { in: ['contact.email', 'contact.phone', 'contact.address'] } }
    });
    emailConfig = configs.find(c => c.key === 'contact.email')?.value || emailConfig;
    phoneConfig = configs.find(c => c.key === 'contact.phone')?.value || phoneConfig;
    addressConfig = configs.find(c => c.key === 'contact.address')?.value || addressConfig;
  } catch (err) {
    console.error('[Footer] DB unreachable, using defaults:', (err as Error).message);
  }

  return (
    <footer className="bg-charcoal text-white/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <h3 className="font-serif text-2xl text-white mb-3">
              Colchis<span className="text-gold"> Creamery</span>
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              {t("description")}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-medium text-gold text-sm uppercase tracking-wider mb-4">
              {t("quickLinks")}
            </h4>
            <ul className="space-y-2">
              {[
                { href: `${prefix}/heritage`, label: nav("heritage") },
                { href: `${prefix}/shop`, label: nav("shop") },
                { href: `${prefix}/recipes`, label: nav("recipes") },
                { href: `${prefix}/journal`, label: "Journal" },
                { href: `${prefix}/wholesale`, label: nav("wholesale") },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/60 hover:text-gold transition"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-medium text-gold text-sm uppercase tracking-wider mb-4">
              {t("support")}
            </h4>
            <ul className="space-y-2">
              {[
                { href: `${prefix}/contact`, label: nav("contact") },
                { href: `${prefix}/faq`, label: nav("faq") },
                { href: `${prefix}/legal/privacy`, label: "Privacy Policy" },
                { href: `${prefix}/legal/terms`, label: "Terms of Service" },
                { href: `${prefix}/legal/returns`, label: "Return Policy" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/60 hover:text-gold transition"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="font-medium text-gold text-sm uppercase tracking-wider mb-4">
              {t("connect")}
            </h4>
            <div className="space-y-3 text-sm text-white/60">
              <p>{emailConfig}</p>
              <p>{phoneConfig}</p>
              <p>{addressConfig}</p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/40">
            {t("copyright", { year })}
          </p>
          <p className="text-xs text-white/40">
            {t("madeIn")}
          </p>
        </div>
      </div>
    </footer>
  );
}
