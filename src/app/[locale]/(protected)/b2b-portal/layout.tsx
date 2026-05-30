import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { prisma as db } from '@/lib/db';
import B2BSidebar from '@/components/b2b/B2BSidebar';
import { getPartnerContext } from '@/lib/b2b-partner';

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

    // Tier 2 — resolve org context. A B2B_PARTNER with no context yet is a
    // proto-owner (B2bPartner row is created just-in-time on first order), so
    // treat null as owner for nav purposes. Active members get scoped nav, and
    // their company name comes from the org (their own User has no companyName).
    const ctx = await getPartnerContext(session.userId);
    // A B2B_PARTNER with no active context is either a proto-owner (no B2bPartner
    // row yet — just registered, fine) or a DISABLED member. Lock out the latter.
    if (!ctx && session.role === 'B2B_PARTNER') {
        const membership = await db.b2bPartnerMember.findUnique({ where: { userId: session.userId }, select: { status: true } });
        if (membership) redirect(`/${locale}/b2b/login`);
    }
    const isOwner = !ctx || ctx.isOwner;
    let companyName = user?.companyName || 'Partner';
    if (ctx && !ctx.isOwner) {
        const org = await db.b2bPartner.findUnique({ where: { id: ctx.partnerId }, select: { companyName: true } });
        companyName = org?.companyName || companyName;
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7] flex flex-col md:flex-row" style={{ paddingTop: 'var(--testing-strip-height, 0px)' }}>
            <B2BSidebar
                locale={locale}
                companyName={companyName}
                companyInitial={companyName.charAt(0).toUpperCase() || 'P'}
                sessionEmail={session.email}
                isOwner={isOwner}
                canViewBilling={ctx?.canViewBilling ?? true}
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
