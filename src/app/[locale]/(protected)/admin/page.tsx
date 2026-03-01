import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { Package, TrendingUp, Users, ShoppingCart, AlertCircle, KeyRound, FileText, Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
    const session = await getSession();

    const [
        totalOrders,
        paidOrders,
        b2bPartnerCount,
        pendingLeads,
        lowStockProducts,
        staffCount,
        accessCodesAvailable,
    ] = await Promise.all([
        prisma.order.count(),
        prisma.order.findMany({ where: { paymentStatus: 'PAID' } }),
        prisma.user.count({ where: { role: 'B2B_PARTNER' } }),
        prisma.b2bLead.count({ where: { status: 'NEW' } }),
        prisma.product.findMany({
            where: { stockQuantity: { lt: 20 }, isActive: true },
            orderBy: { stockQuantity: 'asc' },
            take: 8,
        }),
        prisma.user.count({
            where: { role: { in: ['PRODUCT_MANAGER', 'CONTENT_MANAGER', 'SALES'] } }
        }),
        prisma.accessCode.count({ where: { isUsed: false } }),
    ]);

    const totalRevenue = paidOrders.reduce((sum: number, order: any) => {
        const orderAmount = parseFloat(order.totalAmount.replace(/[^0-9.-]+/g, "")) || 0;
        return sum + orderAmount;
    }, 0);

    const kpis = [
        { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400' },
        { label: 'Total Orders', value: totalOrders.toString(), icon: ShoppingCart, color: 'text-blue-400' },
        { label: 'B2B Partners', value: b2bPartnerCount.toString(), icon: Users, color: 'text-[#CBA153]' },
        { label: 'Pending Leads', value: pendingLeads.toString(), icon: FileText, color: 'text-purple-400' },
        { label: 'Staff Members', value: staffCount.toString(), icon: Shield, color: 'text-cyan-400' },
        { label: 'Unused Codes', value: accessCodesAvailable.toString(), icon: KeyRound, color: 'text-orange-400' },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">
                    Command Center
                </h1>
                <p className="text-gray-500 font-light">
                    Welcome back, {session?.name || 'Admin'}. Full control over the Colchis Creamery platform.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-[#1A1A1A] p-6 rounded-xl border border-white/5 relative overflow-hidden group hover:border-[#CBA153]/20 transition-all">
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-current opacity-0 group-hover:opacity-5 blur-2xl transition-opacity ${kpi.color} -translate-y-1/2 translate-x-1/2 pointer-events-none`}></div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">{kpi.label}</span>
                            <kpi.icon className={`${kpi.color} w-5 h-5`} />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-3xl font-serif text-white">{kpi.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Low Stock Alert */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <h2 className="text-white font-bold">Low Stock Watchlist</h2>
                    <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full ml-auto">{lowStockProducts.length} items</span>
                </div>
                <div className="p-0">
                    {lowStockProducts.length > 0 ? (
                        <ul className="divide-y divide-white/5">
                            {lowStockProducts.map((product: any) => (
                                <li key={product.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#2C2A29]">
                                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <p className="text-white text-sm font-medium">{product.name}</p>
                                            <p className="text-gray-500 text-xs">SKU: {product.sku}</p>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-bold font-mono px-3 py-1 rounded-full ${product.stockQuantity < 5
                                            ? 'bg-red-900/30 text-red-400'
                                            : 'bg-yellow-900/30 text-yellow-400'
                                        }`}>
                                        {product.stockQuantity} units
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="p-6 text-gray-500 text-sm text-center">All products sufficiently stocked.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
