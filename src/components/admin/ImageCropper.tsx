'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Check, Move, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageCropperProps {
    /** The image file to crop */
    file: File;
    /** Called with the cropped image blob */
    onCrop: (blob: Blob) => void;
    /** Called when user cancels */
    onCancel: () => void;
}

export default function ImageCropper({ file, onCrop, onCancel }: ImageCropperProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const previewRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);

    // Image display state
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgNatW, setImgNatW] = useState(0);
    const [imgNatH, setImgNatH] = useState(0);

    // Display dimensions (how the image appears on screen)
    const [dispW, setDispW] = useState(0);
    const [dispH, setDispH] = useState(0);
    const [dispX, setDispX] = useState(0);
    const [dispY, setDispY] = useState(0);

    // Crop box state (relative to displayed image area)
    const [cropX, setCropX] = useState(0);
    const [cropY, setCropY] = useState(0);
    const [cropSize, setCropSize] = useState(200);

    // Drag state
    const [dragging, setDragging] = useState(false);
    const [dragType, setDragType] = useState<'move' | 'resize' | null>(null);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartY, setDragStartY] = useState(0);
    const [startCropX, setStartCropX] = useState(0);
    const [startCropY, setStartCropY] = useState(0);
    const [startCropSize, setStartCropSize] = useState(0);

    // Load image
    useEffect(() => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            setImgNatW(img.naturalWidth);
            setImgNatH(img.naturalHeight);
            setImgLoaded(true);
        };
        img.src = url;
        return () => URL.revokeObjectURL(url);
    }, [file]);

    // Calculate display dimensions when image loads or window resizes
    useEffect(() => {
        if (!imgLoaded || !containerRef.current) return;

        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const padding = 40;
        const maxW = cw - padding * 2;
        const maxH = ch - padding * 2;

        const scale = Math.min(maxW / imgNatW, maxH / imgNatH, 1);
        const dw = Math.round(imgNatW * scale);
        const dh = Math.round(imgNatH * scale);
        const dx = Math.round((cw - dw) / 2);
        const dy = Math.round((ch - dh) / 2);

        setDispW(dw);
        setDispH(dh);
        setDispX(dx);
        setDispY(dy);

        // Initial crop: largest centered square
        const size = Math.min(dw, dh);
        setCropSize(size);
        setCropX(Math.round((dw - size) / 2));
        setCropY(Math.round((dh - size) / 2));
    }, [imgLoaded, imgNatW, imgNatH]);

    // Draw canvas
    useEffect(() => {
        if (!imgLoaded || !canvasRef.current || !imgRef.current || !containerRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        canvas.width = cw;
        canvas.height = ch;

        // Clear
        ctx.clearRect(0, 0, cw, ch);

        // Draw image
        ctx.drawImage(imgRef.current, dispX, dispY, dispW, dispH);

        // Dark overlay (outside crop)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        // Top
        ctx.fillRect(0, 0, cw, dispY + cropY);
        // Bottom
        ctx.fillRect(0, dispY + cropY + cropSize, cw, ch - (dispY + cropY + cropSize));
        // Left
        ctx.fillRect(0, dispY + cropY, dispX + cropX, cropSize);
        // Right
        ctx.fillRect(dispX + cropX + cropSize, dispY + cropY, cw - (dispX + cropX + cropSize), cropSize);

        // Crop border
        ctx.strokeStyle = '#CBA153';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(dispX + cropX, dispY + cropY, cropSize, cropSize);
        ctx.setLineDash([]);

        // Corner handles
        const handleSize = 12;
        const corners = [
            [dispX + cropX, dispY + cropY], // TL
            [dispX + cropX + cropSize, dispY + cropY], // TR
            [dispX + cropX, dispY + cropY + cropSize], // BL
            [dispX + cropX + cropSize, dispY + cropY + cropSize], // BR
        ];
        ctx.fillStyle = '#CBA153';
        corners.forEach(([cx, cy]) => {
            ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
        });

        // Grid lines (rule of thirds)
        ctx.strokeStyle = 'rgba(203, 161, 83, 0.25)';
        ctx.lineWidth = 1;
        const third = cropSize / 3;
        for (let i = 1; i < 3; i++) {
            // Vertical
            ctx.beginPath();
            ctx.moveTo(dispX + cropX + third * i, dispY + cropY);
            ctx.lineTo(dispX + cropX + third * i, dispY + cropY + cropSize);
            ctx.stroke();
            // Horizontal
            ctx.beginPath();
            ctx.moveTo(dispX + cropX, dispY + cropY + third * i);
            ctx.lineTo(dispX + cropX + cropSize, dispY + cropY + third * i);
            ctx.stroke();
        }

        // Dimension label
        const scaleRatio = imgNatW / dispW;
        const realSize = Math.round(cropSize * scaleRatio);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const labelText = `${realSize} × ${realSize} px`;
        ctx.font = '11px ui-monospace, monospace';
        const tm = ctx.measureText(labelText);
        const lx = dispX + cropX + cropSize / 2 - tm.width / 2 - 6;
        const ly = dispY + cropY + cropSize + 8;
        ctx.fillRect(lx, ly, tm.width + 12, 20);
        ctx.fillStyle = '#CBA153';
        ctx.fillText(labelText, lx + 6, ly + 14);

        // Update preview
        if (previewRef.current) {
            const pCanvas = previewRef.current;
            const pCtx = pCanvas.getContext('2d');
            if (pCtx) {
                pCanvas.width = 200;
                pCanvas.height = 200;
                const sx = cropX * scaleRatio;
                const sy = cropY * scaleRatio;
                const sSize = cropSize * scaleRatio;
                pCtx.drawImage(imgRef.current, sx, sy, sSize, sSize, 0, 0, 200, 200);
            }
        }
    }, [imgLoaded, dispX, dispY, dispW, dispH, cropX, cropY, cropSize]);

    // Clamp crop position
    const clampCrop = useCallback((x: number, y: number, size: number) => {
        const s = Math.max(40, Math.min(size, dispW, dispH));
        const cx = Math.max(0, Math.min(x, dispW - s));
        const cy = Math.max(0, Math.min(y, dispH - s));
        return { x: cx, y: cy, size: s };
    }, [dispW, dispH]);

    // Mouse handlers
    const onMouseDown = useCallback((e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mx = e.clientX - rect.left - dispX;
        const my = e.clientY - rect.top - dispY;

        // Check if near a corner handle (resize)
        const handleR = 16;
        const corners = [
            { x: cropX + cropSize, y: cropY + cropSize }, // BR (primary resize)
            { x: cropX, y: cropY + cropSize },             // BL
            { x: cropX + cropSize, y: cropY },             // TR
            { x: cropX, y: cropY },                        // TL
        ];

        for (const c of corners) {
            if (Math.abs(mx - c.x) < handleR && Math.abs(my - c.y) < handleR) {
                setDragging(true);
                setDragType('resize');
                setDragStartX(e.clientX);
                setDragStartY(e.clientY);
                setStartCropX(cropX);
                setStartCropY(cropY);
                setStartCropSize(cropSize);
                e.preventDefault();
                return;
            }
        }

        // Check if inside crop box (move)
        if (mx >= cropX && mx <= cropX + cropSize && my >= cropY && my <= cropY + cropSize) {
            setDragging(true);
            setDragType('move');
            setDragStartX(e.clientX);
            setDragStartY(e.clientY);
            setStartCropX(cropX);
            setStartCropY(cropY);
            setStartCropSize(cropSize);
            e.preventDefault();
        }
    }, [cropX, cropY, cropSize, dispX, dispY]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragging) return;

        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;

        if (dragType === 'move') {
            const clamped = clampCrop(startCropX + dx, startCropY + dy, cropSize);
            setCropX(clamped.x);
            setCropY(clamped.y);
        } else if (dragType === 'resize') {
            // Resize from bottom-right: use max of dx/dy for uniform scale
            const delta = Math.max(dx, dy);
            const newSize = startCropSize + delta;
            const clamped = clampCrop(startCropX, startCropY, newSize);
            setCropSize(clamped.size);
            // Re-clamp position if size changed
            const reClamp = clampCrop(startCropX, startCropY, clamped.size);
            setCropX(reClamp.x);
            setCropY(reClamp.y);
        }
    }, [dragging, dragType, dragStartX, dragStartY, startCropX, startCropY, startCropSize, cropSize, clampCrop]);

    const onMouseUp = useCallback(() => {
        setDragging(false);
        setDragType(null);
    }, []);

    // Zoom buttons
    const zoom = useCallback((factor: number) => {
        const newSize = cropSize + factor;
        const clamped = clampCrop(cropX, cropY, newSize);
        setCropSize(clamped.size);
        setCropX(clampCrop(cropX, cropY, clamped.size).x);
        setCropY(clampCrop(cropX, cropY, clamped.size).y);
    }, [cropSize, cropX, cropY, clampCrop]);

    // Crop & export
    const handleCrop = useCallback(() => {
        if (!imgRef.current) return;

        const scaleRatio = imgNatW / dispW;
        const sx = Math.round(cropX * scaleRatio);
        const sy = Math.round(cropY * scaleRatio);
        const sSize = Math.round(cropSize * scaleRatio);

        // Create off-screen canvas at original resolution (capped at 1200)
        const outputSize = Math.min(sSize, 1200);
        const offCanvas = document.createElement('canvas');
        offCanvas.width = outputSize;
        offCanvas.height = outputSize;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(imgRef.current, sx, sy, sSize, sSize, 0, 0, outputSize, outputSize);

        offCanvas.toBlob((blob) => {
            if (blob) onCrop(blob);
        }, 'image/png', 1.0); // PNG for lossless → Sharp will convert to WebP
    }, [imgNatW, dispW, cropX, cropY, cropSize, onCrop]);

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#111] border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <h3 className="text-white font-bold text-sm">Crop to Square (1:1)</h3>
                    <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-2 py-0.5 rounded">
                        {imgNatW} × {imgNatH} original
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => zoom(-30)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Shrink crop">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => zoom(30)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Expand crop">
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-white/10 mx-1" />
                    <button type="button" onClick={onCancel}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-all">
                        <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                    <button type="button" onClick={handleCrop}
                        className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-black bg-[#CBA153] rounded-lg hover:bg-white transition-all uppercase tracking-wider">
                        <Check className="w-3.5 h-3.5" /> Crop & Upload
                    </button>
                </div>
            </div>

            {/* Canvas area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Main crop area */}
                <div ref={containerRef} className="flex-1 relative cursor-crosshair select-none"
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                >
                    {imgLoaded && (
                        <canvas ref={canvasRef} className="absolute inset-0" />
                    )}
                    {!imgLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                            Loading image...
                        </div>
                    )}
                </div>

                {/* Preview sidebar */}
                <div className="w-[240px] bg-[#0D0D0D] border-l border-white/10 p-5 flex flex-col items-center gap-4 flex-shrink-0">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Preview</p>
                    <div className="w-[200px] h-[200px] rounded-xl overflow-hidden border-2 border-[#CBA153]/30 bg-[#1A1A1A]">
                        <canvas ref={previewRef} className="w-full h-full" />
                    </div>
                    <div className="text-center space-y-2 mt-2">
                        <p className="text-[10px] text-gray-600">
                            <Move className="w-3 h-3 inline mr-1" />
                            Drag to reposition
                        </p>
                        <p className="text-[10px] text-gray-600">
                            Drag corners to resize
                        </p>
                    </div>
                    <div className="mt-auto text-[9px] text-gray-700 text-center space-y-1">
                        <p>Output: Square 1:1</p>
                        <p>Format: WebP optimized</p>
                        <p>Max: 1200×1200 px</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
