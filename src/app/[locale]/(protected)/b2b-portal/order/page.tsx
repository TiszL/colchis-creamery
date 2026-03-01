import { prisma as db } from '@/lib/db';
import { getSessionToken } from '@/lib/session';
import { verifyToken } from '@/lib/auth';
import BulkOrderClient from '@/components/b2b/BulkOrderClient';
import { PackagePlus } from 'lucide-react';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function B2BOrderPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const token = await getSessionToken();
    const session = await verifyToken(token!);

    // Fetch active contract
    const user = await db.user.findUnique({
        where: { id: session!.userId },
        include: {
            contracts: {
                where: { status: 'SIGNED' },
                take: 1
            }
        }
    });

    const activeContract = user?.contracts[0];

    // Block access if no signed contract exists
    if (!activeContract) {
        redirect(`/${locale}/b2b-portal`);
    }

    // Fetch all active products
    const products = await db.product.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
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
            />

        </div>
    );
}
