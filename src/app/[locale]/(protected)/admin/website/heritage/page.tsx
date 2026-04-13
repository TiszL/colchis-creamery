import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import HeritageEditor from '@/components/admin/HeritageEditor';

export const dynamic = 'force-dynamic';

export default async function AdminHeritagePage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const configs = await prisma.siteConfig.findMany({
        where: { key: { startsWith: 'heritage.' } },
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Heritage Page Editor</h1>
                <p className="text-gray-500 font-light">Manage all content sections, images, videos, and translations for the Heritage page.</p>
            </div>
            <HeritageEditor configs={JSON.parse(JSON.stringify(configs))} />
        </div>
    );
}
