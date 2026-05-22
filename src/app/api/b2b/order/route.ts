import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";
import { jwtVerify } from "jose";
import { B2bPaymentMethod } from "@prisma/client";
import { createResolveCustomer, createResolveCharge, isResolveConfigured } from "@/lib/resolve";
import { commitStock } from "@/lib/stock-reservation";

const SECRET_KEY = new TextEncoder().encode(
    process.env.JWT_SECRET || "dev-secret-change-in-production"
);

// Phase 6 (6c) — B2B order placement now branches on paymentMethod.
// Backward compat: omit the field and the order falls through to the
// legacy Net-30-manual path (paymentStatus=UNPAID, no B2bInvoice).
const NET_TERM_DAYS: Record<string, number> = {
    RESOLVE_NET_7: 7,
    RESOLVE_NET_15: 15,
    RESOLVE_NET_30: 30,
    RESOLVE_NET_45: 45,
};

interface B2bOrderRequestBody {
    items: { id: string; quantity: number }[];
    paymentMethod?: B2bPaymentMethod;
}

export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get("auth_token")?.value;
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { payload } = await jwtVerify(token, SECRET_KEY);
        const userId = payload.userId as string;
        const role = payload.role as string;

        if (role !== "B2B_PARTNER" && role !== "MASTER_ADMIN" && role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body: B2bOrderRequestBody = await req.json();
        const { items, paymentMethod } = body;

        if (!items || items.length === 0) {
            return NextResponse.json({ error: "Empty order" }, { status: 400 });
        }

        // 1. Verify contract is signed (existing gate; preserved)
        const user = await db.user.findUnique({
            where: { id: userId },
            include: {
                contracts: { where: { status: "SIGNED" }, take: 1 },
                b2bPartner: true,
            },
        });
        if (!user || user.contracts.length === 0) {
            return NextResponse.json({ error: "No active contract found" }, { status: 403 });
        }

        const discountPercentage = parseInt(user.contracts[0].discountPercentage, 10) || 0;

        // Phase 9c: route each B2B line to a real Location so commitStock can
        // run + write StockMovement (audit) + decrement ProductBatch (FIFO).
        // Pick the first active Location whose allowsChannels matches the
        // product's salesChannel AND has enough free stock for the request.
        // This is intentionally O(items × locations) — partner orders are
        // small enough that we don't need a global packing solver yet.
        const result = await db.$transaction(async tx => {
            let subtotal = 0;
            const processedItems: { productId: string; quantity: number; unitPrice: string }[] = [];
            const fulfillmentPlan: { productId: string; locationId: string; quantity: number; orderItemIndex: number }[] = [];

            for (const item of items) {
                const product = await tx.product.findUnique({
                    where: { id: item.id },
                    select: {
                        id: true, name: true, isActive: true, salesChannel: true,
                        priceB2b: true, isMadeToOrder: true,
                    },
                });
                if (!product || !product.isActive) throw new Error(`Product ${item.id} is invalid or inactive`);

                // Find candidate locations: active + carries this salesChannel +
                // has an enabled Stock row with enough free quantity. MTO products
                // skip the quantity gate (capacity-bound, not stock-bound).
                const candidates = await tx.location.findMany({
                    where: {
                        isActive: true,
                        allowsChannels: { has: product.salesChannel },
                    },
                    select: {
                        id: true, name: true, isPrimary: true,
                        stocks: {
                            where: { productId: product.id, isEnabled: true },
                            select: { id: true, quantity: true, reservedQuantity: true },
                        },
                    },
                    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
                });

                const target = candidates.find(loc => {
                    const stock = loc.stocks[0];
                    if (!stock) return false;
                    if (product.isMadeToOrder) return true;
                    const free = (stock.quantity ?? 0) - stock.reservedQuantity;
                    return free >= item.quantity;
                });

                if (!target) {
                    throw new Error(`Insufficient stock for ${product.name} at any wholesale-capable location`);
                }

                fulfillmentPlan.push({
                    productId: product.id,
                    locationId: target.id,
                    quantity: item.quantity,
                    orderItemIndex: processedItems.length,
                });

                const basePrice = parseFloat(product.priceB2b.replace(/[^0-9.-]+/g, "")) || 0;
                const discountAmount = basePrice * (discountPercentage / 100);
                const finalPrice = basePrice - discountAmount;

                subtotal += finalPrice * item.quantity;
                processedItems.push({
                    productId: product.id,
                    quantity: item.quantity,
                    unitPrice: `$${finalPrice.toFixed(2)}`,
                });
            }

            const order = await tx.order.create({
                data: {
                    userId,
                    orderType: "B2B",
                    paymentStatus: "UNPAID",
                    orderStatus: "PROCESSING",
                    totalAmount: `$${subtotal.toFixed(2)}`,
                    orderItems: { create: processedItems },
                },
                include: { orderItems: true },
            });

            // Group lines by location → one OrderFulfillment per location so the
            // dispatch queue can pull/ship them as a unit. Maps OrderItem.id
            // back via positional index from processedItems (order preserved).
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
                        deliveryMethod: 'MANUAL_DISPATCH', // B2B 3PL freight — admin dispatch queue handles tracking
                        status: 'PENDING',
                        items: {
                            create: lines.map(l => ({
                                orderItemId: order.orderItems[l.orderItemIndex].id,
                                quantity: l.quantity,
                            })),
                        },
                    },
                });
            }

            return {
                order,
                subtotalCents: Math.round(subtotal * 100),
                totalItemCount: processedItems.reduce((n, i) => n + i.quantity, 0),
                fulfillmentPlan,
            };
        });

        // Commit stock OUTSIDE the order-creation tx — commitStock uses its own
        // transaction (writes StockMovement SALE rows + FIFO-consumes batches).
        // If a partner order's stock commit fails mid-flight, ops can replay
        // via the manual dispatch queue; we don't want to roll back the Order
        // itself since the partner already saw a confirmation.
        await commitStock(
            result.fulfillmentPlan.map(l => ({
                productId: l.productId,
                locationId: l.locationId,
                quantity: l.quantity,
            })),
            { orderId: result.order.id },
        );

        const order = result.order;
        const subtotalCents = result.subtotalCents;
        const totalItemCount = result.totalItemCount;

        // 3. Phase 6 (6c) — branch on paymentMethod
        const method: B2bPaymentMethod | undefined = paymentMethod;

        // 3a. Stripe pay-now paths — not yet wired client-side (Elements in the
        // B2B portal is a focused follow-up). For now, accept the request +
        // return a clear "coming soon" so the partner doesn't get a silent
        // legacy Net-30 invoice when they explicitly picked Stripe.
        if (method === "STRIPE_CARD" || method === "STRIPE_ACH") {
            return NextResponse.json({
                success: true,
                orderId: order.id,
                paymentStatus: "AWAITING_PAYMENT",
                note: "Stripe pay-now flow is not yet wired in the B2B portal (Elements integration pending). The order has been placed and will be invoiced. Contact sales to switch payment method.",
            });
        }

        // 3b. Resolve net-terms path
        if (method && NET_TERM_DAYS[method] !== undefined) {
            const dueDays = NET_TERM_DAYS[method];

            if (!isResolveConfigured()) {
                console.warn("[b2b/order] Resolve not configured; falling back to legacy Net-30 invoicing for order", order.id);
                return NextResponse.json({
                    success: true,
                    orderId: order.id,
                    paymentStatus: "UNPAID",
                    note: "Resolve is not configured. Order falls back to manual Net-30 invoicing.",
                });
            }

            // Ensure B2bPartner exists + has resolveCustomerId. Just-in-time
            // creation per Phase plan Q15 (credit check on first net-terms order).
            let partner = user.b2bPartner;
            if (!partner) {
                partner = await db.b2bPartner.create({
                    data: {
                        userId,
                        companyName: user.companyName || user.name || user.email,
                    },
                });
            }

            if (!partner.resolveCustomerId) {
                const created = await createResolveCustomer({
                    partnerId: partner.id,
                    companyName: partner.companyName,
                    contactName: user.name || undefined,
                    contactEmail: user.email,
                    contactPhone: user.phone || undefined,
                    businessAddress: partner.businessAddress || undefined,
                    ein: partner.ein || undefined,
                });
                if (!created) {
                    return NextResponse.json({
                        success: true,
                        orderId: order.id,
                        paymentStatus: "UNPAID",
                        note: "Could not create Resolve customer. Order falls back to manual invoicing — sales will follow up.",
                    });
                }
                partner = await db.b2bPartner.update({
                    where: { id: partner.id },
                    data: { resolveCustomerId: created.customerId, resolveStatusUpdatedAt: new Date() },
                });
            }

            const charge = await createResolveCharge({
                customerId: partner.resolveCustomerId!,
                amountCents: subtotalCents,
                dueDays,
                orderRef: order.id,
                description: `Order ${order.id.slice(0, 8)} — ${totalItemCount} items`,
            });

            // Issue B2bInvoice regardless of Resolve outcome — if Resolve
            // failed, the invoice is on file for ops to chase manually.
            const dueAt = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);
            const invoice = await db.b2bInvoice.create({
                data: {
                    orderId: order.id,
                    partnerId: partner.id,
                    amountCents: subtotalCents,
                    paymentMethod: method,
                    dueAt,
                    resolveInvoiceId: charge?.chargeId ?? null,
                    resolveStatus: charge?.status ?? null,
                    notes: charge ? null : "Resolve charge creation failed — verify spec + retry",
                },
            });

            return NextResponse.json({
                success: true,
                orderId: order.id,
                invoiceId: invoice.id,
                paymentStatus: "UNPAID",
                invoicePayUrl: charge?.invoicePayUrl ?? null,
            });
        }

        // 3c. Legacy Net-30 path (no paymentMethod provided) — current behavior.
        return NextResponse.json({ success: true, orderId: order.id, paymentStatus: "UNPAID" });

    } catch (error) {
        console.error("Order processing error:", error);
        const msg = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
