import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import StaffManagementClient from '@/components/admin/StaffManagementClient';

export const dynamic = 'force-dynamic';

const GLOBAL_STAFF_ROLES = ['PRODUCT_MANAGER', 'CONTENT_MANAGER', 'SALES', 'ANALYTICS_VIEWER'];

export default async function StaffManagementPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/portal-login`);

    const [masterAdmins, globalStaff, locationOnly, b2bPartners, locations] = await Promise.all([
        prisma.user.findMany({
            where: { role: 'MASTER_ADMIN' },
            select: {
                id: true, name: true, email: true, role: true, isActive: true,
                totpSecret: true, createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.user.findMany({
            where: { role: { in: GLOBAL_STAFF_ROLES } },
            select: {
                id: true, name: true, email: true, role: true, isActive: true,
                totpSecret: true, createdAt: true,
                locationRoles: {
                    select: {
                        id: true, role: true,
                        location: { select: { id: true, name: true, city: true, state: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        }),
        // Location-only staff: a hire at one bakery whose global role stayed
        // B2C_CUSTOMER and whose only access is through UserLocation rows.
        prisma.user.findMany({
            where: {
                role: 'B2C_CUSTOMER',
                locationRoles: { some: {} },
            },
            select: {
                id: true, name: true, email: true, role: true, isActive: true,
                totpSecret: true, createdAt: true,
                locationRoles: {
                    select: {
                        id: true, role: true,
                        location: { select: { id: true, name: true, city: true, state: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        }),
        // B2B partners — listed here read-only so admins see the full org;
        // the lifecycle (apply → invite) lives in /admin/requests.
        prisma.user.findMany({
            where: { role: 'B2B_PARTNER' },
            select: {
                id: true, name: true, email: true, companyName: true, isActive: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.location.findMany({
            where: { isActive: true },
            select: { id: true, name: true, city: true, state: true, type: true },
            orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        }),
    ]);

    const serialize = (rows: any[]) =>
        rows.map(u => {
            const { totpSecret, createdAt, ...rest } = u;
            return {
                ...rest,
                createdAt: createdAt.toISOString(),
                has2FA: !!totpSecret,
            };
        });

    return (
        <StaffManagementClient
            masterAdmins={serialize(masterAdmins)}
            globalStaff={serialize(globalStaff)}
            locationOnly={serialize(locationOnly)}
            b2bPartners={b2bPartners.map(p => ({ ...p, createdAt: p.createdAt.toISOString() }))}
            locations={locations}
        />
    );
}
