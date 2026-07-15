// Launch polish — server-side error tracking (Sentry), env-gated.
//
// Without a DSN this is a complete no-op: nothing initializes, nothing is
// sent. To activate: create a (free-tier) Sentry project and set SENTRY_DSN
// (server) + NEXT_PUBLIC_SENTRY_DSN (client) in Vercel env. Until then the
// 58 console.error sites only reach short-retention Vercel logs; money-path
// failures additionally email ops (sendOpsAlertEmail), which stays the
// primary alert channel either way.

import * as Sentry from '@sentry/nextjs';

export async function register() {
    if (!process.env.SENTRY_DSN) return;
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        // Errors are the point; keep performance tracing near-off to stay in
        // free tier.
        tracesSampleRate: 0.02,
    });
}

// Captures errors from React Server Components / route handlers that Next
// would otherwise only log. No-op when init was skipped (no DSN).
export const onRequestError = Sentry.captureRequestError;
