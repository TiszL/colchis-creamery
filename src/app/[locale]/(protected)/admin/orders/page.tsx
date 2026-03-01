import { prisma as db } from '@/lib/db';
import { Truck, ExternalLink } from 'lucide-react';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

async function updateOrderStatus(formData: FormData) {
    'use server';
    const orderId = formData.get('orderId') as string;
    const orderStatus = formData.get('orderStatus') as string;
    const trackingNumber = formData.get('trackingNumber') as string;

    if (orderId && orderStatus) {
        await db.order.update({
            where: { id: orderId },
            data: { orderStatus }
        });

        // Upsert shipment if tracking is provided
        if (trackingNumber) {
            await db.shipment.upsert({
                where: { orderId },
                update: { trackingNumber, carrierName: 'FedEx' },
                create: { orderId, trackingNumber, carrierName: 'FedEx' }
            });
        }
        revalidatePath('/[locale]/admin/orders', 'page');
    }
}

export default async function AdminOrdersPage() {

    const orders = await db.order.findMany({
        include: {
            user: true,
            orderItems: {
                include: { product: true }
            },
            shipment: true
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-serif text-[#2C2A29] flex items-center gap-3">
                        <Truck className="w-8 h-8 text-[#CBA153]" />
                        Logistics & Fulfillment
                    </h1>
                    <p className="text-gray-500 mt-1">Manage physical shipments, update tracking, and confirm order deliveries for B2C & B2B.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-700">
                        <thead className="bg-[#FDFBF7] text-gray-500 font-medium border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">Order ID / Date</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Status & Payment</th>
                                <th className="px-6 py-4">Items (Preview)</th>
                                <th className="px-6 py-4">Fulfillment Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.map((order: any) => (
                                <tr key={order.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-mono text-xs text-gray-900 mb-1">{order.id.split('-').pop()}</div>
                                        <div className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{order.user.companyName || 'Retail Customer'}</div>
                                        <div className="text-xs text-gray-500">{order.user.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase rounded ${order.orderType === 'B2B' ? 'bg-[#2C2A29] text-white' : 'bg-gray-200 text-gray-700'
                                            }`}>
                                            {order.orderType}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-2">
                                            <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full ${order.orderStatus === 'PROCESSING' ? 'bg-amber-100 text-amber-800' :
                                                order.orderStatus === 'SHIPPED' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-green-100 text-green-800'
                                                }`}>
                                                {order.orderStatus}
                                            </span>
                                            <span className={`text-[10px] uppercase font-bold text-center ${order.paymentStatus === 'PAID' ? 'text-green-600' : 'text-red-500'
                                                }`}>
                                                {order.paymentStatus}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-500">
                                        {order.orderItems.length} items <br />
                                        Total: <span className="font-medium text-gray-900">{order.totalAmount}</span>
                                    </td>
                                    <td className="px-6 py-4 bg-gray-50 border-l border-gray-100">
                                        <form action={updateOrderStatus} className="flex flex-col gap-2">
                                            <input type="hidden" name="orderId" value={order.id} />
                                            <select
                                                name="orderStatus"
                                                defaultValue={order.orderStatus}
                                                className="w-full text-xs border border-gray-300 rounded py-1 px-2 focus:ring-[#CBA153]"
                                            >
                                                <option value="PROCESSING">Processing</option>
                                                <option value="SHIPPED">Shipped</option>
                                                <option value="DELIVERED">Delivered</option>
                                            </select>

                                            <input
                                                type="text"
                                                name="trackingNumber"
                                                placeholder={order.shipment?.trackingNumber || "Enter Tracking #"}
                                                className="w-full text-xs border border-gray-300 rounded py-1 px-2 focus:ring-[#CBA153]"
                                            />

                                            <button type="submit" className="w-full text-xs bg-gray-800 text-white py-1.5 rounded hover:bg-black transition">
                                                Update Order
                                            </button>
                                        </form>
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        No recent orders found.
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
