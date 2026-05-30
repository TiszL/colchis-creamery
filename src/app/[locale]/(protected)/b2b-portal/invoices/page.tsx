import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { FileText, AlertCircle, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

function money(cents: number): string {
    return `$${((cents ?? 0) / 100).toFixed(2)}`;
}
function ymd(d: Date | null): string {
    return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function PartnerInvoicesPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session) redirect(`/${locale}/b2b/login`);
    if (session.role !== "B2B_PARTNER" && session.role !== "MASTER_ADMIN") redirect(`/${locale}/`);

    const partner = session.role === "B2B_PARTNER"
        ? await prisma.b2bPartner.findUnique({ where: { userId: session.userId }, select: { id: true } })
        : null;

    const invoices = partner
        ? await prisma.b2bInvoice.findMany({
            where: { partnerId: partner.id },
            orderBy: { issuedAt: "desc" },
            include: { order: { select: { id: true } } },
        })
        : [];

    const now = new Date();
    const isOpen = (i: typeof invoices[number]) => i.status === "PENDING" || i.status === "OVERDUE";
    const isOverdue = (i: typeof invoices[number]) => isOpen(i) && !!i.dueAt && i.dueAt < now;
    const outstandingCents = invoices.filter(isOpen).reduce((s, i) => s + i.amountCents, 0);
    const overdueCents = invoices.filter(isOverdue).reduce((s, i) => s + i.amountCents, 0);
    const nextDue = invoices
        .filter(i => isOpen(i) && i.dueAt)
        .map(i => i.dueAt as Date)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-serif text-[#2C2A29] mb-1 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-[#CBA153]" /> Invoices &amp; billing
                </h1>
                <p className="text-sm text-gray-500">Your net-terms invoices, balances, and payment links.</p>
            </header>

            {!partner && (
                <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm rounded-lg">
                    Place your first Resolve net-terms order to initialize your partner profile and start receiving invoices.
                </div>
            )}

            {/* AR summary tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Outstanding balance</div>
                    <div className="text-3xl font-serif text-[#2C2A29] mt-1">{money(outstandingCents)}</div>
                </div>
                <div className={`border shadow-sm rounded-xl p-5 ${overdueCents > 0 ? "bg-red-50 border-red-200" : "bg-white border-[#E8E6E1]"}`}>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Overdue</div>
                    <div className={`text-3xl font-serif mt-1 ${overdueCents > 0 ? "text-red-700" : "text-[#2C2A29]"}`}>{money(overdueCents)}</div>
                </div>
                <div className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Next due</div>
                    <div className="text-3xl font-serif text-[#2C2A29] mt-1">{ymd(nextDue)}</div>
                </div>
            </div>

            {overdueCents > 0 && (
                <div className="bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    You have {money(overdueCents)} past due. Please pay open invoices to avoid holds on new orders.
                </div>
            )}

            {/* Invoice list */}
            <section>
                <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                    {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
                </h2>
                {invoices.length === 0 ? (
                    <div className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-10 text-center text-gray-500 text-sm">
                        No invoices yet. Net-terms orders you place will appear here.
                    </div>
                ) : (
                    <div className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl divide-y divide-[#E8E6E1] overflow-hidden">
                        {invoices.map(inv => {
                            const overdue = isOverdue(inv);
                            const open = isOpen(inv);
                            const label = inv.status === "PAID" ? "PAID"
                                : inv.status === "WRITTEN_OFF" ? "WRITTEN OFF"
                                : overdue ? "OVERDUE" : "PENDING";
                            const labelClass = inv.status === "PAID" ? "bg-emerald-100 text-emerald-800"
                                : overdue ? "bg-red-100 text-red-800"
                                : inv.status === "WRITTEN_OFF" ? "bg-gray-200 text-gray-600"
                                : "bg-amber-100 text-amber-800";
                            return (
                                <div key={inv.id} className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 shrink-0 ${labelClass}`}>{label}</span>
                                        <div className="min-w-0">
                                            <p className="text-sm text-[#2C2A29]">Order #{inv.order.id.slice(0, 8).toUpperCase()}</p>
                                            <p className="text-[10px] font-mono text-gray-500">
                                                {inv.paymentMethod.replace(/_/g, " ")} · issued {ymd(inv.issuedAt)}
                                                {inv.dueAt && <span> · due {ymd(inv.dueAt)}</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0">
                                        <span className="text-sm font-mono text-[#2C2A29]">{money(inv.amountCents)}</span>
                                        {open && inv.resolvePayUrl ? (
                                            <a
                                                href={inv.resolvePayUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider rounded-md transition inline-flex items-center gap-1"
                                            >
                                                Pay <ExternalLink className="w-3 h-3" />
                                            </a>
                                        ) : open ? (
                                            <span className="text-[10px] font-mono text-gray-400 uppercase">Contact sales to pay</span>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
