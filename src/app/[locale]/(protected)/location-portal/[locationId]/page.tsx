import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/location-rbac";
import { ClipboardList, AlertTriangle, Package, ArrowRight, CalendarClock, DollarSign, TrendingUp } from "lucide-react";
import { getRevenueSummary, getTopSkus } from "@/lib/analytics";

export const dynamic = "force-dynamic";

const EXPIRY_WINDOW_DAYS = 7;
const SALES_WINDOW_DAYS = 7;

export default async function LocationPortalOverview({
    params,
}: {
    params: Promise<{ locale: string; locationId: string }>;
}) {
    const { locale, locationId } = await params;
    const prefix = locale === "en" ? "" : `/${locale}`;
    const base = `${prefix}/location-portal/${locationId}`;

    // Waitstaff (SERVER-only) get the order tiles, not the money/stock ones —
    // revenue is the owner's business, not the floor's.
    const { ctx, matchedLocation } = await requireLocationAccess(locationId);
    const roles = matchedLocation?.roles ?? [];
    const serverOnly =
        !ctx.isMasterAdmin &&
        roles.includes("SERVER") &&
        !roles.includes("LOCATION_MANAGER") &&
        !roles.includes("LOCATION_FULFILLMENT");

    const today = new Date();
    const expiryHorizon = new Date(today.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const salesFrom = new Date(today.getTime() - SALES_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // Use per-Stock.lowStockThreshold (defaults to 0 in schema) so admins can
    // tune it per SKU instead of relying on a global constant. quantity == 0 is
    // ALWAYS low; otherwise quantity <= threshold counts (with threshold > 0).
    const [
        pendingCount, preparingCount, outForDeliveryCount,
        lowStockCount, expiringCount, totalStockRows,
        salesSummary, topSku,
    ] = await Promise.all([
        prisma.orderFulfillment.count({ where: { locationId, status: "PENDING" } }),
        prisma.orderFulfillment.count({ where: { locationId, status: "PREPARING" } }),
        prisma.orderFulfillment.count({ where: { locationId, status: "OUT_FOR_DELIVERY" } }),
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count
            FROM "Stock"
            WHERE "locationId" = ${locationId}
              AND "quantity" IS NOT NULL
              AND "quantity" <= "lowStockThreshold"
        `.then(rows => Number(rows[0]?.count ?? 0)),
        prisma.productBatch.count({
            where: {
                locationId,
                quantity: { gt: 0 },
                expiresAt: { lte: expiryHorizon, gte: today },
            },
        }),
        prisma.stock.count({ where: { locationId } }),
        // Phase 7 (7d) — location-scoped revenue + top SKU for the last 7 days.
        getRevenueSummary({ from: salesFrom, to: today, locationId }),
        getTopSkus({ from: salesFrom, to: today, locationId, limit: 1 }),
    ]);

    const salesValue = `$${(salesSummary.totalCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const tiles = serverOnly
        ? [
              { label: "Pending orders",   value: String(pendingCount),        href: `${base}/orders?status=PENDING`,          tone: "amber", icon: ClipboardList },
              { label: "Preparing",        value: String(preparingCount),      href: `${base}/orders?status=PREPARING`,        tone: "blue",  icon: ClipboardList },
              { label: "Out for delivery", value: String(outForDeliveryCount), href: `${base}/orders?status=OUT_FOR_DELIVERY`, tone: "green", icon: ClipboardList },
          ]
        : [
        { label: "Pending orders",       value: String(pendingCount),         href: `${base}/orders?status=PENDING`,         tone: "amber",  icon: ClipboardList },
        { label: "Preparing",            value: String(preparingCount),       href: `${base}/orders?status=PREPARING`,       tone: "blue",   icon: ClipboardList },
        { label: "Out for delivery",     value: String(outForDeliveryCount),  href: `${base}/orders?status=OUT_FOR_DELIVERY`, tone: "green", icon: ClipboardList },
        { label: `Sales last ${SALES_WINDOW_DAYS}d`, value: salesValue,       href: `${base}/orders`,                        tone: "green",  icon: DollarSign },
        { label: `Top SKU ${SALES_WINDOW_DAYS}d`, value: topSku[0]?.name ?? "—", href: `${base}/menu`,                       tone: "neutral", icon: TrendingUp, small: true },
        { label: "Low stock SKUs",       value: String(lowStockCount),        href: `${base}/inventory`,                     tone: "red",    icon: AlertTriangle },
        { label: `Expiring ≤ ${EXPIRY_WINDOW_DAYS}d`, value: String(expiringCount), href: `${base}/inventory`,               tone: "amber",  icon: CalendarClock },
        { label: "SKUs carried",         value: String(totalStockRows),       href: `${base}/menu`,                          tone: "neutral", icon: Package },
    ];

    return (
        <div className="space-y-8 max-w-5xl">
            <header>
                <h1 className="text-2xl font-serif mb-1">Operations overview</h1>
                <p className="text-sm text-gray-500">Live snapshot for this location. Click a tile to drill in.</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {tiles.map(t => (
                    <Link key={t.label} href={t.href} className="block bg-[#161616] border border-[#ffffff0A] hover:border-[#B96A3D]/40 p-5 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                            <t.icon className={`w-4 h-4 ${toneClass(t.tone)}`} />
                            <ArrowRight className="w-3.5 h-3.5 text-gray-600" />
                        </div>
                        <div className={`${t.small ? "text-lg" : "text-3xl"} font-light text-white truncate`}>{t.value}</div>
                        <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{t.label}</div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

function toneClass(tone: string): string {
    switch (tone) {
        case "amber":   return "text-amber-400";
        case "blue":    return "text-blue-400";
        case "green":   return "text-emerald-400";
        case "red":     return "text-red-400";
        default:        return "text-gray-400";
    }
}
