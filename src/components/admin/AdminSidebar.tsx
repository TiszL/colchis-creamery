'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, LayoutDashboard, Package, FileText, ShoppingCart, Users, KeyRound, BarChart3, Settings, Shield, Globe, Inbox, MessageSquare, Tags, MessageCircle, MapPin } from 'lucide-react';
import { ColchisSeal } from '@/components/brand/ColchisSeal';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Inventory', href: '/admin/inventory', icon: Package },
    { label: 'Locations', href: '/admin/locations', icon: MapPin },
    { label: 'Categories', href: '/admin/categories', icon: Tags },
    { label: 'Live Chat', href: '/admin/chat', icon: MessageCircle },
    { label: 'Orders', href: '/admin/orders', icon: ShoppingCart },
    { label: 'Requests', href: '/admin/requests', icon: Inbox },
    { label: 'Reviews', href: '/admin/reviews', icon: MessageSquare },
    { label: 'Contracts', href: '/admin/contracts', icon: FileText },
    { label: 'Staff Management', href: '/admin/staff', icon: Users },
    { label: '  ↳ Location Staff', href: '/admin/location-staff', icon: Users },
    { label: 'Access Codes', href: '/admin/access-codes', icon: KeyRound },
    { label: 'Website Content', href: '/admin/website', icon: Globe },
    { label: '  ↳ Recipes', href: '/admin/website/recipes', icon: FileText },
    { label: '  ↳ Journal', href: '/admin/website/articles', icon: FileText },
    { label: 'Sales & Inventory', href: '/admin/sales-reports',     icon: BarChart3 },
    { label: 'Prospect Map',      href: '/admin/analytics-control', icon: BarChart3 },
    { label: 'Security Settings', href: '/admin/security', icon: Shield },
];

function NavItems({ items, locale, onNavigate }: { items: typeof NAV_ITEMS; locale: string; onNavigate: () => void }) {
    const pathname = usePathname();

    return (
        <>
            {items.map((item) => {
                const fullHref = `/${locale}${item.href}`;
                const isActive = item.href === '/admin'
                    ? pathname === fullHref || pathname === `/${locale}/admin`
                    : pathname.startsWith(fullHref);

                return (
                    <Link
                        key={item.href}
                        href={fullHref}
                        onClick={onNavigate}
                        className={`ch-admin-nav-item flex items-center gap-3 px-4 py-3 transition-all text-sm ${
                            isActive
                                ? 'bg-[#B96A3D15] text-[#B96A3D] border-l-2 border-[#B96A3D]'
                                : 'text-[#7A8278] hover:text-[#F5F0E6] hover:bg-[#B96A3D08]'
                        }`}
                    >
                        <item.icon className={`w-4 h-4 transition-colors ${
                            isActive ? 'text-[#B96A3D]' : 'text-[#5A6158] group-hover:text-[#B96A3D]'
                        }`} />
                        {item.label}
                        {item.href === '/admin/chat' && <ChatBadge />}
                    </Link>
                );
            })}
        </>
    );
}

// SSE-powered live badge for chat waiting count
function ChatBadge() {
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

        // SSE for instant updates
        const es = new EventSource('/api/chat/staff/stream');
        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'sessions_update') fetchCount();
            } catch { /* parse error */ }
        };
        es.onerror = () => {
            // Fallback to polling on SSE failure
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
            <div className="md:hidden fixed top-0 left-0 w-full h-16 bg-[#0F0F0F] border-b border-[#B96A3D22] z-30 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <ColchisSeal size={28} />
                    <div>
                        <h2 className="text-[#F5F0E6] text-sm" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Colchis Food</h2>
                        <span className="text-[8px] text-[#B96A3D] block" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.3em', textTransform: 'uppercase' }}>Master Admin</span>
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
                
                {/* Logo Area */}
                <div className="p-6 border-b border-[#B96A3D22] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <ColchisSeal size={36} />
                        <div>
                            <h2 className="text-[#F5F0E6]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 15, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Colchis Food</h2>
                            <span className="text-[9px] text-[#B96A3D] block" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.3em', textTransform: 'uppercase' }}>Master Admin</span>
                        </div>
                    </div>
                    {/* Close button for mobile inside drawer */}
                    <button onClick={closeSidebar} className="md:hidden text-[#7A8278] hover:text-[#F5F0E6] transition-colors" style={{ width: 32, height: 32, border: '1px solid #B96A3D33', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
                    <span className="text-[9px] text-[#D9A876] block px-4 mb-3" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' }}>№ 00 — Command Center</span>
                    <NavItems items={NAV_ITEMS} locale={locale} onNavigate={closeSidebar} />
                    <div className="my-4 border-t border-[#ffffff0A]"></div>
                    <Link
                        href={`/${locale}/portal`}
                        onClick={closeSidebar}
                        className="flex items-center gap-3 px-4 py-3 text-[#7A8278] hover:text-[#F5F0E6] hover:bg-[#ffffff08] transition-all text-sm"
                    >
                        <Settings className="w-4 h-4 text-[#5A6158]" />
                        <span className="truncate">Staff Portal View</span>
                    </Link>
                    <Link
                        href={`/${locale}/analytics`}
                        onClick={closeSidebar}
                        className="flex items-center gap-3 px-4 py-3 text-[#7A8278] hover:text-[#F5F0E6] hover:bg-[#ffffff08] transition-all text-sm"
                    >
                        <BarChart3 className="w-4 h-4 text-[#5A6158]" />
                        <span className="truncate">Analytics Dashboard</span>
                    </Link>
                </nav>

                {/* User Info & Logout */}
                <div className="p-4 border-t border-[#B96A3D22] bg-[#0C0C0C]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#B96A3D] flex items-center justify-center shrink-0">
                                <span className="text-[#F5F0E6] text-xs" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                    {sessionName.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0 pr-2">
                                <p className="text-sm text-[#F5F0E6] truncate" style={{ fontFamily: 'var(--font-sans)' }}>{sessionName}</p>
                                <p className="text-[9px] text-[#B96A3D] truncate" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Master Admin</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleLogout} 
                            disabled={isPending}
                            className="text-[#5A6158] hover:text-[#A8312C] transition-colors p-2 shrink-0 disabled:opacity-50"
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
