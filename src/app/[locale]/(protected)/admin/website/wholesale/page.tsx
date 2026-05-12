import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import WholesalePageEditor from '@/components/admin/WholesalePageEditor';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminWholesalePage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/portal-login`);

    const configs = await prisma.siteConfig.findMany();

    return (
        <div className="space-y-8">
            <div>
                <Link href={`/${locale}/admin/website`} className="text-[10px] text-[#B96A3D] hover:text-[#F5F0E6] transition-colors flex items-center gap-1 mb-3" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>
                    <ArrowLeft className="w-3 h-3" /> Back to Website Content
                </Link>
                <span className="text-[9px] text-[#D9A876] block mb-2" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>
                    № 13 — Wholesale
                </span>
                <h1 className="text-3xl text-[#F5F0E6]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontStyle: 'italic' }}>
                    Wholesale Page Content
                </h1>
                <p className="text-[#7A8278] text-sm mt-1" style={{ fontFamily: 'var(--font-sans)' }}>
                    Edit the B2B wholesale landing page content.
                </p>
            </div>

            <WholesalePageEditor configs={JSON.parse(JSON.stringify(configs))} />
        </div>
    );
}
