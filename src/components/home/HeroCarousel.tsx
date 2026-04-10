'use client';

import { useState, useEffect } from 'react';

interface HeroCarouselProps {
    images: string[];
    interval?: number; // ms between transitions
}

export default function HeroCarousel({ images, interval = 6000 }: HeroCarouselProps) {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        if (images.length <= 1) return;
        const timer = setInterval(() => {
            setCurrent((prev) => (prev + 1) % images.length);
        }, interval);
        return () => clearInterval(timer);
    }, [images.length, interval]);

    return (
        <div className="relative w-full h-full">
            {images.map((src, idx) => (
                <img
                    key={idx}
                    src={src}
                    alt={`Hero ${idx + 1}`}
                    className={`absolute inset-0 w-full h-full object-cover scale-105 transition-opacity duration-[1500ms] ease-in-out ${
                        idx === current ? 'opacity-50' : 'opacity-0'
                    }`}
                />
            ))}
        </div>
    );
}
