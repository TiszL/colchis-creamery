import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import AccountClient from '@/components/account/AccountClient';
import { getMyAddresses } from '@/app/actions/addresses';

export const dynamic = 'force-dynamic';

export default async function CustomerAccountPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();

    if (!session || session.role !== 'B2C_CUSTOMER') {
        redirect(`/${locale}/login`);
    }

    const [user, orders, userAddresses] = await Promise.all([
        prisma.user.findUnique({ where: { id: session.userId } }),
        prisma.order.findMany({
            where: { userId: session.userId },
            orderBy: { createdAt: 'desc' },
            include: {
                orderItems: { include: { product: true } },
                // Derived customer stage (customerOrderStage) needs the honest
                // per-fulfillment kitchen + courier progress.
                fulfillments: { select: { status: true, courierStatus: true, deliveryMethod: true } },
            },
        }),
        // Phase 7b: addresses come from the new UserAddress[] table that
        // AddressManager writes to on /shop, /bakery, /cart, /checkout.
        getMyAddresses(),
    ]);

    if (!user) redirect(`/${locale}/login`);

    const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt.toISOString(),
    };

    const ordersData = orders.map(o => ({
        id: o.id,
        createdAt: o.createdAt.toISOString(),
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        totalAmount: Number(o.totalAmount),
        orderItems: o.orderItems.map(item => ({
            product: { name: item.product.name },
            quantity: item.quantity,
        })),
        fulfillments: o.fulfillments.map(f => ({
            status: f.status,
            courierStatus: f.courierStatus,
            deliveryMethod: f.deliveryMethod,
        })),
    }));

    return (
        <AccountClient
            user={userData}
            orders={ordersData}
            locale={locale}
            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}
            userAddresses={userAddresses}
        />
    );
}
