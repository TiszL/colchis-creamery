import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Truck, Package, FileText, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

async function assertB2bDispatchAccess(locale: string): Promise<{ userId: string }> {
    const session = await getSession();
    if (!session) redirect(`/${locale}/portal-login`);
    // MASTER_ADMIN bypass; otherwise must hold B2B_SALES_MANAGER at any location.
    if (session.role !== "MASTER_ADMIN") {
        const has = await prisma.userLocation.findFirst({
            where: { userId: session.userId, role: "B2B_SALES_MANAGER" },
            select: { id: true },
        });
        if (!has) redirect(`/${locale}/portal-login`);
    }
    return { userId: session.userId };
}

/**
 * Mark a B2B order shipped. Writes:
 * - Order.orderStatus = SHIPPED + shippingAddress notes
 * - Upserts Shipment with tracking number + carrier
 *
 * For B2B (MANUAL_DISPATCH), no OrderFulfillment is created at order time
 * yet (legacy /api/b2b/order shape) — Shipment is the audit trail.
 */
async function shipB2bOrderAction(formData: FormData): Promise<void> {
    "use server";
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    if (session.role !== "MASTER_ADMIN") {
        const has = await prisma.userLocation.findFirst({
            where: { userId: session.userId, role: "B2B_SALES_MANAGER" },
            select: { id: true },
        });
        if (!has) throw new Error("Forbidden");
    }

    const orderId = formData.get("orderId") as string;
    const trackingNumber = (formData.get("trackingNumber") as string)?.trim() || null;
    const carrierName = (formData.get("carrierName") as string)?.trim() || "Manual";
    if (!orderId) return;

    await prisma.$transaction([
        prisma.order.update({
            where: { id: orderId },
            data: { orderStatus: "SHIPPED" },
        }),
        ...(trackingNumber ? [
            prisma.shipment.upsert({
                where: { orderId },
                update: { trackingNumber, carrierName, dispatchDate: new Date() },
                create: { orderId, trackingNumber, carrierName, dispatchDate: new Date() },
            }),
        ] : []),
    ]);

    revalidatePath("/[locale]/admin/b2b/dispatch", "page");
}

async function markDeliveredAction(formData: FormData): Promise<void> {
    "use server";
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    if (session.role !== "MASTER_ADMIN") {
        const has = await prisma.userLocation.findFirst({
            where: { userId: session.userId, role: "B2B_SALES_MANAGER" },
            select: { id: true },
        });
        if (!has) throw new Error("Forbidden");
    }
    const orderId = formData.get("orderId") as string;
    if (!orderId) return;
    await prisma.order.update({
        where: { id: orderId },
        data: { orderStatus: "DELIVERED" },
    });
    revalidatePath("/[locale]/admin/b2b/dispatch", "page");
}

export default async function B2bDispatchPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    await assertB2bDispatchAccess(locale);

    // Active B2B orders — anything that hasn't been delivered yet.
    const orders = await prisma.order.findMany({
        where: {
            orderType: "B2B",
            orderStatus: { notIn: ["DELIVERED"] },
        },
        include: {
            user: { select: { name: true, email: true, companyName: true, b2bPartner: { select: { companyName: true } } } },
            orderItems: { include: { product: { select: { name: true, sku: true } } } },
            shipment: true,
            b2bInvoice: true,
        },
        orderBy: [{ orderStatus: "asc" }, { createdAt: "asc" }],
    });

    return (
        <div className="space-y-6 max-w-6xl">
            <header>
                <h1 className="text-2xl font-serif text-white mb-1 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-[#B96A3D]" /> B2B dispatch queue
                </h1>
                <p className="text-sm text-gray-500">
                    Active wholesale orders. Add tracking + mark shipped from this page. Once delivered, orders drop off the queue.
                </p>
            </header>

            {orders.length === 0 && (
                <div className="bg-[#161616] border border-[#ffffff0A] p-10 text-center text-gray-500 text-sm">
                    No active B2B orders. New ones appear here automatically.
                </div>
            )}

            <div className="space-y-3">
                {orders.map(o => {
                    const partnerName = o.user.b2bPartner?.companyName || o.user.companyName || o.user.name || o.user.email;
                    const itemSummary = o.orderItems
                        .map(i => `${i.quantity}× ${i.product.name}`)
                        .join(", ");
                    return (
                        <div key={o.id} className="bg-[#161616] border border-[#ffffff0A] p-5">
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 ${statusClass(o.orderStatus)}`}>
                                            {o.orderStatus}
                                        </span>
                                        <span className="text-[10px] font-mono text-gray-600">#{o.id.slice(0, 8)}</span>
                                        <span className="text-[10px] font-mono text-gray-600">{o.createdAt.toISOString().slice(0, 10)}</span>
                                        {o.b2bInvoice && (
                                            <span className="text-[10px] font-mono text-[#B96A3D] inline-flex items-center gap-1">
                                                <FileText className="w-3 h-3" /> {o.b2bInvoice.paymentMethod.replace(/_/g, " ")} · {o.b2bInvoice.status}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-white mb-1">{partnerName}</p>
                                    <p className="text-xs text-gray-500 mb-1 font-mono">{o.user.email}</p>
                                    <p className="text-[12px] text-gray-400">{itemSummary}</p>
                                    <p className="text-[11px] text-gray-500 mt-1">Total: <span className="text-white font-mono">{o.totalAmount}</span></p>
                                    {o.shipment?.trackingNumber && (
                                        <p className="text-[11px] text-emerald-400 mt-1 font-mono">
                                            Tracking: {o.shipment.trackingNumber} ({o.shipment.carrierName})
                                        </p>
                                    )}
                                </div>
                            </div>

                            {o.orderStatus !== "DELIVERED" && (
                                <div className="border-t border-[#ffffff0A] pt-3 flex flex-wrap items-end gap-2">
                                    {(o.orderStatus === "PROCESSING" || o.orderStatus === "READY_FOR_PICKUP") && (
                                        <form action={shipB2bOrderAction} className="flex items-end gap-2 flex-1 min-w-[260px]">
                                            <input type="hidden" name="orderId" value={o.id} />
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Tracking #</label>
                                                <input name="trackingNumber" placeholder="optional" className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm font-mono" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Carrier</label>
                                                <input name="carrierName" placeholder="UPS / FedEx / Manual" className="bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                                            </div>
                                            <button type="submit" className="bg-[#B96A3D] text-black px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider hover:bg-[#a85d35] transition-colors inline-flex items-center gap-1">
                                                <Package className="w-3 h-3" /> Mark shipped
                                            </button>
                                        </form>
                                    )}
                                    {(o.orderStatus === "SHIPPED" || o.orderStatus === "IN_TRANSIT") && (
                                        <form action={markDeliveredAction}>
                                            <input type="hidden" name="orderId" value={o.id} />
                                            <button type="submit" className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-colors inline-flex items-center gap-1">
                                                <ExternalLink className="w-3 h-3" /> Mark delivered
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function statusClass(status: string): string {
    switch (status) {
        case "PROCESSING":        return "bg-amber-900/30 text-amber-400";
        case "READY_FOR_PICKUP":  return "bg-blue-900/30 text-blue-400";
        case "SHIPPED":           return "bg-purple-900/30 text-purple-400";
        case "IN_TRANSIT":        return "bg-emerald-900/30 text-emerald-400";
        case "DELIVERED":         return "bg-gray-900/30 text-gray-400";
        default:                  return "bg-gray-900/30 text-gray-400";
    }
}
