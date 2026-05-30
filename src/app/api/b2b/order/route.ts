import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";
import { jwtVerify } from "jose";
import { B2bPaymentMethod } from "@prisma/client";
import { createResolveCustomer, createResolveCharge, isResolveConfigured } from "@/lib/resolve";
import { commitStock, reserveStock } from "@/lib/stock-reservation";
import { stripe } from "@/lib/stripe";
import { getJwtSecret } from "@/lib/auth";

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

        const { payload } = await jwtVerify(token, getJwtSecret());
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

        const order = result.order;
        const subtotalCents = result.subtotalCents;
        const totalItemCount = result.totalItemCount;
        const reservationItems = result.fulfillmentPlan.map(l => ({
            productId: l.productId,
            locationId: l.locationId,
            quantity: l.quantity,
        }));

        // 3. Phase 6 (6c) — branch on paymentMethod
        const method: B2bPaymentMethod | undefined = paymentMethod;

        // 3a. Stripe pay-now paths (Phase 10 — Elements wired in B2B portal).
        //     Reserve stock now (race-safe), create a PaymentIntent with
        //     metadata.orderId so the shared webhook handler at
        //     /api/webhooks/stripe finds + commits this order on success,
        //     then return the clientSecret to the client for confirmPayment.
        if (method === "STRIPE_CARD" || method === "STRIPE_ACH") {
            // Phase 4 (Connect) extended to B2B: settle to the connected
            // account when all fulfillments land at a single Location with
            // a complete Connect onboarding. Stripe's transfer_data accepts
            // exactly one destination per PaymentIntent — mixed-location
            // orders fall back to a platform charge (settled internally).
            const uniqueLocationIds = Array.from(new Set(result.fulfillmentPlan.map(l => l.locationId)));
            const connectLookup = await db.location.findMany({
                where: { id: { in: uniqueLocationIds } },
                select: { id: true, stripeConnectAccountId: true, stripeOnboardingStatus: true },
            });
            const completeAccounts = connectLookup
                .filter(l => l.stripeConnectAccountId && l.stripeOnboardingStatus === 'complete')
                .map(l => l.stripeConnectAccountId!);
            const allOnSingleConnectAccount =
                completeAccounts.length === connectLookup.length &&
                new Set(completeAccounts).size === 1;
            const destinationAccountId = allOnSingleConnectAccount ? completeAccounts[0] : null;
            if (uniqueLocationIds.length > 1 && !allOnSingleConnectAccount && completeAccounts.length > 0) {
                console.warn(
                    '[b2b/order] Mixed-Connect order — some locations have complete Connect, others do not. Falling back to platform charge.',
                    { orderId: order.id, locationIds: uniqueLocationIds },
                );
            }

            try {
                await reserveStock(reservationItems);
            } catch (e) {
                console.error("[b2b/order] reserveStock failed for Stripe path:", e);
                // Best-effort: try to mark the just-created order as cancelled so
                // it doesn't sit in PROCESSING forever. If THIS fails too, ops
                // can clean up via admin tools.
                await db.order.update({
                    where: { id: order.id },
                    data: { orderStatus: "CANCELLED", paymentStatus: "FAILED" },
                }).catch(() => undefined);
                return NextResponse.json({ error: "Could not reserve stock for this order." }, { status: 500 });
            }

            // Stripe best practice: reuse the User.stripeCustomerId when present;
            // create + persist if not. Attaching a Customer enables:
            //   - the Stripe dashboard to group repeat partner orders
            //   - support tooling to look up partner-side payment history
            //   - future "save card" flow without retyping
            let stripeCustomerId = user.stripeCustomerId;
            if (!stripeCustomerId) {
                const cust = await stripe.customers.create({
                    email: user.email,
                    name: user.companyName || user.name || undefined,
                    phone: user.phone || undefined,
                    metadata: { userId: user.id, role: "B2B_PARTNER" },
                });
                stripeCustomerId = cust.id;
                await db.user.update({
                    where: { id: user.id },
                    data: { stripeCustomerId },
                });
            }

            // Statement descriptor — what shows on the partner's card statement.
            // Limit: 22 chars total (prefix + suffix). Order-id slice gives them
            // a referenceable ID. Use only allowed chars (alnum + spaces).
            const statementSuffix = `B2B ${order.id.slice(0, 8).toUpperCase()}`.slice(0, 22);

            // Stripe best practice: idempotency key on retryable requests. Keyed
            // on order.id so a network retry won't create a duplicate
            // PaymentIntent for the same order. (Different orders → different
            // PaymentIntents — order.id is unique per attempt.)
            const intentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
                amount: subtotalCents,
                currency: "usd",
                customer: stripeCustomerId,
                automatic_payment_methods: { enabled: true },
                // setup_future_usage='off_session' attaches the PaymentMethod to
                // the Customer after a successful charge so RecurringOrderSchedule
                // (Phase 6d) can bill it via cron without re-prompting the
                // partner. Both card and us_bank_account support off_session via
                // PaymentElement; Stripe handles ACH-mandate text automatically.
                setup_future_usage: 'off_session',
                metadata: {
                    orderId: order.id,
                    orderType: "B2B",
                    paymentMethodChoice: method,
                    userId,
                },
                description: `B2B order ${order.id.slice(0, 8)} — ${totalItemCount} items`,
                // Receipts auto-send when a Customer is attached + has an email,
                // but receipt_email here forces it even when the Stripe receipt
                // setting in dashboard is dialed down. B2B partners want the
                // paper trail.
                receipt_email: user.email,
                statement_descriptor_suffix: statementSuffix,
            };
            if (destinationAccountId) {
                intentParams.transfer_data = { destination: destinationAccountId };
                (intentParams.metadata as Record<string, string>).connect_account_id = destinationAccountId;
            }
            const intent = await stripe.paymentIntents.create(intentParams, {
                idempotencyKey: `b2b-order-pi-${order.id}`,
            });

            await db.order.update({
                where: { id: order.id },
                data: {
                    stripePaymentIntentId: intent.id,
                    orderStatus: "AWAITING_PAYMENT",
                },
            });

            return NextResponse.json({
                success: true,
                orderId: order.id,
                paymentStatus: "AWAITING_PAYMENT",
                clientSecret: intent.client_secret,
                paymentIntentId: intent.id,
                amountCents: subtotalCents,
            });
        }

        // 3b/3c. Non-Stripe paths: commit stock now (synchronous fulfillment).
        // commitStock uses its own transaction (writes StockMovement SALE rows
        // + FIFO-consumes batches). If a partner order's stock commit fails
        // mid-flight, ops can replay via /admin/b2b/dispatch.
        await commitStock(reservationItems, { orderId: order.id });

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
