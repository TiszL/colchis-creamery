'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Check, ImageIcon, Film, Loader2, AlertCircle, Info } from 'lucide-react';
import ImageCropper from './ImageCropper';

interface UploadResult {
    url: string;
    thumbUrl?: string;
    originalSize: string;
    optimizedSize?: string;
    thumbSize?: string;
    savings?: string;
    format: string;
}

interface MediaUploadZoneProps {
    /** Current URLs */
    value: string[];
    /** Callback when URLs change */
    onChange: (urls: string[]) => void;
    /** 'image' or 'video' */
    type: 'image' | 'video';
    /** Label displayed above the zone */
    label: string;
    /** Allow multiple files */
    multiple?: boolean;
    /** Max number of files allowed */
    maxFiles?: number;
    /** Aspect ratio for image cropping */
    aspectRatio?: '1:1' | '16:9' | 'free';
    /** Show thumbnails as landscape (16:9) instead of square */
    landscapeThumbs?: boolean;
}

export default function MediaUploadZone({
    value,
    onChange,
    type,
    label,
    multiple = true,
    maxFiles = 10,
    aspectRatio = '1:1',
    landscapeThumbs = false,
}: MediaUploadZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadStats, setUploadStats] = useState<UploadResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [manualUrl, setManualUrl] = useState('');
    const [showManual, setShowManual] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Cropper state
    const [cropFile, setCropFile] = useState<File | null>(null);
    const [cropQueue, setCropQueue] = useState<File[]>([]);

    const acceptTypes = type === 'image'
        ? 'image/jpeg,image/png,image/webp,image/avif,image/gif'
        : 'video/mp4,video/webm,video/quicktime';

    const uploadBlob = useCallback(async (blob: Blob, filename: string) => {
        setError(null);
        setUploadStats(null);
        setUploading(true);

        try {
            const formData = new FormData();
            formData.set('file', blob, filename);
            formData.set('type', type === 'image' ? 'product' : 'video');

            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            setUploadStats(data);
            onChange([...value, data.url]);
        } catch (err: any) {
            setError(err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    }, [type, value, onChange]);

    const handleFiles = useCallback((files: FileList | File[]) => {
        const fileArray = Array.from(files);
        const remaining = maxFiles - value.length;
        const toProcess = fileArray.slice(0, remaining);

        if (toProcess.length === 0) return;

        if (type === 'image') {
            // For images: open cropper for each file
            setCropQueue(toProcess.slice(1)); // queue the rest
            setCropFile(toProcess[0]); // open cropper for the first one
        } else {
            // For videos: upload directly (no cropping)
            toProcess.forEach(file => uploadBlob(file, file.name));
        }
    }, [maxFiles, value.length, type, uploadBlob]);

    const handleCroppedImage = useCallback((blob: Blob) => {
        const filename = cropFile?.name || 'cropped.png';
        uploadBlob(blob, filename);
        setCropFile(null);

        // Process next in queue
        if (cropQueue.length > 0) {
            const next = cropQueue[0];
            setCropQueue(prev => prev.slice(1));
            setTimeout(() => setCropFile(next), 300);
        }
    }, [cropFile, cropQueue, uploadBlob]);

    const handleCropCancel = useCallback(() => {
        setCropFile(null);
        setCropQueue([]);
    }, []);

    // Drag and drop handlers
    const onDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles]);

    const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
            e.target.value = '';
        }
    }, [handleFiles]);

    const removeUrl = (idx: number) => {
        onChange(value.filter((_, i) => i !== idx));
    };

    const addManualUrl = () => {
        if (manualUrl.trim()) {
            onChange([...value, manualUrl.trim()]);
            setManualUrl('');
            setShowManual(false);
        }
    };

    const ratioHint = aspectRatio === '16:9' ? 'Auto-cropped to 16:9 landscape · Converted to WebP'
        : aspectRatio === '1:1' ? 'Auto-cropped to square 1:1 · Converted to WebP'
        : 'Free crop · Converted to WebP';

    const thumbAspect = landscapeThumbs ? 'aspect-video' : 'aspect-square';
    const gridCols = landscapeThumbs ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-4';

    return (
        <>
            {/* Image Cropper Modal */}
            {cropFile && (
                <ImageCropper
                    file={cropFile}
                    onCrop={handleCroppedImage}
                    onCancel={handleCropCancel}
                    aspectRatio={aspectRatio}
                />
            )}

            <div className="space-y-3">
                {/* Label + Count */}
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        {type === 'image' ? <ImageIcon className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                        {label}
                        {value.length > 0 && (
                            <span className="text-[#CBA153] ml-1">({value.length})</span>
                        )}
                    </label>
                    <button
                        type="button"
                        onClick={() => setShowManual(!showManual)}
                        className="text-[10px] text-gray-500 hover:text-[#CBA153] transition-colors"
                    >
                        {showManual ? 'Hide URL input' : '+ Paste URL'}
                    </button>
                </div>

                {/* Drop Zone */}
                <div
                    onDragEnter={onDragEnter}
                    onDragLeave={onDragLeave}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    onClick={() => !uploading && inputRef.current?.click()}
                    className={`
                        relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200
                        ${isDragging
                            ? 'border-[#CBA153] bg-[#CBA153]/10 scale-[1.01]'
                            : 'border-white/10 hover:border-[#CBA153]/40 hover:bg-white/[0.02]'
                        }
                        ${uploading ? 'pointer-events-none opacity-60' : ''}
                    `}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept={acceptTypes}
                        multiple={multiple}
                        onChange={onFileChange}
                        className="hidden"
                    />

                    {uploading ? (
                        <div className="flex flex-col items-center gap-2 py-2">
                            <Loader2 className="w-6 h-6 text-[#CBA153] animate-spin" />
                            <span className="text-xs text-gray-400">Optimizing & uploading...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 py-1">
                            <Upload className={`w-6 h-6 ${isDragging ? 'text-[#CBA153]' : 'text-gray-600'} transition-colors`} />
                            <div className="text-xs text-gray-400">
                                <span className="text-[#CBA153] font-medium">Click to browse</span> or drag & drop
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-gray-600">
                                <Info className="w-3 h-3 flex-shrink-0" />
                                {type === 'image' ? ratioHint : 'MP4/WebM up to 100MB · Or paste a YouTube URL below'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Upload Stats Toast */}
                {uploadStats && uploadStats.savings && (
                    <div className="flex items-center gap-2 text-[10px] text-emerald-400 bg-emerald-900/20 px-3 py-1.5 rounded-lg">
                        <Check className="w-3 h-3 flex-shrink-0" />
                        <span>
                            Optimized: {uploadStats.originalSize} → {uploadStats.optimizedSize} ({uploadStats.savings} saved)
                            {uploadStats.thumbSize && <span className="text-emerald-600"> · Thumb: {uploadStats.thumbSize}</span>}
                        </span>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 text-[10px] text-red-400 bg-red-900/20 px-3 py-1.5 rounded-lg">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* Manual URL input */}
                {showManual && (
                    <div className="flex gap-2">
                        <input
                            value={manualUrl}
                            onChange={e => setManualUrl(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addManualUrl())}
                            placeholder={type === 'image' ? 'https://images.example.com/...' : 'https://youtube.com/watch?v=...'}
                            className="flex-1 bg-[#0D0D0D] border border-white/10 text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-xs"
                        />
                        <button
                            type="button"
                            onClick={addManualUrl}
                            className="px-3 py-2 bg-[#CBA153]/20 text-[#CBA153] rounded-lg text-xs font-bold hover:bg-[#CBA153]/30 transition-colors"
                        >
                            Add
                        </button>
                    </div>
                )}

                {/* Uploaded Gallery / Thumbnails */}
                {value.length > 0 && (
                    <div className={`grid ${gridCols} gap-2`}>
                        {value.map((url, idx) => (
                            <div key={idx} className="relative group">
                                {type === 'image' ? (
                                    <div className={`${thumbAspect} rounded-lg overflow-hidden bg-[#0D0D0D] border border-white/10 group-hover:border-[#CBA153]/40 transition-colors`}>
                                        <img
                                            src={url}
                                            alt={`Gallery ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                            onError={e => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="aspect-square rounded-lg overflow-hidden bg-[#0D0D0D] border border-white/10 flex items-center justify-center group-hover:border-[#CBA153]/40 transition-colors">
                                        {url.includes('youtube.com') || url.includes('youtu.be') ? (
                                            <div className="relative w-full h-full">
                                                <img
                                                    src={`https://img.youtube.com/vi/${extractYouTubeId(url)}/mqdefault.jpg`}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                                    <Film className="w-4 h-4 text-white" />
                                                </div>
                                            </div>
                                        ) : (
                                            <Film className="w-5 h-5 text-gray-600" />
                                        )}
                                    </div>
                                )}
                                {/* Remove button */}
                                <button
                                    type="button"
                                    onClick={() => removeUrl(idx)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                                {/* Index badge */}
                                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                                    {idx + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

function extractYouTubeId(url: string): string {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : '';
}
