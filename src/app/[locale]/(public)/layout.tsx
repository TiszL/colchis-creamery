import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { JsonLdLocalBusiness } from "@/components/seo/JsonLdLocalBusiness";
import { JsonLdOrganization } from "@/components/seo/JsonLdOrganization";
import { AuthProvider } from "@/providers/AuthProvider";
import LiveChatWidget from "@/components/chat/LiveChatWidget";
import { getSocialUrls } from "@/lib/site-config";
import { getPrimaryLocation } from "@/lib/business-location";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Phase E1.7 — pull social URLs from SiteConfig so JsonLdOrganization.sameAs
  // can be edited from admin without redeploy. Empty/invalid URLs are filtered.
  const [socials, primary] = await Promise.all([
    getSocialUrls(),
    getPrimaryLocation(),
  ]);

  return (
    <AuthProvider>
      <JsonLdLocalBusiness />
      <JsonLdOrganization socials={socials} />
      <Header primaryAddressShort={primary.addressLine1} />
      <main className="min-h-screen">{children}</main>
      <Footer />
      <LiveChatWidget />
    </AuthProvider>
  );
}
