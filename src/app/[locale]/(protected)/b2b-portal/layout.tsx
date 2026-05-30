import { getSession } from '@/lib/session';
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
    const session = await getSession();

    // Phase 11: replace the stale 'ADMIN' check (never matched — codebase
    // uses 'MASTER_ADMIN') and route partners to the correct sign-in.
    // This was the root cause of the post-registration crash: a session
    // with role=B2B_PARTNER passed, but if anything later returned to
    // /login (D2C), the partner saw a generic error page instead of their
    // dashboard.
    if (!session || (session.role !== 'B2B_PARTNER' && session.role !== 'MASTER_ADMIN')) {
        redirect(`/${locale}/b2b/login`);
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
