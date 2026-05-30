import { prisma as db } from '@/lib/db';
import { getSession } from '@/lib/session';
import BulkOrderClient from '@/components/b2b/BulkOrderClient';
import { PackagePlus } from 'lucide-react';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function B2BOrderPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ reorder?: string }> }) {
    const { locale } = await params;
    const { reorder } = await searchParams;
    // getSession enforces the live isActive/sessionVersion check (a raw verifyToken
    // would let a deactivated/demoted partner keep ordering).
    const session = await getSession();
    if (!session) redirect(`/${locale}/b2b/login`);

    // Reorder: pre-fill quantities from a past order's items (scoped to this partner).
    const initialQuantities: Record<string, number> = {};
    if (reorder) {
        const prev = await db.order.findUnique({
            where: { id: reorder },
            select: { userId: true, orderItems: { select: { productId: true, quantity: true } } },
        });
        if (prev && prev.userId === session.userId) {
            for (const it of prev.orderItems) {
                initialQuantities[it.productId] = (initialQuantities[it.productId] || 0) + it.quantity;
            }
        }
    }

    // Active contract = SIGNED AND not expired. An expired contract must not let
    // the partner order (nor silently apply its discount).
    const now = new Date();
    const user = await db.user.findUnique({
        where: { id: session.userId },
        include: {
            contracts: {
                where: { status: 'SIGNED', OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
                take: 1
            }
        }
    });

    const activeContract = user?.contracts[0];

    // Block access if no active (signed, unexpired) contract exists
    if (!activeContract) {
        redirect(`/${locale}/b2b-portal`);
    }

    // Fetch B2B-purchasable products + compute REAL per-location availability so the
    // catalog matches what /api/b2b/order actually allocates (it requires a single
    // location to cover each line). MTO products are unlimited (availableQty=null).
    const productRows = await db.product.findMany({
        where: { status: 'ACTIVE', isB2bVisible: true },
        orderBy: { name: 'asc' }
    });
    const locations = await db.location.findMany({
        where: { isActive: true },
        select: {
            allowsChannels: true,
            stocks: { where: { isEnabled: true }, select: { productId: true, quantity: true, reservedQuantity: true } },
        },
    });
    const products = productRows.map(p => {
        if (p.isMadeToOrder) return { ...p, availableQty: null as number | null };
        let maxFree = 0;
        for (const loc of locations) {
            if (!loc.allowsChannels.includes(p.salesChannel)) continue;
            const st = loc.stocks.find(s => s.productId === p.id);
            if (!st) continue;
            const free = (st.quantity ?? 0) - st.reservedQuantity;
            if (free > maxFree) maxFree = free;
        }
        return { ...p, availableQty: maxFree as number | null };
    });

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-serif text-[#2C2A29] flex items-center gap-3">
                        <PackagePlus className="w-8 h-8 text-[#CBA153]" />
                        Place Bulk Order
                    </h1>
                    <p className="text-gray-500 mt-1">Review inventory and place your order. Your {activeContract.discountPercentage}% contract discount is automatically applied.</p>
                </div>
            </div>

            {/* Client Component handles complex state and math */}
            <BulkOrderClient
                products={products}
                discount={parseInt(activeContract.discountPercentage, 10) || 0}
                stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
                locale={locale}
                initialQuantities={initialQuantities}
            />

        </div>
    );
}
