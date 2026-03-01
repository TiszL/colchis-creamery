import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Users, Shield, Package, FileText, TrendingUp, BarChart3, ToggleLeft, ToggleRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ROLE_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
    PRODUCT_MANAGER: { label: 'Product Manager', icon: Package, color: 'text-blue-400', bgColor: 'bg-blue-900/20' },
    CONTENT_MANAGER: { label: 'Content Manager', icon: FileText, color: 'text-purple-400', bgColor: 'bg-purple-900/20' },
    SALES: { label: 'Sales', icon: TrendingUp, color: 'text-cyan-400', bgColor: 'bg-cyan-900/20' },
    ANALYTICS_VIEWER: { label: 'Analytics Viewer', icon: BarChart3, color: 'text-orange-400', bgColor: 'bg-orange-900/20' },
};

async function toggleUserActive(formData: FormData) {
    'use server';
    const userId = formData.get('userId') as string;
    const currentStatus = formData.get('currentStatus') === 'true';

    await prisma.user.update({
        where: { id: userId },
        data: { isActive: !currentStatus },
    });

    revalidatePath('/admin/staff');
}

export default async function StaffManagementPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const staffUsers = await prisma.user.findMany({
        where: {
            role: { in: ['PRODUCT_MANAGER', 'CONTENT_MANAGER', 'SALES', 'ANALYTICS_VIEWER'] },
        },
        orderBy: { createdAt: 'desc' },
    });

    const staffByRole = Object.entries(ROLE_CONFIG).map(([role, config]) => ({
        role,
        ...config,
        members: staffUsers.filter((u: any) => u.role === role),
    }));

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Staff Management</h1>
                <p className="text-gray-500 font-light">View and manage all staff accounts. Enable or disable access instantly.</p>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {staffByRole.map((group) => (
                    <div key={group.role} className="bg-[#1A1A1A] p-6 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3 mb-4">
                            <group.icon className={`w-5 h-5 ${group.color}`} />
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{group.label}</span>
                        </div>
                        <h3 className="text-3xl font-serif text-white">{group.members.length}</h3>
                        <p className="text-gray-600 text-xs mt-1">{group.members.filter((m: any) => m.isActive).length} active</p>
                    </div>
                ))}
            </div>

            {/* Staff List */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                    <Users className="w-5 h-5 text-[#CBA153]" />
                    <h2 className="text-white font-bold">All Staff Members</h2>
                    <span className="text-xs text-gray-500 ml-auto">{staffUsers.length} total</span>
                </div>
                <div>
                    {staffUsers.length > 0 ? (
                        <ul className="divide-y divide-white/5">
                            {staffUsers.map((user: any) => {
                                const roleConfig = ROLE_CONFIG[user.role] || { label: user.role, color: 'text-gray-400', bgColor: 'bg-gray-900/20' };
                                return (
                                    <li key={user.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-[#CBA153]/10 border border-[#CBA153]/20 flex items-center justify-center">
                                                <span className="text-[#CBA153] text-sm font-bold">{(user.name || user.email).charAt(0).toUpperCase()}</span>
                                            </div>
                                            <div>
                                                <p className="text-white text-sm font-medium">{user.name || user.email}</p>
                                                <p className="text-gray-600 text-xs">{user.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${roleConfig.color} ${roleConfig.bgColor} px-3 py-1 rounded-full`}>
                                                {roleConfig.label}
                                            </span>
                                            <form action={toggleUserActive}>
                                                <input type="hidden" name="userId" value={user.id} />
                                                <input type="hidden" name="currentStatus" value={user.isActive.toString()} />
                                                <button type="submit" className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${user.isActive
                                                    ? 'bg-emerald-900/20 text-emerald-400 hover:bg-red-900/20 hover:text-red-400'
                                                    : 'bg-red-900/20 text-red-400 hover:bg-emerald-900/20 hover:text-emerald-400'
                                                    }`}>
                                                    {user.isActive ? <><ToggleRight className="w-4 h-4" /> Active</> : <><ToggleLeft className="w-4 h-4" /> Disabled</>}
                                                </button>
                                            </form>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="p-6 text-gray-500 text-sm text-center">No staff members registered yet. Generate access codes from the Access Codes page.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
