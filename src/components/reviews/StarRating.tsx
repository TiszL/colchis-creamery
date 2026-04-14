'use client';

interface StarRatingProps {
    value: number;
    max?: number;
    size?: 'sm' | 'md' | 'lg';
    interactive?: boolean;
    onChange?: (value: number) => void;
    hoverValue?: number;
    onHover?: (value: number) => void;
}

export default function StarRating({
    value,
    max = 5,
    size = 'md',
    interactive = false,
    onChange,
    hoverValue,
    onHover,
}: StarRatingProps) {
    const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5';
    const displayValue = hoverValue || value;

    return (
        <div className="flex items-center gap-0.5" role={interactive ? 'radiogroup' : 'img'} aria-label={`${value} out of ${max} stars`}>
            {Array.from({ length: max }, (_, i) => {
                const starIndex = i + 1;
                const isFilled = starIndex <= displayValue;

                return (
                    <button
                        key={i}
                        type="button"
                        disabled={!interactive}
                        onClick={() => interactive && onChange?.(starIndex)}
                        onMouseEnter={() => interactive && onHover?.(starIndex)}
                        onMouseLeave={() => interactive && onHover?.(0)}
                        className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
                        aria-label={`${starIndex} star${starIndex !== 1 ? 's' : ''}`}
                    >
                        <svg
                            className={`${sizeClass} ${isFilled ? 'text-[#CBA153]' : 'text-gray-300'} transition-colors`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    </button>
                );
            })}
        </div>
    );
}
