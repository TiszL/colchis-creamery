import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { Trash2, Globe } from 'lucide-react';
import { AnalyticsPinForm } from '@/components/admin/AnalyticsPinForm';

export const dynamic = 'force-dynamic';

async function addPin(formData: FormData) {
    'use server';
    const name = formData.get('name') as string;
    const latitude = parseFloat(formData.get('latitude') as string);
    const longitude = parseFloat(formData.get('longitude') as string);
    const pinType = formData.get('pinType') as string;
    const status = formData.get('status') as string;
    const contactInfo = formData.get('contactInfo') as string;
    const revenue = formData.get('revenue') as string;
    const notes = formData.get('notes') as string;

    if (!name || isNaN(latitude) || isNaN(longitude)) return;

    await prisma.analyticsPin.create({
        data: {
            name,
            latitude,
            longitude,
            pinType: pinType || 'PROSPECT',
            status: status || 'ACTIVE',
            contactInfo: contactInfo || null,
            revenue: revenue || null,
            notes: notes || null,
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

export default async function AnalyticsControlPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const pins = await prisma.analyticsPin.findMany({
        orderBy: { createdAt: 'desc' }
    });

    // We load the script with the API key
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Analytics Control</h1>
                <p className="text-gray-500 font-light">Manage coverage map pins and business intelligence data targets.</p>
            </div>

            {/* Smart Autocomplete Form Component */}
            <AnalyticsPinForm action={addPin} apiKey={googleMapsApiKey || ""} />

            {/* List of Pins */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-[#CBA153]" />
                        <h2 className="text-white font-bold">Existing Pins Database</h2>
                    </div>
                    <span className="text-xs text-[#CBA153] bg-[#CBA153]/10 px-3 py-1 rounded-full">{pins.length} total</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5 text-xs uppercase tracking-wider text-gray-500 font-bold">
                                <th className="p-4">Location Name</th>
                                <th className="p-4">Type & Status</th>
                                <th className="p-4">Coordinates</th>
                                <th className="p-4">Revenue / Contact</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {pins.length > 0 ? pins.map((pin: any) => (
                                <tr key={pin.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={"w-2 h-2 rounded-full " + (pin.pinType === 'PARTNER' ? 'bg-emerald-400' : pin.pinType === 'PROSPECT' ? 'bg-blue-400' : 'bg-[#CBA153]')}></div>
                                            <span className="text-white font-medium">{pin.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs text-gray-400">{pin.pinType}</span>
                                            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-white/5 w-fit text-gray-500">{pin.status}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                                        {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm text-white">{pin.revenue || '-'}</span>
                                            <span className="text-xs text-gray-500">{pin.contactInfo || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <form action={deletePin}>
                                            <input type="hidden" name="id" value={pin.id} />
                                            <button type="submit" className="text-gray-600 hover:text-red-400 transition-colors p-2 rounded hover:bg-red-400/10 opacity-0 group-hover:opacity-100">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </form>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500 text-sm">
                                        No map pins have been created yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
