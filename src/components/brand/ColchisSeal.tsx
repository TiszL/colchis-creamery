"use client";

import { useId } from "react";

/**
 * ColchisSeal — The canonical CF monogram seal mark.
 * Stone-carved Asomtavruli-inspired C and F letterforms inside a circular seal
 * with Golden Fleece arc ornament at bottom.
 *
 * Props:
 *  - size: pixel diameter (default 40)
 *  - invert: swap ink/cream for dark backgrounds
 *  - mono: use single-color (no copper accent)
 *  - className: additional CSS classes
 */

interface ColchisSealProps {
  size?: number;
  invert?: boolean;
  mono?: boolean;
  className?: string;
}

export function ColchisSeal({ size = 40, invert = false, mono = false, className = "" }: ColchisSealProps) {
  const cream = invert ? "#1F3026" : "#F5F0E6";
  const ink = invert ? "#F5F0E6" : "#1F3026";
  const accent = mono ? ink : "#B96A3D";
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      style={{ display: "block", flexShrink: 0 }}
      aria-label="Colchis Food seal"
    >
      <defs>
        <clipPath id={`clip-${uid}`}>
          <circle cx="100" cy="100" r="92" />
        </clipPath>
      </defs>

      {/* Outer circle */}
      <circle cx="100" cy="100" r="92" fill={cream} stroke={ink} strokeWidth="2" />
      {/* Inner accent ring */}
      <circle cx="100" cy="100" r="86" fill="none" stroke={accent} strokeWidth="0.6" />

      {/* Golden Fleece arc (single wave) */}
      <g opacity="0.95">
        <path
          d="M 60 158 Q 70 150 78 154 Q 86 148 94 154 Q 100 148 106 154 Q 114 148 122 154 Q 130 150 140 158"
          fill="none"
          stroke={accent}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>

      {/* CF Monogram — stone-carved letterforms */}
      <g clipPath={`url(#clip-${uid})`}>
        {/* C */}
        <path
          d="M 78 64 Q 56 64 56 100 Q 56 136 78 136 L 86 136 L 86 124 L 80 124 Q 70 124 70 100 Q 70 76 80 76 L 86 76 L 86 64 Z"
          fill={ink}
        />
        {/* F */}
        <path
          d="M 96 64 L 96 136 L 110 136 L 110 106 L 132 106 L 132 94 L 110 94 L 110 76 L 138 76 L 138 64 Z"
          fill={ink}
        />
        {/* Serif terminals */}
        <rect x="70" y="62" width="20" height="3" fill={ink} />
        <rect x="70" y="135" width="20" height="3" fill={ink} />
        <rect x="92" y="62" width="20" height="3" fill={ink} />
        <rect x="92" y="135" width="22" height="3" fill={ink} />
        <rect x="130" y="62" width="12" height="3" fill={ink} />
        {/* Copper ornament dot */}
        <circle cx="100" cy="50" r="2" fill={accent} />
        {/* Golden Fleece ram's horn spiral */}
        <path
          d="M 100 42 q -3 -2 -3 -5 q 0 -3 3 -3 q 3 0 3 3"
          fill="none"
          stroke={accent}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </g>

      {/* Circular text — only render at larger sizes */}
      {size >= 56 && (
        <>
          <path id={`top-${uid}`} d="M 100 100 m -72 0 a 72 72 0 0 1 144 0" fill="none" />
          <path id={`bot-${uid}`} d="M 100 100 m -72 0 a 72 72 0 0 0 144 0" fill="none" />
          <text fontFamily="Fraunces, Georgia, serif" fontSize="9" letterSpacing="4" fontWeight="500" fill={ink}>
            <textPath href={`#top-${uid}`} startOffset="50%" textAnchor="middle">EST · MMXXVI · OHIO</textPath>
          </text>
          <text fontFamily="Fraunces, Georgia, serif" fontSize="8" letterSpacing="3" fontWeight="500" fill={ink}>
            <textPath href={`#bot-${uid}`} startOffset="50%" textAnchor="middle">COLCHIS · GEORGIA · 𐌝</textPath>
          </text>
        </>
      )}
    </svg>
  );
}
