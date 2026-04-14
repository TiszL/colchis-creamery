'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, LogOut, LayoutDashboard, Package, FileText, BookOpen, ShoppingCart, Users, BarChart3, Settings, Star, FileSignature } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function StaffSidebar({
    locale,
    sessionRole,
    sessionName,
    sessionEmail,
    roleLabel,
    logoutAction
}: {
    locale: string;
    sessionRole: string;
    sessionName: string;
    sessionEmail: string;
    roleLabel: string;
    logoutAction: () => Promise<void>;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const closeSidebar = () => setIsOpen(false);
    const pathname = usePathname();

    const STAFF_ROLES = ["MASTER_ADMIN", "PRODUCT_MANAGER", "CONTENT_MANAGER", "SALES"];
    
    // Role-based navigation items
    const NAV_ITEMS = [
        { label: 'Dashboard', href: '/staff-portal', icon: LayoutDashboard, roles: STAFF_ROLES },
        // Product & Customer Manager
        { label: 'Inventory (B2C)', href: '/staff-portal/products', icon: Package, roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
        { label: 'Inventory (B2B)', href: '/staff-portal/products-b2b', icon: Package, roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
        { label: 'Orders', href: '/staff-portal/orders', icon: ShoppingCart, roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER', 'SALES'] },
        { label: 'Reviews', href: '/staff-portal/reviews', icon: Star, roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
        // Content Manager
        { label: 'Content Hub', href: '/staff-portal/content', icon: FileText, roles: ['MASTER_ADMIN', 'CONTENT_MANAGER'] },
        { label: 'Articles', href: '/staff-portal/content/articles', icon: FileText, roles: ['MASTER_ADMIN', 'CONTENT_MANAGER'] },
        { label: 'Recipes', href: '/staff-portal/content/recipes', icon: BookOpen, roles: ['MASTER_ADMIN', 'CONTENT_MANAGER'] },
        // Sales
        { label: 'B2B Leads', href: '/staff-portal/leads', icon: Users, roles: ['MASTER_ADMIN', 'SALES'] },
        { label: 'Contracts', href: '/staff-portal/contracts', icon: FileSignature, roles: ['MASTER_ADMIN', 'SALES'] },
        // All staff
        { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: STAFF_ROLES },
    ];

    const filteredNav = NAV_ITEMS.filter(item => item.roles.includes(sessionRole));

    // Group nav items by section
    const dashboardItems = filteredNav.filter(i => i.href === '/staff-portal');
    const workItems = filteredNav.filter(i => i.href !== '/staff-portal' && i.href !== '/analytics');
    const analyticsItem = filteredNav.filter(i => i.href === '/analytics');

    const isActive = (href: string) => {
        const full = `/${locale}${href}`;
        if (href === '/staff-portal') return pathname === full;
        return pathname.startsWith(full);
    };

    const NavLink = ({ item }: { item: typeof NAV_ITEMS[0] }) => (
        <Link
            href={`/${locale}${item.href}`}
            onClick={closeSidebar}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group text-sm ${
                isActive(item.href)
                    ? 'bg-[#CBA153]/10 text-[#CBA153] border border-[#CBA153]/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
        >
            <item.icon className={`w-4 h-4 ${isActive(item.href) ? 'text-[#CBA153]' : 'text-gray-500 group-hover:text-[#CBA153]'} transition-colors`} />
            <span className="truncate">{item.label}</span>
        </Link>
    );

    return (
        <>
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 w-full h-16 bg-[#111111] border-b border-white/5 z-30 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#CBA153]/10 border border-[#CBA153]/30 flex items-center justify-center shrink-0">
                        <Settings className="w-4 h-4 text-[#CBA153]" />
                    </div>
                    <div>
                        <h2 className="text-white font-serif text-base tracking-wide leading-tight">Colchis</h2>
                        <span className="text-[9px] text-[#CBA153]/60 uppercase tracking-[0.2em] font-bold block">Staff Portal</span>
                    </div>
                </div>
                <button onClick={() => setIsOpen(true)} className="text-[#CBA153] p-2 hover:bg-white/5 rounded transition-colors">
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* Mobile Backdrop Overlay */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 bg-black/70 z-40 transition-opacity" onClick={closeSidebar}></div>
            )}

            {/* Sidebar drawer */}
            <aside className={`w-72 bg-[#111111] border-r border-white/5 fixed top-0 left-0 h-full flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
                
                {/* Logo */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#CBA153]/10 border border-[#CBA153]/30 flex items-center justify-center shrink-0">
                            <Settings className="w-5 h-5 text-[#CBA153]" />
                        </div>
                        <div>
                            <h2 className="text-white font-serif text-lg tracking-wide leading-tight">Colchis</h2>
                            <span className="text-[10px] text-[#CBA153]/60 uppercase tracking-[0.3em] font-bold block">Staff Portal</span>
                        </div>
                    </div>
                    {/* Close button for mobile */}
                    <button onClick={closeSidebar} className="md:hidden text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {/* Dashboard */}
                    {dashboardItems.map(item => <NavLink key={item.href} item={item} />)}

                    {/* Work items */}
                    {workItems.length > 0 && (
                        <>
                            <div className="my-3 border-t border-white/5"></div>
                            <span className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold px-4 mb-2 block">Workspace</span>
                            {workItems.map(item => <NavLink key={item.href} item={item} />)}
                        </>
                    )}

                    {/* Analytics */}
                    {analyticsItem.length > 0 && (
                        <>
                            <div className="my-3 border-t border-white/5"></div>
                            <span className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold px-4 mb-2 block">Intelligence</span>
                            {analyticsItem.map(item => <NavLink key={item.href} item={item} />)}
                        </>
                    )}

                    {sessionRole === "MASTER_ADMIN" && (
                        <>
                            <div className="my-4 border-t border-white/5"></div>
                            <span className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold px-4 mb-3 block">Admin</span>
                            <Link
                                href={`/${locale}/admin`}
                                onClick={closeSidebar}
                                className="flex items-center gap-3 px-4 py-3 text-[#CBA153] hover:text-white hover:bg-[#CBA153]/10 rounded-lg transition-all group text-sm font-medium"
                            >
                                <LayoutDashboard className="w-4 h-4 shrink-0" />
                                <span className="truncate">Master Admin Panel</span>
                            </Link>
                        </>
                    )}
                </nav>

                {/* User Info */}
                <div className="p-4 border-t border-white/5 bg-[#0D0D0D]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div className="w-9 h-9 rounded-full bg-[#CBA153]/10 border border-[#CBA153]/30 flex items-center justify-center shrink-0">
                                <span className="text-[#CBA153] text-xs font-bold">
                                    {(sessionName || sessionEmail).charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm text-white font-medium truncate">{sessionName || sessionEmail}</p>
                                <p className="text-[10px] text-[#CBA153] uppercase tracking-wider font-bold truncate">{roleLabel || sessionRole}</p>
                            </div>
                        </div>
                        <form action={logoutAction}>
                            <button type="submit" className="text-gray-600 hover:text-red-400 transition-colors p-2 shrink-0">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            </aside>
        </>
    );
}
