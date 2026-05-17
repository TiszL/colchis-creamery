// Phase E1.1 — Server helpers for SiteConfig-backed runtime configuration.
//
// SiteConfig is a generic key/value table. Values are stored as String; for
// composite settings we JSON-stringify on save and parse on read. This module
// centralises the parsing + default-fallback logic so other code can call
// `getTestingMode()` etc. without knowing the storage shape.

import { prisma } from './db';

/* ─── Testing mode (pre-launch banner) ─────────────────────────────────── */

export type TestingModeConfig = {
    /** Master switch — when false, no banner renders, no modal. */
    enabled: boolean;
    /** First-visit modal title. */
    modalTitle: string;
    /** First-visit modal body — markdown allowed (bold, italic, paragraphs, links). */
    modalBody: string;
    /** Persistent top strip text. */
    stripText: string;
    /** If true, show the first-visit modal once (until user dismisses).
     *  If false, only the strip ever shows — useful for late-stage testing. */
    showModalOnFirstVisit: boolean;
    /** Bumped by admin to force the modal to re-show for every visitor
     *  (clears the localStorage acknowledgment effectively). */
    version: number;
};

export const DEFAULT_TESTING_MODE: TestingModeConfig = {
    enabled: true,
    modalTitle: 'Welcome — site is in testing',
    modalBody: [
        "We're testing our ordering pipeline before going live for real sales.",
        '',
        'You can browse, add to cart, and place orders, but **no real charges happen** and **no real deliveries are made** — payments run in Stripe test mode and delivery requests go to sandbox carriers.',
        '',
        "We'll remove this notice once we open for real orders. Thanks for testing with us.",
    ].join('\n'),
    stripText: 'Testing in progress — orders are not real sales · no charges · no deliveries',
    showModalOnFirstVisit: true,
    version: 1,
};

const TESTING_MODE_KEY = 'site.testingMode';

/** Reads + parses the testing-mode config, falling back to DEFAULT_TESTING_MODE
 *  on missing row or malformed JSON. Cached by Next per-request. */
export async function getTestingMode(): Promise<TestingModeConfig> {
    try {
        const row = await prisma.siteConfig.findUnique({
            where: { key: TESTING_MODE_KEY },
        });
        if (!row) return DEFAULT_TESTING_MODE;
        const parsed = JSON.parse(row.value);
        // Shallow-merge with default so partial saves don't break the contract
        return {
            ...DEFAULT_TESTING_MODE,
            ...parsed,
            // Coerce types defensively — admin form might submit strings
            enabled: parsed.enabled === true || parsed.enabled === 'true',
            showModalOnFirstVisit:
                parsed.showModalOnFirstVisit === true || parsed.showModalOnFirstVisit === 'true',
            version: typeof parsed.version === 'number' ? parsed.version : DEFAULT_TESTING_MODE.version,
        };
    } catch {
        return DEFAULT_TESTING_MODE;
    }
}

/** Storage key constant — exported so the admin form writes to the same key. */
export const TESTING_MODE_STORAGE_KEY = TESTING_MODE_KEY;

/* ─── Social URLs (for JsonLdOrganization sameAs) ──────────────────────── */

export type SocialUrls = {
    instagram: string | null;
    facebook: string | null;
    twitter: string | null;
    tiktok: string | null;
    linkedin: string | null;
    youtube: string | null;
};

/** Load all social_* SiteConfig values in one query. Returns null for any
 *  unset / empty key. Used by JsonLdOrganization at the public layout. */
export async function getSocialUrls(): Promise<SocialUrls> {
    const rows = await prisma.siteConfig.findMany({
        where: { key: { in: [
            'social_instagram',
            'social_facebook',
            'social_twitter',
            'social_tiktok',
            'social_linkedin',
            'social_youtube',
        ] } },
    });
    const byKey = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const pick = (k: string): string | null => {
        const v = byKey[k]?.trim();
        return v && /^https?:\/\//.test(v) ? v : null;
    };
    return {
        instagram: pick('social_instagram'),
        facebook:  pick('social_facebook'),
        twitter:   pick('social_twitter'),
        tiktok:    pick('social_tiktok'),
        linkedin:  pick('social_linkedin'),
        youtube:   pick('social_youtube'),
    };
}
