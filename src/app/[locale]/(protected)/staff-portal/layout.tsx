import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { LogOut, LayoutDashboard, Package, FileText, ShoppingCart, Users, BarChart3, Settings } from 'lucide-react';
import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

const STAFF_ROLES = ["MASTER_ADMIN", "PRODUCT_MANAGER", "CONTENT_MANAGER", "SALES"];

// Role-based navigation items
const NAV_ITEMS = [
    { label: 'Dashboard', href: '/staff-portal', icon: LayoutDashboard, roles: STAFF_ROLES },
    { label: 'Products (B2C)', href: '/staff-portal/products', icon: Package, roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
    { label: 'Products (B2B)', href: '/staff-portal/products-b2b', icon: Package, roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
    { label: 'Content & Articles', href: '/staff-portal/content', icon: FileText, roles: ['MASTER_ADMIN', 'CONTENT_MANAGER'] },
    { label: 'B2B Leads', href: '/staff-portal/leads', icon: Users, roles: ['MASTER_ADMIN', 'SALES'] },
    { label: 'Orders', href: '/staff-portal/orders', icon: ShoppingCart, roles: ['MASTER_ADMIN', 'SALES', 'PRODUCT_MANAGER'] },
    { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['MASTER_ADMIN', 'SALES'] },
];

const ROLE_LABELS: Record<string, string> = {
    MASTER_ADMIN: 'Master Admin',
    PRODUCT_MANAGER: 'Product Manager',
    CONTENT_MANAGER: 'Content Manager',
    SALES: 'Sales',
};

export default async function StaffPortalLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: any;
}) {
    const { locale } = await params;
    const session = await getSession();

    if (!session || !STAFF_ROLES.includes(session.role)) {
        redirect(`/${locale}/staff`);
    }

    const filteredNav = NAV_ITEMS.filter(item => item.roles.includes(session.role));

    return (
        <div className="min-h-screen bg-[#0D0D0D] flex">
            {/* Sidebar */}
            <aside className="w-72 bg-[#111111] border-r border-white/5 fixed top-0 left-0 h-full flex flex-col z-40">
                {/* Logo */}
                <div className="p-6 border-b border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#CBA153]/10 border border-[#CBA153]/30 flex items-center justify-center">
                            <Settings className="w-5 h-5 text-[#CBA153]" />
                        </div>
                        <div>
                            <h2 className="text-white font-serif text-lg tracking-wide">Colchis</h2>
                            <span className="text-[10px] text-[#CBA153]/60 uppercase tracking-[0.3em] font-bold">Staff Portal</span>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <span className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold px-4 mb-3 block">Workspace</span>
                    {filteredNav.map((item) => (
                        <Link
                            key={item.href}
                            href={`/${locale}${item.href}`}
                            className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all group text-sm"
                        >
                            <item.icon className="w-4 h-4 text-gray-500 group-hover:text-[#CBA153] transition-colors" />
                            {item.label}
                        </Link>
                    ))}

                    {session.role === "MASTER_ADMIN" && (
                        <>
                            <div className="my-4 border-t border-white/5"></div>
                            <span className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold px-4 mb-3 block">Admin</span>
                            <Link
                                href={`/${locale}/admin`}
                                className="flex items-center gap-3 px-4 py-3 text-[#CBA153] hover:text-white hover:bg-[#CBA153]/10 rounded-lg transition-all group text-sm font-medium"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Master Admin Panel
                            </Link>
                        </>
                    )}
                </nav>

                {/* User Info */}
                <div className="p-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#CBA153]/10 border border-[#CBA153]/30 flex items-center justify-center shrink-0">
                                <span className="text-[#CBA153] text-xs font-bold">
                                    {(session.name || session.email).charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm text-white font-medium truncate">{session.name || session.email}</p>
                                <p className="text-[10px] text-[#CBA153] uppercase tracking-wider font-bold">{ROLE_LABELS[session.role] || session.role}</p>
                            </div>
                        </div>
                        <form action={logoutAction}>
                            <button type="submit" className="text-gray-600 hover:text-red-400 transition-colors p-2">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-72 min-h-screen">
                <div className="p-8 lg:p-12">
                    {children}
                </div>
            </main>
        </div>
    );
}
