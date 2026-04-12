'use client';

import { useState, useEffect, useCallback } from 'react';

interface HeroCarouselProps {
    images: string[];
    /** ms between transitions */
    interval?: number;
    /** Transition effect type */
    transition?: 'fade' | 'slide' | 'zoom';
    /** Transition duration in ms */
    transitionDuration?: number;
}

export default function HeroCarousel({
    images,
    interval = 6000,
    transition = 'fade',
    transitionDuration = 1500,
}: HeroCarouselProps) {
    const [current, setCurrent] = useState(0);
    const [previous, setPrevious] = useState(-1);

    const advance = useCallback(() => {
        setPrevious(current);
        setCurrent((prev) => (prev + 1) % images.length);
    }, [current, images.length]);

    useEffect(() => {
        if (images.length <= 1) return;
        const timer = setInterval(advance, interval);
        return () => clearInterval(timer);
    }, [images.length, interval, advance]);

    if (transition === 'slide') {
        return (
            <div className="relative w-full h-full overflow-hidden">
                {images.map((src, idx) => {
                    const isActive = idx === current;
                    const isPrev = idx === previous;
                    let translateX = '100%';
                    if (isActive) translateX = '0%';
                    else if (isPrev) translateX = '-100%';

                    return (
                        <img
                            key={idx}
                            src={src}
                            alt={`Hero ${idx + 1}`}
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{
                                transform: `translateX(${translateX})`,
                                transition: isActive || isPrev ? `transform ${transitionDuration}ms ease-in-out` : 'none',
                                zIndex: isActive ? 2 : isPrev ? 1 : 0,
                            }}
                        />
                    );
                })}
            </div>
        );
    }

    if (transition === 'zoom') {
        // Ken Burns effect: gentle zoom while visible, crossfade between
        return (
            <div className="relative w-full h-full overflow-hidden">
                {images.map((src, idx) => {
                    const isActive = idx === current;
                    return (
                        <img
                            key={idx}
                            src={src}
                            alt={`Hero ${idx + 1}`}
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{
                                opacity: isActive ? 1 : 0,
                                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                                transition: `opacity ${transitionDuration}ms ease-in-out, transform ${interval + transitionDuration}ms ease-out`,
                            }}
                        />
                    );
                })}
            </div>
        );
    }

    // Default: fade (crossfade)
    return (
        <div className="relative w-full h-full">
            {images.map((src, idx) => (
                <img
                    key={idx}
                    src={src}
                    alt={`Hero ${idx + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                        opacity: idx === current ? 1 : 0,
                        transition: `opacity ${transitionDuration}ms ease-in-out`,
                    }}
                />
            ))}
        </div>
    );
}
