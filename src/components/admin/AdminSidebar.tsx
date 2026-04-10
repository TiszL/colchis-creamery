'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, LayoutDashboard, Package, FileText, ShoppingCart, Users, KeyRound, BarChart3, Settings, Shield, Globe, Inbox } from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Inventory', href: '/admin/inventory', icon: Package },
    { label: 'Orders', href: '/admin/orders', icon: ShoppingCart },
    { label: 'Requests', href: '/admin/requests', icon: Inbox },
    { label: 'Contracts', href: '/admin/contracts', icon: FileText },
    { label: 'Staff Management', href: '/admin/staff', icon: Users },
    { label: 'Access Codes', href: '/admin/access-codes', icon: KeyRound },
    { label: 'Website Content', href: '/admin/website', icon: Globe },
    { label: '  ↳ Recipes', href: '/admin/website/recipes', icon: FileText },
    { label: '  ↳ Journal', href: '/admin/website/articles', icon: FileText },
    { label: 'Analytics Control', href: '/admin/analytics-control', icon: BarChart3 },
    { label: 'Security Settings', href: '/admin/security', icon: Shield },
];

function NavItems({ items, locale, onNavigate }: { items: typeof NAV_ITEMS; locale: string; onNavigate: () => void }) {
    const pathname = usePathname();

    return (
        <>
            {items.map((item) => {
                const fullHref = `/${locale}${item.href}`;
                // Exact match for dashboard, startsWith for sub-routes
                const isActive = item.href === '/admin'
                    ? pathname === fullHref || pathname === `/${locale}/admin`
                    : pathname.startsWith(fullHref);

                return (
                    <Link
                        key={item.href}
                        href={fullHref}
                        onClick={onNavigate}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group text-sm ${
                            isActive
                                ? 'text-white bg-[#CBA153]/10 border-l-2 border-[#CBA153]'
                                : 'text-gray-400 hover:text-white hover:bg-[#CBA153]/5'
                        }`}
                    >
                        <item.icon className={`w-4 h-4 transition-colors ${
                            isActive ? 'text-[#CBA153]' : 'text-gray-600 group-hover:text-[#CBA153]'
                        }`} />
                        {item.label}
                    </Link>
                );
            })}
        </>
    );
}

export default function AdminSidebar({
    locale,
    sessionName,
    sessionEmail,
    logoutAction
}: {
    locale: string;
    sessionName: string;
    sessionEmail: string;
    logoutAction: () => Promise<void>;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const closeSidebar = () => setIsOpen(false);

    const handleLogout = () => {
        startTransition(() => {
            logoutAction();
        });
    };

    return (
        <>
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 w-full h-16 bg-[#0F0F0F] border-b border-[#CBA153]/10 z-30 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-[#CBA153]" />
                    <h2 className="text-white font-serif text-lg tracking-wide">Colchis Admin</h2>
                </div>
                <button onClick={() => setIsOpen(true)} className="text-[#CBA153] p-2 hover:bg-[#CBA153]/10 rounded transition-colors">
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* Mobile Backdrop Overlay */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 bg-black/70 z-40 transition-opacity" onClick={closeSidebar}></div>
            )}

            {/* Sidebar drawer */}
            <aside className={`w-72 bg-[#0F0F0F] border-r border-[#CBA153]/10 fixed top-0 left-0 h-full flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
                
                {/* Logo Area */}
                <div className="p-6 border-b border-[#CBA153]/10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#CBA153] flex items-center justify-center shadow-lg shadow-[#CBA153]/20">
                            <Shield className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h2 className="text-white font-serif text-lg tracking-wide">Colchis</h2>
                            <span className="text-[10px] text-[#CBA153] uppercase tracking-[0.3em] font-bold">Master Admin</span>
                        </div>
                    </div>
                    {/* Close button for mobile inside drawer */}
                    <button onClick={closeSidebar} className="md:hidden text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <span className="text-[10px] text-[#CBA153]/40 uppercase tracking-[0.2em] font-bold px-4 mb-3 block">Command Center</span>
                    <NavItems items={NAV_ITEMS} locale={locale} onNavigate={closeSidebar} />
                    <div className="my-4 border-t border-white/5"></div>
                    <Link
                        href={`/${locale}/staff-portal`}
                        onClick={closeSidebar}
                        className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all group text-sm"
                    >
                        <Settings className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
                        <span className="truncate">Staff Portal View</span>
                    </Link>
                    <Link
                        href={`/${locale}/analytics`}
                        onClick={closeSidebar}
                        className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all group text-sm"
                    >
                        <BarChart3 className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
                        <span className="truncate">Analytics Dashboard</span>
                    </Link>
                </nav>

                {/* User Info & Logout */}
                <div className="p-4 border-t border-[#CBA153]/10 bg-[#0A0A0A]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#CBA153] flex items-center justify-center shrink-0">
                                <span className="text-black text-xs font-bold">
                                    {sessionName.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0 pr-2">
                                <p className="text-sm text-white font-medium truncate">{sessionName}</p>
                                <p className="text-[10px] text-[#CBA153] uppercase tracking-wider font-bold truncate">Master Admin</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleLogout} 
                            disabled={isPending}
                            className="text-gray-600 hover:text-red-400 transition-colors p-2 shrink-0 disabled:opacity-50"
                            aria-label="Logout"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
