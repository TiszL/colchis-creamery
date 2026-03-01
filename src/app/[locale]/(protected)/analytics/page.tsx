import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { MapPin, Users, TrendingUp, Globe, BarChart3, Eye, LogOut, Shield } from 'lucide-react';
import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';
import { AnalyticsView } from '@/components/admin/AnalyticsView';

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

    const [
        totalPins,
        partnerPins,
        prospectPins,
        convertedPins,
        pins,
    ] = await Promise.all([
        prisma.analyticsPin.count(),
        prisma.analyticsPin.count({ where: { pinType: 'PARTNER' } }),
        prisma.analyticsPin.count({ where: { pinType: 'PROSPECT' } }),
        prisma.analyticsPin.count({ where: { status: 'CONVERTED' } }),
        prisma.analyticsPin.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        }),
    ]);

    const conversionRate = totalPins > 0 ? ((convertedPins / totalPins) * 100).toFixed(1) : '0';

    return (
        <div className="min-h-screen bg-[#0A0A0A]">
            {/* Top Bar */}
            <div className="bg-[#111111] border-b border-[#CBA153]/10">
                <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#CBA153]/10 border border-[#CBA153]/30 flex items-center justify-center">
                            <Globe className="w-5 h-5 text-[#CBA153]" />
                        </div>
                        <div>
                            <h1 className="font-serif text-xl text-white">Business Intelligence</h1>
                            <span className="text-[10px] text-[#CBA153]/60 uppercase tracking-[0.3em] font-bold">
                                {isViewerOnly ? 'Viewer Mode' : 'Analytics Dashboard'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {session.role !== 'ANALYTICS_VIEWER' && (
                            <Link href={`/${locale}/admin`} className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-2">
                                <Shield className="w-4 h-4" /> Admin
                            </Link>
                        )}
                        <form action={logoutAction}>
                            <button type="submit" className="text-gray-600 hover:text-red-400 transition-colors p-2">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
                {/* KPI Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Targets', value: totalPins.toString(), icon: MapPin, color: 'text-[#CBA153]', glow: '#CBA153' },
                        { label: 'Active Partners', value: partnerPins.toString(), icon: Users, color: 'text-emerald-400', glow: '#34d399' },
                        { label: 'Prospects', value: prospectPins.toString(), icon: Eye, color: 'text-blue-400', glow: '#60a5fa' },
                        { label: 'Conversion Rate', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-purple-400', glow: '#a78bfa' },
                    ].map((kpi, i) => (
                        <div key={i} className="bg-[#111111] p-6 rounded-xl border border-white/5 relative overflow-hidden group hover:border-[#CBA153]/20 transition-all">
                            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity" style={{ backgroundColor: kpi.glow }}></div>
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">{kpi.label}</span>
                                <kpi.icon className={`${kpi.color} w-5 h-5`} />
                            </div>
                            <h3 className="text-3xl font-serif text-white relative z-10">{kpi.value}</h3>
                        </div>
                    ))}
                </div>

                {/* Map and Pin Listings */}
                <AnalyticsView
                    apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}
                    initialPins={pins}
                    canEdit={canEdit}
                    totalPins={totalPins}
                />

                {/* Viewer mode watermark */}
                {isViewerOnly && (
                    <div className="text-center py-4">
                        <span className="text-[10px] text-gray-700 uppercase tracking-[0.3em]">
                            Colchis Creamery &mdash; Business Intelligence &mdash; Confidential
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
