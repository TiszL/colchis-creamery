import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HandCoins, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

// Server tips — payout report. Tips are the SERVERS' money passing through
// the company (a liability, not revenue): this page tells the owner exactly
// how much to pay each person through payroll for the chosen period.
// Attribution = the server who claimed the table on the KDS. Orders that were
// fully refunded are excluded (the tip went back to the customer).

const PERIOD_OPTIONS = [
    { value: "today", label: "Today", days: 1 },
    { value: "7d", label: "Last 7 days", days: 7 },
    { value: "14d", label: "Last 14 days", days: 14 },
    { value: "30d", label: "Last 30 days", days: 30 },
];

function fmtMoney(cents: number): string {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminTipsPage({
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
    const from = new Date(Date.now() - period.days * 24 * 60 * 60 * 1000);

    // One fulfillment per dine-in order (table orders are single-location), so
    // no double counting. paymentStatus PAID excludes both unpaid sessions and
    // fully-refunded orders; partial item refunds never touch the tip.
    // CANCELLED fulfillments are excluded from the payout — "Remove stale
    // order" cancels WITHOUT refunding, and a tip for food never served is not
    // payable; those orders surface separately below so the owner can decide
    // (usually: refund the customer).
    const allFulfillments = await prisma.orderFulfillment.findMany({
        where: {
            deliveryMethod: "IN_STORE_DINE_IN",
            createdAt: { gte: from },
            order: { tipCents: { gt: 0 }, paymentStatus: "PAID" },
        },
        select: {
            status: true,
            serverId: true,
            serverName: true,
            createdAt: true,
            location: { select: { name: true } },
            order: { select: { id: true, tipCents: true, tableNumber: true, totalAmount: true, stripeFeeCents: true } },
        },
        orderBy: { createdAt: "desc" },
    });
    const fulfillments = allFulfillments.filter(f => f.status !== "CANCELLED");
    const cancelledTipped = allFulfillments.filter(f => f.status === "CANCELLED");

    // Lawful card-fee deduction: the tip's pro-rata share of the REAL Stripe
    // processing fee for its charge (captured at payment time). Rows paid
    // before fee capture existed fall back to the standard 2.9% + 30¢
    // estimate and the report says so. Nothing else may be deducted from
    // tips (employer payroll taxes are the company's own obligation).
    const feeShareOf = (f: (typeof fulfillments)[number]): { cents: number; estimated: boolean } => {
        const orderTotalCents = Math.round((parseFloat(f.order.totalAmount) || 0) * 100);
        if (orderTotalCents <= 0) return { cents: 0, estimated: false };
        const realFee = f.order.stripeFeeCents;
        const fee = realFee ?? Math.round(orderTotalCents * 0.029 + 30);
        return { cents: Math.round(fee * f.order.tipCents / orderTotalCents), estimated: realFee === null };
    };

    type Row = { serverId: string | null; serverName: string; tipCents: number; feeCents: number; orders: number; locations: Set<string> };
    const byServer = new Map<string, Row>();
    let anyEstimated = false;
    for (const f of fulfillments) {
        const key = f.serverId ?? "__unassigned__";
        const row = byServer.get(key) ?? {
            serverId: f.serverId,
            serverName: f.serverId ? (f.serverName ?? "Server") : "Unassigned — no server claimed the table",
            tipCents: 0,
            feeCents: 0,
            orders: 0,
            locations: new Set<string>(),
        };
        const share = feeShareOf(f);
        if (share.estimated) anyEstimated = true;
        row.tipCents += f.order.tipCents;
        row.feeCents += share.cents;
        row.orders += 1;
        row.locations.add(f.location.name);
        byServer.set(key, row);
    }
    const rows = [...byServer.values()].sort((a, b) => b.tipCents - a.tipCents);
    const totalCents = rows.reduce((s, r) => s + r.tipCents, 0);
    const totalFeeCents = rows.reduce((s, r) => s + r.feeCents, 0);
    const totalNetCents = totalCents - totalFeeCents;
    const unassigned = fulfillments.filter(f => !f.serverId);
    const prefix = locale === "en" ? "" : `/${locale}`;

    return (
        <div className="space-y-8 max-w-5xl">
            <header className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-serif mb-1 flex items-center gap-2">
                        <HandCoins className="w-6 h-6 text-[#B96A3D]" /> Server tips
                    </h1>
                    <p className="text-sm text-gray-500 max-w-2xl">
                        Card tips from QR table ordering, attributed to the server who claimed each table.
                        Pass-through to your servers, net of each tip&apos;s card-processing share — pay the
                        net amounts via payroll. Fully-refunded orders are excluded.
                    </p>
                </div>
                <div className="flex gap-1.5">
                    {PERIOD_OPTIONS.map(p => (
                        <Link
                            key={p.value}
                            href={`${prefix}/admin/tips?period=${p.value}`}
                            className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider border transition-colors ${
                                p.value === period.value
                                    ? "bg-[#B96A3D] text-black border-[#B96A3D]"
                                    : "text-gray-400 border-[#ffffff1A] hover:text-white"
                            }`}
                        >
                            {p.label}
                        </Link>
                    ))}
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-[#161616] border border-[#ffffff0A] p-5">
                    <div className="text-3xl font-light text-white">{fmtMoney(totalCents)}</div>
                    <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Tips (gross) · {period.label}</div>
                </div>
                <div className="bg-[#161616] border border-[#ffffff0A] p-5">
                    <div className="text-3xl font-light text-gray-400">−{fmtMoney(totalFeeCents)}</div>
                    <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Card-fee share{anyEstimated ? " (partly est.)" : ""}</div>
                </div>
                <div className="bg-[#161616] border border-[#ffffff0A] p-5">
                    <div className="text-3xl font-light text-emerald-400">{fmtMoney(totalNetCents)}</div>
                    <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Net to pay out</div>
                </div>
                <div className="bg-[#161616] border border-[#ffffff0A] p-5">
                    <div className={`text-3xl font-light ${unassigned.length > 0 ? "text-amber-400" : "text-white"}`}>
                        {unassigned.length}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Unclaimed tipped orders</div>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="bg-[#161616] border border-[#ffffff0A] p-10 text-center text-gray-500 text-sm">
                    No tipped table orders in this period yet.
                </div>
            ) : (
                <div className="bg-[#161616] border border-[#ffffff0A] overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#ffffff0A]">
                                <th className="px-5 py-3">Server</th>
                                <th className="px-5 py-3">Location(s)</th>
                                <th className="px-5 py-3 text-right">Tipped orders</th>
                                <th className="px-5 py-3 text-right">Tips (gross)</th>
                                <th className="px-5 py-3 text-right">Card-fee share</th>
                                <th className="px-5 py-3 text-right">Net payout</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ffffff0A]">
                            {rows.map(r => (
                                <tr key={r.serverId ?? "unassigned"} className={r.serverId ? "" : "bg-amber-900/10"}>
                                    <td className="px-5 py-3 text-white">
                                        {r.serverId ? r.serverName : (
                                            <span className="text-amber-400 flex items-center gap-1.5">
                                                <AlertCircle className="w-3.5 h-3.5" /> {r.serverName}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-gray-400">{[...r.locations].join(", ")}</td>
                                    <td className="px-5 py-3 text-right font-mono text-gray-300">{r.orders}</td>
                                    <td className="px-5 py-3 text-right font-mono text-gray-300">{fmtMoney(r.tipCents)}</td>
                                    <td className="px-5 py-3 text-right font-mono text-gray-500">−{fmtMoney(r.feeCents)}</td>
                                    <td className="px-5 py-3 text-right font-mono text-emerald-400">{fmtMoney(r.tipCents - r.feeCents)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {unassigned.length > 0 && (
                <div className="bg-[#161616] border border-amber-800/40 p-5">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-amber-400 mb-3">
                        Unclaimed tipped orders — assign by memory, or split per house policy
                    </p>
                    <div className="space-y-1.5">
                        {unassigned.map(f => (
                            <p key={f.order.id} className="text-[12px] font-mono text-gray-400">
                                #{f.order.id.slice(0, 8).toUpperCase()} · Table {f.order.tableNumber ?? "?"} ·{" "}
                                {f.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ·{" "}
                                <span className="text-emerald-400">{fmtMoney(f.order.tipCents)}</span>
                            </p>
                        ))}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-3">
                        Tips stay attributable when servers tap “Claim table” on the order queue — remind the floor.
                    </p>
                </div>
            )}

            {cancelledTipped.length > 0 && (
                <div className="bg-[#161616] border border-red-800/40 p-5">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-red-400 mb-3">
                        Cancelled without refund — tip NOT payable; the customer paid for food never served
                    </p>
                    <div className="space-y-1.5">
                        {cancelledTipped.map(f => (
                            <p key={f.order.id} className="text-[12px] font-mono text-gray-400">
                                #{f.order.id.slice(0, 8).toUpperCase()} · Table {f.order.tableNumber ?? "?"} ·{" "}
                                {f.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ·{" "}
                                tip <span className="text-red-400">{fmtMoney(f.order.tipCents)}</span>
                                {f.serverName ? ` · claimed by ${f.serverName}` : ""}
                            </p>
                        ))}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-3">
                        These orders were cleared off the board without a refund. The right move is usually a full
                        refund from the admin order page — the customer's money (tip included) goes back to them.
                    </p>
                </div>
            )}

            <p className="text-[11px] text-gray-600 max-w-3xl">
                Bookkeeping note: these amounts are pass-through employee tips, not revenue — run the NET amount through
                payroll (withholding applies) and ask your accountant about the §45B FICA tip credit, which
                offsets the employer share of Social Security/Medicare on reported tips. The card-fee share is the
                tip&apos;s exact pro-rata slice of the real Stripe fee for its charge{anyEstimated ? " (older orders: 2.9% + 30¢ estimate)" : ""} —
                the only cost that may lawfully come out of tips. Employer payroll taxes may NOT be deducted from tips.
            </p>
        </div>
    );
}
