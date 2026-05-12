import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import CreameryPageEditor from '@/components/admin/CreameryPageEditor';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function parseJSON(value: string | undefined | null) {
    if (!value) return null;
    try { return JSON.parse(value); } catch { return null; }
}

export default async function AdminCreameryPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/portal-login`);

    const configs = await prisma.siteConfig.findMany({
        where: { key: { startsWith: 'creamery.' } },
    });

    const configMap: Record<string, string> = {};
    for (const c of configs) configMap[c.key] = c.value;

    const initialData = {
        hero: parseJSON(configMap['creamery.hero']),
        method: parseJSON(configMap['creamery.method']),
        delivery: parseJSON(configMap['creamery.delivery']),
        subscription: parseJSON(configMap['creamery.subscription']),
    };

    return (
        <div className="space-y-8">
            <div>
                <Link href={`/${locale}/admin/website`} className="text-[10px] text-[#B96A3D] hover:text-[#F5F0E6] transition-colors flex items-center gap-1 mb-3" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>
                    <ArrowLeft className="w-3 h-3" /> Back to Website Content
                </Link>
                <span className="text-[9px] text-[#D9A876] block mb-2" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>
                    № 11 — Creamery
                </span>
                <h1 className="text-3xl text-[#F5F0E6]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontStyle: 'italic' }}>
                    Creamery Page Content
                </h1>
                <p className="text-[#7A8278] text-sm mt-1" style={{ fontFamily: 'var(--font-sans)' }}>
                    Edit all creamery/shop page sections. Changes go live immediately after saving.
                </p>
            </div>

            <CreameryPageEditor initialData={initialData} />
        </div>
    );
}
