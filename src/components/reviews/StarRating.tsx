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
    const sizeMap = { sm: 14, md: 18, lg: 24 };
    const s = sizeMap[size];
    const displayValue = hoverValue || value;

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 3 }} role={interactive ? 'radiogroup' : 'img'} aria-label={`${value} out of ${max} stars`}>
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
                        style={{ cursor: interactive ? "pointer" : "default", background: "transparent", border: "none", padding: 0, display: "inline-block", transition: "transform 200ms" }}
                        aria-label={`${starIndex} star${starIndex !== 1 ? 's' : ''}`}
                    >
                        <svg width={s} height={s} viewBox="0 0 16 16" style={{ display: "block" }}>
                            <path d="M8 1l2.09 4.26L15 6l-3.5 3.41.83 4.84L8 11.97 3.67 14.25 4.5 9.41 1 6l4.91-.74L8 1z"
                                fill={isFilled ? "#B96A3D" : "transparent"} stroke="#B96A3D" strokeWidth="1" />
                        </svg>
                    </button>
                );
            })}
        </div>
    );
}
