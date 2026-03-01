import { prisma as db } from '@/lib/db';
import { FileSignature, CheckCircle, Clock } from 'lucide-react';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

async function generateContractAction(formData: FormData) {
    'use server';
    const partnerId = formData.get('partnerId') as string;
    const discount = formData.get('discount') as string;

    if (partnerId) {
        // In a real flow, this would trigger Adobe Sign API.
        // For now, we stub it to immediately create a SIGNED contract.
        await db.contract.create({
            data: {
                partnerId,
                discountPercentage: discount || '0',
                status: 'SIGNED',
                validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
            }
        });
        revalidatePath('/[locale]/admin/contracts', 'page');
    }
}

export default async function AdminContractsPage() {

    // Fetch all B2B users and their contracts
    const b2bPartners = await db.user.findMany({
        where: { role: 'B2B_PARTNER' },
        include: {
            contracts: {
                orderBy: { createdAt: 'desc' }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Fetch incoming leads
    const leads = await db.b2bLead.findMany({
        where: { status: 'NEW' },
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div className="max-w-6xl mx-auto space-y-12">
            <div>
                <h1 className="text-3xl font-serif text-[#2C2A29] flex items-center gap-3">
                    <FileSignature className="w-8 h-8 text-[#CBA153]" />
                    B2B Contracts
                </h1>
                <p className="text-gray-500 mt-1">Review incoming partnership leads and manage active distributor contracts.</p>
            </div>

            {/* Leads Section */}
            <div>
                <h2 className="text-xl font-serif text-[#2C2A29] mb-4">Pending Applications</h2>
                {leads.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {leads.map((lead: any) => (
                            <div key={lead.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{lead.companyName}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{lead.email}</p>

                                    <div className="mt-4 p-4 bg-gray-50 rounded text-sm text-gray-700 font-mono">
                                        Vol: {lead.expectedVolume || 'Unspecified'}
                                        <br />
                                        <span className="text-gray-500 block mt-2 text-xs italic">"{lead.message}"</span>
                                    </div>
                                </div>
                                <div className="mt-6 flex gap-3">
                                    <button className="flex-1 bg-[#2C2A29] text-white py-2 rounded text-sm font-medium hover:bg-black transition">Review</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
                        No new applications at the moment.
                    </div>
                )}
            </div>

            {/* Active Partners Section */}
            <div>
                <h2 className="text-xl font-serif text-[#2C2A29] mb-4">Registered Partners</h2>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left text-sm text-gray-700">
                        <thead className="bg-[#FDFBF7] text-gray-500 font-medium border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">Company</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Contract Status</th>
                                <th className="px-6 py-4 text-center">Discount Tier</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {b2bPartners.map((partner: any) => {
                                const activeContract = partner.contracts[0];

                                return (
                                    <tr key={partner.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 font-medium text-gray-900">{partner.companyName || 'N/A'}</td>
                                        <td className="px-6 py-4 text-gray-500">{partner.email}</td>
                                        <td className="px-6 py-4">
                                            {activeContract ? (
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${activeContract.status === 'SIGNED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                    {activeContract.status === 'SIGNED' ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                                    {activeContract.status}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic">No Contract</span>
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
                                                        <input type="number" name="discount" defaultValue="15" className="w-16 border border-gray-300 rounded px-2 py-1 text-xs text-right" min="0" max="100" />
                                                        <span className="text-xs text-gray-500">%</span>
                                                    </div>
                                                    <button type="submit" className="text-xs bg-[#CBA153] text-white px-3 py-1 rounded hover:bg-[#b08d47] transition">
                                                        Issue Contract
                                                    </button>
                                                </form>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
