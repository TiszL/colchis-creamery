import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { Users, FileText, ClipboardList, AlertCircle, Truck, ArrowRight, Repeat } from "lucide-react";

export const dynamic = "force-dynamic";

const OVERDUE_GRACE_DAYS = 0; // a B2bInvoice is overdue the moment dueAt passes

export default async function B2bAdminOverview({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const session = await getSession();
    if (!session) redirect(`/${locale}/portal-login`);
    if (session.role !== "MASTER_ADMIN") {
        const has = await prisma.userLocation.findFirst({
            where: { userId: session.userId, role: "B2B_SALES_MANAGER" },
            select: { id: true },
        });
        if (!has) redirect(`/${locale}/staff`);
    }

    const prefix = locale === "en" ? "" : `/${locale}`;
    const now = new Date();
    const overdueCutoff = new Date(now.getTime() - OVERDUE_GRACE_DAYS * 24 * 60 * 60 * 1000);

    const [
        leadsNew, leadsContacted, leadsConverted,
        contractsSigned,
        partnersActive,
        invoicesPending, invoicesOverdueByDueDate,
        arPendingCents, arOverdueCents,
        activeSchedules,
        activeB2bOrders,
    ] = await Promise.all([
        prisma.b2bLead.count({ where: { status: "NEW" } }),
        prisma.b2bLead.count({ where: { status: "CONTACTED" } }),
        prisma.b2bLead.count({ where: { status: "CONVERTED" } }),
        prisma.contract.count({ where: { status: "SIGNED" } }),
        prisma.b2bPartner.count(),
        prisma.b2bInvoice.count({ where: { status: "PENDING" } }),
        prisma.b2bInvoice.count({ where: { status: "PENDING", dueAt: { lt: overdueCutoff } } }),
        prisma.b2bInvoice.aggregate({ _sum: { amountCents: true }, where: { status: "PENDING" } }),
        prisma.b2bInvoice.aggregate({ _sum: { amountCents: true }, where: { status: "PENDING", dueAt: { lt: overdueCutoff } } }),
        prisma.recurringOrderSchedule.count({ where: { active: true } }),
        prisma.order.count({ where: { orderType: "B2B", orderStatus: { notIn: ["DELIVERED"] } } }),
    ]);

    // Recent invoices — top of the AR aging list
    const arRows = await prisma.b2bInvoice.findMany({
        where: { status: { in: ["PENDING", "OVERDUE"] } },
        include: {
            partner: { include: { user: { select: { name: true, email: true } } } },
        },
        orderBy: { dueAt: "asc" },
        take: 20,
    });

    // Recent leads
    const recentLeads = await prisma.b2bLead.findMany({
        where: { status: { in: ["NEW", "CONTACTED"] } },
        orderBy: { createdAt: "desc" },
        take: 10,
    });

    const fmtMoney = (cents: number | null | undefined) => `$${((cents ?? 0) / 100).toFixed(2)}`;

    return (
        <div className="space-y-8 max-w-6xl">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-serif text-white mb-1 flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#B96A3D]" /> B2B overview
                    </h1>
                    <p className="text-sm text-gray-500">Partner pipeline, accounts receivable, and active operations.</p>
                </div>
                <Link href={`${prefix}/admin/b2b/dispatch`} className="text-xs font-mono uppercase tracking-wider text-[#B96A3D] hover:text-white inline-flex items-center gap-1">
                    Dispatch queue <ArrowRight className="w-3 h-3" />
                </Link>
            </header>

            {/* Top-line tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Tile label="Active partners"      value={partnersActive}    icon={Users}         tone="neutral" />
                <Tile label="Signed contracts"    value={contractsSigned}   icon={FileText}      tone="neutral" />
                <Tile label="Active schedules"     value={activeSchedules}   icon={Repeat}        tone="neutral" />
                <Tile label="Orders in flight"     value={activeB2bOrders}   icon={Truck}         tone="amber"   href={`${prefix}/admin/b2b/dispatch`} />
                <Tile label="New leads"            value={leadsNew}          icon={ClipboardList} tone="blue"    href={`${prefix}/admin/requests`} />
                <Tile label="Contacted"           value={leadsContacted}    icon={ClipboardList} tone="neutral" href={`${prefix}/admin/requests`} />
                <Tile label="Converted (lifetime)" value={leadsConverted}   icon={ClipboardList} tone="green" />
                <Tile label="Pending AR"           value={fmtMoney(arPendingCents._sum.amountCents)} icon={FileText} tone="amber" />
            </div>

            {/* Overdue alert */}
            {invoicesOverdueByDueDate > 0 && (
                <div className="bg-red-950/30 border border-red-900/40 px-4 py-3 text-red-300 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                        <strong>{invoicesOverdueByDueDate}</strong> invoice{invoicesOverdueByDueDate === 1 ? " is" : "s are"} past due — {fmtMoney(arOverdueCents._sum.amountCents)} outstanding.
                    </span>
                </div>
            )}

            {/* AR aging */}
            <section>
                <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                    Open invoices <span className="text-gray-600">· {invoicesPending}</span>
                </h2>
                {arRows.length === 0 ? (
                    <div className="bg-[#161616] border border-[#ffffff0A] p-6 text-center text-gray-500 text-sm">
                        No open invoices.
                    </div>
                ) : (
                    <div className="bg-[#161616] border border-[#ffffff0A] divide-y divide-[#ffffff0A]">
                        {arRows.map(inv => {
                            const overdue = inv.dueAt && inv.dueAt < now;
                            return (
                                <div key={inv.id} className={`flex items-center justify-between px-4 py-3 ${overdue ? "bg-red-950/15" : ""}`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 ${overdue ? "bg-red-900/40 text-red-300" : "bg-amber-900/30 text-amber-400"}`}>
                                            {overdue ? "OVERDUE" : "PENDING"}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm text-white truncate">{inv.partner.user.name || inv.partner.user.email}</p>
                                            <p className="text-[10px] font-mono text-gray-500">
                                                {inv.paymentMethod.replace(/_/g, " ")} · order #{inv.orderId.slice(0, 8)}
                                                {inv.dueAt && <span> · due {inv.dueAt.toISOString().slice(0, 10)}</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-sm text-white font-mono shrink-0">
                                        {fmtMoney(inv.amountCents)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Recent leads */}
            <section>
                <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                    Recent leads <span className="text-gray-600">· {recentLeads.length}</span>
                </h2>
                {recentLeads.length === 0 ? (
                    <div className="bg-[#161616] border border-[#ffffff0A] p-6 text-center text-gray-500 text-sm">
                        No open leads. New applications come through <Link className="text-[#B96A3D] underline" href={`${prefix}/wholesale/apply`}>/wholesale/apply</Link>.
                    </div>
                ) : (
                    <div className="bg-[#161616] border border-[#ffffff0A] divide-y divide-[#ffffff0A]">
                        {recentLeads.map(l => (
                            <Link href={`${prefix}/admin/requests`} key={l.id} className="flex items-center justify-between px-4 py-3 hover:bg-[#1a1a1a]">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 ${l.status === "NEW" ? "bg-blue-900/30 text-blue-400" : "bg-gray-900/30 text-gray-400"}`}>
                                        {l.status}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm text-white truncate">{l.companyName}</p>
                                        <p className="text-[10px] font-mono text-gray-500">{l.email}{l.expectedVolume && <span> · {l.expectedVolume}</span>}</p>
                                    </div>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function Tile({ label, value, icon: Icon, tone, href }: {
    label: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    tone: "amber" | "blue" | "green" | "neutral";
    href?: string;
}) {
    const toneClass: Record<string, string> = {
        amber:   "text-amber-400",
        blue:    "text-blue-400",
        green:   "text-emerald-400",
        neutral: "text-gray-400",
    };
    const body = (
        <>
            <div className="flex items-center justify-between mb-2">
                <Icon className={`w-4 h-4 ${toneClass[tone]}`} />
                {href && <ArrowRight className="w-3 h-3 text-gray-600" />}
            </div>
            <div className="text-2xl font-light text-white">{value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">{label}</div>
        </>
    );
    if (href) {
        return <Link href={href} className="block bg-[#161616] border border-[#ffffff0A] hover:border-[#B96A3D]/40 p-4 transition-colors">{body}</Link>;
    }
    return <div className="block bg-[#161616] border border-[#ffffff0A] p-4">{body}</div>;
}
