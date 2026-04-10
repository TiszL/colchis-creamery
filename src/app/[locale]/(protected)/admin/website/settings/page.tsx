import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import SiteSettingsClient from '@/components/admin/SiteSettingsClient';

export default async function AdminGlobalSettingsPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    
    if (!session || session.role !== 'MASTER_ADMIN') {
        redirect(`/${locale}/staff`);
    }

    const configs = await prisma.siteConfig.findMany();
    const initialSettings = configs.reduce((acc: any, c: any) => {
        acc[c.key] = c.value;
        return acc;
    }, {});

    return <SiteSettingsClient locale={locale} initialSettings={initialSettings} />;
}
