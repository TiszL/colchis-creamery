'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * HeroPreview — pixel-perfect scaled replica of the frontend hero section.
 * Content block is freely draggable to any position.
 */

interface HeroPreviewProps {
    // Content
    title: string;
    subtitle: string;
    badgeText: string;
    shopCta: string;
    wholesaleCta: string;
    // Visibility
    showBadge: boolean;
    showTitle: boolean;
    showSubtitle: boolean;
    showBtnPrimary: boolean;
    showBtnSecondary: boolean;
    // Layout
    textSize: string;
    posX: number;  // 0–100 percentage
    posY: number;  // 0–100 percentage
    badgeAlign: string;
    titleAlign: string;
    subtitleAlign: string;
    btnAlign: string;
    // Image
    heroImage: string;
    // Overlay
    overlayEnabled: boolean;
    overlayOpacity: number;
    overlayColor: string;
    gradientEnabled: boolean;
    gradientOpacity: number;
    // Callbacks
    onPositionChange: (x: number, y: number) => void;
}

// Same class maps as the real HeroSection
const titleSizes: Record<string, string> = {
    sm: 'text-3xl md:text-5xl', md: 'text-4xl md:text-6xl',
    lg: 'text-5xl md:text-8xl', xl: 'text-6xl md:text-9xl',
};
const subtitleSizes: Record<string, string> = {
    sm: 'text-sm md:text-base', md: 'text-base md:text-lg',
    lg: 'text-lg md:text-xl', xl: 'text-xl md:text-2xl',
};
const textAlignClass = (a: string) => a === 'left' ? 'text-left' : a === 'right' ? 'text-right' : 'text-center';
const btnJustifyClass = (a: string) => a === 'left' ? 'justify-start' : a === 'right' ? 'justify-end' : 'justify-center';

// Derive transform-origin from position to keep content visible
function getTransformOrigin(x: number, y: number) {
    const tx = x < 25 ? '0%' : x > 75 ? '100%' : '50%';
    const ty = y < 25 ? '0%' : y > 75 ? '100%' : '50%';
    return `${tx} ${ty}`;
}
function getTranslate(x: number, y: number) {
    const tx = x < 25 ? '0%' : x > 75 ? '-100%' : '-50%';
    const ty = y < 25 ? '0%' : y > 75 ? '-100%' : '-50%';
    return `translate(${tx}, ${ty})`;
}

