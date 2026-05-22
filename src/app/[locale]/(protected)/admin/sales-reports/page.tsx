import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { BarChart3, Download, ArrowRight, TrendingUp, AlertCircle } from "lucide-react";
import { RevenueBarChart, ChannelSplitChart } from "@/components/admin/AnalyticsCharts";
import {
    getRevenueSummary,
    getRevenueByLocation,
    getRevenueByDeliveryMethod,
    getTopSkus,
    getInventoryDaysOnHand,
    getArAging,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

const PERIOD_OPTIONS = [
    { value: "7d",   label: "Last 7 days",  days: 7 },
    { value: "30d",  label: "Last 30 days", days: 30 },
    { value: "90d",  label: "Last 90 days", days: 90 },
    { value: "365d", label: "Last 365 days", days: 365 },
];

function fmtMoney(cents: number | null | undefined): string {
    return `$${(((cents ?? 0)) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminAnalyticsPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ period?: string }>;
}) {
    const { locale } = await params;
    const { period: periodRaw } = await searchParams;
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") redirect(`/${locale}/portal-login`);

    const period = PERIOD_OPTIONS.find(p => p.value === periodRaw) ?? PERIOD_OPTIONS[1];
    const window = {
        from: new Date(Date.now() - period.days * 24 * 60 * 60 * 1000),
        to: new Date(),
    };

    const prefix = locale === "en" ? "" : `/${locale}`;

    const [summary, byLocation, byDeliveryMethod, topSkus, lowDaysOnHand, arBuckets] = await Promise.all([
        getRevenueSummary(window),
        getRevenueByLocation(window),
        getRevenueByDeliveryMethod(window),
        getTopSkus({ ...window, limit: 10 }),
        getInventoryDaysOnHand({ limit: 10 }),
        getArAging(),
    ]);

    const arTotalCents = arBuckets.reduce((s, b) => s + b.cents, 0);

    return (
        <div className="space-y-8 max-w-7xl">
            <header className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-serif text-white mb-1 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-[#B96A3D]" /> Analytics
                    </h1>
                    <p className="text-sm text-gray-500">Revenue, margin, inventory turn, and AR — org-wide.</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Period selector via plain links — fully server-rendered */}
                    <div className="flex items-center gap-1 bg-[#161616] border border-[#ffffff0A]">
                        {PERIOD_OPTIONS.map(p => (
                            <Link
                                key={p.value}
                                href={`${prefix}/admin/sales-reports?period=${p.value}`}
                                className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider ${p.value === period.value ? "bg-[#B96A3D] text-black" : "text-gray-400 hover:text-white"}`}
                            >
                                {p.label.replace("Last ", "")}
                            </Link>
                        ))}
                    </div>
                    <Link
                        href={`${prefix}/api/admin/exports/orders.csv?from=${window.from.toISOString()}&to=${window.to.toISOString()}`}
                        className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-gray-400 border border-[#ffffff0A] hover:border-[#B96A3D]/40 hover:text-white inline-flex items-center gap-1"
                    >
                        <Download className="w-3 h-3" /> Orders CSV
                    </Link>
                </div>
            </header>

            {/* Top-line tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Tile label="Revenue (period)"  value={fmtMoney(summary.totalCents)}    tone="green" />
                <Tile label="Orders"            value={summary.orderCount.toString()}   tone="neutral" />
                <Tile label="B2C / B2B"         value={`${fmtMoney(summary.b2cCents)} · ${fmtMoney(summary.b2bCents)}`} tone="blue" small />
                <Tile label="Open B2B AR"       value={fmtMoney(arTotalCents)}          tone={arBuckets.find(b => b.bucket === "60d+")!.cents > 0 ? "red" : "amber"} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <RevenueBarChart
                    title="Revenue by location"
                    series={[{ label: "Revenue", data: byLocation.map(r => ({ label: r.locationName, value: r.cents })) }]}
                />
                <ChannelSplitChart b2cCents={summary.b2cCents} b2bCents={summary.b2bCents} />
                <RevenueBarChart
                    title="Revenue by delivery method"
                    series={[{ label: "Revenue", data: byDeliveryMethod.map(r => ({ label: r.deliveryMethod.replace(/_/g, " "), value: r.cents })) }]}
                />
                {/* AR aging buckets */}
                <div className="bg-[#161616] border border-[#ffffff0A] p-5">
                    <h3 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-3">AR aging</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {arBuckets.map(b => (
                            <div key={b.bucket} className="bg-[#0F0F0F] border border-[#ffffff0A] p-3">
                                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1">{b.bucket}</p>
                                <p className={`text-lg font-light ${b.bucket === "60d+" && b.cents > 0 ? "text-red-400" : "text-white"}`}>
                                    {fmtMoney(b.cents)}
                                </p>
                                <p className="text-[10px] text-gray-600 mt-0.5">{b.invoiceCount} invoices</p>
                            </div>
                        ))}
                    </div>
                    {arBuckets.find(b => b.bucket === "60d+")!.cents > 0 && (
                        <p className="text-xs text-red-400 mt-3 inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Invoices &gt; 60 days overdue — escalate to collections.
                        </p>
                    )}
                </div>
            </div>

            {/* Top SKUs */}
            <section>
                <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5" /> Top SKUs (by revenue)
                </h2>
                <div className="bg-[#161616] border border-[#ffffff0A] divide-y divide-[#ffffff0A]">
                    {topSkus.length === 0 && (
                        <div className="px-4 py-8 text-center text-gray-500 text-sm">No sales in this window.</div>
                    )}
                    {topSkus.map(sku => (
                        <div key={sku.productId} className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-[10px] font-mono text-[#B96A3D]">{sku.salesChannel.replace(/_/g, " ")}</span>
                                <p className="text-sm text-white truncate">{sku.name}</p>
                                <span className="text-[10px] font-mono text-gray-500">{sku.sku}</span>
                            </div>
                            <div className="flex items-center gap-4 shrink-0 text-right">
                                <div>
                                    <p className="text-sm text-white font-mono">{fmtMoney(sku.cents)}</p>
                                    <p className="text-[10px] text-gray-500">{sku.quantity} units</p>
                                </div>
                                <div className="w-24 text-right">
                                    {sku.grossMarginCents === null ? (
                                        <p className="text-[10px] text-gray-600 italic">no COGS</p>
                                    ) : (
                                        <>
                                            <p className="text-sm text-emerald-400 font-mono">{fmtMoney(sku.grossMarginCents)}</p>
                                            <p className="text-[10px] text-gray-500">{sku.cents > 0 ? `${((sku.grossMarginCents / sku.cents) * 100).toFixed(0)}%` : "—"}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Inventory days-on-hand — most urgent first */}
            <section>
                <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                    Inventory days-on-hand <span className="text-gray-600">· most urgent</span>
                </h2>
                {lowDaysOnHand.length === 0 ? (
                    <div className="bg-[#161616] border border-[#ffffff0A] p-6 text-center text-gray-500 text-sm">
                        No tracked stock rows.
                    </div>
                ) : (
                    <div className="bg-[#161616] border border-[#ffffff0A] divide-y divide-[#ffffff0A]">
                        {lowDaysOnHand.map(r => {
                            const urgent = r.daysOnHand !== Infinity && r.daysOnHand < 7;
                            const moderate = r.daysOnHand !== Infinity && r.daysOnHand < 14;
                            return (
                                <div key={`${r.productId}-${r.locationId}`} className={`flex items-center justify-between px-4 py-3 ${urgent ? "bg-red-950/15" : ""}`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <p className="text-sm text-white truncate">{r.name}</p>
                                        <span className="text-[10px] font-mono text-gray-500">{r.sku}</span>
                                        <span className="text-[10px] font-mono text-gray-600">{r.locationName}</span>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0 text-right">
                                        <div>
                                            <p className="text-sm text-white font-mono">{r.currentQty}</p>
                                            <p className="text-[10px] text-gray-500">in stock</p>
                                        </div>
                                        <div className="w-24 text-right">
                                            <p className={`text-sm font-mono ${urgent ? "text-red-400" : moderate ? "text-amber-400" : "text-white"}`}>
                                                {r.daysOnHand === Infinity ? "∞" : `${r.daysOnHand.toFixed(1)}d`}
                                            </p>
                                            <p className="text-[10px] text-gray-500">{r.soldLast30} sold/30d</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Per-location revenue table footer */}
            {byLocation.length > 0 && (
                <section>
                    <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                        Revenue by location <span className="text-gray-600">· {period.label.toLowerCase()}</span>
                    </h2>
                    <div className="bg-[#161616] border border-[#ffffff0A] divide-y divide-[#ffffff0A]">
                        {byLocation.map(r => (
                            <Link href={`${prefix}/location-portal/${r.locationId}`} key={r.locationId} className="flex items-center justify-between px-4 py-3 hover:bg-[#1a1a1a]">
                                <div className="flex items-center gap-3">
                                    <p className="text-sm text-white">{r.locationName}</p>
                                    <span className="text-[10px] font-mono text-gray-500">{r.orderCount} orders</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="text-sm text-white font-mono">{fmtMoney(r.cents)}</p>
                                    <ArrowRight className="w-3 h-3 text-gray-600" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

function Tile({ label, value, tone, small }: {
    label: string;
    value: string;
    tone: "green" | "blue" | "amber" | "red" | "neutral";
    small?: boolean;
}) {
    const toneClass: Record<string, string> = {
        green:  "text-emerald-400",
        blue:   "text-blue-400",
        amber:  "text-amber-400",
        red:    "text-red-400",
        neutral:"text-gray-400",
    };
    return (
        <div className="bg-[#161616] border border-[#ffffff0A] p-4">
            <div className={`w-1 h-3 mb-2 ${toneClass[tone].replace("text-", "bg-")}`} />
            <p className={`${small ? "text-lg" : "text-2xl"} font-light text-white`}>{value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">{label}</p>
        </div>
    );
}
