import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPartnerContext, getOrgUserIds } from "@/lib/b2b-partner";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Package, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

function money(s: string | null | undefined): string {
    const n = Number(String(s ?? "").replace(/[^0-9.-]+/g, "")) || 0;
    return `$${n.toFixed(2)}`;
}

export default async function PartnerOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session) redirect(`/${locale}/b2b/login`);
    if (session.role !== "B2B_PARTNER" && session.role !== "MASTER_ADMIN") redirect(`/${locale}/`);

    // Owner sees every order placed across the org; a member sees their own.
    const ctx = await getPartnerContext(session.userId);
    const orgUserIds = ctx ? (ctx.isOwner ? await getOrgUserIds(ctx.partnerId) : [session.userId]) : [session.userId];
    const isOwnerView = ctx?.isOwner ?? true;

    const orders = await prisma.order.findMany({
        where: { userId: { in: orgUserIds }, orderType: "B2B" },
        orderBy: { createdAt: "desc" },
        include: {
            orderItems: { select: { quantity: true, product: { select: { name: true } } } },
            b2bInvoice: { select: { status: true } },
            partnerLocation: { select: { label: true } },
            user: { select: { name: true, email: true } },
        },
    });

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-serif text-[#2C2A29] mb-1 flex items-center gap-2">
                    <Package className="w-6 h-6 text-[#CBA153]" /> Order history
                </h1>
                <p className="text-sm text-gray-500">Every wholesale order you&apos;ve placed.</p>
            </header>

            {orders.length === 0 ? (
                <div className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-10 text-center text-gray-500 text-sm">
                    No orders yet.{" "}
                    <Link href={`/${locale}/b2b-portal/order`} className="text-[#CBA153] underline">Place your first bulk order →</Link>
                </div>
            ) : (
                <div className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl divide-y divide-[#E8E6E1] overflow-hidden">
                    {orders.map(o => {
                        const items = o.orderItems.map(i => `${i.quantity}× ${i.product.name}`).join(" · ");
                        return (
                            <Link key={o.id} href={`/${locale}/b2b-portal/orders/${o.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[#FDFBF7] transition">
                                <div className="min-w-0">
                                    <p className="text-sm text-[#2C2A29]">
                                        #{o.id.slice(0, 8).toUpperCase()} <span className="text-gray-400">· {o.createdAt.toISOString().slice(0, 10)}</span>
                                    </p>
                                    <p className="text-[11px] text-gray-500 truncate">{items || "—"}</p>
                                    {(o.partnerLocation || (isOwnerView && o.user?.name)) && (
                                        <p className="text-[10px] text-gray-400 truncate">
                                            {o.partnerLocation ? `→ ${o.partnerLocation.label}` : ""}
                                            {isOwnerView && o.user?.name ? `${o.partnerLocation ? " · " : ""}by ${o.user.name}` : ""}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    {o.b2bInvoice && (
                                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 ${o.b2bInvoice.status === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                            {o.b2bInvoice.status}
                                        </span>
                                    )}
                                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-gray-100 text-gray-600">{o.orderStatus}</span>
                                    <span className="text-sm font-mono text-[#2C2A29]">{money(o.totalAmount)}</span>
                                    <ArrowRight className="w-4 h-4 text-gray-400" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
