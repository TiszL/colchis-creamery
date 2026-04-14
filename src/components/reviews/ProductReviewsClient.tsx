'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StarRating from './StarRating';
import ReviewCard from './ReviewCard';
import ReviewForm from './ReviewForm';
import { submitReview, submitReply, deleteOwnReview } from '@/app/actions/reviews';
import { Trash2, Clock, XCircle } from 'lucide-react';

interface ReviewData {
    id: string;
    rating: number;
    title: string;
    body: string;
    isVerifiedPurchase: boolean;
    isOwn?: boolean;
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

interface OwnPendingReview {
    id: string;
    rating: number;
    title: string;
    body: string;
    status: string;
    createdAt: string;
}

interface Props {
    productId: string;
    reviews: ReviewData[];
    totalReviews: number;
    avgRating: number;
    distribution: { star: number; count: number; percentage: number }[];
    hasExistingReview: boolean;
    isLoggedIn: boolean;
    ownPendingReview?: OwnPendingReview | null;
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
    ownPendingReview,
}: Props) {
    const [visibleCount, setVisibleCount] = useState(REVIEWS_PER_PAGE);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const router = useRouter();

    const handleReply = async (reviewId: string, body: string) => {
        const formData = new FormData();
        formData.append('reviewId', reviewId);
        formData.append('body', body);
        return submitReply(formData);
    };

    const handleDeleteOwn = async (reviewId: string) => {
        if (!confirm('Are you sure you want to delete your review? This cannot be undone.')) return;
        setDeleting(true);
        setDeleteError('');
        try {
            const result = await deleteOwnReview(reviewId);
            if (result?.error) {
                setDeleteError(result.error);
            } else {
                router.refresh();
            }
        } catch {
            setDeleteError('Failed to delete review.');
        }
        setDeleting(false);
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

            {/* User's own pending/rejected review */}
            {ownPendingReview && (
                <div className={`mb-8 rounded-lg border p-6 ${ownPendingReview.status === 'REJECTED' ? 'bg-red-50/50 border-red-200' : 'bg-amber-50/50 border-amber-200'}`}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            {ownPendingReview.status === 'PENDING' ? (
                                <Clock className="w-4 h-4 text-amber-600" />
                            ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className={`text-xs font-bold uppercase tracking-wider ${ownPendingReview.status === 'REJECTED' ? 'text-red-600' : 'text-amber-700'}`}>
                                {ownPendingReview.status === 'PENDING' ? 'Pending Approval' : 'Not Approved'}
                            </span>
                        </div>
                        <button
                            onClick={() => handleDeleteOwn(ownPendingReview.id)}
                            disabled={deleting}
                            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                    <div className="mb-2">
                        <StarRating value={ownPendingReview.rating} size="sm" />
                    </div>
                    <h4 className="font-medium text-[#2C2A29] text-sm">{ownPendingReview.title}</h4>
                    <p className="text-sm text-[#2C2A29]/70 mt-1">{ownPendingReview.body}</p>
                    <p className="text-[10px] text-gray-400 mt-3">
                        Submitted {new Date(ownPendingReview.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    {deleteError && <p className="text-xs text-red-500 mt-2">{deleteError}</p>}
                </div>
            )}

            {/* Review List */}
            {reviews.length > 0 && (
                <div className="space-y-4 mb-8">
                    {reviews.slice(0, visibleCount).map((review) => (
                        <ReviewCard
                            key={review.id}
                            review={review}
                            onReply={handleReply}
                            isLoggedIn={isLoggedIn}
                            isOwn={review.isOwn}
                            onDelete={review.isOwn ? () => handleDeleteOwn(review.id) : undefined}
                            deleting={deleting}
                        />
                    ))}

                    {visibleCount < reviews.length && (
                        <button
                            onClick={() => setVisibleCount(prev => prev + REVIEWS_PER_PAGE)}
                            className="w-full py-3 border border-gray-200 rounded-lg text-sm text-gray-500 hover:text-[#A6812F] hover:border-[#A6812F] transition-colors"
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
