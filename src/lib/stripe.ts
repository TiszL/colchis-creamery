// Server-only Stripe SDK client.
// Import from server actions / route handlers only — never from a client component.
//
// 7a.5 (createCheckoutSession server action) calls `stripe.paymentIntents.create({...})`.
// 7a.6 (webhook handler) calls `stripe.webhooks.constructEvent(...)`.

import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
    console.warn('[stripe] STRIPE_SECRET_KEY is not set — server-side Stripe calls will fail.');
}

export const stripe = new Stripe(STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
    apiVersion: '2026-01-28.clover',
    typescript: true,
});

export function isStripeConfigured(): boolean {
    return !!STRIPE_SECRET_KEY && STRIPE_SECRET_KEY !== 'sk_test_placeholder';
}

/**
 * Whether the server is running with a LIVE-mode Stripe key (sk_live_/rk_live_).
 * Connect account ids, PaymentIntents, webhooks etc. are mode-scoped — objects
 * created in test mode do not exist in live mode. Anything that stores or
 * routes to a mode-scoped Stripe id must check this.
 */
export function isStripeLiveMode(): boolean {
    return /^(sk|rk)_live_/.test(STRIPE_SECRET_KEY ?? '');
}
