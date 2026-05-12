import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import HomepageEditor from '@/components/admin/HomepageEditor';
import HeroMediaEditor from '@/components/admin/HeroMediaEditor';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function parseJSON(value: string | undefined | null) {
    if (!value) return null;
    try { return JSON.parse(value); } catch { return null; }
}

export default async function AdminHomepagePage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/portal-login`);

    // Load BOTH the new home.* JSON content blocks (HomepageEditor) AND the
    // legacy hero.* media keys (HeroMediaEditor — drives the carousel images,
    // video, overlay/gradient, transition settings on the public hero).
    // Both editors target the same SiteConfig table but different key prefixes,
    // so they save independently without conflict.
    const [homeConfigs, heroMediaConfigs] = await Promise.all([
        prisma.siteConfig.findMany({ where: { key: { startsWith: 'home.' } } }),
        prisma.siteConfig.findMany({ where: { key: { startsWith: 'hero.' } } }),
    ]);

    const configMap: Record<string, string> = {};
    for (const c of homeConfigs) configMap[c.key] = c.value;

    const initialData = {
        hero: parseJSON(configMap['home.hero']),
        story: parseJSON(configMap['home.story']),
        threeHouses: parseJSON(configMap['home.three_houses']),
        process: parseJSON(configMap['home.process']),
        press: parseJSON(configMap['home.press']),
        visit: parseJSON(configMap['home.visit']),
        ticker: parseJSON(configMap['home.ticker']),
    };

    return (
        <div className="space-y-8">
            <div>
                <Link href={`/${locale}/admin/website`} className="text-[10px] text-[#B96A3D] hover:text-[#F5F0E6] transition-colors flex items-center gap-1 mb-3" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>
                    <ArrowLeft className="w-3 h-3" /> Back to Website Content
                </Link>
                <span className="text-[9px] text-[#D9A876] block mb-2" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>
                    № 10 — Homepage
                </span>
                <h1 className="text-3xl text-[#F5F0E6]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontStyle: 'italic' }}>
                    Homepage Content
                </h1>
                <p className="text-[#7A8278] text-sm mt-1" style={{ fontFamily: 'var(--font-sans)' }}>
                    Edit all homepage sections. Changes go live immediately after saving.
                </p>
            </div>

            {/* Hero media (carousel images, video, overlay/gradient, transition).
                Lives in its own editor because the media data uses individual
                SiteConfig hero.* keys (rather than a single home.hero JSON blob)
                — Vercel Blob URLs are stored per-image so they need separate
                save endpoints. Restored here in Phase 7c after the
                HomepageEditor migration accidentally orphaned it. */}
            <HeroMediaEditor configs={heroMediaConfigs} />

            <HomepageEditor initialData={initialData} />
        </div>
    );
}
