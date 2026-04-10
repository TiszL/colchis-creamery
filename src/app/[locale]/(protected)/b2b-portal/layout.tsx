import Link from 'next/link';
import { getSessionToken } from '@/lib/session';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma as db } from '@/lib/db';
import B2BSidebar from '@/components/b2b/B2BSidebar';

export default async function B2BLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: any;
}) {
    const { locale } = await params;
    const token = await getSessionToken();
    const session = token ? await verifyToken(token) : null;

    if (!session || (session.role !== 'B2B_PARTNER' && session.role !== 'ADMIN')) {
        redirect(`/${locale}/login`);
    }

    // Fetch company name for display
    const user = await db.user.findUnique({
        where: { id: session.userId }
    });


    return (
        <div className="min-h-screen bg-[#FDFBF7] flex flex-col md:flex-row">
            <B2BSidebar 
                locale={locale} 
                companyName={user?.companyName || 'Unknown Partner'} 
                companyInitial={user?.companyName?.charAt(0).toUpperCase() || 'P'}
                sessionEmail={session.email}
            />

            {/* Main Content Area */}
            <main className="flex-1 w-full md:ml-64 min-h-screen pt-16 md:pt-0">
                <div className="p-4 md:p-8 lg:p-12">
                    {children}
                </div>
            </main>
        </div>
    );
}
