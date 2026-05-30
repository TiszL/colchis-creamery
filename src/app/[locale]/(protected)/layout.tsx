import { cookies } from "next/headers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/providers/AuthProvider";
import { LocationProvider, LOCATION_COOKIE_NAME } from "@/providers/LocationProvider";
import ProtectedShell from "@/components/layout/ProtectedShell";
import { getPrimaryLocation } from "@/lib/business-location";
import { prisma } from "@/lib/db";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The shared Header renders the sticky LocationPicker, which calls
  // useLocation() and therefore REQUIRES a LocationProvider ancestor — exactly
  // like the (public) layout. Without it, protected routes that render this
  // Header directly (e.g. /account) throw "useLocation must be used within a
  // LocationProvider" and 500 on the server. Mirror the (public) setup.
  const [primary, activeLocations, cookieStore] = await Promise.all([
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

  const rawCookieId = cookieStore.get(LOCATION_COOKIE_NAME)?.value ?? null;
  const initialSelectedId = rawCookieId && activeLocations.some(l => l.id === rawCookieId)
    ? rawCookieId
    : null;

  return (
    <AuthProvider>
      <LocationProvider locations={activeLocations} initialSelectedId={initialSelectedId}>
        <ProtectedShell header={<Header primaryAddressShort={primary.addressLine1} />} footer={<Footer />}>
          {children}
        </ProtectedShell>
      </LocationProvider>
    </AuthProvider>
  );
}
