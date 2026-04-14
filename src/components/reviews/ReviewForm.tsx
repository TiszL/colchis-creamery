'use client';

import { useState, useRef } from 'react';
import StarRating from './StarRating';
import { Camera, X, Loader2 } from 'lucide-react';

interface ReviewFormProps {
    productId: string;
    hasExistingReview: boolean;
    isLoggedIn: boolean;
    onSubmit: (formData: FormData) => Promise<{ error?: string; success?: boolean; message?: string }>;
}

export default function ReviewForm({ productId, hasExistingReview, isLoggedIn, onSubmit }: ReviewFormProps) {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isLoggedIn) {
        return (
            <div className="bg-white rounded-lg border border-gray-100 p-8 text-center shadow-sm">
                <p className="text-gray-500 mb-3">Sign in to share your experience with this product</p>
                <a href="/login" className="inline-block px-6 py-2.5 bg-[#CBA153] text-white font-bold text-sm rounded-lg hover:bg-[#b88e44] transition-colors tracking-wider uppercase">
                    Sign In
                </a>
            </div>
        );
    }

    if (hasExistingReview) {
        return (
            <div className="bg-[#CBA153]/5 rounded-lg border border-[#CBA153]/20 p-6 text-center">
                <p className="text-[#2C2A29] font-medium">You have already reviewed this product.</p>
                <p className="text-sm text-gray-500 mt-1">You can add a reply to your review above.</p>
            </div>
        );
    }

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const remaining = 3 - photos.length;
        const toUpload = Array.from(files).slice(0, remaining);

        setUploading(true);
        setError('');

        for (const file of toUpload) {
            if (file.size > 5 * 1024 * 1024) {
                setError('Each photo must be under 5MB.');
                continue;
            }

            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch('/api/upload/review-photo', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.error) {
                    setError(data.error);
                } else {
                    setPhotos(prev => [...prev, data.url]);
                }
            } catch {
                setError('Failed to upload photo.');
            }
        }

        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removePhoto = (idx: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (rating === 0) { setError('Please select a rating.'); return; }
        if (title.length < 5) { setError('Title must be at least 5 characters.'); return; }
        if (body.length < 10) { setError('Review must be at least 10 characters.'); return; }

        setSubmitting(true);
        const formData = new FormData();
        formData.append('productId', productId);
        formData.append('rating', rating.toString());
        formData.append('title', title);
        formData.append('body', body);
        formData.append('photoUrls', photos.join(','));

        const result = await onSubmit(formData);
        setSubmitting(false);

        if (result?.error) {
            setError(result.error);
        } else {
            setSuccess(result?.message || 'Review submitted!');
            setRating(0);
            setTitle('');
            setBody('');
            setPhotos([]);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm space-y-5">
            <h3 className="font-serif text-xl text-[#2C2A29]">Write a Review</h3>

            {/* Star selector */}
            <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Your Rating</label>
                <StarRating
                    value={rating}
                    size="lg"
                    interactive
                    onChange={setRating}
                    hoverValue={hoverRating}
                    onHover={setHoverRating}
                />
            </div>

            {/* Title */}
            <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Title</label>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Sum up your experience..."
                    maxLength={100}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-[#2C2A29] focus:outline-none focus:border-[#CBA153] transition-colors"
                />
                <p className="text-[10px] text-gray-400 mt-1 text-right">{title.length}/100</p>
            </div>

            {/* Body */}
            <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Your Review</label>
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="What did you like or dislike? How did you use the product?"
                    maxLength={2000}
                    rows={4}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-[#2C2A29] focus:outline-none focus:border-[#CBA153] transition-colors resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-1 text-right">{body.length}/2000</p>
            </div>

            {/* Photos */}
            <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Photos (optional, max 3)</label>
                <div className="flex flex-wrap gap-3 items-center">
                    {photos.map((url, idx) => (
                        <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => removePhoto(idx)}
                                className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="w-3 h-3 text-white" />
                            </button>
                        </div>
                    ))}
                    {photos.length < 3 && (
                        <label className={`w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-[#CBA153] transition-colors ${uploading ? 'opacity-50' : ''}`}>
                            {uploading ? (
                                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                            ) : (
                                <>
                                    <Camera className="w-5 h-5 text-gray-400" />
                                    <span className="text-[9px] text-gray-400 mt-1">Add</span>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                onChange={handlePhotoUpload}
                                className="hidden"
                                disabled={uploading}
                            />
                        </label>
                    )}
                </div>
            </div>

            {/* Error / Success */}
            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-2">{error}</p>}
            {success && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2">{success}</p>}

            {/* Submit */}
            <button
                type="submit"
                disabled={submitting || rating === 0}
                className="w-full py-3.5 bg-[#CBA153] text-white font-bold text-sm rounded-lg hover:bg-[#b88e44] transition-colors tracking-wider uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {submitting ? 'Submitting...' : 'Submit Review'}
            </button>

            <p className="text-[10px] text-gray-400 text-center">
                Your review will be visible after moderation approval. Links are not allowed.
            </p>
        </form>
    );
}
