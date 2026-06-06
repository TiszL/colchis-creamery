import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPartnerContext, getOrgUserIds } from "@/lib/b2b-partner";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft, Repeat, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

function money(s: string | null | undefined): string {
    const n = Number(String(s ?? "").replace(/[^0-9.-]+/g, "")) || 0;
    return `$${n.toFixed(2)}`;
}
function moneyCents(c: number): string {
    return `$${((c ?? 0) / 100).toFixed(2)}`;
}

export default async function PartnerOrderDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
    const { id, locale } = await params;
    const t = await getTranslations('b2bPortal.orderDetail');
    const session = await getSession();
    if (!session) redirect(`/${locale}/b2b/login`);

    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            orderItems: { include: { product: { select: { name: true, sku: true } } } },
            fulfillments: {
                orderBy: { createdAt: "asc" },
                include: { location: { select: { name: true } } },
            },
            shipment: true,
            b2bInvoice: true,
            partnerLocation: { select: { label: true } },
        },
    });
    // Ownership: "not yours" == 404 so we never leak a foreign order id. An owner
    // may view any order across the org; a member only their own. Admins, any.
    const ctx = await getPartnerContext(session.userId);
    const orgUserIds = ctx ? (ctx.isOwner ? await getOrgUserIds(ctx.partnerId) : [session.userId]) : [session.userId];
    const canView = session.role === "MASTER_ADMIN" || (!!order && orgUserIds.includes(order.userId));
    if (!order || !canView) notFound();

    const inv = order.b2bInvoice;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <Link href={`/${locale}/b2b-portal/orders`} className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-[#2C2A29]">
                <ArrowLeft className="w-3.5 h-3.5" /> {t('orderHistory')}
            </Link>

            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif text-[#2C2A29]">{t('orderTitle', { id: order.id.slice(0, 8).toUpperCase() })}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {t('placedOn', { date: order.createdAt.toISOString().slice(0, 10) })} · <span className="font-mono">{order.orderStatus}</span> · {money(order.totalAmount)}
                    </p>
                </div>
                <Link href={`/${locale}/b2b-portal/order?reorder=${order.id}`} className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-5 py-2.5 rounded-lg font-medium transition shadow-sm inline-flex items-center justify-center gap-2 self-start">
                    <Repeat className="w-4 h-4" /> {t('reorder')}
                </Link>
            </header>

            {/* Line items */}
            <section className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#E8E6E1]">
                    <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500">{t('items')}</h2>
                </div>
                <div className="divide-y divide-[#E8E6E1]">
                    {order.orderItems.map(it => (
                        <div key={it.id} className="flex items-center justify-between gap-4 px-5 py-3">
                            <div className="min-w-0">
                                <p className="text-sm text-[#2C2A29]">{it.product.name}</p>
                                <p className="text-[10px] font-mono text-gray-500">{it.product.sku} · {t('pricePerUnit', { price: money(it.unitPrice) })}</p>
                            </div>
                            <div className="text-sm font-mono text-[#2C2A29] shrink-0">× {it.quantity}</div>
                        </div>
                    ))}
                </div>
                <div className="px-5 py-3 border-t border-[#E8E6E1] flex justify-between text-sm">
                    <span className="text-gray-500">{t('total')}</span>
                    <span className="font-bold text-[#2C2A29]">{money(order.totalAmount)}</span>
                </div>
            </section>

            {/* Tier 2 — purchase-order metadata (only if the buyer supplied any) */}
            {(order.partnerLocation || order.poNumber || order.scheduledFor || order.shippingLine1 || order.notes) && (
                <section className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                    <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-3">{t('purchaseOrder')}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        {order.partnerLocation && (
                            <div><p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-0.5">{t('shop')}</p><p className="text-[#2C2A29]">{order.partnerLocation.label}</p></div>
                        )}
                        {order.poNumber && (
                            <div><p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-0.5">{t('poNumber')}</p><p className="text-[#2C2A29]">{order.poNumber}</p></div>
                        )}
                        {order.scheduledFor && (
                            <div><p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-0.5">{t('requestedDelivery')}</p><p className="text-[#2C2A29]">{order.scheduledFor.toISOString().slice(0, 10)}</p></div>
                        )}
                        {order.shippingLine1 && (
                            <div className="sm:col-span-2">
                                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-0.5">{t('shipTo')}</p>
                                <p className="text-[#2C2A29]">
                                    {order.shippingLine1}{order.shippingAddressLine2 ? `, ${order.shippingAddressLine2}` : ""}<br />
                                    {[order.shippingCity, order.shippingState, order.shippingPostalCode].filter(Boolean).join(", ")}
                                </p>
                            </div>
                        )}
                        {order.notes && (
                            <div className="sm:col-span-2"><p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-0.5">{t('notes')}</p><p className="text-[#2C2A29] whitespace-pre-wrap">{order.notes}</p></div>
                        )}
                    </div>
                </section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fulfillment / shipping */}
                <section className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                    <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-3">{t('fulfillment')}</h2>
                    {order.fulfillments.length === 0 ? (
                        <p className="text-sm text-gray-500">{t('notYetRouted')}</p>
                    ) : (
                        <div className="space-y-2">
                            {order.fulfillments.map(f => (
                                <div key={f.id} className="flex items-center justify-between text-sm">
                                    <span className="text-[#2C2A29]">{f.location?.name ?? "—"}</span>
                                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-gray-100 text-gray-600">{f.status}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {order.shipment?.trackingNumber && (
                        <p className="text-[11px] font-mono text-gray-500 mt-3">
                            {t('tracking')} <span className="text-[#2C2A29]">{order.shipment.carrierName} {order.shipment.trackingNumber}</span>
                        </p>
                    )}
                </section>

                {/* Billing */}
                <section className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                    <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> {t('billing')}
                    </h2>
                    {inv ? (
                        <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">{t('amount')}</span><span className="font-mono text-[#2C2A29]">{moneyCents(inv.amountCents)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">{t('method')}</span><span className="text-[#2C2A29]">{inv.paymentMethod.replace(/_/g, " ")}</span></div>
                            {inv.dueAt && <div className="flex justify-between"><span className="text-gray-500">{t('due')}</span><span className="text-[#2C2A29]">{inv.dueAt.toISOString().slice(0, 10)}</span></div>}
                            <div className="flex justify-between"><span className="text-gray-500">{t('status')}</span><span className={`font-medium ${inv.status === "PAID" ? "text-emerald-600" : "text-amber-600"}`}>{inv.status}</span></div>
                            {(inv.status === "PENDING" || inv.status === "OVERDUE") && inv.resolvePayUrl && (
                                <a href={inv.resolvePayUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block bg-[#CBA153] hover:bg-[#b08d47] text-white px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider rounded-md transition">{t('payInvoice')}</a>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">
                            {order.paymentStatus === "PAID" ? t('paidByCard') : t('noInvoice')}
                        </p>
                    )}
                </section>
            </div>
        </div>
    );
}
