import { prisma as db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { Truck, FileSignature, CheckCircle, Package } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// B2B order totals are stored as unprefixed numeric strings; render with a "$".
function money(s: string | null | undefined): string {
    const n = Number(String(s ?? '').replace(/[^0-9.-]+/g, '')) || 0;
    return `$${n.toFixed(2)}`;
}

export default async function B2BPortalDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    // getSession enforces the live isActive/sessionVersion check (the layout does
    // too); a deactivated/demoted partner is evicted instead of riding the cookie.
    const session = await getSession();
    if (!session) redirect(`/${locale}/b2b/login`);

    // Active contract = SIGNED AND not expired (matches the order gate).
    const now = new Date();
    const user = await db.user.findUnique({
        where: { id: session.userId },
        include: {
            contracts: {
                where: { status: 'SIGNED', OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
                orderBy: { createdAt: 'desc' },
                take: 1
            },
            orders: {
                where: { orderType: 'B2B' },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { shipment: true }
            }
        }
    });

    const activeContract = user?.contracts[0];
    const recentOrders = user?.orders || [];

    // B2B billing summary for the AR widget.
    const partner = await db.b2bPartner.findUnique({ where: { userId: session.userId }, select: { id: true } });
    const openInvoices = partner ? await db.b2bInvoice.findMany({
        where: { partnerId: partner.id, status: { in: ['PENDING', 'OVERDUE'] } },
        select: { amountCents: true, dueAt: true },
    }) : [];
    const outstandingCents = openInvoices.reduce((s, i) => s + i.amountCents, 0);
    const overdueCents = openInvoices.filter(i => i.dueAt && i.dueAt < now).reduce((s, i) => s + i.amountCents, 0);

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif text-[#2C2A29]">Partner Dashboard</h1>
                    <p className="text-gray-500 mt-1">Welcome back, {user?.companyName}.</p>
                </div>
                <Link href={`/${locale}/b2b-portal/order`} className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-6 py-2.5 rounded-lg font-medium transition shadow-sm flex items-center justify-center gap-2 self-start sm:self-auto">
                    <Package className="w-4 h-4" />
                    New Bulk Order
                </Link>
            </div>

            {/* Billing summary — links to the full invoices page */}
            {partner && (outstandingCents > 0 || overdueCents > 0) && (
                <Link href={`/${locale}/b2b-portal/invoices`} className="block">
                    <div className={`rounded-xl p-5 border shadow-sm flex items-center justify-between gap-4 transition hover:border-[#CBA153]/50 ${overdueCents > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-[#E8E6E1]'}`}>
                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Outstanding balance</div>
                            <div className="text-2xl font-serif text-[#2C2A29] mt-0.5">${(outstandingCents / 100).toFixed(2)}</div>
                            {overdueCents > 0 && <div className="text-xs text-red-700 mt-1 font-medium">${(overdueCents / 100).toFixed(2)} past due</div>}
                        </div>
                        <span className="text-xs font-mono uppercase tracking-wider text-[#CBA153] whitespace-nowrap">View invoices →</span>
                    </div>
                </Link>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Contract Status Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-[#E8E6E1] col-span-1 lg:col-span-1 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-[#FDFBF7] rounded-lg text-[#CBA153]">
                            <FileSignature className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-serif text-[#2C2A29]">Contract Status</h2>
                    </div>

                    {activeContract ? (
                        <div className="flex-1 space-y-4">
                            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                                <span className="text-gray-500 text-sm">Status</span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <CheckCircle className="w-3.5 h-3.5" /> Active
                                </span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                                <span className="text-gray-500 text-sm">Discount Tier</span>
                                <span className="font-bold text-[#CBA153] text-lg">{activeContract.discountPercentage}% OFF</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-sm">Valid Until</span>
                                <span className="text-gray-900 font-medium">
                                    {activeContract.validUntil ? new Date(activeContract.validUntil).toLocaleDateString() : 'Indefinite'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-red-50 rounded-lg border border-red-100">
                            <p className="text-red-800 font-medium mb-2">No Active Contract</p>
                            <p className="text-sm text-red-600">Your account is pending review or contract signature. You cannot place orders yet.</p>
                        </div>
                    )}
                </div>

                {/* Recent Orders Overview */}
                <div className="bg-white rounded-xl shadow-sm border border-[#E8E6E1] col-span-1 lg:col-span-2">
                    <div className="p-6 border-b border-[#E8E6E1] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                <Truck className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-serif text-[#2C2A29]">Recent Shipments</h2>
                        </div>
                    </div>

                    <div className="p-0 overflow-x-auto">
                        {recentOrders.length > 0 ? (
                            <table className="w-full text-left text-sm text-gray-700 min-w-[560px]">
                                <thead className="bg-[#FDFBF7] text-gray-500 font-medium border-b border-[#E8E6E1]">
                                    <tr>
                                        <th className="px-6 py-3">Order Date</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Total Amount</th>
                                        <th className="px-6 py-3">Tracking</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {recentOrders.map((order: any) => (
                                        <tr key={order.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">{new Date(order.createdAt).toLocaleDateString()}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full ${order.orderStatus === 'PROCESSING' ? 'bg-amber-100 text-amber-800' :
                                                    order.orderStatus === 'SHIPPED' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-green-100 text-green-800'
                                                    }`}>
                                                    {order.orderStatus}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium">{money(order.totalAmount)}</td>
                                            <td className="px-6 py-4">
                                                {order.shipment?.trackingNumber ? (
                                                    <span className="font-mono text-xs text-[#2C2A29]">
                                                        {order.shipment.carrierName} {order.shipment.trackingNumber}
                                                    </span>
                                                ) : <span className="text-gray-400">Not assigned yet</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-12 text-center text-gray-500">
                                You haven't placed any bulk orders yet.
                            </div>
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
}
