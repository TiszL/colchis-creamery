// Phase 6 (6d) — Cron-fired recurring B2B order creator.
//
// Fires on a Vercel cron schedule (configure in vercel.json or Vercel
// dashboard) — recommend hourly at the top of the hour. For each due
// schedule (active=true AND nextFireAt <= now), creates a B2B order
// equivalent to the partner POST'ing /api/b2b/order with the schedule's
// itemsJson + paymentMethod.
//
// Auth: CRON_SECRET env var as bearer token. Vercel cron sends this
// automatically when configured via vercel.json.
//
// Idempotency: a schedule with nextFireAt in the past + processed
// successfully advances both nextFireAt and lastFiredAt atomically;
// re-running before the next interval is a no-op (find returns nothing).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { B2bPaymentMethod, B2bInvoiceStatus } from "@prisma/client";
import { createResolveCharge, isResolveConfigured } from "@/lib/resolve";
import { reserveStock, commitStock } from "@/lib/stock-reservation";
import { validateB2bQty } from "@/lib/b2b-moq";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

const NET_TERM_DAYS: Record<string, number> = {
    RESOLVE_NET_7: 7,
    RESOLVE_NET_15: 15,
    RESOLVE_NET_30: 30,
    RESOLVE_NET_45: 45,
};

export async function GET(req: Request) {
    // Vercel cron sends `authorization: Bearer <CRON_SECRET>`.
    const auth = req.headers.get("authorization") || "";
    // Fail closed in production: a missing secret must NOT open this
    // order-creating + Resolve-charging endpoint to the public internet.
    if (!CRON_SECRET && process.env.NODE_ENV === "production") {
        console.error("[cron/recurring] CRON_SECRET unset in production — refusing.");
        return new NextResponse("Forbidden", { status: 403 });
    }
    if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const now = new Date();
    const due = await prisma.recurringOrderSchedule.findMany({
        where: { active: true, nextFireAt: { lte: now } },
        include: {
            partner: { include: { user: { select: { email: true, name: true, phone: true } } } },
        },
        take: 50, // ceiling per cron tick; remainder picked up next run
    });

    if (due.length === 0) {
        return NextResponse.json({ fired: 0 });
    }

    let fired = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const sched of due) {
        try {
            let items: Array<{ productId: string; quantity: number }>;
            try {
                items = JSON.parse(sched.itemsJson);
                if (!Array.isArray(items) || items.length === 0) throw new Error("empty");
            } catch {
                console.warn(`[cron/recurring] Schedule ${sched.id} has malformed itemsJson — skipping`);
                skipped++;
                continue;
            }

            // Build the order in a transaction, mirroring /api/b2b/order (Phase 9c):
            // route each line to a real Location, write per-location OrderFulfillment,
            // and advance the schedule INSIDE the same tx so a crash between
            // order-create and advance can't duplicate the order on the next tick.
            const preferredLocationId =
                sched.fulfillmentLocationId ?? sched.partner.defaultFulfillmentLocationId ?? null;

            const result = await prisma.$transaction(async tx => {
                // Contract gate — mirror the live route's 403. No signed contract ⇒
                // throw so the schedule retries (doesn't advance) until re-signed.
                const contract = await tx.contract.findFirst({
                    where: { partnerId: sched.partner.userId, status: "SIGNED", OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
                    take: 1,
                });
                if (!contract) throw new Error("No active signed contract (or it has expired)");
                // Clamp 0–100 so a malformed contract value can't make a negative total.
                const discountPct = Math.min(100, Math.max(0, parseInt(contract.discountPercentage, 10) || 0));

                let subtotal = 0;
                const processed: { productId: string; quantity: number; unitPrice: string }[] = [];
                const fulfillmentPlan: { productId: string; locationId: string; quantity: number; orderItemIndex: number }[] = [];

                for (const item of items) {
                    const product = await tx.product.findUnique({
                        where: { id: item.productId },
                        select: { id: true, name: true, isActive: true, salesChannel: true, priceB2b: true, isMadeToOrder: true, b2bCaseSize: true, b2bMinOrderQty: true, b2bUnitLabel: true },
                    });
                    if (!product || !product.isActive) throw new Error(`Product ${item.productId} invalid or inactive`);

                    // Tier 2 — same MOQ/case enforcement as /api/b2b/order. A schedule
                    // whose quantity violates a (possibly later-added) constraint throws
                    // → recorded as a failure + retries until the partner fixes it,
                    // mirroring the contract gate. Never silently places an invalid order.
                    const qtyErr = validateB2bQty(item.quantity, { caseSize: product.b2bCaseSize, minOrderQty: product.b2bMinOrderQty, unitLabel: product.b2bUnitLabel });
                    if (qtyErr) throw new Error(`${product.name}: ${qtyErr} — update this recurring schedule's quantity`);

                    // Per-location routing: active location carrying this channel with
                    // an enabled Stock row that has enough free quantity. MTO products
                    // skip the quantity gate (capacity-bound, not stock-bound).
                    const candidates = await tx.location.findMany({
                        where: { isActive: true, allowsChannels: { has: product.salesChannel } },
                        select: {
                            id: true, isPrimary: true,
                            stocks: { where: { productId: product.id, isEnabled: true }, select: { quantity: true, reservedQuantity: true } },
                        },
                        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
                    });
                    const hasFreeStock = (loc: typeof candidates[number]) => {
                        const stock = loc.stocks[0];
                        if (!stock) return false;
                        if (product.isMadeToOrder) return true;
                        return (stock.quantity ?? 0) - stock.reservedQuantity >= item.quantity;
                    };
                    // Honor the schedule's pinned / partner-default location when it can serve.
                    const target =
                        candidates.find(loc => loc.id === preferredLocationId && hasFreeStock(loc)) ??
                        candidates.find(hasFreeStock);
                    if (!target) throw new Error(`Insufficient stock for ${product.name} at any wholesale-capable location`);

                    fulfillmentPlan.push({ productId: product.id, locationId: target.id, quantity: item.quantity, orderItemIndex: processed.length });

                    const basePrice = parseFloat(product.priceB2b.replace(/[^0-9.-]+/g, "")) || 0;
                    const finalPrice = basePrice * (1 - discountPct / 100);
                    subtotal += finalPrice * item.quantity;
                    processed.push({ productId: product.id, quantity: item.quantity, unitPrice: `$${finalPrice.toFixed(2)}` });
                }

                // Tier 2 — if the schedule targets one of the partner's shops,
                // snapshot its address onto the order ship-to + tag the shop.
                const shipTo = sched.partnerLocationId
                    ? await tx.b2bPartnerLocation.findUnique({
                        where: { id: sched.partnerLocationId },
                        select: { line1: true, line2: true, city: true, state: true, postalCode: true },
                    })
                    : null;

                const order = await tx.order.create({
                    data: {
                        userId: sched.partner.userId,
                        orderType: "B2B",
                        paymentStatus: "UNPAID",
                        orderStatus: "PROCESSING",
                        // Unprefixed numeric string to match D2C (refunds parseFloat this).
                        totalAmount: subtotal.toFixed(2),
                        notes: `Auto-generated from recurring schedule "${sched.name}"`,
                        partnerLocationId: shipTo ? sched.partnerLocationId : null,
                        shippingLine1: shipTo?.line1 ?? null,
                        shippingAddressLine2: shipTo?.line2 ?? null,
                        shippingCity: shipTo?.city ?? null,
                        shippingState: shipTo?.state ?? null,
                        shippingPostalCode: shipTo?.postalCode ?? null,
                        orderItems: { create: processed },
                    },
                    include: { orderItems: true },
                });

                // One OrderFulfillment (MANUAL_DISPATCH) per location so the order
                // shows up grouped in /admin/b2b/dispatch.
                const byLocation = new Map<string, typeof fulfillmentPlan>();
                for (const line of fulfillmentPlan) {
                    const list = byLocation.get(line.locationId) ?? [];
                    list.push(line);
                    byLocation.set(line.locationId, list);
                }
                for (const [locationId, lines] of byLocation) {
                    await tx.orderFulfillment.create({
                        data: {
                            orderId: order.id,
                            locationId,
                            deliveryMethod: 'MANUAL_DISPATCH',
                            status: 'PENDING',
                            items: { create: lines.map(l => ({ orderItemId: order.orderItems[l.orderItemIndex].id, quantity: l.quantity })) },
                        },
                    });
                }

                // Advance the schedule ATOMICALLY with order creation. Previously a
                // separate transaction — a crash in between duplicated the order.
                const next = new Date(sched.nextFireAt.getTime() + sched.intervalDays * 24 * 60 * 60 * 1000);
                while (next <= now) next.setDate(next.getDate() + sched.intervalDays);
                await tx.recurringOrderSchedule.update({
                    where: { id: sched.id },
                    data: { lastFiredAt: now, nextFireAt: next },
                });

                return { order, subtotalCents: Math.round(subtotal * 100), fulfillmentPlan };
            });

            // Commit stock per-location (StockMovement SALE + FIFO batches), mirroring
            // the live B2B route — NOT the deprecated Product.stockQuantity decrement.
            // reserveStock re-checks atomically; commitStock nets it out. A failure
            // leaves a recoverable PROCESSING order, never a duplicate (the schedule
            // already advanced inside the tx above).
            const reservationItems = result.fulfillmentPlan.map(l => ({
                productId: l.productId, locationId: l.locationId, quantity: l.quantity,
            }));
            const reservation = await reserveStock(reservationItems);
            if (reservation.ok) {
                await commitStock(reservationItems, { orderId: result.order.id });
            } else {
                console.error(`[cron/recurring] Schedule ${sched.id}: stock commit skipped (${reservation.error}); order ${result.order.id} needs manual review.`);
                failures.push(`${sched.id}: stock commit skipped (${reservation.error})`);
            }

            // Resolve invoice — only if configured + a resolve customer exists.
            // Legacy Net-30 path still puts the order on the dispatch queue.
            const dueDays = NET_TERM_DAYS[sched.paymentMethod];
            // Subcompany billing (Tier 2 C): a separate-billing shop with its own
            // Resolve customer invoices to that customer + AR; otherwise the parent
            // partner's. The cron doesn't JIT-create shop customers (the on-demand
            // path does on first order), so it falls back safely until then.
            const subShop = sched.partnerLocationId
                ? await prisma.b2bPartnerLocation.findUnique({ where: { id: sched.partnerLocationId }, select: { separateBilling: true, resolveCustomerId: true } })
                : null;
            const useSub = !!(subShop?.separateBilling && subShop.resolveCustomerId);
            const billingCustomerId = useSub ? subShop!.resolveCustomerId! : sched.partner.resolveCustomerId;
            const billingLocationId = useSub ? sched.partnerLocationId : null;
            if (dueDays !== undefined && isResolveConfigured() && billingCustomerId) {
                const charge = await createResolveCharge({
                    customerId: billingCustomerId,
                    amountCents: result.subtotalCents,
                    dueDays,
                    orderRef: result.order.id,
                    description: `Recurring "${sched.name}" — order ${result.order.id.slice(0, 8)}`,
                });
                const dueAt = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);
                await prisma.b2bInvoice.create({
                    data: {
                        orderId: result.order.id,
                        partnerId: sched.partnerId,
                        partnerLocationId: billingLocationId,
                        amountCents: result.subtotalCents,
                        paymentMethod: sched.paymentMethod as B2bPaymentMethod,
                        dueAt,
                        resolveInvoiceId: charge?.chargeId ?? null,
                        resolveStatus: charge?.status ?? null,
                        resolvePayUrl: charge?.invoicePayUrl ?? null,
                        status: B2bInvoiceStatus.PENDING,
                        notes: charge ? null : "Resolve charge failed — retry / verify spec",
                    },
                });
            }

            console.log(`[cron/recurring] Fired schedule ${sched.id} (${sched.name}) → order ${result.order.id}`);
            fired++;
        } catch (e) {
            const msg = e instanceof Error ? e.message : "unknown";
            console.error(`[cron/recurring] Schedule ${sched.id} failed:`, msg);
            failures.push(`${sched.id}: ${msg}`);
            // Don't advance nextFireAt — let it retry on next tick. If it
            // fails repeatedly, the schedule sticks at its overdue
            // nextFireAt and the partner sees it as stale on /b2b-portal/schedules.
        }
    }

    return NextResponse.json({ fired, skipped, failures });
}
