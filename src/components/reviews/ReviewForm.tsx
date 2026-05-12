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
            <div style={{ background: "#EAE2D2", border: "1px solid #1F302614", padding: 32, textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 16, color: "#2C3D33", margin: "0 0 14px" }}>Sign in to share your experience with this product</p>
                <a href="/login" style={{ display: "inline-block", padding: "12px 24px", background: "#1F3026", color: "#F5F0E6", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>
                    Sign In
                </a>
            </div>
        );
    }

    if (hasExistingReview) {
        return (
            <div style={{ background: "#B96A3D08", border: "1px solid #B96A3D22", padding: 24, textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "#1F3026", margin: 0 }}>You have already reviewed this product.</p>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#7A8278", marginTop: 6 }}>You can add a reply to your review above.</p>
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

        try {
            const result = await onSubmit(formData);
            setSubmitting(false);

            if (result?.error) {
                setError(result.error);
            } else if (result?.success) {
                setSuccess(result?.message || 'Review submitted!');
                setRating(0);
                setTitle('');
                setBody('');
                setPhotos([]);
            } else {
                setError('Unexpected response. Please try again.');
            }
        } catch (err: unknown) {
            setSubmitting(false);
            console.error('Review submission error:', err);
            setError(err instanceof Error ? err.message : 'Failed to submit review. Please try again.');
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ background: "#EAE2D2", border: "1px solid #1F302614", padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "#1F3026", margin: 0, fontWeight: 400 }}>Write a Review</h3>

            {/* Star selector */}
            <div>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Your Rating</label>
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
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Title</label>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Sum up your experience..."
                    maxLength={100}
                    style={{ width: "100%", border: "1px solid #1F302622", padding: "10px 14px", fontFamily: "var(--font-sans)", fontSize: 14, color: "#1F3026", background: "#F5F0E6", outline: "none" }}
                />
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#7A8278", textAlign: "right", marginTop: 4, letterSpacing: "0.16em" }}>{title.length}/100</p>
            </div>

            {/* Body */}
            <div>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Your Review</label>
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="What did you like or dislike? How did you use the product?"
                    maxLength={2000}
                    rows={4}
                    style={{ width: "100%", border: "1px solid #1F302622", padding: "10px 14px", fontFamily: "var(--font-sans)", fontSize: 14, color: "#1F3026", background: "#F5F0E6", outline: "none", resize: "none" }}
                />
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#7A8278", textAlign: "right", marginTop: 4, letterSpacing: "0.16em" }}>{body.length}/2000</p>
            </div>

            {/* Photos */}
            <div>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Photos (optional, max 3)</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    {photos.map((url, idx) => (
                        <div key={idx} style={{ position: "relative", width: 72, height: 72, overflow: "hidden", border: "1px solid #1F302622" }}>
                            <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            <button
                                type="button"
                                onClick={() => removePhoto(idx)}
                                style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, background: "rgba(31,48,38,0.7)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                            >
                                <X style={{ width: 12, height: 12, color: "#F5F0E6" }} />
                            </button>
                        </div>
                    ))}
                    {photos.length < 3 && (
                        <label style={{ width: 72, height: 72, border: "2px dashed #1F302633", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: uploading ? 0.5 : 1 }}>
                            {uploading ? (
                                <Loader2 style={{ width: 18, height: 18, color: "#7A8278", animation: "spin 1s linear infinite" }} />
                            ) : (
                                <>
                                    <Camera style={{ width: 18, height: 18, color: "#7A8278" }} />
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#7A8278", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.16em" }}>Add</span>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                onChange={handlePhotoUpload}
                                style={{ display: "none" }}
                                disabled={uploading}
                            />
                        </label>
                    )}
                </div>
            </div>

            {/* Error / Success */}
            {error && <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#A8312C", background: "#A8312C11", padding: "10px 14px", border: "1px solid #A8312C33", margin: 0 }}>{error}</p>}
            {success && <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#2C3D33", background: "#B96A3D11", padding: "10px 14px", border: "1px solid #B96A3D33", margin: 0 }}>{success}</p>}

            {/* Submit */}
            <button
                type="submit"
                disabled={submitting || rating === 0}
                style={{ width: "100%", padding: "14px 0", background: "#1F3026", color: "#F5F0E6", border: "none", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer", opacity: (submitting || rating === 0) ? 0.5 : 1 }}
            >
                {submitting ? 'Submitting...' : 'Submit Review'}
            </button>

            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#7A8278", textAlign: "center", letterSpacing: "0.16em", textTransform: "uppercase", margin: 0 }}>
                Your review will be visible after moderation approval
            </p>
        </form>
    );
}
