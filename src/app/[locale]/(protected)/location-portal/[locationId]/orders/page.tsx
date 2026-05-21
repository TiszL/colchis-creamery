import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { assertLocationRole } from "@/lib/location-rbac";

export const dynamic = "force-dynamic";

// Linear order-fulfillment status progression. Matches the admin pattern in
// /admin/orders/[id]/page.tsx so terminology stays consistent.
const NEXT_STATUS: Record<string, string> = {
    PENDING:          "CONFIRMED",
    CONFIRMED:        "PREPARING",
    PREPARING:        "OUT_FOR_DELIVERY",
    OUT_FOR_DELIVERY: "DELIVERED",
};

async function advanceFulfillment(formData: FormData) {
    "use server";
    const id = formData.get("fulfillmentId") as string;
    const locationId = formData.get("locationId") as string;
    if (!id || !locationId) return;

    // Phase 2 — only fulfillment staff (or higher) at this location may advance.
    await assertLocationRole(locationId, ["LOCATION_MANAGER", "LOCATION_FULFILLMENT"]);

    const current = await prisma.orderFulfillment.findUnique({
        where: { id },
        select: { status: true, locationId: true },
    });
    if (!current) return;
    // Defense-in-depth: confirm the fulfillment actually belongs to this location.
    if (current.locationId !== locationId) return;

    const next = NEXT_STATUS[current.status];
    if (!next) return;

    await prisma.orderFulfillment.update({ where: { id }, data: { status: next } });
    revalidatePath(`/[locale]/location-portal/${locationId}/orders`, "page");
}

export default async function LocationOrdersPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; locationId: string }>;
    searchParams: Promise<{ status?: string }>;
}) {
    const { locationId } = await params;
    const { status } = await searchParams;
    const statusFilter = status ? [status] : ["PENDING", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"];

    const fulfillments = await prisma.orderFulfillment.findMany({
        where: { locationId, status: { in: statusFilter } },
        include: {
            order: { select: { id: true, guestEmail: true, guestPhone: true, user: { select: { email: true, name: true } } } },
            items: {
                include: {
                    orderItem: { include: { product: { select: { name: true, sku: true } } } },
                },
            },
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });

    return (
        <div className="space-y-6 max-w-5xl">
            <header>
                <h1 className="text-2xl font-serif mb-1">Order queue</h1>
                <p className="text-sm text-gray-500">
                    {fulfillments.length} active fulfillment{fulfillments.length === 1 ? "" : "s"}
                    {status && <span className="text-[#B96A3D] font-mono text-xs ml-2">· filter: {status}</span>}
                </p>
            </header>

            {fulfillments.length === 0 && (
                <div className="bg-[#161616] border border-[#ffffff0A] p-10 text-center text-gray-500 text-sm">
                    No active orders. New orders will appear here as customers check out.
                </div>
            )}

            <div className="space-y-3">
                {fulfillments.map(f => {
                    const customer = f.order.user?.name ?? f.order.user?.email ?? f.order.guestEmail ?? "Guest";
                    const phone    = f.order.guestPhone ?? "";
                    const next     = NEXT_STATUS[f.status];

                    return (
                        <div key={f.id} className="bg-[#161616] border border-[#ffffff0A] p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 ${statusClass(f.status)}`}>
                                            {f.status.replace(/_/g, " ")}
                                        </span>
                                        <span className="text-[10px] text-gray-600 font-mono">{f.deliveryMethod.replace(/_/g, " ")}</span>
                                        <span className="text-[10px] text-gray-600 font-mono">#{f.order.id.slice(0, 8)}</span>
                                    </div>
                                    <p className="text-sm text-white">{customer}{phone && <span className="text-gray-500"> · {phone}</span>}</p>
                                    <ul className="mt-2 space-y-0.5">
                                        {f.items.map(i => (
                                            <li key={i.id} className="text-[12px] text-gray-400 font-mono">
                                                {i.quantity}× {i.orderItem.product.name} <span className="text-gray-600">({i.orderItem.product.sku})</span>
                                            </li>
                                        ))}
                                    </ul>
                                    {f.trackingNumber && (
                                        <p className="mt-2 text-[10px] text-gray-500 font-mono">Tracking: {f.trackingNumber}</p>
                                    )}
                                </div>

                                {next && (
                                    <form action={advanceFulfillment} className="shrink-0">
                                        <input type="hidden" name="fulfillmentId" value={f.id} />
                                        <input type="hidden" name="locationId" value={locationId} />
                                        <button
                                            type="submit"
                                            className="px-3 py-2 text-[11px] font-mono uppercase tracking-wider bg-[#B96A3D] text-black hover:bg-[#a85d35] transition-colors"
                                        >
                                            → {next.replace(/_/g, " ")}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function statusClass(status: string): string {
    switch (status) {
        case "PENDING":          return "bg-amber-900/30 text-amber-400";
        case "CONFIRMED":        return "bg-blue-900/30 text-blue-400";
        case "PREPARING":        return "bg-purple-900/30 text-purple-400";
        case "OUT_FOR_DELIVERY": return "bg-emerald-900/30 text-emerald-400";
        case "DELIVERED":        return "bg-gray-900/30 text-gray-400";
        case "CANCELLED":        return "bg-red-900/30 text-red-400";
        default:                 return "bg-gray-900/30 text-gray-400";
    }
}
