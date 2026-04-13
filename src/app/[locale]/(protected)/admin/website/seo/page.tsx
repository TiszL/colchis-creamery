import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import SeoEditor from '@/components/admin/SeoEditor';

export const dynamic = 'force-dynamic';

export default async function AdminSeoPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const configs = await prisma.siteConfig.findMany({
        where: { key: { startsWith: 'seo.' } },
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">SEO & Social Sharing</h1>
                <p className="text-gray-500 font-light">Control how your pages appear in Google search results, Facebook, Twitter, and other platforms.</p>
            </div>
            <SeoEditor configs={JSON.parse(JSON.stringify(configs))} />
        </div>
    );
}
