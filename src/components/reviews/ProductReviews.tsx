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
            user: { select: { name: true } },
            photos: { select: { id: true, imageUrl: true } },
            replies: {
                orderBy: { createdAt: 'asc' },
                include: { user: { select: { name: true } } },
            },
        },
    });

    // Check if current user already has a review (any status)
    let hasExistingReview = false;
    if (session) {
        const existing = await prisma.productReview.findUnique({
            where: { productId_userId: { productId, userId: session.userId } },
        });
        hasExistingReview = !!existing;
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
        />
    );
}
