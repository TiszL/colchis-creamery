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
        <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#CBA153]/10 flex items-center justify-center shrink-0">
                        <span className="text-[#A6812F] font-bold text-sm">{displayName[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                        <p className="font-medium text-[#2C2A29] text-sm">{displayName}</p>
                        <p className="text-xs text-gray-400">{date}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isOwn && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#CBA153]/10 text-[#A6812F] text-[10px] font-bold uppercase tracking-wider">
                            Your Review
                        </span>
                    )}
                    {review.isVerifiedPurchase ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verified Purchase
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 text-xs font-medium">
                            <MessageCircle className="w-3.5 h-3.5" />
                            Community Review
                        </span>
                    )}
                    {isOwn && onDelete && (
                        <button
                            onClick={onDelete}
                            disabled={deleting}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 ml-1"
                            title="Delete your review"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Rating & Title */}
            <div className="flex items-center gap-3 mb-2">
                <StarRating value={review.rating} size="sm" />
                <h4 className="font-serif text-lg text-[#2C2A29]">{review.title}</h4>
            </div>

            {/* Body */}
            <p className="text-gray-600 leading-relaxed text-sm mb-4">{review.body}</p>

            {/* Photos */}
            {review.photos.length > 0 && (
                <div className="flex gap-2 mb-4">
                    {review.photos.map((photo) => (
                        <button
                            key={photo.id}
                            onClick={() => setLightboxUrl(photo.imageUrl)}
                            className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:border-[#CBA153] transition-colors"
                        >
                            <Image src={photo.imageUrl} alt="Review photo" fill sizes="80px" className="object-cover" />
                        </button>
                    ))}
                </div>
            )}

            {/* Replies toggle */}
            {(review.replies.length > 0 || isLoggedIn) && (
                <div className="border-t border-gray-100 pt-3 mt-3">
                    <button
                        onClick={() => setShowReplies(!showReplies)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#A6812F] transition-colors"
                    >
                        {showReplies ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {review.replies.length > 0 ? `${review.replies.length} ${review.replies.length === 1 ? 'Reply' : 'Replies'}` : 'Reply'}
                    </button>

                    {showReplies && (
                        <div className="mt-3 space-y-3">
                            {review.replies.map((reply) => (
                                <div key={reply.id} className={`pl-4 border-l-2 ${reply.isAdminReply ? 'border-[#CBA153]' : 'border-gray-200'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-xs font-medium text-[#2C2A29]">
                                            {reply.isAdminReply ? 'Colchis Creamery' : (reply.user.name?.split(' ')[0] || 'User')}
                                        </p>
                                        {reply.isAdminReply && (
                                            <span className="text-[9px] uppercase tracking-wider font-bold text-[#A6812F] bg-[#CBA153]/10 px-1.5 py-0.5 rounded">Official</span>
                                        )}
                                        <span className="text-[10px] text-gray-400">
                                            {new Date(reply.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600">{reply.body}</p>
                                </div>
                            ))}

                            {/* Reply form */}
                            {isLoggedIn && (
                                <div className="flex gap-2 mt-2">
                                    <input
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="Write a reply..."
                                        maxLength={1000}
                                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#CBA153] text-[#2C2A29]"
                                    />
                                    <button
                                        onClick={handleReply}
                                        disabled={replyLoading || !replyText.trim()}
                                        className="px-4 py-2 bg-[#CBA153] text-white text-xs font-bold rounded-lg hover:bg-[#B5922E] transition-colors disabled:opacity-50"
                                    >
                                        {replyLoading ? '...' : 'Reply'}
                                    </button>
                                </div>
                            )}
                            {replyError && <p className="text-xs text-red-500 mt-1">{replyError}</p>}
                        </div>
                    )}
                </div>
            )}

            {/* Lightbox */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setLightboxUrl(null)}
                >
                    <div className="relative max-w-3xl max-h-[90vh] w-full">
                        <Image src={lightboxUrl} alt="Review photo" width={1200} height={900} className="object-contain w-full h-full rounded-lg" />
                    </div>
                </div>
            )}
        </div>
    );
}
