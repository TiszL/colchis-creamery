'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';

interface ProductGalleryProps {
    images: string[];
    videos: string[];
    productName: string;
}

function getYouTubeId(url: string) {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

type MediaItem = { type: 'image'; url: string } | { type: 'video'; url: string; ytId?: string };

export function ProductGallery({ images, videos, productName }: ProductGalleryProps) {
    // Combine all media into a unified list
    const mediaItems: MediaItem[] = [
        ...images.map(url => ({ type: 'image' as const, url })),
        ...videos.map(url => {
            const ytId = getYouTubeId(url);
            return { type: 'video' as const, url, ytId: ytId || undefined };
        }),
    ];

    const [activeIndex, setActiveIndex] = useState(0);
    const activeItem = mediaItems[activeIndex] || mediaItems[0];

    if (mediaItems.length === 0) {
        return (
            <div className="aspect-square relative bg-cream rounded-lg overflow-hidden border border-border-light shadow-sm flex items-center justify-center text-charcoal/30">
                No media available
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Main display */}
            <div className="aspect-square relative bg-cream rounded-lg overflow-hidden border border-border-light shadow-sm">
                {activeItem.type === 'image' ? (
                    <img
                        src={activeItem.url}
                        alt={productName}
                        className="w-full h-full object-cover mix-blend-multiply"
                    />
                ) : activeItem.ytId ? (
                    <iframe
                        src={`https://www.youtube.com/embed/${activeItem.ytId}?autoplay=0`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={`${productName} video`}
                    />
                ) : (
                    <video
                        src={activeItem.url}
                        controls
                        className="w-full h-full object-cover"
                    />
                )}
            </div>

            {/* Thumbnail strip — only show if more than 1 media item */}
            {mediaItems.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {mediaItems.map((item, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveIndex(idx)}
                            className={`relative w-16 h-16 rounded-md overflow-hidden border-2 flex-shrink-0 transition-all ${
                                idx === activeIndex
                                    ? 'border-gold shadow-md'
                                    : 'border-transparent opacity-60 hover:opacity-100'
                            }`}
                        >
                            {item.type === 'image' ? (
                                <img src={item.url} alt={`${productName} ${idx + 1}`} className="w-full h-full object-cover" />
                            ) : item.ytId ? (
                                <div className="relative w-full h-full">
                                    <img
                                        src={`https://img.youtube.com/vi/${item.ytId}/default.jpg`}
                                        alt={`Video ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                        <Play className="w-4 h-4 text-white" fill="white" />
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-full bg-charcoal/10 flex items-center justify-center">
                                    <Play className="w-4 h-4 text-charcoal/50" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
