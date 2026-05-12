import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ReviewModerationClient from '@/components/admin/ReviewModerationClient';

export const dynamic = 'force-dynamic';

const ALLOWED = ['MASTER_ADMIN', 'PRODUCT_MANAGER'];

export default async function StaffReviewsPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || !ALLOWED.includes(session.role)) redirect(`/${locale}/staff`);

    const reviews = await prisma.productReview.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            user: { select: { name: true, email: true } },
            product: { select: { name: true, slug: true, imageUrl: true } },
            photos: { select: { id: true, imageUrl: true } },
            replies: {
                orderBy: { createdAt: 'asc' },
                include: { user: { select: { name: true } } },
            },
        },
    });

    const serialized = reviews.map(r => ({
        id: r.id, rating: r.rating, title: r.title, body: r.body,
        status: r.status, isVerifiedPurchase: r.isVerifiedPurchase,
        adminNote: r.adminNote, createdAt: r.createdAt.toISOString(),
        user: { name: r.user.name, email: r.user.email },
        product: r.product, photos: r.photos,
        replies: r.replies.map(rep => ({
            id: rep.id, body: rep.body, isAdminReply: rep.isAdminReply,
            createdAt: rep.createdAt.toISOString(), user: rep.user,
        })),
    }));

    const pending = serialized.filter(r => r.status === 'PENDING').length;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Review Moderation</h1>
                <p className="text-gray-500 font-light">Approve, reject, or reply to customer reviews.</p>
            </div>
            <ReviewModerationClient reviews={serialized} pendingCount={pending} />
        </div>
    );
}
