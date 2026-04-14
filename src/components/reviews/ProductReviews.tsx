import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import ProductReviewsClient from './ProductReviewsClient';

interface ProductReviewsProps {
    productId: string;
    productSlug: string;
}

export default async function ProductReviews({ productId, productSlug }: ProductReviewsProps) {
    const session = await getSession();

    // Fetch approved reviews
    const reviews = await prisma.productReview.findMany({
        where: { productId, status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        include: {
            user: { select: { name: true, id: true } },
            photos: { select: { id: true, imageUrl: true } },
            replies: {
                orderBy: { createdAt: 'asc' },
                include: { user: { select: { name: true } } },
            },
        },
    });

    // Check if current user already has a review (any status) and fetch it
    let hasExistingReview = false;
    let ownPendingReview: {
        id: string;
        rating: number;
        title: string;
        body: string;
        status: string;
        createdAt: string;
    } | null = null;

    if (session) {
        const existing = await prisma.productReview.findUnique({
            where: { productId_userId: { productId, userId: session.userId } },
        });
        hasExistingReview = !!existing;

        // If the review exists but is NOT approved, send it to the client so they can see it
        if (existing && existing.status !== 'APPROVED') {
            ownPendingReview = {
                id: existing.id,
                rating: existing.rating,
                title: existing.title,
                body: existing.body,
                status: existing.status,
                createdAt: existing.createdAt.toISOString(),
            };
        }
    }

    // Compute stats
    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;
    const distribution = [5, 4, 3, 2, 1].map(star => ({
        star,
        count: reviews.filter(r => r.rating === star).length,
        percentage: totalReviews > 0 ? (reviews.filter(r => r.rating === star).length / totalReviews) * 100 : 0,
    }));

    // Serialize dates for client
    const serializedReviews = reviews.map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        isOwn: session ? r.userId === session.userId : false,
        photos: r.photos.map(p => ({ ...p })),
        replies: r.replies.map(rep => ({
            ...rep,
            createdAt: rep.createdAt.toISOString(),
        })),
    }));

    return (
        <ProductReviewsClient
            productId={productId}
            reviews={serializedReviews}
            totalReviews={totalReviews}
            avgRating={Math.round(avgRating * 10) / 10}
            distribution={distribution}
            hasExistingReview={hasExistingReview}
            isLoggedIn={!!session}
            ownPendingReview={ownPendingReview}
        />
    );
}