export default function HeroPreview(props: HeroPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.5);
    const [dragging, setDragging] = useState(false);
    const dragRef = useRef(false);

    const VP_W = 1440;
    const VP_H = 810;

    // Calculate scale
    useEffect(() => {
        const calc = () => {
            if (!containerRef.current) return;
            setScale(containerRef.current.clientWidth / VP_W);
        };
        calc();
        const obs = new ResizeObserver(calc);
        if (containerRef.current) obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    // Convert mouse event to percentage position
    const mouseToPercent = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!containerRef.current) return null;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.round(Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100)));
        const y = Math.round(Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100)));
        return { x, y };
    }, []);

    // Drag handlers
    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        dragRef.current = true;
        setDragging(true);
        const pos = mouseToPercent(e);
        if (pos) props.onPositionChange(pos.x, pos.y);
    }, [mouseToPercent, props.onPositionChange]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragRef.current) return;
        const pos = mouseToPercent(e);
        if (pos) props.onPositionChange(pos.x, pos.y);
    }, [mouseToPercent, props.onPositionChange]);

    const onMouseUp = useCallback(() => {
        dragRef.current = false;
        setDragging(false);
    }, []);

    // Title parsing
    const titleLine1 = props.title ? props.title.split(',')[0] || props.title : 'Ancient Heritage,';
    const titleLine2 = props.title ? props.title.split(',').slice(1).join(',').trim() || '' : 'Fresh Taste';

    const hasAny = props.showBadge || props.showTitle || props.showSubtitle || props.showBtnPrimary || props.showBtnSecondary;

    return (
        <div
            ref={containerRef}
            className={`relative rounded-xl overflow-hidden border border-white/10 bg-[#0D0D0D] select-none ${dragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
            style={{ aspectRatio: `${VP_W} / ${VP_H}` }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
        >
            {/* Scaled hero replica */}
            <div
                className="pointer-events-none"
                style={{
                    width: VP_W,
                    height: VP_H,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                }}
            >
                <div className="relative overflow-hidden bg-[#FDFBF7]" style={{ width: VP_W, height: VP_H }}>
                    {/* Background */}
                    <div className="absolute inset-0 z-0">
                        {props.overlayEnabled && (
                            <div className="absolute inset-0 z-[5]"
                                style={{ backgroundColor: props.overlayColor, opacity: props.overlayOpacity / 100 }} />
                        )}
                        {props.gradientEnabled && (
                            <div className="absolute inset-0 z-10"
                                style={{
                                    background: `linear-gradient(to bottom, transparent 30%, ${props.overlayEnabled ? props.overlayColor : '#FDFBF7'} 100%)`,
                                    opacity: props.gradientOpacity / 100,
                                }} />
                        )}
                        {props.heroImage && (
                            <img src={props.heroImage} className="w-full h-full object-cover scale-105" alt="" />
                        )}
                    </div>

                    {/* Content — positioned freely with percentage coordinates */}
                    {hasAny && (
                        <div
                            className="absolute z-20 max-w-4xl w-full"
                            style={{
                                left: `${props.posX}%`,
                                top: `${props.posY}%`,
                                transform: getTranslate(props.posX, props.posY),
                                padding: '0 24px',
                            }}
                        >
                            <div className="flex flex-col items-center">
                                {props.showBadge && (
                                    <div className={`flex w-full ${btnJustifyClass(props.badgeAlign)} mb-8`}>
                                        <div className="inline-block px-4 py-1 border border-[#CBA153] rounded-full text-[#CBA153] text-xs font-bold tracking-[0.2em] uppercase">
                                            {props.badgeText}
                                        </div>
                                    </div>
                                )}
                                {props.showTitle && (
                                    <h1 className={`w-full ${titleSizes[props.textSize] || titleSizes.lg} font-serif mb-8 text-[#2C2A29] leading-tight tracking-tight ${textAlignClass(props.titleAlign)}`}>
                                        {titleLine1} <br />
                                        <span className="italic text-[#CBA153]">{titleLine2}</span>
                                    </h1>
                                )}
                                {props.showSubtitle && (
                                    <p className={`${subtitleSizes[props.textSize] || subtitleSizes.lg} text-[#2C2A29]/70 mb-10 max-w-2xl font-light leading-relaxed ${textAlignClass(props.subtitleAlign)} ${props.subtitleAlign === 'center' ? 'self-center' : props.subtitleAlign === 'right' ? 'self-end' : 'self-start'}`}>
                                        {props.subtitle}
                                    </p>
                                )}
                                {(props.showBtnPrimary || props.showBtnSecondary) && (
                                    <div className={`flex flex-row gap-4 w-full ${btnJustifyClass(props.btnAlign)}`}>
                                        {props.showBtnPrimary && (
                                            <span className="px-10 py-5 bg-[#CBA153] text-white font-bold rounded-sm tracking-widest uppercase shadow-xl shadow-[#CBA153]/20 text-sm">
                                                {props.shopCta}
                                            </span>
                                        )}
                                        {props.showBtnSecondary && (
                                            <span className="px-10 py-5 border-2 border-[#2C2A29] text-[#2C2A29] font-bold rounded-sm tracking-widest uppercase text-sm">
                                                {props.wholesaleCta}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Crosshair guides (show during drag) */}
            {dragging && (
                <>
                    <div className="absolute z-40 pointer-events-none"
                        style={{ left: `${props.posX}%`, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(203,161,83,0.4)' }} />
                    <div className="absolute z-40 pointer-events-none"
                        style={{ top: `${props.posY}%`, left: 0, right: 0, height: 1, backgroundColor: 'rgba(203,161,83,0.4)' }} />
                </>
            )}

            {/* Position indicator */}
            <div className="absolute top-2 right-2 z-40 bg-black/70 backdrop-blur-sm text-[9px] text-[#CBA153] font-mono px-2 py-1 rounded-md pointer-events-none">
                X:{props.posX}% Y:{props.posY}%
            </div>

            {/* Drag hint */}
            {!dragging && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-sm text-[9px] text-gray-400 font-medium px-3 py-1 rounded-full pointer-events-none">
                    Click & drag to position content
                </div>
            )}
        </div>
    );
}
