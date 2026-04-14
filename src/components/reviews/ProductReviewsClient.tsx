'use client';

import { useState } from 'react';
import StarRating from './StarRating';
import ReviewCard from './ReviewCard';
import ReviewForm from './ReviewForm';
import { submitReview, submitReply } from '@/app/actions/reviews';

interface ReviewData {
    id: string;
    rating: number;
    title: string;
    body: string;
    isVerifiedPurchase: boolean;
    createdAt: string;
    user: { name: string | null };
    photos: { id: string; imageUrl: string }[];
    replies: {
        id: string;
        body: string;
        isAdminReply: boolean;
        createdAt: string;
        user: { name: string | null };
    }[];
}

interface Props {
    productId: string;
    reviews: ReviewData[];
    totalReviews: number;
    avgRating: number;
    distribution: { star: number; count: number; percentage: number }[];
    hasExistingReview: boolean;
    isLoggedIn: boolean;
}

const REVIEWS_PER_PAGE = 5;

export default function ProductReviewsClient({
    productId,
    reviews,
    totalReviews,
    avgRating,
    distribution,
    hasExistingReview,
    isLoggedIn,
}: Props) {
    const [visibleCount, setVisibleCount] = useState(REVIEWS_PER_PAGE);

    const handleReply = async (reviewId: string, body: string) => {
        const formData = new FormData();
        formData.append('reviewId', reviewId);
        formData.append('body', body);
        return submitReply(formData);
    };

    return (
        <section className="mt-16 border-t border-gray-100 pt-12" id="reviews">
            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-start gap-8 mb-10">
                {/* Left: Title + Average */}
                <div className="md:w-1/3">
                    <h2 className="font-serif text-2xl sm:text-3xl text-[#2C2A29] mb-2">
                        Customer Reviews
                    </h2>
                    {totalReviews > 0 ? (
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-4xl font-bold text-[#2C2A29]">{avgRating}</span>
                            <div>
                                <StarRating value={Math.round(avgRating)} size="md" />
                                <p className="text-xs text-gray-400 mt-0.5">{totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 mb-4">No reviews yet. Be the first to share your experience!</p>
                    )}
                </div>

                {/* Right: Distribution bars */}
                {totalReviews > 0 && (
                    <div className="md:w-2/3 space-y-1.5">
                        {distribution.map((d) => (
                            <div key={d.star} className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 w-16 text-right">{d.star} star{d.star !== 1 ? 's' : ''}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-[#CBA153] h-full rounded-full transition-all duration-500"
                                        style={{ width: `${d.percentage}%` }}
                                    />
                                </div>
                                <span className="text-xs text-gray-400 w-8">{d.count}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Review List */}
            {reviews.length > 0 && (
                <div className="space-y-4 mb-8">
                    {reviews.slice(0, visibleCount).map((review) => (
                        <ReviewCard
                            key={review.id}
                            review={review}
                            onReply={handleReply}
                            isLoggedIn={isLoggedIn}
                        />
                    ))}

                    {visibleCount < reviews.length && (
                        <button
                            onClick={() => setVisibleCount(prev => prev + REVIEWS_PER_PAGE)}
                            className="w-full py-3 border border-gray-200 rounded-lg text-sm text-gray-500 hover:text-[#CBA153] hover:border-[#CBA153] transition-colors"
                        >
                            Show More Reviews ({reviews.length - visibleCount} remaining)
                        </button>
                    )}
                </div>
            )}

            {/* Review Form */}
            <ReviewForm
                productId={productId}
                hasExistingReview={hasExistingReview}
                isLoggedIn={isLoggedIn}
                onSubmit={submitReview}
            />
        </section>
    );
}
