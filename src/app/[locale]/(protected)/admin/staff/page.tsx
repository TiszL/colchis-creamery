import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import StaffManagementClient from '@/components/admin/StaffManagementClient';

export const dynamic = 'force-dynamic';

export default async function StaffManagementPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const staffUsers = await prisma.user.findMany({
        where: {
            role: { in: ['PRODUCT_MANAGER', 'CONTENT_MANAGER', 'SALES', 'ANALYTICS_VIEWER'] },
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    const serialized = staffUsers.map(u => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
    }));

    return <StaffManagementClient initialStaff={serialized} />;
}
