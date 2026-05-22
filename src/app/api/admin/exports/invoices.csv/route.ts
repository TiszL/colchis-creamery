import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { toCsv, csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") {
        return new Response("Forbidden", { status: 403 });
    }

    const fromRaw = req.nextUrl.searchParams.get("from");
    const toRaw = req.nextUrl.searchParams.get("to");
    const to = toRaw ? new Date(toRaw) : new Date();
    const from = fromRaw ? new Date(fromRaw) : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);

    const invoices = await prisma.b2bInvoice.findMany({
        where: { issuedAt: { gte: from, lt: to } },
        include: {
            partner: { include: { user: { select: { email: true, name: true } } } },
            order: { select: { totalAmount: true } },
        },
        orderBy: { issuedAt: "asc" },
    });

    const now = Date.now();
    const rows = invoices.map(inv => {
        const daysOverdue = inv.status === "PENDING" && inv.dueAt
            ? Math.max(0, Math.floor((now - inv.dueAt.getTime()) / (24 * 60 * 60 * 1000)))
            : 0;
        return [
            inv.id,
            inv.orderId,
            inv.partner.user.name ?? "",
            inv.partner.user.email,
            inv.partner.companyName,
            inv.amountCents / 100,
            inv.paymentMethod,
            inv.status,
            inv.issuedAt,
            inv.dueAt ?? "",
            inv.paidAt ?? "",
            daysOverdue,
            inv.resolveInvoiceId ?? "",
            inv.resolveStatus ?? "",
            inv.notes ?? "",
        ];
    });

    const csv = toCsv(
        [
            "invoiceId", "orderId", "partnerName", "partnerEmail", "partnerCompany",
            "amount", "paymentMethod", "status",
            "issuedAt", "dueAt", "paidAt", "daysOverdue",
            "resolveInvoiceId", "resolveStatus", "notes",
        ],
        rows,
    );

    const filename = `invoices_${from.toISOString().slice(0, 10)}_to_${to.toISOString().slice(0, 10)}.csv`;
    return csvResponse(filename, csv);
}
