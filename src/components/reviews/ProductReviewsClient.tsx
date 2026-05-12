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
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const router = useRouter();

    const handleReply = async (reviewId: string, body: string) => {
        const formData = new FormData();
        formData.append('reviewId', reviewId);
        formData.append('body', body);
        return submitReply(formData);
    };

    const requestDelete = (reviewId: string) => {
        setDeleteTarget(reviewId);
        setDeleteError('');
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        setDeleteError('');
        try {
            const result = await deleteOwnReview(deleteTarget);
            if (result?.error) {
                setDeleteError(result.error);
            } else {
                setDeleteTarget(null);
                router.refresh();
            }
        } catch {
            setDeleteError('Failed to delete review.');
        }
        setDeleting(false);
    };

    return (
        <div id="reviews">
            {/* Delete Confirmation Dialog */}
            {deleteTarget && (
                <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => !deleting && setDeleteTarget(null)}>
                    <div style={{ position: "absolute", inset: 0, background: "rgba(31,48,38,0.6)", backdropFilter: "blur(4px)" }} />
                    <div
                        style={{ position: "relative", background: "#FFFFFF", maxWidth: 380, width: "100%", padding: 28, border: "1px solid #1F302622" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                            <div style={{ width: 40, height: 40, background: "#A8312C11", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Trash2 style={{ width: 18, height: 18, color: "#A8312C" }} />
                            </div>
                            <div>
                                <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "#1F3026", margin: 0 }}>Delete Review</h3>
                                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", margin: 0 }}>This action cannot be undone</p>
                            </div>
                        </div>
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "#2C3D33", marginBottom: 20 }}>
                            Are you sure you want to delete your review? It will be permanently removed.
                        </p>
                        {deleteError && <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#A8312C", marginBottom: 12 }}>{deleteError}</p>}
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ flex: 1, padding: "10px 16px", border: "1px solid #1F302622", background: "transparent", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", cursor: "pointer", opacity: deleting ? 0.5 : 1 }}>Cancel</button>
                            <button onClick={confirmDelete} disabled={deleting} style={{ flex: 1, padding: "10px 16px", background: "#A8312C", color: "#F5F0E6", border: "none", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer", opacity: deleting ? 0.5 : 1 }}>{deleting ? 'Deleting...' : 'Delete Review'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Aggregate + Distribution */}
            <div className="ch-pdp-reviews-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2.2fr", gap: 48, alignItems: "flex-start" }}>
                {/* Aggregate */}
                <div style={{ padding: 32, background: "#EAE2D2", border: "1px solid #1F302622" }}>
                    {totalReviews > 0 ? (
                        <>
                            <div style={{ fontFamily: "var(--font-serif)", fontSize: 72, fontWeight: 300, lineHeight: 1, color: "#1F3026" }}>{avgRating}</div>
                            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                                <StarRating value={Math.round(avgRating)} size="md" />
                            </div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginTop: 6 }}>{totalReviews} reviews</div>
                            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
                                {distribution.map(d => (
                                    <div key={d.star} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 10, color: "#7A8278" }}>
                                        <span style={{ width: 20 }}>{d.star}★</span>
                                        <div style={{ flex: 1, height: 4, background: "#1F302615", overflow: "hidden", borderRadius: 2 }}>
                                            <div style={{ height: "100%", width: `${d.percentage}%`, background: "#B96A3D", transition: "width 400ms" }} />
                                        </div>
                                        <span style={{ width: 20, textAlign: "right" }}>{d.count}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 16, color: "#7A8278" }}>No reviews yet. Be the first to share your experience!</p>
                    )}
                </div>

                {/* Review list */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                    {/* User's own pending/rejected review */}
                    {ownPendingReview && (
                        <div style={{ marginBottom: 20, padding: 20, background: ownPendingReview.status === 'REJECTED' ? '#A8312C08' : '#D9A87611', border: `1px solid ${ownPendingReview.status === 'REJECTED' ? '#A8312C33' : '#D9A87644'}` }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {(ownPendingReview.status === 'PENDING' || ownPendingReview.status === 'FLAGGED') ? (
                                        <Clock style={{ width: 14, height: 14, color: "#B96A3D" }} />
                                    ) : (
                                        <XCircle style={{ width: 14, height: 14, color: "#A8312C" }} />
                                    )}
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: ownPendingReview.status === 'REJECTED' ? '#A8312C' : '#B96A3D', fontWeight: 500 }}>
                                        {(ownPendingReview.status === 'PENDING' || ownPendingReview.status === 'FLAGGED') ? 'Pending Approval' : 'Not Approved'}
                                    </span>
                                </div>
                                <button onClick={() => requestDelete(ownPendingReview.id)} disabled={deleting} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 9, color: "#7A8278", background: "transparent", border: "none", cursor: "pointer", letterSpacing: "0.16em", textTransform: "uppercase", opacity: deleting ? 0.5 : 1 }}>
                                    <Trash2 style={{ width: 12, height: 12 }} /> Delete
                                </button>
                            </div>
                            <StarRating value={ownPendingReview.rating} size="sm" />
                            <h4 style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 16, color: "#1F3026", marginTop: 8 }}>{ownPendingReview.title}</h4>
                            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#2C3D33", marginTop: 4 }}>{ownPendingReview.body}</p>
                            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#7A8278", letterSpacing: "0.22em", textTransform: "uppercase", marginTop: 10 }}>
                                Submitted {new Date(ownPendingReview.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                    )}

                    {reviews.length > 0 && (
                        <>
                            {reviews.slice(0, visibleCount).map((review) => (
                                <ReviewCard
                                    key={review.id}
                                    review={review}
                                    onReply={handleReply}
                                    isLoggedIn={isLoggedIn}
                                    isOwn={review.isOwn}
                                    onDelete={review.isOwn ? () => requestDelete(review.id) : undefined}
                                    deleting={deleting}
                                />
                            ))}

                            {visibleCount < reviews.length && (
                                <button
                                    onClick={() => setVisibleCount(prev => prev + REVIEWS_PER_PAGE)}
                                    style={{ width: "100%", padding: "14px 0", border: "1px solid #1F302622", background: "transparent", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", cursor: "pointer", marginTop: 8, transition: "color 200ms, border-color 200ms" }}
                                >
                                    Show More Reviews ({reviews.length - visibleCount} remaining)
                                </button>
                            )}
                        </>
                    )}

                    {/* Review Form */}
                    <div style={{ marginTop: 28 }}>
                        <ReviewForm
                            productId={productId}
                            hasExistingReview={hasExistingReview}
                            isLoggedIn={isLoggedIn}
                            onSubmit={submitReview}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
