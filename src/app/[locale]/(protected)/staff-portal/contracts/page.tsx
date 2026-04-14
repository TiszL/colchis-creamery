import { prisma as db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { FileSignature, CheckCircle, Clock } from 'lucide-react';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const ALLOWED = ['MASTER_ADMIN', 'SALES'];

async function generateContractAction(formData: FormData) {
    'use server';
    const partnerId = formData.get('partnerId') as string;
    const discount = formData.get('discount') as string;

    if (partnerId) {
        await db.contract.create({
            data: {
                partnerId,
                discountPercentage: discount || '0',
                status: 'SIGNED',
                validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            }
        });
        revalidatePath('/staff-portal/contracts');
        revalidatePath('/admin/contracts');
    }
}

export default async function StaffContractsPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || !ALLOWED.includes(session.role)) redirect(`/${locale}/staff`);

    const b2bPartners = await db.user.findMany({
        where: { role: 'B2B_PARTNER' },
        include: {
            contracts: { orderBy: { createdAt: 'desc' } }
        },
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2 flex items-center gap-3">
                    <FileSignature className="w-8 h-8 text-[#CBA153]" />
                    B2B Contracts
                </h1>
                <p className="text-gray-500 font-light">Manage active distributor contracts and discount tiers.</p>
            </div>

            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-white/5 text-gray-500 font-medium border-b border-white/5">
                        <tr>
                            <th className="px-6 py-4">Company</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Contract Status</th>
                            <th className="px-6 py-4 text-center">Discount</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {b2bPartners.map((partner: any) => {
                            const activeContract = partner.contracts[0];
                            return (
                                <tr key={partner.id} className="hover:bg-white/5 transition">
                                    <td className="px-6 py-4 font-medium text-white">{partner.companyName || 'N/A'}</td>
                                    <td className="px-6 py-4 text-gray-500">{partner.email}</td>
                                    <td className="px-6 py-4">
                                        {activeContract ? (
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                                                activeContract.status === 'SIGNED'
                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-amber-500/10 text-amber-400'
                                            }`}>
                                                {activeContract.status === 'SIGNED' ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                                {activeContract.status}
                                            </span>
                                        ) : (
                                            <span className="text-gray-600 italic">No Contract</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {activeContract ? (
                                            <span className="font-bold text-[#CBA153]">{activeContract.discountPercentage}% OFF</span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {!activeContract && (
                                            <form action={generateContractAction} className="flex flex-col gap-2 items-center">
                                                <input type="hidden" name="partnerId" value={partner.id} />
                                                <div className="flex items-center gap-2">
                                                    <input type="number" name="discount" defaultValue="15"
                                                        className="w-16 bg-[#0D0D0D] border border-white/10 text-white rounded px-2 py-1 text-xs text-right focus:border-[#CBA153]"
                                                        min="0" max="100" />
                                                    <span className="text-xs text-gray-500">%</span>
                                                </div>
                                                <button type="submit" className="text-xs bg-[#CBA153] text-black px-3 py-1.5 rounded font-bold hover:bg-white transition">
                                                    Issue Contract
                                                </button>
                                            </form>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {b2bPartners.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-600">
                                    No B2B partners registered yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
