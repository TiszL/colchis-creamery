import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { User, MapPin, Package, LogOut, ShoppingCart, Lock } from 'lucide-react';
import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';
import { AccountProfileForm } from '@/components/account/AccountProfileForm';
import { AccountAddressForm } from '@/components/account/AccountAddressForm';
import { AccountPasswordForm } from '@/components/account/AccountPasswordForm';

export const dynamic = 'force-dynamic';

export default async function CustomerAccountPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();

    if (!session || session.role !== 'B2C_CUSTOMER') {
        redirect(`/${locale}/login`);
    }

    const [user, profile, recentOrders] = await Promise.all([
        prisma.user.findUnique({ where: { id: session.userId } }),
        prisma.userProfile.findUnique({ where: { userId: session.userId } }),
        prisma.order.findMany({
            where: { userId: session.userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { orderItems: { include: { product: true } } },
        }),
    ]);

    if (!user) redirect(`/${locale}/login`);

    return (
        <div className="min-h-screen bg-[#FDFBF7]">
            {/* Header Bar */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/${locale}`}>
                            <img src="/logo-optimized.png" alt="Colchis Creamery" className="w-10 h-10 rounded-full border border-[#CBA153]/30 object-cover" />
                        </Link>
                        <div>
                            <h1 className="font-serif text-xl text-[#2C2A29]">My Account</h1>
                            <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href={`/${locale}/shop`} className="text-sm text-[#A6812F] hover:text-[#2C2A29] transition-colors flex items-center gap-1">
                            <ShoppingCart className="w-4 h-4" /> Shop
                        </Link>
                        <form action={logoutAction}>
                            <button type="submit" className="text-gray-400 hover:text-red-500 transition-colors p-2">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
                {/* Profile Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-[#A6812F]" />
                            <h2 className="font-bold text-[#2C2A29]">Profile Information</h2>
                        </div>
                        <span className="text-xs text-gray-400">Member since {new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                    <AccountProfileForm
                        userId={user.id}
                        initialName={user.name || ""}
                        initialPhone={user.phone || ""}
                    />
                </div>

                {/* Shipping Address */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-[#A6812F]" />
                        <h2 className="font-bold text-[#2C2A29]">Shipping Address</h2>
                    </div>
                    <AccountAddressForm
                        userId={user.id}
                        initialAddress={profile?.shippingAddress || ""}
                        initialCity={profile?.shippingCity || ""}
                        initialState={profile?.shippingState || ""}
                        initialZip={profile?.shippingZip || ""}
                        initialCountry={profile?.shippingCountry || "US"}
                    />
                </div>

                {/* Password */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                        <Lock className="w-5 h-5 text-[#A6812F]" />
                        <h2 className="font-bold text-[#2C2A29]">Password</h2>
                    </div>
                    <AccountPasswordForm userId={user.id} />
                </div>

                {/* Recent Orders */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Package className="w-5 h-5 text-[#A6812F]" />
                            <h2 className="font-bold text-[#2C2A29]">Recent Orders</h2>
                        </div>
                        <span className="text-xs text-gray-400">{recentOrders.length} orders</span>
                    </div>
                    <div>
                        {recentOrders.length > 0 ? (
                            <ul className="divide-y divide-gray-100">
                                {recentOrders.map((order: any) => (
                                    <li key={order.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <div>
                                            <p className="text-sm font-medium text-[#2C2A29]">
                                                {order.orderItems.map((item: any) => item.product.name).join(', ')}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${order.orderStatus === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                                                order.orderStatus === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {order.orderStatus}
                                            </span>
                                            <span className="font-bold text-[#2C2A29]">{order.totalAmount}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="p-6 text-gray-400 text-sm text-center italic">No orders yet. Start shopping!</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
