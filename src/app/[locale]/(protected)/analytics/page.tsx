import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Globe, LogOut, Shield } from 'lucide-react';
import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';
import { AnalyticsDashboard, type DashboardStats } from '@/components/admin/AnalyticsDashboard';

export const dynamic = 'force-dynamic';

const ANALYTICS_ROLES = ['MASTER_ADMIN', 'SALES', 'ANALYTICS_VIEWER'];

export default async function AnalyticsDashboardPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();

    if (!session || !ANALYTICS_ROLES.includes(session.role)) {
        redirect(`/${locale}/staff`);
    }

    const isViewerOnly = session.role === 'ANALYTICS_VIEWER';
    const canEdit = ['MASTER_ADMIN', 'SALES'].includes(session.role);

    // Fetch ALL pins (no limit)
    const pins = await prisma.analyticsPin.findMany({
        orderBy: { priorityScore: 'desc' },
    });

    // Compute aggregated stats
    const totalPins = pins.length;

    let totalTAMLow = 0;
    let totalTAMHigh = 0;
    let totalPriorityScore = 0;
    let scoredCount = 0;
    let criticalCount = 0;
    let highCount = 0;

    const byTier: Record<string, { count: number; revLow: number; revHigh: number }> = {};
    const byPriority: Record<string, number> = {};
    const byState: Record<string, { count: number; revLow: number; revHigh: number }> = {};
    const byCategory: Record<string, { label: string; tier: number; count: number; revLow: number; revHigh: number }> = {};
    const stateSet = new Set<string>();

    for (const pin of pins) {
        const mLow = pin.revenueMonthlyLow || 0;
        const mHigh = pin.revenueMonthlyHigh || 0;
        totalTAMLow += mLow;
        totalTAMHigh += mHigh;

        if (pin.priorityScore != null) {
            totalPriorityScore += pin.priorityScore;
            scoredCount++;
        }

        if (pin.priorityRank === 'CRITICAL') criticalCount++;
        if (pin.priorityRank === 'HIGH') highCount++;

        // By tier
        const tl = pin.tierLabel || 'UNKNOWN';
        if (!byTier[tl]) byTier[tl] = { count: 0, revLow: 0, revHigh: 0 };
        byTier[tl].count++;
        byTier[tl].revLow += mLow;
        byTier[tl].revHigh += mHigh;

        // By priority
        const pr = pin.priorityRank || 'UNKNOWN';
        byPriority[pr] = (byPriority[pr] || 0) + 1;

        // By state
        const st = pin.state || 'UNKNOWN';
        stateSet.add(st);
        if (!byState[st]) byState[st] = { count: 0, revLow: 0, revHigh: 0 };
        byState[st].count++;
        byState[st].revLow += mLow;
        byState[st].revHigh += mHigh;

        // By category
        const cat = pin.category || 'UNKNOWN';
        if (!byCategory[cat]) byCategory[cat] = { label: pin.categoryLabel || cat, tier: pin.tier || 0, count: 0, revLow: 0, revHigh: 0 };
        byCategory[cat].count++;
        byCategory[cat].revLow += mLow;
        byCategory[cat].revHigh += mHigh;
    }

    const stats: DashboardStats = {
        totalPins,
        totalTAMLow,
        totalTAMHigh,
        byTier,
        byPriority,
        byState,
        byCategory,
        avgPriorityScore: scoredCount > 0 ? totalPriorityScore / scoredCount : 0,
        stateCount: stateSet.size,
        criticalCount,
        highCount,
    };

    // Serialize pins for client components
    const serializedPins = pins.map(pin => ({
        id: pin.id,
        name: pin.name,
        latitude: pin.latitude,
        longitude: pin.longitude,
        pinType: pin.pinType,
        status: pin.status,
        notes: pin.notes,
        contactInfo: pin.contactInfo,
        revenue: pin.revenue,
        prospectId: pin.prospectId,
        brandName: pin.brandName,
        category: pin.category,
        categoryLabel: pin.categoryLabel,
        tier: pin.tier,
        tierLabel: pin.tierLabel,
        priorityScore: pin.priorityScore,
        priorityRank: pin.priorityRank,
        phone: pin.phone,
        website: pin.website,
        address: pin.address,
        city: pin.city,
        state: pin.state,
        googleRating: pin.googleRating,
        revenueMonthlyLow: pin.revenueMonthlyLow,
        revenueMonthlyHigh: pin.revenueMonthlyHigh,
        cheeseLbsLow: pin.cheeseLbsLow,
        cheeseLbsHigh: pin.cheeseLbsHigh,
        distanceMiles: pin.distanceMiles,
        driveHours: pin.driveHours,
    }));

    return (
        <div className="min-h-screen bg-[#0e110e]">
            {/* Top Bar */}
            <div className="bg-[#141414] border-b border-[#2A2A2A]">
                <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#2C2A29] border border-[#3d7a47]/30 flex items-center justify-center">
                            <Globe className="w-5 h-5 text-[#CBA153]" />
                        </div>
                        <div>
                            <h1 className="font-serif text-xl text-[#F0EDE6]">Prospect Intelligence</h1>
                            <span className="text-[10px] text-[#c9a84c]/60 uppercase tracking-[0.3em] font-bold">
                                {isViewerOnly ? 'Viewer Mode' : 'Business Intelligence Dashboard'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-4 text-[11px] text-[#888888]">
                            <span>Updated <strong className="text-[#c9a84c]">Mar 2026</strong></span>
                        </div>
                        {session.role !== 'ANALYTICS_VIEWER' && (
                            <Link href={`/${locale}/admin`} className="text-sm text-[#666666] hover:text-[#F0EDE6] transition-colors flex items-center gap-2">
                                <Shield className="w-4 h-4" /> Admin
                            </Link>
                        )}
                        <form action={logoutAction}>
                            <button type="submit" className="text-[#666666] hover:text-red-400 transition-colors p-2">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-6 py-6">
                <AnalyticsDashboard
                    pins={serializedPins}
                    stats={stats}
                    apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}
                    canEdit={canEdit}
                />

                {/* Viewer mode watermark */}
                {isViewerOnly && (
                    <div className="text-center py-4 mt-8">
                        <span className="text-[10px] text-[#666666] uppercase tracking-[0.3em]">
                            Colchis Creamery &mdash; Prospect Intelligence &mdash; Confidential
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
