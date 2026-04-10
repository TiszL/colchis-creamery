'use client';

import { useState } from 'react';
import { Plus, X, Image as ImageIcon, Film } from 'lucide-react';

interface ProductMediaInputsProps {
    initialImages: string[];
    initialVideos: string[];
}

export function ProductMediaInputs({ initialImages, initialVideos }: ProductMediaInputsProps) {
    const [images, setImages] = useState<string[]>(initialImages.length > 0 ? initialImages : []);
    const [videos, setVideos] = useState<string[]>(initialVideos.length > 0 ? initialVideos : []);

    const addImage = () => setImages(prev => [...prev, '']);
    const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));
    const updateImage = (idx: number, val: string) => setImages(prev => prev.map((v, i) => i === idx ? val : v));

    const addVideo = () => setVideos(prev => [...prev, '']);
    const removeVideo = (idx: number) => setVideos(prev => prev.filter((_, i) => i !== idx));
    const updateVideo = (idx: number, val: string) => setVideos(prev => prev.map((v, i) => i === idx ? val : v));

    // Helper to extract YouTube video ID
    const getYouTubeId = (url: string) => {
        const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
    };

    return (
        <div className="space-y-6 border-t border-white/5 pt-6">

            {/* Additional Images */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <ImageIcon className="w-3.5 h-3.5" /> Additional Images
                    </label>
                    <button
                        type="button"
                        onClick={addImage}
                        className="flex items-center gap-1.5 text-xs text-[#CBA153] hover:text-white transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add Image
                    </button>
                </div>
                {images.length === 0 && (
                    <p className="text-xs text-gray-600 italic">No additional images. Click &quot;Add Image&quot; to add gallery photos.</p>
                )}
                <div className="space-y-3">
                    {images.map((url, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                            {/* Thumbnail preview */}
                            {url && (
                                <div className="w-10 h-10 rounded-md overflow-hidden bg-[#2C2A29] flex-shrink-0 border border-white/10">
                                    <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                </div>
                            )}
                            <input
                                name="images[]"
                                value={url}
                                onChange={(e) => updateImage(idx, e.target.value)}
                                placeholder="https://images.unsplash.com/..."
                                className="flex-1 bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeImage(idx)}
                                className="text-red-400 hover:text-red-300 transition-colors p-1.5"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Video URLs / YouTube */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Film className="w-3.5 h-3.5" /> Videos / YouTube Links
                    </label>
                    <button
                        type="button"
                        onClick={addVideo}
                        className="flex items-center gap-1.5 text-xs text-[#CBA153] hover:text-white transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add Video
                    </button>
                </div>
                {videos.length === 0 && (
                    <p className="text-xs text-gray-600 italic">No videos. Click &quot;Add Video&quot; to add YouTube or direct video links.</p>
                )}
                <div className="space-y-3">
                    {videos.map((url, idx) => {
                        const ytId = getYouTubeId(url);
                        return (
                            <div key={idx} className="space-y-2">
                                <div className="flex items-center gap-3">
                                    {/* YouTube thumbnail preview */}
                                    {ytId && (
                                        <div className="w-10 h-10 rounded-md overflow-hidden bg-[#2C2A29] flex-shrink-0 border border-white/10">
                                            <img src={`https://img.youtube.com/vi/${ytId}/default.jpg`} alt={`Video ${idx + 1}`} className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <input
                                        name="videoUrls[]"
                                        value={url}
                                        onChange={(e) => updateVideo(idx, e.target.value)}
                                        placeholder="https://www.youtube.com/watch?v=... or https://cdn.example.com/video.mp4"
                                        className="flex-1 bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600 text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeVideo(idx)}
                                        className="text-red-400 hover:text-red-300 transition-colors p-1.5"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                {/* YouTube embed preview */}
                                {ytId && (
                                    <div className="ml-13 aspect-video max-w-xs rounded-lg overflow-hidden border border-white/10">
                                        <iframe
                                            src={`https://www.youtube.com/embed/${ytId}`}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
