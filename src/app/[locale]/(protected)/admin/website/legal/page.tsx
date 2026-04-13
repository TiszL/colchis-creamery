import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import LegalPagesEditor from '@/components/admin/LegalPagesEditor';

export const dynamic = 'force-dynamic';

export default async function AdminLegalPagesPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const configs = await prisma.siteConfig.findMany({
        where: { key: { startsWith: 'legal.' } },
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Legal & FAQ Pages</h1>
                <p className="text-gray-500 font-light">Edit FAQ, Privacy Policy, Terms of Service, and Return Policy content.</p>
            </div>
            <LegalPagesEditor configs={JSON.parse(JSON.stringify(configs))} />
        </div>
    );
}
