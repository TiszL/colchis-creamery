import Link from "next/link";
import { prisma } from "@/lib/db";
import { ClipboardList, AlertTriangle, Package, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LocationPortalOverview({
    params,
}: {
    params: Promise<{ locale: string; locationId: string }>;
}) {
    const { locale, locationId } = await params;
    const prefix = locale === "en" ? "" : `/${locale}`;
    const base = `${prefix}/location-portal/${locationId}`;

    // Pending / in-flight fulfillments for this location
    const [pendingCount, preparingCount, outForDeliveryCount, lowStockCount, totalStockRows] = await Promise.all([
        prisma.orderFulfillment.count({ where: { locationId, status: "PENDING" } }),
        prisma.orderFulfillment.count({ where: { locationId, status: "PREPARING" } }),
        prisma.orderFulfillment.count({ where: { locationId, status: "OUT_FOR_DELIVERY" } }),
        prisma.stock.count({
            where: {
                locationId,
                quantity: { not: null, lte: 5 }, // arbitrary low-stock threshold for now
            },
        }),
        prisma.stock.count({ where: { locationId } }),
    ]);

    const tiles = [
        { label: "Pending orders",       value: pendingCount,         href: `${base}/orders?status=PENDING`,         tone: "amber",  icon: ClipboardList },
        { label: "Preparing",            value: preparingCount,       href: `${base}/orders?status=PREPARING`,       tone: "blue",   icon: ClipboardList },
        { label: "Out for delivery",     value: outForDeliveryCount,  href: `${base}/orders?status=OUT_FOR_DELIVERY`, tone: "green", icon: ClipboardList },
        { label: "Low stock SKUs",       value: lowStockCount,        href: `${base}/inventory`,                     tone: "red",    icon: AlertTriangle },
        { label: "SKUs carried",         value: totalStockRows,       href: `${base}/menu`,                          tone: "neutral", icon: Package },
    ];

    return (
        <div className="space-y-8 max-w-5xl">
            <header>
                <h1 className="text-2xl font-serif mb-1">Operations overview</h1>
                <p className="text-sm text-gray-500">Live snapshot for this location. Click a tile to drill in.</p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {tiles.map(t => (
                    <Link key={t.label} href={t.href} className="block bg-[#161616] border border-[#ffffff0A] hover:border-[#B96A3D]/40 p-5 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                            <t.icon className={`w-4 h-4 ${toneClass(t.tone)}`} />
                            <ArrowRight className="w-3.5 h-3.5 text-gray-600" />
                        </div>
                        <div className="text-3xl font-light text-white">{t.value}</div>
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
