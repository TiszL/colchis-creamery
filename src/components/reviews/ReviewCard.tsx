'use client';

import { useState } from 'react';
import Image from 'next/image';
import StarRating from './StarRating';
import { ShieldCheck, MessageCircle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface ReviewReply {
    id: string;
    body: string;
    isAdminReply: boolean;
    createdAt: string;
    user: { name: string | null };
}

interface ReviewPhoto {
    id: string;
    imageUrl: string;
}

interface ReviewData {
    id: string;
    rating: number;
    title: string;
    body: string;
    isVerifiedPurchase: boolean;
    createdAt: string;
    user: { name: string | null };
    photos: ReviewPhoto[];
    replies: ReviewReply[];
}

interface ReviewCardProps {
    review: ReviewData;
    onReply?: (reviewId: string, body: string) => Promise<{ error?: string }>;
    isLoggedIn: boolean;
    isOwn?: boolean;
    onDelete?: () => void;
    deleting?: boolean;
}

export default function ReviewCard({ review, onReply, isLoggedIn, isOwn, onDelete, deleting }: ReviewCardProps) {
    const [showReplies, setShowReplies] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [replyLoading, setReplyLoading] = useState(false);
    const [replyError, setReplyError] = useState('');
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    const displayName = review.user.name
        ? `${review.user.name.split(' ')[0]} ${review.user.name.split(' ')[1]?.[0] || ''}.`.trim()
        : 'Anonymous';

    const date = new Date(review.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
    });

    const handleReply = async () => {
        if (!replyText.trim() || !onReply) return;
        setReplyLoading(true);
        setReplyError('');
        const result = await onReply(review.id, replyText);
        setReplyLoading(false);
        if (result?.error) {
            setReplyError(result.error);
        } else {
            setReplyText('');
        }
    };

    return (
        <div style={{ padding: "28px 0", borderBottom: "1px solid #1F302615", display: "grid", gridTemplateColumns: "44px 1fr", gap: 18 }}>
            {/* Avatar */}
            <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "#B96A3D22", border: "1px solid #B96A3D55",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-serif)", fontSize: 18, color: "#B96A3D", fontStyle: "italic"
            }}>{displayName[0]?.toUpperCase()}</div>

            <div>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: "#1F3026" }}>{displayName}</span>
                        {review.isVerifiedPurchase && (
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#B96A3D", textTransform: "uppercase", marginLeft: 10 }}>· Verified buyer</span>
                        )}
                        {isOwn && (
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#B96A3D", textTransform: "uppercase", marginLeft: 10, background: "#B96A3D18", padding: "3px 8px" }}>Your Review</span>
                        )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <StarRating value={review.rating} size="sm" />
                        {isOwn && onDelete && (
                            <button
                                onClick={onDelete}
                                disabled={deleting}
                                style={{ background: "transparent", border: "none", color: "#7A8278", cursor: "pointer", padding: 4, display: "flex", opacity: deleting ? 0.5 : 1 }}
                                title="Delete your review"
                            >
                                <Trash2 style={{ width: 14, height: 14 }} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Date */}
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginTop: 4 }}>{date}</div>

                {/* Title */}
                {review.title && (
                    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 19, color: "#1F3026", marginTop: 12, lineHeight: 1.3 }}>&ldquo;{review.title}&rdquo;</div>
                )}

                {/* Body */}
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.7, color: "#2C3D33", marginTop: 10 }}>{review.body}</p>

                {/* Photos */}
                {review.photos.length > 0 && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        {review.photos.map((photo) => (
                            <button
                                key={photo.id}
                                onClick={() => setLightboxUrl(photo.imageUrl)}
                                style={{ position: "relative", width: 72, height: 72, overflow: "hidden", border: "1px solid #1F302622", cursor: "pointer", padding: 0, background: "transparent" }}
                            >
                                <Image src={photo.imageUrl} alt="Review photo" fill sizes="72px" style={{ objectFit: "cover" }} />
                            </button>
                        ))}
                    </div>
                )}

                {/* Replies toggle */}
                {(review.replies.length > 0 || isLoggedIn) && (
                    <div style={{ borderTop: "1px solid #1F302611", paddingTop: 12, marginTop: 14 }}>
                        <button
                            onClick={() => setShowReplies(!showReplies)}
                            style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", color: "#7A8278", textTransform: "uppercase", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                        >
                            {showReplies ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                            {review.replies.length > 0 ? `${review.replies.length} ${review.replies.length === 1 ? 'Reply' : 'Replies'}` : 'Reply'}
                        </button>

                        {showReplies && (
                            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                                {review.replies.map((reply) => (
                                    <div key={reply.id} style={{ paddingLeft: 16, borderLeft: `2px solid ${reply.isAdminReply ? '#B96A3D' : '#1F302622'}` }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                            <span style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "#1F3026" }}>
                                                {reply.isAdminReply ? 'Colchis Food' : (reply.user.name?.split(' ')[0] || 'User')}
                                            </span>
                                            {reply.isAdminReply && (
                                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase", background: "#B96A3D18", padding: "2px 6px" }}>Official</span>
                                            )}
                                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#7A8278", letterSpacing: "0.16em" }}>
                                                {new Date(reply.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#2C3D33", lineHeight: 1.6, margin: 0 }}>{reply.body}</p>
                                    </div>
                                ))}

                                {/* Reply form */}
                                {isLoggedIn && (
                                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                        <input
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder="Write a reply..."
                                            maxLength={1000}
                                            style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 13, border: "1px solid #1F302622", padding: "8px 12px", color: "#1F3026", background: "#F5F0E6", outline: "none" }}
                                        />
                                        <button
                                            onClick={handleReply}
                                            disabled={replyLoading || !replyText.trim()}
                                            style={{ padding: "8px 16px", background: "#1F3026", color: "#F5F0E6", border: "none", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer", opacity: (replyLoading || !replyText.trim()) ? 0.5 : 1 }}
                                        >
                                            {replyLoading ? '...' : 'Reply'}
                                        </button>
                                    </div>
                                )}
                                {replyError && <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#A8312C", margin: 0 }}>{replyError}</p>}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightboxUrl && (
                <div
                    style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(31,48,38,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                    onClick={() => setLightboxUrl(null)}
                >
                    <div style={{ position: "relative", maxWidth: 800, maxHeight: "90vh", width: "100%" }}>
                        <Image src={lightboxUrl} alt="Review photo" width={1200} height={900} style={{ objectFit: "contain", width: "100%", height: "100%" }} />
                    </div>
                </div>
            )}
        </div>
    );
}
