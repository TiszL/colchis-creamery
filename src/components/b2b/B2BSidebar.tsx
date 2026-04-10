'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, LogOut, PackagePlus, LayoutDashboard } from 'lucide-react';

export default function B2BSidebar({
    locale,
    companyName,
    companyInitial,
    sessionEmail
}: {
    locale: string;
    companyName: string;
    companyInitial: string;
    sessionEmail: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const closeSidebar = () => setIsOpen(false);

    const navItems = [
        { label: 'Partner Dashboard', href: `/${locale}/b2b-portal`, icon: LayoutDashboard },
        { label: 'Place Bulk Order', href: `/${locale}/b2b-portal/order`, icon: PackagePlus },
    ];

    return (
        <>
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 w-full h-16 bg-white border-b border-[#E8E6E1] z-30 flex items-center justify-between px-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <h2 className="text-[#CBA153] font-serif text-lg leading-tight">Colchis B2B</h2>
                </div>
                <button onClick={() => setIsOpen(true)} className="text-[#CBA153] p-2 hover:bg-[#FDFBF7] rounded transition-colors">
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* Mobile Backdrop */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={closeSidebar}></div>
            )}

            {/* Sidebar drawer */}
            <aside className={`w-64 bg-white border-r border-[#E8E6E1] fixed top-0 left-0 h-full flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
                <div className="p-6 border-b border-[#E8E6E1] flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-serif text-[#CBA153] leading-tight">
                            Colchis B2B
                        </h2>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">
                            Partner Portal
                        </p>
                    </div>
                    {/* Close button for mobile inside drawer */}
                    <button onClick={closeSidebar} className="md:hidden text-gray-500 hover:text-gray-900 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={closeSidebar}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 rounded-lg hover:bg-[#FDFBF7] hover:text-[#CBA153] transition-colors group"
                            >
                                <Icon className="w-5 h-5 text-gray-400 group-hover:text-[#CBA153] transition-colors" />
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 border-t border-[#E8E6E1] space-y-2 bg-[#FDFBF7]">
                    <div className="px-4 py-2 flex items-center gap-3 text-sm font-medium text-gray-700">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-[#E8E6E1] shadow-sm shrink-0">
                            <span className="text-xs font-bold text-[#CBA153]">{companyInitial}</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-900 text-xs font-bold truncate">{companyName}</p>
                            <p className="text-[10px] text-gray-500 truncate">{sessionEmail}</p>
                        </div>
                    </div>

                    <form action="/api/auth/logout" method="POST">
                        <button type="submit" className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 rounded-lg hover:bg-white transition-colors">
                            <LogOut className="w-5 h-5" />
                            Sign Out
                        </button>
                    </form>
                </div>
            </aside>
        </>
    );
}
