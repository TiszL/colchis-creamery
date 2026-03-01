import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";
import { jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(
    process.env.JWT_SECRET || "dev-secret-change-in-production"
);

export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get("auth_token")?.value;
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { payload } = await jwtVerify(token, SECRET_KEY);
        const userId = payload.userId as string;
        const role = payload.role as string;

        if (role !== "B2B_PARTNER" && role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { items }: { items: { id: string, quantity: number }[] } = await req.json();

        if (!items || items.length === 0) {
            return NextResponse.json({ error: "Empty order" }, { status: 400 });
        }

        // 1. Verify contract discount
        const user = await db.user.findUnique({
            where: { id: userId },
            include: { contracts: { where: { status: "SIGNED" }, take: 1 } }
        });

        if (!user || user.contracts.length === 0) {
            return NextResponse.json({ error: "No active contract found" }, { status: 403 });
        }

        const discountPercentage = parseInt(user.contracts[0].discountPercentage, 10) || 0;

        // 2. Wrap all creates & stock updates in a Prisma Transaction (ACID compliance)
        const result = await db.$transaction(async (tx: any) => {

            let subtotal = 0;
            const processedItems = [];

            // 3. Process each item: Check stock, compute price
            for (const item of items) {
                const product = await tx.product.findUnique({ where: { id: item.id } });

                if (!product || !product.isActive) {
                    throw new Error(`Product ${item.id} is invalid or inactive`);
                }

                if (product.stockQuantity < item.quantity) {
                    throw new Error(`Insufficient stock for ${product.name}`);
                }

                // Deduct stock immediately!
                await tx.product.update({
                    where: { id: product.id },
                    data: { stockQuantity: product.stockQuantity - item.quantity }
                });

                const basePrice = parseFloat(product.priceB2b.replace(/[^0-9.-]+/g, "")) || 0;
                const discountAmount = basePrice * (discountPercentage / 100);
                const finalPrice = basePrice - discountAmount;

                subtotal += (finalPrice * item.quantity);

                processedItems.push({
                    productId: product.id,
                    quantity: item.quantity,
                    unitPrice: `$${finalPrice.toFixed(2)}`
                });
            }

            // 4. Create the final Order record
            // By default, it's UNPAID because it's a Net-30 B2B invoice
            const order = await tx.order.create({
                data: {
                    userId,
                    orderType: "B2B",
                    paymentStatus: "UNPAID",
                    orderStatus: "PROCESSING",
                    totalAmount: `$${subtotal.toFixed(2)}`,
                    orderItems: {
                        create: processedItems
                    }
                }
            });

            return order;
        });

        return NextResponse.json({ success: true, orderId: result.id });

    } catch (error: any) {
        console.error("Order processing error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
