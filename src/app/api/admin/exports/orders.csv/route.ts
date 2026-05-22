import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { toCsv, csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

function parseWindow(searchParams: URLSearchParams): { from: Date; to: Date } {
    const toRaw = searchParams.get("to");
    const fromRaw = searchParams.get("from");
    const to = toRaw ? new Date(toRaw) : new Date();
    const from = fromRaw ? new Date(fromRaw) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
}

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") {
        return new Response("Forbidden", { status: 403 });
    }

    const { from, to } = parseWindow(req.nextUrl.searchParams);

    const orders = await prisma.order.findMany({
        where: { createdAt: { gte: from, lt: to } },
        include: {
            user: { select: { email: true, name: true, companyName: true } },
            fulfillments: { select: { locationId: true, deliveryMethod: true, status: true, location: { select: { name: true } } } },
            b2bInvoice: { select: { paymentMethod: true, status: true, dueAt: true } },
        },
        orderBy: { createdAt: "asc" },
    });

    const rows = orders.map(o => [
        o.id,
        o.createdAt,
        o.orderType,
        o.orderStatus,
        o.paymentStatus,
        o.totalAmount,
        o.subtotalAmount ?? "",
        o.shippingAmount ?? "",
        o.taxAmount ?? "",
        o.user.email,
        o.user.name ?? "",
        o.user.companyName ?? "",
        // One row per order — join fulfillment summaries with "|"
        o.fulfillments.map(f => `${f.location.name}:${f.deliveryMethod}:${f.status}`).join("|"),
        o.b2bInvoice?.paymentMethod ?? "",
        o.b2bInvoice?.status ?? "",
        o.b2bInvoice?.dueAt ?? "",
        o.shippingAddress ?? "",
    ]);

    const csv = toCsv(
        [
            "orderId", "createdAt", "orderType", "orderStatus", "paymentStatus",
            "totalAmount", "subtotalAmount", "shippingAmount", "taxAmount",
            "customerEmail", "customerName", "companyName",
            "fulfillments",
            "b2bPaymentMethod", "b2bInvoiceStatus", "b2bInvoiceDueAt",
            "shippingAddress",
        ],
        rows,
    );

    const filename = `orders_${from.toISOString().slice(0, 10)}_to_${to.toISOString().slice(0, 10)}.csv`;
    return csvResponse(filename, csv);
}
