import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { LogOut, LayoutDashboard, Package, FileText, ShoppingCart, Users, KeyRound, BarChart3, Settings, Shield, Globe } from 'lucide-react';
import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Inventory', href: '/admin/inventory', icon: Package },
    { label: 'Orders', href: '/admin/orders', icon: ShoppingCart },
    { label: 'Contracts', href: '/admin/contracts', icon: FileText },
    { label: 'Staff Management', href: '/admin/staff', icon: Users },
    { label: 'Access Codes', href: '/admin/access-codes', icon: KeyRound },
    { label: 'Website Content', href: '/admin/website', icon: Globe },
    { label: '  ↳ Products', href: '/admin/website/products', icon: Package },
    { label: '  ↳ Recipes', href: '/admin/website/recipes', icon: FileText },
    { label: '  ↳ Articles', href: '/admin/website/articles', icon: FileText },
    { label: 'Analytics Control', href: '/admin/analytics-control', icon: BarChart3 },
];

export default async function AdminLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: any;
}) {
    const { locale } = await params;
    const session = await getSession();

    if (!session || session.role !== 'MASTER_ADMIN') {
        redirect(`/${locale}/staff`);
    }

    return (
        <div className="min-h-screen bg-[#0A0A0A] flex">
            {/* Sidebar */}
            <aside className="w-72 bg-[#0F0F0F] border-r border-[#CBA153]/10 fixed top-0 left-0 h-full flex flex-col z-40">
                {/* Logo */}
                <div className="p-6 border-b border-[#CBA153]/10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#CBA153] flex items-center justify-center shadow-lg shadow-[#CBA153]/20">
                            <Shield className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h2 className="text-white font-serif text-lg tracking-wide">Colchis</h2>
                            <span className="text-[10px] text-[#CBA153] uppercase tracking-[0.3em] font-bold">Master Admin</span>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <span className="text-[10px] text-[#CBA153]/40 uppercase tracking-[0.2em] font-bold px-4 mb-3 block">Command Center</span>
                    {NAV_ITEMS.map((item) => (
                        <Link
                            key={item.href}
                            href={`/${locale}${item.href}`}
                            className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#CBA153]/5 rounded-lg transition-all group text-sm"
                        >
                            <item.icon className="w-4 h-4 text-gray-600 group-hover:text-[#CBA153] transition-colors" />
                            {item.label}
                        </Link>
                    ))}

                    <div className="my-4 border-t border-white/5"></div>
                    <Link
                        href={`/${locale}/staff-portal`}
                        className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all group text-sm"
                    >
                        <Settings className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
                        Staff Portal View
                    </Link>
                    <Link
                        href={`/${locale}/analytics`}
                        className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all group text-sm"
                    >
                        <BarChart3 className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
                        Analytics Dashboard
                    </Link>
                </nav>

                {/* User Info */}
                <div className="p-4 border-t border-[#CBA153]/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#CBA153] flex items-center justify-center shrink-0">
                                <span className="text-black text-xs font-bold">
                                    {(session.name || session.email).charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm text-white font-medium truncate">{session.name || session.email}</p>
                                <p className="text-[10px] text-[#CBA153] uppercase tracking-wider font-bold">Master Admin</p>
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
