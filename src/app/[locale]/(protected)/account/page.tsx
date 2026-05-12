import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import AccountClient from '@/components/account/AccountClient';

export const dynamic = 'force-dynamic';

export default async function CustomerAccountPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();

    if (!session || session.role !== 'B2C_CUSTOMER') {
        redirect(`/${locale}/login`);
    }

    const [user, profile, orders] = await Promise.all([
        prisma.user.findUnique({ where: { id: session.userId } }),
        prisma.userProfile.findUnique({ where: { userId: session.userId } }),
        prisma.order.findMany({
            where: { userId: session.userId },
            orderBy: { createdAt: 'desc' },
            include: { orderItems: { include: { product: true } } },
        }),
    ]);

    if (!user) redirect(`/${locale}/login`);

    const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt.toISOString(),
    };

    const profileData = profile ? {
        shippingAddress: profile.shippingAddress,
        shippingCity: profile.shippingCity,
        shippingState: profile.shippingState,
        shippingZip: profile.shippingZip,
        shippingCountry: profile.shippingCountry,
    } : null;

    const ordersData = orders.map(o => ({
        id: o.id,
        createdAt: o.createdAt.toISOString(),
        orderStatus: o.orderStatus,
        totalAmount: Number(o.totalAmount),
        orderItems: o.orderItems.map(item => ({
            product: { name: item.product.name },
            quantity: item.quantity,
        })),
    }));

    return (
        <AccountClient
            user={userData}
            profile={profileData}
            orders={ordersData}
            locale={locale}
        />
    );
}
