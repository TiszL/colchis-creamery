'use client';

import { useState, useTransition } from 'react';
import { moderateReview, deleteReview, submitReply } from '@/app/actions/reviews';
import { Star, ShieldCheck, MessageCircle, Check, X, Trash2, Eye, ChevronDown, ChevronUp, Image as ImageIcon, Send } from 'lucide-react';

interface ReviewPhoto {
    id: string;
    imageUrl: string;
}

interface ReviewReply {
    id: string;
    body: string;
    isAdminReply: boolean;
    createdAt: string;
    user: { name: string | null };
}

interface ReviewItem {
    id: string;
    rating: number;
    title: string;
    body: string;
    status: string;
    isVerifiedPurchase: boolean;
    adminNote: string | null;
    createdAt: string;
    user: { name: string | null; email: string };
    product: { name: string; slug: string; imageUrl: string };
    photos: ReviewPhoto[];
    replies: ReviewReply[];
}

interface Props {
    reviews: ReviewItem[];
    pendingCount: number;
}

export default function ReviewModerationClient({ reviews: initialReviews, pendingCount }: Props) {
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
    const [reviews, setReviews] = useState(initialReviews);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isPending, startTransition] = useTransition();

    const filtered = filter === 'ALL' ? reviews : reviews.filter(r => r.status === filter);
    const counts = {
        ALL: reviews.length,
        PENDING: reviews.filter(r => r.status === 'PENDING').length,
        APPROVED: reviews.filter(r => r.status === 'APPROVED').length,
        REJECTED: reviews.filter(r => r.status === 'REJECTED').length,
    };

    const handleModerate = (reviewId: string, action: 'APPROVED' | 'REJECTED') => {
        startTransition(async () => {
            const result = await moderateReview(reviewId, action);
            if (result.success) {
                setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status: action } : r));
            }
        });
    };

    const handleDelete = (reviewId: string) => {
        if (!confirm('Delete this review permanently?')) return;
        startTransition(async () => {
            const result = await deleteReview(reviewId);
            if (result.success) {
                setReviews(prev => prev.filter(r => r.id !== reviewId));
            }
        });
    };

    const handleReply = (reviewId: string) => {
        if (!replyText.trim()) return;
        startTransition(async () => {
            const formData = new FormData();
            formData.set('reviewId', reviewId);
            formData.set('body', replyText);
            const result = await submitReply(formData);
            if (result.success) {
                // Add the reply to local state
                setReviews(prev => prev.map(r => r.id === reviewId ? {
                    ...r,
                    replies: [...r.replies, {
                        id: Date.now().toString(),
                        body: replyText,
                        isAdminReply: true,
                        createdAt: new Date().toISOString(),
                        user: { name: 'Staff' },
                    }]
                } : r));
                setReplyText('');
                setReplyingTo(null);
            }
        });
    };

    const statusColors: Record<string, string> = {
        PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        APPROVED: 'bg-green-500/10 text-green-400 border-green-500/20',
        REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
    };

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-serif text-white tracking-wide">Review Moderation</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {pendingCount > 0 ? (
                            <span className="text-amber-400">{pendingCount} review{pendingCount !== 1 ? 's' : ''} awaiting approval</span>
                        ) : (
                            'All reviews are up to date'
                        )}
                    </p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                            filter === tab
                                ? 'bg-[#CBA153] text-black'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        {tab}
                        <span className="ml-2 opacity-60">({counts[tab]})</span>
                    </button>
                ))}
            </div>

            {/* Reviews List */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                    <p className="text-lg">No {filter.toLowerCase()} reviews</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((review) => {
                        const isExpanded = expandedId === review.id;
                        const date = new Date(review.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        });

                        return (
                            <div key={review.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                                {/* Collapsed row */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : review.id)}
                                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/5 transition-colors"
                                >
                                    {/* Product thumbnail */}
                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/10 shrink-0">
                                        <img src={review.product.imageUrl} alt="" className="w-full h-full object-cover" />
                                    </div>

                                    {/* Stars */}
                                    <div className="flex gap-0.5 shrink-0">
                                        {Array.from({ length: 5 }, (_, i) => (
                                            <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'text-[#CBA153] fill-[#CBA153]' : 'text-gray-700'}`} />
                                        ))}
                                    </div>

                                    {/* Title + user */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white font-medium truncate">{review.title}</p>
                                        <p className="text-xs text-gray-500 truncate">
                                            {review.user.name || review.user.email} · {review.product.name}
                                        </p>
                                    </div>

                                    {/* Badges */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {review.isVerifiedPurchase && (
                                            <ShieldCheck className="w-4 h-4 text-green-400" />
                                        )}
                                        {review.photos.length > 0 && (
                                            <span className="flex items-center gap-1 text-xs text-gray-500">
                                                <ImageIcon className="w-3.5 h-3.5" />{review.photos.length}
                                            </span>
                                        )}
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[review.status]}`}>
                                            {review.status}
                                        </span>
                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
                                    </div>
                                </button>

                                {/* Expanded detail */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-white/5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                            {/* Left: Review content */}
                                            <div>
                                                <p className="text-sm text-gray-300 leading-relaxed mb-4">{review.body}</p>

                                                {review.photos.length > 0 && (
                                                    <div className="flex gap-2 mb-4">
                                                        {review.photos.map(p => (
                                                            <a key={p.id} href={p.imageUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                                                                <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Replies */}
                                                {review.replies.length > 0 && (
                                                    <div className="space-y-2 mb-4">
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Replies ({review.replies.length})</p>
                                                        {review.replies.map(rep => (
                                                            <div key={rep.id} className={`pl-3 border-l-2 ${rep.isAdminReply ? 'border-[#CBA153]' : 'border-white/10'}`}>
                                                                <p className="text-xs text-gray-400">
                                                                    <span className="font-medium text-gray-300">{rep.isAdminReply ? 'Admin' : rep.user.name || 'User'}</span>
                                                                    {' · '}
                                                                    {new Date(rep.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                </p>
                                                                <p className="text-sm text-gray-400">{rep.body}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right: Meta + Actions */}
                                            <div className="space-y-3">
                                                <div className="bg-white/5 rounded-lg p-4 space-y-2 text-xs">
                                                    <div className="flex justify-between"><span className="text-gray-500">User</span><span className="text-gray-300">{review.user.name || 'Anonymous'}</span></div>
                                                    <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="text-gray-300">{review.user.email}</span></div>
                                                    <div className="flex justify-between"><span className="text-gray-500">Product</span><span className="text-gray-300">{review.product.name}</span></div>
                                                    <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="text-gray-300">{date}</span></div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Verified</span>
                                                        <span className={review.isVerifiedPurchase ? 'text-green-400' : 'text-gray-600'}>
                                                            {review.isVerifiedPurchase ? 'Yes' : 'No'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Action buttons */}
                                                <div className="flex gap-2">
                                                    {review.status !== 'APPROVED' && (
                                                        <button
                                                            onClick={() => handleModerate(review.id, 'APPROVED')}
                                                            disabled={isPending}
                                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                                        >
                                                            <Check className="w-3.5 h-3.5" /> Approve
                                                        </button>
                                                    )}
                                                    {review.status !== 'REJECTED' && (
                                                        <button
                                                            onClick={() => handleModerate(review.id, 'REJECTED')}
                                                            disabled={isPending}
                                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                        >
                                                            <X className="w-3.5 h-3.5" /> Reject
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(review.id)}
                                                        disabled={isPending}
                                                        className="py-2.5 px-3 bg-white/5 text-gray-500 border border-white/10 rounded-lg hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors disabled:opacity-50"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>

                                                {/* Reply button */}
                                                <button
                                                    onClick={() => { setReplyingTo(replyingTo === review.id ? null : review.id); setReplyText(''); }}
                                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#CBA153]/10 text-[#CBA153] border border-[#CBA153]/20 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#CBA153]/20 transition-colors"
                                                >
                                                    <MessageCircle className="w-3.5 h-3.5" /> Reply to Customer
                                                </button>

                                                {/* Reply form */}
                                                {replyingTo === review.id && (
                                                    <div className="space-y-2 animate-fade-in">
                                                        <textarea
                                                            value={replyText}
                                                            onChange={(e) => setReplyText(e.target.value)}
                                                            placeholder="Write a reply as staff..."
                                                            rows={3}
                                                            className="w-full bg-[#0D0D0D] border border-white/10 text-white text-sm rounded-lg p-3 focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 resize-none placeholder:text-gray-600"
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleReply(review.id)}
                                                                disabled={isPending || !replyText.trim()}
                                                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#CBA153] text-black rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-colors disabled:opacity-50"
                                                            >
                                                                <Send className="w-3.5 h-3.5" /> Send Reply
                                                            </button>
                                                            <button
                                                                onClick={() => { setReplyingTo(null); setReplyText(''); }}
                                                                className="py-2 px-4 text-xs text-gray-500 hover:text-white transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
