import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ReviewModerationClient from '@/components/admin/ReviewModerationClient';

export const dynamic = 'force-dynamic';

export default async function AdminReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

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
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: r.status,
        isVerifiedPurchase: r.isVerifiedPurchase,
        adminNote: r.adminNote,
        createdAt: r.createdAt.toISOString(),
        user: { name: r.user.name, email: r.user.email },
        product: r.product,
        photos: r.photos,
        replies: r.replies.map(rep => ({
            id: rep.id,
            body: rep.body,
            isAdminReply: rep.isAdminReply,
            createdAt: rep.createdAt.toISOString(),
            user: rep.user,
        })),
    }));

    const pending = serialized.filter(r => r.status === 'PENDING').length;

    return <ReviewModerationClient reviews={serialized} pendingCount={pending} />;
}
