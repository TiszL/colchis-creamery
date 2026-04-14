import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ALLOWED = ['MASTER_ADMIN', 'PRODUCT_MANAGER', 'SALES'];

async function updateOrderStatus(formData: FormData) {
    'use server';
    const orderId = formData.get('orderId') as string;
    const orderStatus = formData.get('orderStatus') as string;
    const trackingNumber = formData.get('trackingNumber') as string;

    if (orderId && orderStatus) {
        await prisma.order.update({
            where: { id: orderId },
            data: { orderStatus }
        });

        if (trackingNumber) {
            await prisma.shipment.upsert({
                where: { orderId },
                update: { trackingNumber, carrierName: 'FedEx' },
                create: { orderId, trackingNumber, carrierName: 'FedEx' }
            });
        }
        revalidatePath('/staff-portal/orders');
        revalidatePath('/admin/orders');
    }
}

export default async function StaffOrdersPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || !ALLOWED.includes(session.role)) redirect(`/${locale}/staff`);

    const isSalesOnly = session.role === 'SALES';

    const orders = await prisma.order.findMany({
        include: {
            user: true,
            orderItems: { include: { product: true } },
            shipment: true
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2 flex items-center gap-3">
                    <Truck className="w-8 h-8 text-[#CBA153]" />
                    Orders & Fulfillment
                </h1>
                <p className="text-gray-500 font-light">
                    {isSalesOnly ? 'View order status and tracking.' : 'Manage orders, update tracking, and confirm deliveries.'}
                </p>
            </div>

            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
                        <thead className="bg-white/5 text-gray-500 font-medium border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4">Order ID / Date</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Status & Payment</th>
                                <th className="px-6 py-4">Items</th>
                                {!isSalesOnly && <th className="px-6 py-4">Fulfillment</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {orders.map((order: any) => (
                                <tr key={order.id} className="hover:bg-white/5 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-mono text-xs text-white mb-1">{order.id.split('-').pop()}</div>
                                        <div className="text-xs text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-white">{order.user.companyName || order.user.name || 'Customer'}</div>
                                        <div className="text-xs text-gray-600">{order.user.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase rounded ${order.orderType === 'B2B' ? 'bg-[#CBA153]/10 text-[#CBA153]' : 'bg-white/10 text-gray-300'}`}>
                                            {order.orderType}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-2">
                                            <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full ${
                                                order.orderStatus === 'PROCESSING' ? 'bg-amber-500/10 text-amber-400' :
                                                order.orderStatus === 'SHIPPED' ? 'bg-blue-500/10 text-blue-400' :
                                                'bg-green-500/10 text-green-400'
                                            }`}>
                                                {order.orderStatus}
                                            </span>
                                            <span className={`text-[10px] uppercase font-bold text-center ${order.paymentStatus === 'PAID' ? 'text-green-400' : 'text-red-400'}`}>
                                                {order.paymentStatus}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        {order.orderItems.length} items<br />
                                        Total: <span className="font-medium text-white">{order.totalAmount}</span>
                                    </td>
                                    {!isSalesOnly && (
                                        <td className="px-6 py-4 border-l border-white/5">
                                            <form action={updateOrderStatus} className="flex flex-col gap-2">
                                                <input type="hidden" name="orderId" value={order.id} />
                                                <select
                                                    name="orderStatus"
                                                    defaultValue={order.orderStatus}
                                                    className="w-full text-xs bg-[#0D0D0D] border border-white/10 text-white rounded py-1 px-2 focus:border-[#CBA153]"
                                                >
                                                    <option value="PROCESSING">Processing</option>
                                                    <option value="SHIPPED">Shipped</option>
                                                    <option value="DELIVERED">Delivered</option>
                                                </select>
                                                <input
                                                    type="text" name="trackingNumber"
                                                    placeholder={order.shipment?.trackingNumber || "Tracking #"}
                                                    className="w-full text-xs bg-[#0D0D0D] border border-white/10 text-white placeholder-gray-600 rounded py-1 px-2 focus:border-[#CBA153]"
                                                />
                                                <button type="submit" className="w-full text-xs bg-[#CBA153] text-black py-1.5 rounded font-bold hover:bg-white transition">
                                                    Update
                                                </button>
                                            </form>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-600">
                                        No orders found.
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
