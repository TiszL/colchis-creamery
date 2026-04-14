/**
 * Review Auto-Moderation Engine
 *
 * Evaluates reviews using trust signals and spam heuristics.
 * Returns a moderation decision: APPROVED, FLAGGED, or REJECTED.
 *
 * Score thresholds:
 *   ≥ 50  → APPROVED (auto-published)
 *   20-49 → FLAGGED  (needs staff review)
 *   < 20  → FLAGGED with HIGH priority
 */

import { prisma } from "@/lib/db";

// ── Link & spam patterns ────────────────────────────────────────────────────

const LINK_PATTERNS = /https?:\/\/|www\.|\.com\b|\.net\b|\.org\b|\.io\b|bit\.ly|t\.co|goo\.gl/gi;

const SPAM_PHRASES = [
    "buy now", "click here", "free money", "work from home",
    "earn cash", "limited time", "act now", "order now",
    "100% free", "no obligation", "congratulations",
    "you have been selected", "dear friend",
    "make money", "crypto", "bitcoin", "nft",
    "weight loss", "lose weight", "diet pill",
    "viagra", "cialis", "pharmacy",
];

const REPETITIVE_PATTERN = /(.)\1{4,}/; // 5+ same char in a row: "aaaaa"
const ALL_CAPS_THRESHOLD = 0.7; // >70% uppercase = suspicious
const MIN_QUALITY_LENGTH = 15; // Minimum chars for quality check

// ── Types ────────────────────────────────────────────────────────────────────

export interface ModerationResult {
    status: "APPROVED" | "FLAGGED";
    score: number;
    flags: string[];
    priority: "LOW" | "MEDIUM" | "HIGH";
}

interface ModerationContext {
    userId: string;
    rating: number;
    title: string;
    body: string;
    isVerifiedPurchase: boolean;
}

// ── Main moderation function ────────────────────────────────────────────────

export async function autoModerateReview(ctx: ModerationContext): Promise<ModerationResult> {
    let score = 0;
    const flags: string[] = [];

    // ── Trust signals (positive) ────────────────────────────────────────

    // 1. Verified purchase is the strongest trust signal
    if (ctx.isVerifiedPurchase) {
        score += 40;
    }

    // 2. Account age
    const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: {
            createdAt: true,
            emailVerified: true,
            role: true,
            accounts: { select: { provider: true } },
        },
    });

    if (user) {
        const accountAgeDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);

        if (accountAgeDays > 30) {
            score += 20;
        } else if (accountAgeDays > 7) {
            score += 15;
        } else if (accountAgeDays > 1) {
            score += 5;
        } else {
            score -= 20;
            flags.push("New account (< 24h old)");
        }

        // 3. Email verified
        if (user.emailVerified) {
            score += 10;
        } else {
            score -= 10;
            flags.push("Unverified email");
        }

        // 4. OAuth user = legitimate (Google/Facebook verified identity)
        const hasOAuth = user.accounts.some(a => ['google', 'facebook'].includes(a.provider));
        if (hasOAuth) {
            score += 15;
        }

        // 5. Staff/admin reviewing = trusted
        if (["MASTER_ADMIN", "PRODUCT_MANAGER"].includes(user.role)) {
            score += 50;
        }
    }

    // ── Content quality signals ─────────────────────────────────────────

    const fullText = `${ctx.title} ${ctx.body}`;

    // 6. No links = clean
    const linkMatches = fullText.match(LINK_PATTERNS);
    if (!linkMatches || linkMatches.length === 0) {
        score += 10;
    } else {
        score -= 50;
        flags.push(`Contains ${linkMatches.length} link pattern(s)`);
    }

    // 7. Spam phrase check
    const lowerText = fullText.toLowerCase();
    const foundSpam = SPAM_PHRASES.filter(phrase => lowerText.includes(phrase));
    if (foundSpam.length > 0) {
        score -= 30;
        flags.push(`Spam phrases: ${foundSpam.join(", ")}`);
    }

    // 8. Repetitive characters (bot behavior)
    if (REPETITIVE_PATTERN.test(fullText)) {
        score -= 25;
        flags.push("Repetitive characters detected");
    }

    // 9. ALL CAPS check
    const letters = fullText.replace(/[^a-zA-Z]/g, "");
    if (letters.length > 10) {
        const upperRatio = letters.replace(/[^A-Z]/g, "").length / letters.length;
        if (upperRatio > ALL_CAPS_THRESHOLD) {
            score -= 15;
            flags.push("Excessive ALL CAPS");
        }
    }

    // 10. Text quality / length
    if (ctx.body.length >= MIN_QUALITY_LENGTH) {
        score += 10;
    } else {
        score -= 10;
        flags.push("Very short review body");
    }

    // 11. Title quality
    if (ctx.title.length < 5) {
        score -= 5;
        flags.push("Very short title");
    }

    // ── Rate limiting signals ───────────────────────────────────────────

    // 12. Multiple reviews in 24h
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await prisma.productReview.count({
        where: { userId: ctx.userId, createdAt: { gte: dayAgo } },
    });

    if (recentCount >= 3) {
        score -= 30;
        flags.push(`${recentCount} reviews in last 24h (rate limit)`);
    } else if (recentCount >= 2) {
        score -= 10;
        flags.push(`${recentCount} reviews in last 24h`);
    }

    // ── Determine result ────────────────────────────────────────────────

    let status: "APPROVED" | "FLAGGED";
    let priority: "LOW" | "MEDIUM" | "HIGH";

    if (score >= 50) {
        status = "APPROVED";
        priority = "LOW";
    } else if (score >= 20) {
        status = "FLAGGED";
        priority = "MEDIUM";
        if (flags.length === 0) flags.push("Moderate trust score");
    } else {
        status = "FLAGGED";
        priority = "HIGH";
        if (flags.length === 0) flags.push("Low trust score");
    }

    return { status, score, flags, priority };
}
