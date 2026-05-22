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

            // Build the order in a transaction (mirrors /api/b2b/order shape).
            const result = await prisma.$transaction(async tx => {
                let subtotal = 0;
                const processed: { productId: string; quantity: number; unitPrice: string }[] = [];

                // Apply partner's signed-contract discount if present.
                const contract = await tx.contract.findFirst({
                    where: { partnerId: sched.partner.userId, status: "SIGNED" },
                    take: 1,
                });
                const discountPct = contract ? (parseInt(contract.discountPercentage, 10) || 0) : 0;

                for (const item of items) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    if (!product || !product.isActive) throw new Error(`Product ${item.productId} invalid or inactive`);
                    if (product.stockQuantity < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);

                    await tx.product.update({
                        where: { id: product.id },
                        data: { stockQuantity: product.stockQuantity - item.quantity },
                    });

                    const basePrice = parseFloat(product.priceB2b.replace(/[^0-9.-]+/g, "")) || 0;
                    const finalPrice = basePrice * (1 - discountPct / 100);
                    subtotal += finalPrice * item.quantity;
                    processed.push({ productId: product.id, quantity: item.quantity, unitPrice: `$${finalPrice.toFixed(2)}` });
                }

                const order = await tx.order.create({
                    data: {
                        userId: sched.partner.userId,
                        orderType: "B2B",
                        paymentStatus: "UNPAID",
                        orderStatus: "PROCESSING",
                        totalAmount: `$${subtotal.toFixed(2)}`,
                        notes: `Auto-generated from recurring schedule "${sched.name}"`,
                        orderItems: { create: processed },
                    },
                });

                return { order, subtotalCents: Math.round(subtotal * 100) };
            });

            // Resolve invoice — only if configured + a resolve customer exists.
            // Skip silently otherwise; legacy Net-30 path still puts the order
            // on the dispatch queue.
            const dueDays = NET_TERM_DAYS[sched.paymentMethod];
            if (dueDays !== undefined && isResolveConfigured() && sched.partner.resolveCustomerId) {
                const charge = await createResolveCharge({
                    customerId: sched.partner.resolveCustomerId,
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
                        amountCents: result.subtotalCents,
                        paymentMethod: sched.paymentMethod as B2bPaymentMethod,
                        dueAt,
                        resolveInvoiceId: charge?.chargeId ?? null,
                        resolveStatus: charge?.status ?? null,
                        status: B2bInvoiceStatus.PENDING,
                        notes: charge ? null : "Resolve charge failed — retry / verify spec",
                    },
                });
            }

            // Advance the schedule.
            const next = new Date(sched.nextFireAt.getTime() + sched.intervalDays * 24 * 60 * 60 * 1000);
            // If we somehow missed many fires (system was down), fast-forward so
            // we don't create a flood retroactively. Always set nextFireAt strictly
            // in the future.
            while (next <= now) next.setDate(next.getDate() + sched.intervalDays);
            await prisma.recurringOrderSchedule.update({
                where: { id: sched.id },
                data: { lastFiredAt: now, nextFireAt: next },
            });

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
