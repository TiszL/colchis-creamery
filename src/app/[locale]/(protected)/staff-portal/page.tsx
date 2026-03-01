import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { Package, TrendingUp, Users, ShoppingCart, FileText, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ROLE_GREETINGS: Record<string, string> = {
    MASTER_ADMIN: 'Full access across all systems.',
    PRODUCT_MANAGER: 'Manage products, inventory, and pricing.',
    CONTENT_MANAGER: 'Create and publish articles, recipes, and content.',
    SALES: 'Track leads, manage contracts, and close deals.',
};

export default async function StaffPortalDashboard() {
    const session = await getSession();

    const [totalProducts, totalOrders, b2bLeads, lowStockCount, articlesCount] = await Promise.all([
        prisma.product.count({ where: { isActive: true } }),
        prisma.order.count(),
        prisma.b2bLead.count({ where: { status: 'NEW' } }),
        prisma.product.count({ where: { stockQuantity: { lt: 20 }, isActive: true } }),
        prisma.article.count(),
    ]);

    const stats = [
        { label: 'Active Products', value: totalProducts.toString(), icon: Package, color: 'text-[#CBA153]' },
        { label: 'Total Orders', value: totalOrders.toString(), icon: ShoppingCart, color: 'text-blue-400' },
        { label: 'New B2B Leads', value: b2bLeads.toString(), icon: Users, color: 'text-emerald-400' },
        { label: 'Low Stock Items', value: lowStockCount.toString(), icon: AlertCircle, color: lowStockCount > 0 ? 'text-red-400' : 'text-gray-500' },
    ];

    return (
        <div className="space-y-8">
            {/* Welcome */}
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">
                    Welcome back, {session?.name || 'Team Member'}
                </h1>
                <p className="text-gray-500 font-light">
                    {ROLE_GREETINGS[session?.role || ''] || 'Welcome to your workspace.'}
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-[#1A1A1A] p-6 rounded-xl border border-white/5 relative overflow-hidden group hover:border-[#CBA153]/20 transition-all">
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-current opacity-0 group-hover:opacity-5 blur-2xl transition-opacity ${stat.color} -translate-y-1/2 translate-x-1/2 pointer-events-none`}></div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">{stat.label}</span>
                            <stat.icon className={`${stat.color} w-5 h-5`} />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-3xl font-serif text-white">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {session?.role && ['MASTER_ADMIN', 'PRODUCT_MANAGER'].includes(session.role) && (
                    <div className="bg-[#1A1A1A] p-6 rounded-xl border border-white/5">
                        <Package className="w-8 h-8 text-[#CBA153] mb-4" />
                        <h3 className="text-white font-bold mb-1">Manage Products</h3>
                        <p className="text-gray-500 text-sm mb-4">Update B2C and B2B product catalogs</p>
                        <div className="flex gap-3">
                            <span className="text-xs text-[#CBA153] bg-[#CBA153]/10 px-3 py-1 rounded-full">{totalProducts} products</span>
                        </div>
                    </div>
                )}
                {session?.role && ['MASTER_ADMIN', 'CONTENT_MANAGER'].includes(session.role) && (
                    <div className="bg-[#1A1A1A] p-6 rounded-xl border border-white/5">
                        <FileText className="w-8 h-8 text-blue-400 mb-4" />
                        <h3 className="text-white font-bold mb-1">Content Hub</h3>
                        <p className="text-gray-500 text-sm mb-4">Manage articles, recipes, and website copy</p>
                        <div className="flex gap-3">
                            <span className="text-xs text-blue-400 bg-blue-900/20 px-3 py-1 rounded-full">{articlesCount} articles</span>
                        </div>
                    </div>
                )}
                {session?.role && ['MASTER_ADMIN', 'SALES'].includes(session.role) && (
                    <div className="bg-[#1A1A1A] p-6 rounded-xl border border-white/5">
                        <TrendingUp className="w-8 h-8 text-emerald-400 mb-4" />
                        <h3 className="text-white font-bold mb-1">Sales Pipeline</h3>
                        <p className="text-gray-500 text-sm mb-4">Track leads and grow partnerships</p>
                        <div className="flex gap-3">
                            <span className="text-xs text-emerald-400 bg-emerald-900/20 px-3 py-1 rounded-full">{b2bLeads} new leads</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
