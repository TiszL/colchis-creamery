import Link from 'next/link';
import { getSessionToken } from '@/lib/session';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LogOut, PackagePlus, LayoutDashboard, FileText } from 'lucide-react';
import { prisma as db } from '@/lib/db';

export default async function B2BLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: any;
}) {
    const { locale } = await params;
    const token = await getSessionToken();
    const session = token ? await verifyToken(token) : null;

    if (!session || (session.role !== 'B2B_PARTNER' && session.role !== 'ADMIN')) {
        redirect(`/${locale}/login`);
    }

    // Fetch company name for display
    const user = await db.user.findUnique({
        where: { id: session.userId }
    });

    const navItems = [
        { label: 'Partner Dashboard', href: `/${locale}/b2b-portal`, icon: LayoutDashboard },
        { label: 'Place Bulk Order', href: `/${locale}/b2b-portal/order`, icon: PackagePlus },
    ];

    return (
        <div className="min-h-screen bg-[#FDFBF7] flex">
            {/* Sidebar - Lighter theme than Admin */}
            <aside className="w-64 bg-white border-r border-[#E8E6E1] flex flex-col fixed h-full z-10">
                <div className="p-6 border-b border-[#E8E6E1]">
                    <h2 className="text-xl font-serif text-[#CBA153] leading-tight">
                        Colchis B2B
                    </h2>
                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">
                        Partner Portal
                    </p>
                </div>

                <nav className="flex-1 py-6 px-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
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
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-[#E8E6E1] shadow-sm">
                            <span className="text-xs font-bold text-[#CBA153]">{user?.companyName?.charAt(0).toUpperCase() || 'P'}</span>
                        </div>
                        <div className="truncate">
                            <p className="text-gray-900 text-xs font-bold truncate">{user?.companyName}</p>
                            <p className="text-[10px] text-gray-500 truncate">{session.email}</p>
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

            {/* Main Content Area */}
            <main className="flex-1 ml-64 min-h-screen">
                <div className="p-8 md:p-12">
                    {children}
                </div>
            </main>
        </div>
    );
}
