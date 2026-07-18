/**
 * Phase 7 — Analytics queries shared by master + per-location dashboards.
 *
 * All money is in CENTS to avoid float drift through aggregations.
 * Queries take an optional `window` (default: last 30 days) and an optional
 * `locationId` filter (omit for org-wide totals).
 *
 * Order-level revenue is computed from OrderFulfillment-attributed
 * OrderItems where possible (so per-location aggregation is honest about
 * which leg of a split order belongs where). When no fulfillment exists
 * yet (e.g. legacy B2B orders before Phase 6), the order is counted at the
 * org level but not attributed to a location.
 */
import { prisma } from "@/lib/db";

export interface AnalyticsWindow {
    /** Inclusive start. Default = 30 days ago. */
    from?: Date;
    /** Exclusive end. Default = now. */
    to?: Date;
}

function resolveWindow(w?: AnalyticsWindow): { from: Date; to: Date } {
    const to = w?.to ?? new Date();
    const from = w?.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
}

function parseMoneyCents(s: string | null | undefined): number {
    if (!s) return 0;
    const n = parseFloat(s.replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/* ─── Revenue ──────────────────────────────────────────────────────────── */

export interface RevenueSummary {
    totalCents: number;
    orderCount: number;
    b2cCents: number;
    b2bCents: number;
    paidCents: number;        // sum where paymentStatus = PAID
    unpaidCents: number;      // sum where paymentStatus = UNPAID (open B2B invoices)
}

export async function getRevenueSummary(opts?: AnalyticsWindow & { locationId?: string }): Promise<RevenueSummary> {
    const { from, to } = resolveWindow(opts);

    // Org-level: just sum Order.totalAmount (string money). Location-scoped:
    // sum via OrderFulfillment so split orders are attributed correctly.
    if (opts?.locationId) {
        const fulfillments = await prisma.orderFulfillment.findMany({
            where: {
                locationId: opts.locationId,
                createdAt: { gte: from, lt: to },
            },
            include: {
                order: { select: { orderType: true, paymentStatus: true } },
                items: { include: { orderItem: { select: { unitPrice: true } } } },
            },
        });
        let total = 0, b2c = 0, b2b = 0, paid = 0, unpaid = 0;
        for (const f of fulfillments) {
            const fulfillmentCents = f.items.reduce((sum, it) =>
                sum + parseMoneyCents(it.orderItem.unitPrice) * it.quantity, 0);
            total += fulfillmentCents;
            if (f.order.orderType === "B2B") b2b += fulfillmentCents; else b2c += fulfillmentCents;
            if (f.order.paymentStatus === "PAID") paid += fulfillmentCents; else unpaid += fulfillmentCents;
        }
        return {
            totalCents: total,
            orderCount: new Set(fulfillments.map(f => f.orderId)).size,
            b2cCents: b2c, b2bCents: b2b, paidCents: paid, unpaidCents: unpaid,
        };
    }

    const orders = await prisma.order.findMany({
        where: { createdAt: { gte: from, lt: to } },
        select: { totalAmount: true, tipCents: true, orderType: true, paymentStatus: true },
    });
    let total = 0, b2c = 0, b2b = 0, paid = 0, unpaid = 0;
    for (const o of orders) {
        // Tips are the servers' pass-through money, not company revenue.
        const cents = Math.max(0, parseMoneyCents(o.totalAmount) - o.tipCents);
        total += cents;
        if (o.orderType === "B2B") b2b += cents; else b2c += cents;
        if (o.paymentStatus === "PAID") paid += cents; else unpaid += cents;
    }
    return { totalCents: total, orderCount: orders.length, b2cCents: b2c, b2bCents: b2b, paidCents: paid, unpaidCents: unpaid };
}

/* ─── Revenue by location ──────────────────────────────────────────────── */

export interface LocationRevenueRow {
    locationId: string;
    locationName: string;
    cents: number;
    orderCount: number;
}

export async function getRevenueByLocation(opts?: AnalyticsWindow): Promise<LocationRevenueRow[]> {
    const { from, to } = resolveWindow(opts);
    const fulfillments = await prisma.orderFulfillment.findMany({
        where: { createdAt: { gte: from, lt: to } },
        include: {
            location: { select: { id: true, name: true } },
            items: { include: { orderItem: { select: { unitPrice: true } } } },
        },
    });
    const map = new Map<string, LocationRevenueRow>();
    for (const f of fulfillments) {
        const cents = f.items.reduce((sum, it) =>
            sum + parseMoneyCents(it.orderItem.unitPrice) * it.quantity, 0);
        const existing = map.get(f.locationId);
        if (existing) {
            existing.cents += cents;
            existing.orderCount++;
        } else {
            map.set(f.locationId, { locationId: f.locationId, locationName: f.location.name, cents, orderCount: 1 });
        }
    }
    return Array.from(map.values()).sort((a, b) => b.cents - a.cents);
}

/* ─── Revenue by delivery method ───────────────────────────────────────── */

export interface DeliveryMethodRevenueRow {
    deliveryMethod: string;
    cents: number;
    orderCount: number;
}

export async function getRevenueByDeliveryMethod(opts?: AnalyticsWindow): Promise<DeliveryMethodRevenueRow[]> {
    const { from, to } = resolveWindow(opts);
    const fulfillments = await prisma.orderFulfillment.findMany({
        where: { createdAt: { gte: from, lt: to } },
        include: { items: { include: { orderItem: { select: { unitPrice: true } } } } },
    });
    const map = new Map<string, DeliveryMethodRevenueRow>();
    for (const f of fulfillments) {
        const cents = f.items.reduce((sum, it) =>
            sum + parseMoneyCents(it.orderItem.unitPrice) * it.quantity, 0);
        const existing = map.get(f.deliveryMethod);
        if (existing) {
            existing.cents += cents;
            existing.orderCount++;
        } else {
            map.set(f.deliveryMethod, { deliveryMethod: f.deliveryMethod, cents, orderCount: 1 });
        }
    }
    return Array.from(map.values()).sort((a, b) => b.cents - a.cents);
}

/* ─── Top SKUs ─────────────────────────────────────────────────────────── */

export interface TopSkuRow {
    productId: string;
    sku: string;
    name: string;
    salesChannel: string;
    quantity: number;
    cents: number;
    /** Gross margin in cents — null when Product.unitCost not set. */
    grossMarginCents: number | null;
}

export async function getTopSkus(opts?: AnalyticsWindow & { locationId?: string; limit?: number }): Promise<TopSkuRow[]> {
    const { from, to } = resolveWindow(opts);
    const limit = opts?.limit ?? 20;

    // Pull OrderItem rows, optionally filtered by location via the
    // OrderFulfillmentItem→OrderFulfillment.locationId path.
    const items = await prisma.orderItem.findMany({
        where: {
            order: { createdAt: { gte: from, lt: to } },
            ...(opts?.locationId
                ? { fulfillmentItems: { some: { fulfillment: { locationId: opts.locationId } } } }
                : {}),
        },
        select: {
            quantity: true, unitPrice: true,
            product: { select: { id: true, sku: true, name: true, salesChannel: true, unitCost: true } },
        },
    });

    const map = new Map<string, TopSkuRow>();
    for (const it of items) {
        const cents = parseMoneyCents(it.unitPrice) * it.quantity;
        const cost  = parseMoneyCents(it.product.unitCost) * it.quantity;
        const margin = it.product.unitCost ? cents - cost : null;
        const existing = map.get(it.product.id);
        if (existing) {
            existing.quantity += it.quantity;
            existing.cents += cents;
            if (margin !== null && existing.grossMarginCents !== null) existing.grossMarginCents += margin;
        } else {
            map.set(it.product.id, {
                productId: it.product.id,
                sku: it.product.sku,
                name: it.product.name,
                salesChannel: it.product.salesChannel,
                quantity: it.quantity,
                cents,
                grossMarginCents: margin,
            });
        }
    }
    return Array.from(map.values()).sort((a, b) => b.cents - a.cents).slice(0, limit);
}

/* ─── Inventory days-on-hand ───────────────────────────────────────────── */

export interface InventoryTurnRow {
    productId: string;
    sku: string;
    name: string;
    locationId: string;
    locationName: string;
    currentQty: number;
    soldLast30: number;
    /** Days on hand at current sales velocity. Infinity if no recent sales. */
    daysOnHand: number;
}

export async function getInventoryDaysOnHand(opts?: { locationId?: string; limit?: number }): Promise<InventoryTurnRow[]> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const stocks = await prisma.stock.findMany({
        where: {
            quantity: { not: null },
            ...(opts?.locationId ? { locationId: opts.locationId } : {}),
        },
        include: {
            product: { select: { id: true, sku: true, name: true } },
            location: { select: { id: true, name: true } },
        },
    });

    // Sum SALE movements in last 30d per (productId, locationId).
    const sales = await prisma.stockMovement.groupBy({
        by: ["productId", "locationId"],
        where: {
            type: "SALE",
            createdAt: { gte: since },
            ...(opts?.locationId ? { locationId: opts.locationId } : {}),
        },
        _sum: { quantityDelta: true },
    });
    const salesMap = new Map<string, number>();
    for (const s of sales) {
        // quantityDelta is negative for SALE — take absolute
        salesMap.set(`${s.productId}|${s.locationId}`, Math.abs(s._sum.quantityDelta ?? 0));
    }

    const rows: InventoryTurnRow[] = stocks.map(st => {
        const sold = salesMap.get(`${st.productId}|${st.locationId}`) ?? 0;
        const dailySales = sold / 30;
        const days = dailySales > 0 ? (st.quantity! / dailySales) : Infinity;
        return {
            productId: st.product.id,
            sku: st.product.sku,
            name: st.product.name,
            locationId: st.location.id,
            locationName: st.location.name,
            currentQty: st.quantity!,
            soldLast30: sold,
            daysOnHand: days,
        };
    });

    // Sort lowest-days-on-hand first (most urgent to restock)
    rows.sort((a, b) => a.daysOnHand - b.daysOnHand);
    return opts?.limit ? rows.slice(0, opts.limit) : rows;
}

/* ─── B2B AR aging ─────────────────────────────────────────────────────── */

export interface ArAgingBucket {
    bucket: "current" | "1-30d" | "31-60d" | "60d+";
    invoiceCount: number;
    cents: number;
}

export async function getArAging(): Promise<ArAgingBucket[]> {
    const invoices = await prisma.b2bInvoice.findMany({
        where: { status: { in: ["PENDING", "OVERDUE"] } },
        select: { amountCents: true, dueAt: true },
    });
    const now = Date.now();
    const buckets: Record<ArAgingBucket["bucket"], ArAgingBucket> = {
        "current": { bucket: "current", invoiceCount: 0, cents: 0 },
        "1-30d":   { bucket: "1-30d",   invoiceCount: 0, cents: 0 },
        "31-60d":  { bucket: "31-60d",  invoiceCount: 0, cents: 0 },
        "60d+":    { bucket: "60d+",    invoiceCount: 0, cents: 0 },
    };
    for (const inv of invoices) {
        const daysOverdue = inv.dueAt ? Math.floor((now - inv.dueAt.getTime()) / (24 * 60 * 60 * 1000)) : 0;
        const key: ArAgingBucket["bucket"] =
            daysOverdue <= 0  ? "current" :
            daysOverdue <= 30 ? "1-30d" :
            daysOverdue <= 60 ? "31-60d" :
                                "60d+";
        buckets[key].invoiceCount++;
        buckets[key].cents += inv.amountCents;
    }
    return Object.values(buckets);
}
