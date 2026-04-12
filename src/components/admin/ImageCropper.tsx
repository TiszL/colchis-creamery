'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Check, Move, ZoomIn, ZoomOut, RectangleHorizontal, Square } from 'lucide-react';

interface ImageCropperProps {
    /** The image file to crop */
    file: File;
    /** Called with the cropped image blob */
    onCrop: (blob: Blob) => void;
    /** Called when user cancels */
    onCancel: () => void;
    /** Aspect ratio: '1:1' for product, '16:9' for hero, 'free' for no constraint */
    aspectRatio?: '1:1' | '16:9' | 'free';
}

export default function ImageCropper({ file, onCrop, onCancel, aspectRatio = '1:1' }: ImageCropperProps) {
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
    const [cropW, setCropW] = useState(200);
    const [cropH, setCropH] = useState(200);

    // Active aspect ratio (user can switch)
    const [activeRatio, setActiveRatio] = useState(aspectRatio);

    // Drag state
    const [dragging, setDragging] = useState(false);
    const [dragType, setDragType] = useState<'move' | 'resize' | null>(null);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartY, setDragStartY] = useState(0);
    const [startCropX, setStartCropX] = useState(0);
    const [startCropY, setStartCropY] = useState(0);
    const [startCropW, setStartCropW] = useState(0);
    const [startCropH, setStartCropH] = useState(0);

    // Get aspect ratio as number
    const getRatioNum = useCallback((ratio: string) => {
        if (ratio === '16:9') return 16 / 9;
        if (ratio === '1:1') return 1;
        return 0; // free
    }, []);

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

    // Calculate display dimensions when image loads
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

        // Initial crop based on ratio
        const ratio = getRatioNum(activeRatio);
        let cw2: number, ch2: number;
        if (ratio > 0) {
            // Constrained ratio: find largest box that fits
            if (dw / dh > ratio) {
                ch2 = dh;
                cw2 = Math.round(dh * ratio);
            } else {
                cw2 = dw;
                ch2 = Math.round(dw / ratio);
            }
        } else {
            cw2 = dw;
            ch2 = dh;
        }
        setCropW(cw2);
        setCropH(ch2);
        setCropX(Math.round((dw - cw2) / 2));
        setCropY(Math.round((dh - ch2) / 2));
    }, [imgLoaded, imgNatW, imgNatH, activeRatio, getRatioNum]);

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

        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(imgRef.current, dispX, dispY, dispW, dispH);

        // Dark overlay outside crop
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, cw, dispY + cropY);
        ctx.fillRect(0, dispY + cropY + cropH, cw, ch - (dispY + cropY + cropH));
        ctx.fillRect(0, dispY + cropY, dispX + cropX, cropH);
        ctx.fillRect(dispX + cropX + cropW, dispY + cropY, cw - (dispX + cropX + cropW), cropH);

        // Crop border
        ctx.strokeStyle = '#CBA153';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(dispX + cropX, dispY + cropY, cropW, cropH);
        ctx.setLineDash([]);

        // Corner handles
        const handleSize = 12;
        const corners = [
            [dispX + cropX, dispY + cropY],
            [dispX + cropX + cropW, dispY + cropY],
            [dispX + cropX, dispY + cropY + cropH],
            [dispX + cropX + cropW, dispY + cropY + cropH],
        ];
        ctx.fillStyle = '#CBA153';
        corners.forEach(([cx, cy]) => {
            ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
        });

        // Grid lines
        ctx.strokeStyle = 'rgba(203, 161, 83, 0.25)';
        ctx.lineWidth = 1;
        const thirdW = cropW / 3;
        const thirdH = cropH / 3;
        for (let i = 1; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(dispX + cropX + thirdW * i, dispY + cropY);
            ctx.lineTo(dispX + cropX + thirdW * i, dispY + cropY + cropH);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(dispX + cropX, dispY + cropY + thirdH * i);
            ctx.lineTo(dispX + cropX + cropW, dispY + cropY + thirdH * i);
            ctx.stroke();
        }

        // Dimension label
        const scaleRatio = imgNatW / dispW;
        const realW = Math.round(cropW * scaleRatio);
        const realH = Math.round(cropH * scaleRatio);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const labelText = `${realW} × ${realH} px`;
        ctx.font = '11px ui-monospace, monospace';
        const tm = ctx.measureText(labelText);
        const lx = dispX + cropX + cropW / 2 - tm.width / 2 - 6;
        const ly = dispY + cropY + cropH + 8;
        ctx.fillRect(lx, ly, tm.width + 12, 20);
        ctx.fillStyle = '#CBA153';
        ctx.fillText(labelText, lx + 6, ly + 14);

        // Update preview
        if (previewRef.current) {
            const pCanvas = previewRef.current;
            const pCtx = pCanvas.getContext('2d');
            if (pCtx) {
                const previewW = 240;
                const previewH = activeRatio === '16:9' ? 135 : activeRatio === '1:1' ? 240 : Math.round(240 * cropH / cropW);
                pCanvas.width = previewW;
                pCanvas.height = previewH;
                const sx = cropX * scaleRatio;
                const sy = cropY * scaleRatio;
                const sW = cropW * scaleRatio;
                const sH = cropH * scaleRatio;
                pCtx.drawImage(imgRef.current, sx, sy, sW, sH, 0, 0, previewW, previewH);
            }
        }
    }, [imgLoaded, dispX, dispY, dispW, dispH, cropX, cropY, cropW, cropH, imgNatW, activeRatio]);

    // Clamp crop position
    const clampCrop = useCallback((x: number, y: number, w: number, h: number) => {
        const cw2 = Math.max(60, Math.min(w, dispW));
        const ch2 = Math.max(34, Math.min(h, dispH));
        const cx = Math.max(0, Math.min(x, dispW - cw2));
        const cy = Math.max(0, Math.min(y, dispH - ch2));
        return { x: cx, y: cy, w: cw2, h: ch2 };
    }, [dispW, dispH]);

    // Mouse handlers
    const onMouseDown = useCallback((e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mx = e.clientX - rect.left - dispX;
        const my = e.clientY - rect.top - dispY;

        // Check corners for resize
        const handleR = 16;
        const corners = [
            { x: cropX + cropW, y: cropY + cropH },
            { x: cropX, y: cropY + cropH },
            { x: cropX + cropW, y: cropY },
            { x: cropX, y: cropY },
        ];

        for (const c of corners) {
            if (Math.abs(mx - c.x) < handleR && Math.abs(my - c.y) < handleR) {
                setDragging(true);
                setDragType('resize');
                setDragStartX(e.clientX);
                setDragStartY(e.clientY);
                setStartCropX(cropX);
                setStartCropY(cropY);
                setStartCropW(cropW);
                setStartCropH(cropH);
                e.preventDefault();
                return;
            }
        }

        // Check inside crop box for move
        if (mx >= cropX && mx <= cropX + cropW && my >= cropY && my <= cropY + cropH) {
            setDragging(true);
            setDragType('move');
            setDragStartX(e.clientX);
            setDragStartY(e.clientY);
            setStartCropX(cropX);
            setStartCropY(cropY);
            setStartCropW(cropW);
            setStartCropH(cropH);
            e.preventDefault();
        }
    }, [cropX, cropY, cropW, cropH, dispX, dispY]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragging) return;

        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;

        if (dragType === 'move') {
            const clamped = clampCrop(startCropX + dx, startCropY + dy, cropW, cropH);
            setCropX(clamped.x);
            setCropY(clamped.y);
        } else if (dragType === 'resize') {
            const ratio = getRatioNum(activeRatio);
            if (ratio > 0) {
                // Constrained resize
                const delta = Math.max(dx, dy);
                const newW = startCropW + delta;
                const newH = Math.round(newW / ratio);
                const clamped = clampCrop(startCropX, startCropY, newW, newH);
                // Re-enforce ratio after clamping
                const finalW = clamped.w;
                const finalH = Math.round(finalW / ratio);
                setCropW(finalW);
                setCropH(Math.min(finalH, dispH));
                const rc = clampCrop(startCropX, startCropY, finalW, Math.min(finalH, dispH));
                setCropX(rc.x);
                setCropY(rc.y);
            } else {
                const newW = startCropW + dx;
                const newH = startCropH + dy;
                const clamped = clampCrop(startCropX, startCropY, newW, newH);
                setCropW(clamped.w);
                setCropH(clamped.h);
                setCropX(clampCrop(startCropX, startCropY, clamped.w, clamped.h).x);
                setCropY(clampCrop(startCropX, startCropY, clamped.w, clamped.h).y);
            }
        }
    }, [dragging, dragType, dragStartX, dragStartY, startCropX, startCropY, startCropW, startCropH, cropW, cropH, clampCrop, activeRatio, getRatioNum, dispH]);

    const onMouseUp = useCallback(() => {
        setDragging(false);
        setDragType(null);
    }, []);

    // Zoom buttons
    const zoom = useCallback((factor: number) => {
        const ratio = getRatioNum(activeRatio);
        const newW = cropW + factor;
        const newH = ratio > 0 ? Math.round(newW / ratio) : cropH + factor;
        const clamped = clampCrop(cropX, cropY, newW, newH);
        setCropW(clamped.w);
        setCropH(ratio > 0 ? Math.round(clamped.w / ratio) : clamped.h);
        setCropX(clampCrop(cropX, cropY, clamped.w, clamped.h).x);
        setCropY(clampCrop(cropX, cropY, clamped.w, clamped.h).y);
    }, [cropW, cropH, cropX, cropY, clampCrop, activeRatio, getRatioNum]);

    // Crop & export
    const handleCrop = useCallback(() => {
        if (!imgRef.current) return;

        const scaleRatio = imgNatW / dispW;
        const sx = Math.round(cropX * scaleRatio);
        const sy = Math.round(cropY * scaleRatio);
        const sW = Math.round(cropW * scaleRatio);
        const sH = Math.round(cropH * scaleRatio);

        // Output at original resolution, capped
        const maxDim = activeRatio === '16:9' ? 1920 : 1200;
        const outputScale = Math.min(1, maxDim / sW);
        const outW = Math.round(sW * outputScale);
        const outH = Math.round(sH * outputScale);

        const offCanvas = document.createElement('canvas');
        offCanvas.width = outW;
        offCanvas.height = outH;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(imgRef.current, sx, sy, sW, sH, 0, 0, outW, outH);

        offCanvas.toBlob((blob) => {
            if (blob) onCrop(blob);
        }, 'image/png', 1.0);
    }, [imgNatW, dispW, cropX, cropY, cropW, cropH, onCrop, activeRatio]);

    const ratioLabel = activeRatio === '16:9' ? 'Landscape 16:9' : activeRatio === '1:1' ? 'Square 1:1' : 'Free Crop';
    const previewAspect = activeRatio === '16:9' ? 'aspect-video' : activeRatio === '1:1' ? 'aspect-square' : 'aspect-video';

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#111] border-b border-white/10 flex-shrink-0 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <h3 className="text-white font-bold text-sm">Crop Image — {ratioLabel}</h3>
                    <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-2 py-0.5 rounded">
                        {imgNatW} × {imgNatH} original
                    </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Ratio switcher */}
                    <div className="flex items-center bg-white/5 rounded-lg overflow-hidden border border-white/10">
                        <button type="button" onClick={() => setActiveRatio('1:1')}
                            className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeRatio === '1:1' ? 'bg-[#CBA153] text-black' : 'text-gray-400 hover:text-white'}`}>
                            <Square className="w-3 h-3" /> 1:1
                        </button>
                        <button type="button" onClick={() => setActiveRatio('16:9')}
                            className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeRatio === '16:9' ? 'bg-[#CBA153] text-black' : 'text-gray-400 hover:text-white'}`}>
                            <RectangleHorizontal className="w-3 h-3" /> 16:9
                        </button>
                    </div>

                    <div className="w-px h-6 bg-white/10" />
                    <button type="button" onClick={() => zoom(-30)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Shrink crop">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => zoom(30)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Expand crop">
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-white/10" />
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
                <div className="w-[260px] bg-[#0D0D0D] border-l border-white/10 p-5 flex flex-col items-center gap-4 flex-shrink-0 hidden md:flex">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Preview</p>
                    <div className={`w-[240px] ${previewAspect} rounded-xl overflow-hidden border-2 border-[#CBA153]/30 bg-[#1A1A1A]`}>
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
                        <p>Output: {ratioLabel}</p>
                        <p>Format: WebP optimized</p>
                        <p>Max: {activeRatio === '16:9' ? '1920×1080' : '1200×1200'} px</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
