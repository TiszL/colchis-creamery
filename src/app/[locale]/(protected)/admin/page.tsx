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
            where: { stockQuantity: { lt: 20 }, status: { in: ['ACTIVE', 'COMING_SOON'] } },
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
        { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-[#4A7A5A]' },
        { label: 'Total Orders', value: totalOrders.toString(), icon: ShoppingCart, color: 'text-[#5A8A9A]' },
        { label: 'B2B Partners', value: b2bPartnerCount.toString(), icon: Users, color: 'text-[#B96A3D]' },
        { label: 'Pending Leads', value: pendingLeads.toString(), icon: FileText, color: 'text-[#8A6A9A]' },
        { label: 'Staff Members', value: staffCount.toString(), icon: Shield, color: 'text-[#5A8A9A]' },
        { label: 'Unused Codes', value: accessCodesAvailable.toString(), icon: KeyRound, color: 'text-[#D9A876]' },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <span className="text-[9px] text-[#D9A876] block mb-3" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>
                    № 00 — Dashboard
                </span>
                <h1 className="text-3xl text-[#F5F0E6] mb-2" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontStyle: 'italic' }}>
                    Command Center
                </h1>
                <p className="text-[#7A8278] text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                    Welcome back, {session?.name || 'Admin'}. Full control over the Colchis Food platform.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-[#161616] p-6 border border-[#B96A3D22] relative overflow-hidden group hover:border-[#B96A3D44] transition-all">
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <span className="text-[9px] text-[#7A8278]" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>{kpi.label}</span>
                            <kpi.icon className={`${kpi.color} w-5 h-5`} />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-3xl text-[#F5F0E6]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300 }}>{kpi.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Low Stock Alert */}
            <div className="bg-[#161616] border border-[#B96A3D22] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#B96A3D22] flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-[#A8312C]" />
                    <h2 className="text-[#F5F0E6]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500 }}>Low Stock Watchlist</h2>
                    <span className="text-[9px] bg-[#A8312C22] text-[#A8312C] px-2 py-0.5 ml-auto" style={{ fontFamily: 'var(--font-mono)' }}>{lowStockProducts.length} items</span>
                </div>
                <div className="p-0">
                    {lowStockProducts.length > 0 ? (
                        <ul className="divide-y divide-[#ffffff0A]">
                            {lowStockProducts.map((product: any) => (
                                <li key={product.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#1C1C1C] transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 overflow-hidden bg-[#1C1C1C]">
                                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <p className="text-[#F5F0E6] text-sm" style={{ fontFamily: 'var(--font-sans)' }}>{product.name}</p>
                                            <p className="text-[#5A6158] text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>SKU: {product.sku}</p>
                                        </div>
                                    </div>
                                    <span className={`text-sm px-3 py-1 ${product.stockQuantity < 5
                                            ? 'bg-[#A8312C22] text-[#A8312C]'
                                            : 'bg-[#D9A87622] text-[#D9A876]'
                                        }`} style={{ fontFamily: 'var(--font-mono)' }}>
                                        {product.stockQuantity} units
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="p-6 text-[#7A8278] text-sm text-center" style={{ fontFamily: 'var(--font-sans)' }}>All products sufficiently stocked.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
