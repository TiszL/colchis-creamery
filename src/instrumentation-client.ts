// Launch polish — client-side error tracking (Sentry), env-gated.
// No NEXT_PUBLIC_SENTRY_DSN → complete no-op. See src/instrumentation.ts.

import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 0,
    });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
