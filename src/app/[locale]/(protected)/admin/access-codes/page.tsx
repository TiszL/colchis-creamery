import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { KeyRound, Plus, Copy, CheckCircle, Clock, Users, Shield, BarChart3 } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Server Action: Generate Access Code
async function generateAccessCode(formData: FormData) {
    'use server';
    const type = formData.get('type') as string;
    const targetRole = formData.get('targetRole') as string;
    const email = formData.get('email') as string;

    const prefix = type === 'B2B' ? 'B2B' : type === 'STAFF' ? 'STAFF' : 'VIEW';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `COLCHIS-${prefix}-${random}`;

    await prisma.accessCode.create({
        data: {
            code,
            type,
            targetRole,
            email: email || null,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
    });

    revalidatePath('/admin/access-codes');
}

const ROLE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    B2B_PARTNER: { label: 'B2B Partner', icon: Users, color: 'text-emerald-400' },
    PRODUCT_MANAGER: { label: 'Product Manager', icon: Shield, color: 'text-blue-400' },
    CONTENT_MANAGER: { label: 'Content Manager', icon: Shield, color: 'text-purple-400' },
    SALES: { label: 'Sales', icon: Shield, color: 'text-cyan-400' },
    ANALYTICS_VIEWER: { label: 'Analytics Viewer', icon: BarChart3, color: 'text-orange-400' },
};

export default async function AccessCodesPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const codes = await prisma.accessCode.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    const unusedCodes = codes.filter((c: any) => !c.isUsed);
    const usedCodes = codes.filter((c: any) => c.isUsed);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Access Code Generator</h1>
                <p className="text-gray-500 font-light">Create invite codes for B2B partners, staff members, and analytics viewers.</p>
            </div>

            {/* Generator Form */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                    <Plus className="w-5 h-5 text-[#CBA153]" />
                    <h2 className="text-white font-bold">Generate New Code</h2>
                </div>
                <form action={generateAccessCode} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Code Type</label>
                            <select name="type" required className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]">
                                <option value="B2B">B2B Partner</option>
                                <option value="STAFF">Staff Member</option>
                                <option value="ANALYTICS_VIEWER">Analytics Viewer</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Target Role</label>
                            <select name="targetRole" required className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]">
                                <option value="B2B_PARTNER">B2B Partner</option>
                                <option value="PRODUCT_MANAGER">Product Manager</option>
                                <option value="CONTENT_MANAGER">Content Manager</option>
                                <option value="SALES">Sales</option>
                                <option value="ANALYTICS_VIEWER">Analytics Viewer</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Restrict to Email (Optional)</label>
                            <input
                                type="email" name="email" placeholder="optional@email.com"
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white placeholder-gray-600 py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]"
                            />
                        </div>
                    </div>
                    <button type="submit" className="bg-[#CBA153] text-black px-8 py-3 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-white transition-all">
                        Generate Code
                    </button>
                </form>
            </div>

            {/* Active Codes */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <KeyRound className="w-5 h-5 text-[#CBA153]" />
                        <h2 className="text-white font-bold">Active Codes</h2>
                    </div>
                    <span className="text-xs text-[#CBA153] bg-[#CBA153]/10 px-3 py-1 rounded-full">{unusedCodes.length} available</span>
                </div>
                <div>
                    {unusedCodes.length > 0 ? (
                        <ul className="divide-y divide-white/5">
                            {unusedCodes.map((code: any) => {
                                const roleInfo = ROLE_CONFIG[code.targetRole] || { label: code.targetRole, color: 'text-gray-400' };
                                return (
                                    <li key={code.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <Clock className="w-4 h-4 text-yellow-500" />
                                            <div>
                                                <p className="text-white font-mono text-sm tracking-wider">{code.code}</p>
                                                <p className="text-gray-600 text-xs mt-0.5">
                                                    {code.email ? `For: ${code.email}` : 'Open use'} • Expires: {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : 'Never'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-bold uppercase ${roleInfo.color} bg-white/5 px-3 py-1 rounded-full`}>
                                            {roleInfo.label}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="p-6 text-gray-500 text-sm text-center">No active codes. Generate one above.</p>
                    )}
                </div>
            </div>

            {/* Used Codes */}
            {usedCodes.length > 0 && (
                <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden opacity-60">
                    <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-gray-500" />
                        <h2 className="text-gray-400 font-bold">Used Codes ({usedCodes.length})</h2>
                    </div>
                    <ul className="divide-y divide-white/5">
                        {usedCodes.slice(0, 10).map((code: any) => (
                            <li key={code.id} className="px-6 py-3 flex items-center justify-between">
                                <span className="text-gray-500 font-mono text-sm line-through">{code.code}</span>
                                <span className="text-gray-600 text-xs">{code.targetRole}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
