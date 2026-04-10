import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';

export const dynamic = 'force-dynamic';


export default async function AdminLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: any;
}) {
    const { locale } = await params;
    const session = await getSession();

    if (!session || session.role !== 'MASTER_ADMIN') {
        redirect(`/${locale}/staff`);
    }

    return (
        <div className="min-h-screen bg-[#0A0A0A]">
            <AdminSidebar 
                locale={locale} 
                sessionName={session.name || session.email} 
                sessionEmail={session.email} 
                logoutAction={logoutAction} 
            />

            {/* Main Content — offset by sidebar width on md+ */}
            <main className="min-h-screen pt-16 md:pt-0 md:ml-72">
                <div className="p-4 md:p-8 lg:p-12 max-w-full overflow-x-hidden">
                    {children}
                </div>
            </main>
        </div>
    );
}
