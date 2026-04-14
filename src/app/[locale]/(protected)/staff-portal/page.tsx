import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Package, TrendingUp, Users, ShoppingCart, FileText, AlertCircle, Star, BookOpen, ArrowRight, MessageCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ROLE_GREETINGS: Record<string, string> = {
    MASTER_ADMIN: 'Full access across all systems.',
    PRODUCT_MANAGER: 'Manage products, orders, reviews, and customer experience.',
    CONTENT_MANAGER: 'Create and publish articles, recipes, and content.',
    SALES: 'Track leads, manage contracts, and close deals.',
};

export default async function StaffPortalDashboard({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();

    const [totalProducts, totalOrders, b2bLeads, lowStockCount, articlesCount, recipesCount, pendingReviews, chatWaiting] = await Promise.all([
        prisma.product.count({ where: { isActive: true } }),
        prisma.order.count(),
        prisma.b2bLead.count({ where: { status: 'NEW' } }),
        prisma.product.count({ where: { stockQuantity: { lt: 20 }, isActive: true } }),
        prisma.article.count(),
        prisma.recipe.count(),
        prisma.productReview.count({ where: { status: 'PENDING' } }),
        prisma.chatSession.count({ where: { status: { in: ['WAITING', 'ACTIVE'] } } }),
    ]);

    const stats = [
        { label: 'Active Products', value: totalProducts.toString(), icon: Package, color: 'text-[#CBA153]', roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
        { label: 'Total Orders', value: totalOrders.toString(), icon: ShoppingCart, color: 'text-blue-400', roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER', 'SALES'] },
        { label: 'New B2B Leads', value: b2bLeads.toString(), icon: Users, color: 'text-emerald-400', roles: ['MASTER_ADMIN', 'SALES'] },
        { label: 'Low Stock', value: lowStockCount.toString(), icon: AlertCircle, color: lowStockCount > 0 ? 'text-red-400' : 'text-gray-500', roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
        { label: 'Pending Reviews', value: pendingReviews.toString(), icon: Star, color: pendingReviews > 0 ? 'text-amber-400' : 'text-gray-500', roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
        { label: 'Articles', value: articlesCount.toString(), icon: FileText, color: 'text-blue-400', roles: ['MASTER_ADMIN', 'CONTENT_MANAGER'] },
        { label: 'Recipes', value: recipesCount.toString(), icon: BookOpen, color: 'text-emerald-400', roles: ['MASTER_ADMIN', 'CONTENT_MANAGER'] },
        { label: 'Live Chats', value: chatWaiting.toString(), icon: MessageCircle, color: chatWaiting > 0 ? 'text-amber-400' : 'text-gray-500', roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
    ];

    const visibleStats = stats.filter(s => s.roles.includes(session?.role || ''));

    // Quick action cards based on role
    const quickActions = [
        {
            title: 'Manage Inventory',
            description: 'Update products, pricing, and stock levels',
            href: `/${locale}/staff-portal/products`,
            icon: Package, color: 'text-[#CBA153]', bg: 'bg-[#CBA153]/10',
            count: `${totalProducts} products`,
            roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'],
        },
        {
            title: 'Moderate Reviews',
            description: 'Approve or reject customer reviews',
            href: `/${locale}/staff-portal/reviews`,
            icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10',
            count: `${pendingReviews} pending`,
            roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'],
        },
        {
            title: 'Content Hub',
            description: 'Manage articles, recipes, and website copy',
            href: `/${locale}/staff-portal/content`,
            icon: FileText, color: 'text-blue-400', bg: 'bg-blue-400/10',
            count: `${articlesCount} articles · ${recipesCount} recipes`,
            roles: ['MASTER_ADMIN', 'CONTENT_MANAGER'],
        },
        {
            title: 'Sales Pipeline',
            description: 'Track leads and grow partnerships',
            href: `/${locale}/staff-portal/leads`,
            icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10',
            count: `${b2bLeads} new leads`,
            roles: ['MASTER_ADMIN', 'SALES'],
        },
        {
            title: 'Orders & Fulfillment',
            description: 'Process and track customer orders',
            href: `/${locale}/staff-portal/orders`,
            icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-400/10',
            count: `${totalOrders} total orders`,
            roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER', 'SALES'],
        },
        {
            title: 'Live Chat',
            description: 'Respond to customer conversations in real time',
            href: `/${locale}/staff-portal/chat`,
            icon: MessageCircle, color: chatWaiting > 0 ? 'text-amber-400' : 'text-emerald-400',
            bg: chatWaiting > 0 ? 'bg-amber-400/10' : 'bg-emerald-400/10',
            count: chatWaiting > 0 ? `${chatWaiting} active` : 'No active chats',
            roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'],
        },
    ];

    const visibleActions = quickActions.filter(a => a.roles.includes(session?.role || ''));

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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {visibleStats.map((stat, i) => (
                    <div key={i} className="bg-[#1A1A1A] p-5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-[#CBA153]/20 transition-all">
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-current opacity-0 group-hover:opacity-5 blur-2xl transition-opacity ${stat.color} -translate-y-1/2 translate-x-1/2 pointer-events-none`}></div>
                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">{stat.label}</span>
                            <stat.icon className={`${stat.color} w-4 h-4`} />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-2xl font-serif text-white">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleActions.map((action) => (
                    <Link
                        key={action.href}
                        href={action.href}
                        className="bg-[#1A1A1A] p-6 rounded-xl border border-white/5 hover:border-[#CBA153]/20 transition-all group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-10 h-10 rounded-lg ${action.bg} flex items-center justify-center`}>
                                <action.icon className={`w-5 h-5 ${action.color}`} />
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-[#CBA153] transition-colors" />
                        </div>
                        <h3 className="text-white font-bold mb-1">{action.title}</h3>
                        <p className="text-gray-500 text-sm mb-4">{action.description}</p>
                        <span className={`text-xs ${action.color} ${action.bg} px-3 py-1 rounded-full`}>{action.count}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
