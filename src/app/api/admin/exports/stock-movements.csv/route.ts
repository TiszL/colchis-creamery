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
    const locationId = req.nextUrl.searchParams.get("locationId") || undefined;

    const movements = await prisma.stockMovement.findMany({
        where: {
            createdAt: { gte: from, lt: to },
            ...(locationId ? { locationId } : {}),
        },
        include: {
            product: { select: { sku: true, name: true } },
            location: { select: { name: true } },
            batch: { select: { lotNumber: true, expiresAt: true } },
            initiatedBy: { select: { email: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
    });

    const rows = movements.map(m => [
        m.id,
        m.createdAt,
        m.type,
        m.quantityDelta,
        m.product.sku,
        m.product.name,
        m.location.name,
        m.batch?.lotNumber ?? "",
        m.batch?.expiresAt ?? "",
        m.orderId ?? "",
        m.initiatedBy?.email ?? "",
        m.reason ?? "",
    ]);

    const csv = toCsv(
        [
            "movementId", "createdAt", "type", "quantityDelta",
            "sku", "productName", "location",
            "batchLotNumber", "batchExpiresAt",
            "orderId", "initiatedByEmail", "reason",
        ],
        rows,
    );

    const filename = `stock-movements_${from.toISOString().slice(0, 10)}_to_${to.toISOString().slice(0, 10)}.csv`;
    return csvResponse(filename, csv);
}
