import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { MapPin, Plus, Trash2, Globe, TrendingUp, Users } from 'lucide-react';

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

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Analytics Control</h1>
                <p className="text-gray-500 font-light">Manage coverage map pins and business intelligence data targets.</p>
            </div>

            {/* Add Pin Form */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                    <Plus className="w-5 h-5 text-[#CBA153]" />
                    <h2 className="text-white font-bold">Add New Target Pin</h2>
                </div>
                <form action={addPin} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Location Name</label>
                                <input type="text" name="name" required placeholder="e.g. Artisan Cheese Shop" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Latitude</label>
                                    <input type="number" step="any" name="latitude" required placeholder="41.7151" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Longitude</label>
                                    <input type="number" step="any" name="longitude" required placeholder="44.8271" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Pin Type</label>
                                    <select name="pinType" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]">
                                        <option value="PROSPECT">Prospect</option>
                                        <option value="PARTNER">Partner</option>
                                        <option value="SUPPLIER">Supplier</option>
                                        <option value="ZONE">Zone</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Status</label>
                                    <select name="status" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]">
                                        <option value="ACTIVE">Active</option>
                                        <option value="INACTIVE">Inactive</option>
                                        <option value="CONVERTED">Converted</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Contact Info</label>
                                <input type="text" name="contactInfo" placeholder="Email or Phone" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Expected Revenue</label>
                                <input type="text" name="revenue" placeholder="e.g. $5,000/mo" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Internal Notes</label>
                                <textarea name="notes" placeholder="Meeting details, next steps..." rows={3} className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-none"></textarea>
                            </div>
                        </div>
                    </div>
                    <div className="pt-2">
                        <button type="submit" className="bg-[#CBA153] text-black px-8 py-3 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-white transition-all">
                            Save Map Pin
                        </button>
                    </div>
                </form>
            </div>

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
                            {pins.length > 0 ? pins.map((pin) => (
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
