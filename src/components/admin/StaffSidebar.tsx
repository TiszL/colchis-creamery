'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Menu, X, LogOut, LayoutDashboard, Package, FileText, BookOpen, ShoppingCart, Users, BarChart3, Settings, Star, FileSignature, Tags, MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ColchisSeal } from '@/components/brand/ColchisSeal';

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
        { label: 'Dashboard', href: '/portal', icon: LayoutDashboard, roles: STAFF_ROLES },
        // Product Expert & Customer Assistance
        { label: 'Inventory (B2C)', href: '/portal/products', icon: Package, roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
        { label: 'Inventory (B2B)', href: '/portal/products-b2b', icon: Package, roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
        { label: 'Categories', href: '/portal/categories', icon: Tags, roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
        { label: 'Live Chat', href: '/portal/chat', icon: MessageCircle, roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
        { label: 'Orders', href: '/portal/orders', icon: ShoppingCart, roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER', 'SALES'] },
        { label: 'Reviews', href: '/portal/reviews', icon: Star, roles: ['MASTER_ADMIN', 'PRODUCT_MANAGER'] },
        // Content Manager
        { label: 'Content Hub', href: '/portal/content', icon: FileText, roles: ['MASTER_ADMIN', 'CONTENT_MANAGER'] },
        { label: 'Articles', href: '/portal/content/articles', icon: FileText, roles: ['MASTER_ADMIN', 'CONTENT_MANAGER'] },
        { label: 'Recipes', href: '/portal/content/recipes', icon: BookOpen, roles: ['MASTER_ADMIN', 'CONTENT_MANAGER'] },
        // Sales
        { label: 'B2B Leads', href: '/portal/leads', icon: Users, roles: ['MASTER_ADMIN', 'SALES'] },
        { label: 'Contracts', href: '/portal/contracts', icon: FileSignature, roles: ['MASTER_ADMIN', 'SALES'] },
        // All staff
        { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: STAFF_ROLES },
    ];

    const filteredNav = NAV_ITEMS.filter(item => item.roles.includes(sessionRole));

    // Group nav items by section
    const dashboardItems = filteredNav.filter(i => i.href === '/portal');
    const workItems = filteredNav.filter(i => i.href !== '/portal' && i.href !== '/analytics');
    const analyticsItem = filteredNav.filter(i => i.href === '/analytics');

    const isActive = (href: string) => {
        const full = `/${locale}${href}`;
        if (href === '/portal') return pathname === full;
        return pathname.startsWith(full);
    };

    const NavLink = ({ item }: { item: typeof NAV_ITEMS[0] }) => (
        <Link
            href={`/${locale}${item.href}`}
            onClick={closeSidebar}
            className={`ch-admin-nav-item flex items-center gap-3 px-4 py-3 transition-all text-sm ${
                isActive(item.href)
                    ? 'bg-[#B96A3D15] text-[#B96A3D] border-l-2 border-[#B96A3D]'
                    : 'text-[#7A8278] hover:text-[#F5F0E6] hover:bg-[#B96A3D08]'
            }`}
        >
            <item.icon className={`w-4 h-4 ${isActive(item.href) ? 'text-[#B96A3D]' : 'text-[#5A6158]'} transition-colors`} />
            <span className="truncate">{item.label}</span>
            {item.href === '/portal/chat' && <StaffChatBadge />}
        </Link>
    );

    // SSE-powered live badge for chat waiting count
    function StaffChatBadge() {
        const [count, setCount] = useState(0);

        const fetchCount = useCallback(async () => {
            try {
                const res = await fetch('/api/chat/staff');
                const data = await res.json();
                setCount(data.waitingCount || 0);
            } catch { /* silent */ }
        }, []);

        useEffect(() => {
            fetchCount();

            const es = new EventSource('/api/chat/staff/stream');
            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'sessions_update') fetchCount();
                } catch { /* parse error */ }
            };
            es.onerror = () => {
                const interval = setInterval(fetchCount, 10000);
                es.close();
                return () => clearInterval(interval);
            };
            return () => es.close();
        }, [fetchCount]);

        if (count <= 0) return null;
        return (
            <span className="ml-auto bg-[#A8312C] text-[#F5F0E6] text-[9px] font-bold px-1.5 py-0.5 min-w-[18px] text-center" style={{ fontFamily: 'var(--font-mono)' }}>
                {count}
            </span>
        );
    }

    return (
        <>
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 w-full h-16 bg-[#0F0F0F] border-b border-[#B96A3D22] z-30 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <ColchisSeal size={28} />
                    <div>
                        <h2 className="text-[#F5F0E6] text-sm" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Colchis Food</h2>
                        <span className="text-[8px] text-[#D9A876] block" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>Staff Portal</span>
                    </div>
                </div>
                <button onClick={() => setIsOpen(true)} className="text-[#B96A3D] p-2 hover:bg-[#B96A3D15] transition-colors" style={{ border: '1px solid #B96A3D33' }}>
                    <Menu className="w-5 h-5" />
                </button>
            </div>

            {/* Mobile Backdrop Overlay */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 bg-black/70 z-40 transition-opacity" onClick={closeSidebar}></div>
            )}

            {/* Sidebar drawer */}
            <aside className={`w-72 bg-[#0F0F0F] border-r border-[#B96A3D22] fixed top-0 left-0 h-full flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
                
                {/* Logo */}
                <div className="p-6 border-b border-[#B96A3D22] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <ColchisSeal size={36} />
                        <div>
                            <h2 className="text-[#F5F0E6]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 15, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Colchis Food</h2>
                            <span className="text-[9px] text-[#D9A876] block" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>Staff Portal</span>
                        </div>
                    </div>
                    {/* Close button for mobile */}
                    <button onClick={closeSidebar} className="md:hidden text-[#7A8278] hover:text-[#F5F0E6] transition-colors" style={{ width: 32, height: 32, border: '1px solid #B96A3D33', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
                    {/* Dashboard */}
                    {dashboardItems.map(item => <NavLink key={item.href} item={item} />)}

                    {/* Work items */}
                    {workItems.length > 0 && (
                        <>
                            <div className="my-3 border-t border-[#ffffff0A]"></div>
                            <span className="text-[9px] text-[#D9A876] block px-4 mb-2" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>Workspace</span>
                            {workItems.map(item => <NavLink key={item.href} item={item} />)}
                        </>
                    )}

                    {/* Analytics */}
                    {analyticsItem.length > 0 && (
                        <>
                            <div className="my-3 border-t border-[#ffffff0A]"></div>
                            <span className="text-[9px] text-[#D9A876] block px-4 mb-2" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>Intelligence</span>
                            {analyticsItem.map(item => <NavLink key={item.href} item={item} />)}
                        </>
                    )}

                    {sessionRole === "MASTER_ADMIN" && (
                        <>
                            <div className="my-4 border-t border-[#ffffff0A]"></div>
                            <span className="text-[9px] text-[#D9A876] block px-4 mb-3" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>Admin</span>
                            <Link
                                href={`/${locale}/admin`}
                                onClick={closeSidebar}
                                className="flex items-center gap-3 px-4 py-3 text-[#B96A3D] hover:text-[#F5F0E6] hover:bg-[#B96A3D15] transition-all text-sm"
                            >
                                <LayoutDashboard className="w-4 h-4 shrink-0" />
                                <span className="truncate">Master Admin Panel</span>
                            </Link>
                        </>
                    )}
                </nav>

                {/* User Info */}
                <div className="p-4 border-t border-[#B96A3D22] bg-[#0C0C0C]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div className="w-9 h-9 rounded-full bg-[#B96A3D] flex items-center justify-center shrink-0">
                                <span className="text-[#F5F0E6] text-xs" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                    {(sessionName || sessionEmail).charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm text-[#F5F0E6] truncate" style={{ fontFamily: 'var(--font-sans)' }}>{sessionName || sessionEmail}</p>
                                <p className="text-[9px] text-[#B96A3D] truncate" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{roleLabel || sessionRole}</p>
                            </div>
                        </div>
                        <form action={logoutAction}>
                            <button type="submit" className="text-[#5A6158] hover:text-[#A8312C] transition-colors p-2 shrink-0">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            </aside>
        </>
    );
}
