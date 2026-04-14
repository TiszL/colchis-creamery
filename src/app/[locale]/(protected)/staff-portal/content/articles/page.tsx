import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import JournalEditorClient from '@/components/admin/JournalEditorClient';

export const dynamic = 'force-dynamic';

const ALLOWED = ['MASTER_ADMIN', 'CONTENT_MANAGER'];

export default async function StaffArticlesPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || !ALLOWED.includes(session.role)) redirect(`/${locale}/staff`);

    const articles = await prisma.article.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true, title: true, slug: true, excerpt: true,
            content: true, contentBlocks: true, coverImage: true,
            tags: true, isPublished: true, publishedAt: true, createdAt: true,
        }
    });

    return (
        <div className="space-y-8">
            <div>
                <Link href={`/${locale}/staff-portal/content`} className="text-xs text-[#CBA153] hover:text-white transition-colors flex items-center gap-1 mb-3">
                    <ArrowLeft className="w-3 h-3" /> Back to Content Hub
                </Link>
                <h1 className="text-3xl font-serif text-white mb-2">Journal Manager</h1>
                <p className="text-gray-500 font-light">Create and manage journal articles for the public website.</p>
            </div>

            <JournalEditorClient articles={JSON.parse(JSON.stringify(articles))} locale={locale} />
        </div>
    );
}
