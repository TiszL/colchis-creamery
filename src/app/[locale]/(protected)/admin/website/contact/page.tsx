import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import ContactPageEditor from '@/components/admin/ContactPageEditor';

export const dynamic = 'force-dynamic';

function parseJSON<T>(v: string | undefined | null): T | null {
    if (!v) return null;
    try { return JSON.parse(v) as T; } catch { return null; }
}

export default async function AdminContactPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/portal-login`);

    const configs = await prisma.siteConfig.findMany({
        where: { key: { startsWith: 'contact.' } },
    });
    const m: Record<string, string> = {};
    for (const c of configs) m[c.key] = c.value;

    const initial = {
        hero: parseJSON<unknown>(m['contact.hero']),
        desks: parseJSON<unknown>(m['contact.desks']),
        hoursTable: parseJSON<unknown>(m['contact.hours_table']),
        faqLinks: parseJSON<unknown>(m['contact.faq_links']),
        map: parseJSON<unknown>(m['contact.map']),
        addressCard: parseJSON<unknown>(m['contact.address_card']),
        formIntro: parseJSON<unknown>(m['contact.form_intro']),
        faqCard: parseJSON<unknown>(m['contact.faq_card']),
        heroHoursLabel: m['contact.hero'] ? null : (m['contact.hours'] || null),
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href={`/${locale}/admin/website`} className="text-[10px] text-[#7A8278] hover:text-[#B96A3D] uppercase tracking-[0.28em] inline-flex items-center gap-1 mb-3">
                        <ChevronLeft className="w-3 h-3" /> Back to Website
                    </Link>
                    <h1 className="text-3xl text-[#F5F0E6]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontStyle: 'italic' }}>Contact Page</h1>
                    <p className="text-[#7A8278] text-sm mt-1" style={{ fontFamily: 'var(--font-sans)' }}>
                        Hero copy, desk cards, hours table, FAQ teaser, map section. The street address, phone, city/state and map link
                        come from the <Link href={`/${locale}/admin/locations`} className="text-[#B96A3D] underline">primary business location</Link> —
                        edit there to change them everywhere on the site at once.
                    </p>
                </div>
            </div>
            <ContactPageEditor initial={initial} />
        </div>
    );
}
