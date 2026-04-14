'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useRef, useEffect, useState } from 'react';

interface ProductLineOption {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    badgeColor: string | null;
}

interface CategoryOption {
    id: string;
    slug: string;
    name: string;
    productLineId: string;
}

interface ShopFilterBarProps {
    productLines: ProductLineOption[];
    categories: CategoryOption[];
    allLabel: string;
    allCategoriesLabel: string;
}

export default function ShopFilterBar({ productLines, categories, allLabel, allCategoriesLabel }: ShopFilterBarProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showLeftFade, setShowLeftFade] = useState(false);
    const [showRightFade, setShowRightFade] = useState(false);

    const activeLine = searchParams.get('line') || '';
    const activeCategory = searchParams.get('category') || '';

    const updateFilters = useCallback((line: string, category: string) => {
        const params = new URLSearchParams();
        if (line) params.set('line', line);
        if (category) params.set('category', category);
        const qs = params.toString();
        router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    }, [router, pathname]);

    const setLine = (slug: string) => {
        // When switching lines, reset category
        updateFilters(slug, '');
    };

    const setCategory = (slug: string) => {
        updateFilters(activeLine, slug);
    };

    // Filtered categories for the active line
    const visibleCategories = activeLine
        ? categories.filter(c => {
            const line = productLines.find(l => l.slug === activeLine);
            return line && c.productLineId === line.id;
        })
        : categories;

    // Scroll fade detection
    const updateFades = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setShowLeftFade(el.scrollLeft > 4);
        setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    }, []);

    useEffect(() => {
        updateFades();
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', updateFades, { passive: true });
        window.addEventListener('resize', updateFades);
        return () => {
            el.removeEventListener('scroll', updateFades);
            window.removeEventListener('resize', updateFades);
        };
    }, [updateFades, visibleCategories]);

    return (
        <div className="space-y-4">
            {/* Product Line Tabs */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                    onClick={() => setLine('')}
                    className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                        !activeLine
                            ? 'bg-charcoal text-white shadow-lg shadow-charcoal/20'
                            : 'bg-white text-charcoal/70 hover:text-charcoal hover:shadow-md border border-border-light'
                    }`}
                >
                    {allLabel}
                </button>
                {productLines.map(line => (
                    <button
                        key={line.slug}
                        onClick={() => setLine(line.slug)}
                        className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                            activeLine === line.slug
                                ? 'text-white shadow-lg'
                                : 'bg-white text-charcoal/70 hover:text-charcoal hover:shadow-md border border-border-light'
                        }`}
                        style={activeLine === line.slug ? {
                            backgroundColor: line.badgeColor || '#CBA153',
                            boxShadow: `0 10px 25px -5px ${line.badgeColor || '#CBA153'}30`,
                        } : {}}
                    >
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: line.badgeColor || '#CBA153' }}
                        />
                        {line.name}
                    </button>
                ))}
            </div>

            {/* Category Pills */}
            {visibleCategories.length > 0 && (
                <div className="relative">
                    {/* Left fade */}
                    {showLeftFade && (
                        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-cream to-transparent z-10 pointer-events-none" />
                    )}
                    {/* Right fade */}
                    {showRightFade && (
                        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-cream to-transparent z-10 pointer-events-none" />
                    )}

                    <div
                        ref={scrollRef}
                        className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 justify-center"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        <button
                            onClick={() => setCategory('')}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                                !activeCategory
                                    ? 'bg-gold/10 text-gold border border-gold/30'
                                    : 'text-charcoal/50 hover:text-charcoal hover:bg-white border border-transparent'
                            }`}
                        >
                            {allCategoriesLabel}
                        </button>
                        {visibleCategories.map(cat => (
                            <button
                                key={cat.slug}
                                onClick={() => setCategory(cat.slug)}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                                    activeCategory === cat.slug
                                        ? 'bg-gold/10 text-gold border border-gold/30'
                                        : 'text-charcoal/50 hover:text-charcoal hover:bg-white border border-transparent'
                                }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
