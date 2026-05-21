import { cookies } from "next/headers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { JsonLdLocalBusiness } from "@/components/seo/JsonLdLocalBusiness";
import { JsonLdOrganization } from "@/components/seo/JsonLdOrganization";
import { AuthProvider } from "@/providers/AuthProvider";
import { LocationProvider, LOCATION_COOKIE_NAME } from "@/providers/LocationProvider";
import LiveChatWidget from "@/components/chat/LiveChatWidget";
import { getSocialUrls } from "@/lib/site-config";
import { getPrimaryLocation } from "@/lib/business-location";
import { prisma } from "@/lib/db";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Phase E1.7 — pull social URLs from SiteConfig so JsonLdOrganization.sameAs
  // can be edited from admin without redeploy. Empty/invalid URLs are filtered.
  // Phase 1 (1e) — also fetch the active locations for the sticky LocationPicker
  // and read the selected-location cookie so SSR matches the first client paint.
  const [socials, primary, activeLocations, cookieStore] = await Promise.all([
    getSocialUrls(),
    getPrimaryLocation(),
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, type: true, city: true, state: true,
        latitude: true, longitude: true, isPrimary: true,
        allowsChannels: true, displayDescription: true,
      },
    }),
    cookies(),
  ]);

  // Validate cookie value against current locations; ignore stale IDs so the
  // client provider's auto-pick falls back to the primary bakery.
  const rawCookieId = cookieStore.get(LOCATION_COOKIE_NAME)?.value ?? null;
  const initialSelectedId = rawCookieId && activeLocations.some(l => l.id === rawCookieId)
    ? rawCookieId
    : null;

  return (
    <AuthProvider>
      <LocationProvider locations={activeLocations} initialSelectedId={initialSelectedId}>
        <JsonLdLocalBusiness />
        <JsonLdOrganization socials={socials} />
        <Header primaryAddressShort={primary.addressLine1} />
        <main className="min-h-screen">{children}</main>
        <Footer />
        <LiveChatWidget />
      </LocationProvider>
    </AuthProvider>
  );
}
