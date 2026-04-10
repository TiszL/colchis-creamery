import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';
import StaffSidebar from '@/components/admin/StaffSidebar';

export const dynamic = 'force-dynamic';

const STAFF_ROLES = ["MASTER_ADMIN", "PRODUCT_MANAGER", "CONTENT_MANAGER", "SALES"];

const ROLE_LABELS: Record<string, string> = {
    MASTER_ADMIN: 'Master Admin',
    PRODUCT_MANAGER: 'Product Manager',
    CONTENT_MANAGER: 'Content Manager',
    SALES: 'Sales',
};

export default async function StaffPortalLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: any;
}) {
    const { locale } = await params;
    const session = await getSession();

    if (!session || !STAFF_ROLES.includes(session.role)) {
        redirect(`/${locale}/staff`);
    }

    return (
        <div className="min-h-screen bg-[#0D0D0D] flex flex-col md:flex-row">
            <StaffSidebar
                locale={locale}
                sessionRole={session.role}
                sessionName={session.name || session.email}
                sessionEmail={session.email}
                roleLabel={ROLE_LABELS[session.role] || session.role}
            />

            {/* Main Content */}
            <main className="flex-1 w-full md:ml-72 min-h-screen pt-16 md:pt-0">
                <div className="p-4 md:p-8 lg:p-12">
                    {children}
                </div>
            </main>
        </div>
    );
}
