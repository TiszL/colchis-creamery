import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { requireLocationAccess } from "@/lib/location-rbac";
import { MapPin, ClipboardList, ListChecks, Package, Home } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LocationPortalLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string; locationId: string }>;
}) {
    const { locale, locationId } = await params;

    // Phase 2 (2c+2d) — gate per-location access. Master admin bypass is
    // inside requireLocationAccess; non-admins must have a UserLocation row.
    const { ctx, matchedLocation } = await requireLocationAccess(locationId);

    const location = await prisma.location.findUnique({
        where: { id: locationId },
        select: { id: true, name: true, type: true, city: true, state: true, isActive: true },
    });
    if (!location) notFound();

    const prefix = locale === "en" ? "" : `/${locale}`;
    const base = `${prefix}/location-portal/${locationId}`;

    // Waitstaff (SERVER-only) live on the order queue — hide the menu/inventory
    // surfaces they can't use (their pages gate on kitchen roles anyway).
    const roles = matchedLocation?.roles ?? [];
    const serverOnly =
        !ctx.isMasterAdmin &&
        roles.includes("SERVER") &&
        !roles.includes("LOCATION_MANAGER") &&
        !roles.includes("LOCATION_FULFILLMENT");

    const navItems = serverOnly
        ? [
              { href: base, label: "Overview", icon: Home },
              { href: `${base}/orders`, label: "Orders", icon: ClipboardList },
          ]
        : [
              { href: base, label: "Overview", icon: Home },
              { href: `${base}/orders`, label: "Orders", icon: ClipboardList },
              { href: `${base}/menu`, label: "Menu", icon: ListChecks },
              { href: `${base}/inventory`, label: "Inventory", icon: Package },
          ];

    const roleLabel = ctx.isMasterAdmin
        ? "MASTER ADMIN"
        : (matchedLocation?.roles || []).join(" · ");

    return (
        <div className="min-h-screen bg-[#0C0C0C] text-white">
            <header className="border-b border-[#ffffff0A] bg-[#0F0F0F] px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-[#B96A3D]" />
                        <div>
                            <h1 className="text-lg font-semibold">{location.name}</h1>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                                {location.type.replace(/_/g, " ")} · {location.city}, {location.state}
                                {!location.isActive && <span className="text-amber-400 ml-2">· INACTIVE</span>}
                            </p>
                        </div>
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">
                        {roleLabel}
                    </div>
                </div>
            </header>

            {/* Mobile: nav becomes a horizontal scrollable bar above the
                content. Desktop (md+): nav becomes the left sidebar. */}
            <nav className="md:hidden flex overflow-x-auto border-b border-[#ffffff0A] scrollbar-hide">
                {navItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-1.5 px-4 py-3 text-xs text-gray-400 hover:text-white whitespace-nowrap shrink-0 border-r border-[#ffffff0A]"
                    >
                        <item.icon className="w-3.5 h-3.5" />
                        {item.label}
                    </Link>
                ))}
            </nav>

            <div className="flex">
                <nav className="hidden md:block w-56 shrink-0 border-r border-[#ffffff0A] min-h-[calc(100vh-72px)] py-4">
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-2.5 px-5 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-[#161616] transition-colors"
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <main className="flex-1 p-4 md:p-8 min-w-0">{children}</main>
            </div>
        </div>
    );
}
