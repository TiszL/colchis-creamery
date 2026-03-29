import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { Trash2, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnalyticsPinForm } from '@/components/admin/AnalyticsPinForm';

export const dynamic = 'force-dynamic';

const PRIORITY_COLORS: Record<string, string> = {
    CRITICAL: 'bg-[#e8614a]/15 text-[#e8614a]',
    HIGH: 'bg-[#c9a84c]/15 text-[#c9a84c]',
    MEDIUM: 'bg-[#4d9a5a]/15 text-[#4d9a5a]',
    LOW: 'bg-[#4a7a9a]/15 text-[#4a7a9a]',
    EXPLORATORY: 'bg-[#7a6a8a]/15 text-[#7a6a8a]',
};

async function addPin(formData: FormData) {
    'use server';
    const name = formData.get('name') as string;
    const latitude = parseFloat(formData.get('latitude') as string);
    const longitude = parseFloat(formData.get('longitude') as string);
    const pinType = formData.get('pinType') as string;
    const status = formData.get('status') as string;
    const contactInfo = formData.get('contactInfo') as string;
    const notes = formData.get('notes') as string;
    // New fields
    const category = formData.get('category') as string;
    const categoryLabel = formData.get('categoryLabel') as string;
    const tierStr = formData.get('tier') as string;
    const tierLabel = formData.get('tierLabel') as string;
    const priorityRank = formData.get('priorityRank') as string;
    const phone = formData.get('phone') as string;
    const website = formData.get('website') as string;
    const address = formData.get('address') as string;
    const city = formData.get('city') as string;
    const state = formData.get('state') as string;
    const googleRatingStr = formData.get('googleRating') as string;
    const revLowStr = formData.get('revenueMonthlyLow') as string;
    const revHighStr = formData.get('revenueMonthlyHigh') as string;

    if (!name || isNaN(latitude) || isNaN(longitude)) return;

    const tier = tierStr ? parseInt(tierStr) : null;
    const googleRating = googleRatingStr ? parseFloat(googleRatingStr) : null;
    const revenueMonthlyLow = revLowStr ? parseInt(revLowStr) : null;
    const revenueMonthlyHigh = revHighStr ? parseInt(revHighStr) : null;

    await prisma.analyticsPin.create({
        data: {
            name,
            latitude,
            longitude,
            pinType: pinType || 'PROSPECT',
            status: status || 'ACTIVE',
            contactInfo: contactInfo || null,
            revenue: revenueMonthlyHigh ? `$${revenueMonthlyHigh}/mo` : null,
            notes: notes || null,
            category: category || null,
            categoryLabel: categoryLabel || null,
            tier: tier,
            tierLabel: tierLabel || null,
            priorityRank: priorityRank || null,
            phone: phone || null,
            website: website || null,
            address: address || null,
            city: city || null,
            state: state || null,
            googleRating: googleRating,
            revenueMonthlyLow: revenueMonthlyLow,
            revenueMonthlyHigh: revenueMonthlyHigh,
        }
    });

    revalidatePath('/admin/analytics-control');
    revalidatePath('/analytics');
}

async function deletePin(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    if (!id) return;

    await prisma.analyticsPin.delete({
        where: { id }
    });

    revalidatePath('/admin/analytics-control');
    revalidatePath('/analytics');
}

export default async function AnalyticsControlPage({ params, searchParams }: { params: any; searchParams: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const resolvedSearchParams = await searchParams;
    const currentPage = parseInt(resolvedSearchParams?.page as string) || 1;
    const perPage = 25;
    const skip = (currentPage - 1) * perPage;

    const [pins, totalCount] = await Promise.all([
        prisma.analyticsPin.findMany({
            orderBy: { createdAt: 'desc' },
            skip,
            take: perPage,
        }),
        prisma.analyticsPin.count(),
    ]);

    const totalPages = Math.ceil(totalCount / perPage);
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Analytics Control</h1>
                <p className="text-gray-500 font-light">Manage prospect intelligence database and coverage map pins.</p>
            </div>

            <AnalyticsPinForm action={addPin} apiKey={googleMapsApiKey || ""} />

            {/* Prospect Database Table */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-[#CBA153]" />
                        <h2 className="text-white font-bold">Prospect Database</h2>
                    </div>
                    <span className="text-xs text-[#CBA153] bg-[#CBA153]/10 px-3 py-1 rounded-full">{totalCount} total</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                                <th className="p-3 pl-5">Location Name</th>
                                <th className="p-3">Category</th>
                                <th className="p-3">Tier</th>
                                <th className="p-3">Priority</th>
                                <th className="p-3">City / State</th>
                                <th className="p-3">Revenue</th>
                                <th className="p-3">Rating</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {pins.length > 0 ? pins.map((pin: any) => {
                                const prCls = PRIORITY_COLORS[pin.priorityRank || ''] || '';
                                return (
                                    <tr key={pin.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-3 pl-5">
                                            <span className="text-white font-medium text-sm">{pin.name}</span>
                                        </td>
                                        <td className="p-3 text-xs text-gray-500">{pin.categoryLabel || '—'}</td>
                                        <td className="p-3">
                                            {pin.tierLabel ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 font-medium">T{pin.tier} {pin.tierLabel}</span>
                                            ) : '—'}
                                        </td>
                                        <td className="p-3">
                                            {pin.priorityRank ? (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${prCls}`}>{pin.priorityRank}</span>
                                            ) : '—'}
                                        </td>
                                        <td className="p-3 text-xs text-gray-500 whitespace-nowrap">{pin.city && pin.state ? `${pin.city}, ${pin.state}` : '—'}</td>
                                        <td className="p-3 text-xs text-gray-400">
                                            {pin.revenueMonthlyHigh ? `$${pin.revenueMonthlyHigh.toLocaleString()}/mo` : pin.revenue || '—'}
                                        </td>
                                        <td className="p-3 text-xs text-gray-500">{pin.googleRating ? `⭐ ${pin.googleRating}` : '—'}</td>
                                        <td className="p-3 text-right">
                                            <form action={deletePin}>
                                                <input type="hidden" name="id" value={pin.id} />
                                                <button type="submit" className="text-gray-600 hover:text-red-400 transition-colors p-2 rounded hover:bg-red-400/10 opacity-0 group-hover:opacity-100">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-gray-500 text-sm">
                                        No prospects in the database yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 text-xs text-gray-500">
                        <span>Page {currentPage} of {totalPages} ({totalCount} records)</span>
                        <div className="flex gap-2">
                            {currentPage > 1 && (
                                <a href={`?page=${currentPage - 1}`} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                                    <ChevronLeft className="w-3 h-3" /> Prev
                                </a>
                            )}
                            {currentPage < totalPages && (
                                <a href={`?page=${currentPage + 1}`} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                                    Next <ChevronRight className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
