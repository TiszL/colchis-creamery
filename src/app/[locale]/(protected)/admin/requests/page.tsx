import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import RequestsDashboard from '@/components/admin/RequestsDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminRequestsPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const leads = await prisma.b2bLead.findMany({
        orderBy: { createdAt: 'desc' },
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Partnership Requests</h1>
                <p className="text-gray-500 font-light">Wholesale partnership applications from the website form.</p>
            </div>

            <RequestsDashboard leads={JSON.parse(JSON.stringify(leads))} locale={locale} />
        </div>
    );
}
