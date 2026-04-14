import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { FileText, BookOpen, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ALLOWED = ['MASTER_ADMIN', 'CONTENT_MANAGER'];

export default async function StaffContentPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || !ALLOWED.includes(session.role)) redirect(`/${locale}/staff`);

    const [articlesCount, recipesCount] = await Promise.all([
        prisma.article.count(),
        prisma.recipe.count(),
    ]);

    const sections = [
        {
            title: 'Journal Articles',
            description: 'Create, edit, and publish journal articles for the public website.',
            href: `/staff-portal/content/articles`,
            icon: FileText,
            count: articlesCount,
            countLabel: 'articles',
            color: 'text-blue-400',
            bg: 'bg-blue-400/10',
        },
        {
            title: 'Recipes & Pairings',
            description: 'Manage recipes with rich media, cooking times, and difficulty levels.',
            href: `/staff-portal/content/recipes`,
            icon: BookOpen,
            count: recipesCount,
            countLabel: 'recipes',
            color: 'text-emerald-400',
            bg: 'bg-emerald-400/10',
        },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Content Hub</h1>
                <p className="text-gray-500 font-light">Manage articles, recipes, and website content.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sections.map((s) => (
                    <Link
                        key={s.href}
                        href={`/${locale}${s.href}`}
                        className="bg-[#1A1A1A] rounded-xl border border-white/5 p-6 hover:border-[#CBA153]/20 transition-all group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-12 h-12 rounded-lg ${s.bg} flex items-center justify-center`}>
                                <s.icon className={`w-6 h-6 ${s.color}`} />
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-[#CBA153] transition-colors" />
                        </div>
                        <h3 className="text-white font-bold mb-1">{s.title}</h3>
                        <p className="text-gray-500 text-sm mb-4">{s.description}</p>
                        <span className={`text-xs ${s.color} ${s.bg} px-3 py-1 rounded-full`}>
                            {s.count} {s.countLabel}
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
