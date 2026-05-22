/**
 * Phase 4 — Stripe Connect helpers.
 *
 * Owns all direct Stripe.accounts / Stripe.accountLinks API calls so the
 * server actions and webhook handler share one implementation. Status is
 * computed from Stripe's account.requirements payload and stored as a
 * compact string on Location.stripeOnboardingStatus.
 */
import { stripe, isStripeConfigured } from "@/lib/stripe";
import type Stripe from "stripe";

export type ConnectOnboardingStatus = "pending" | "restricted" | "complete";

/**
 * Compute our compact status string from a Stripe account object.
 *
 * - 'complete'   = charges_enabled && payouts_enabled
 *                  (Stripe has accepted the connected account; safe to route
 *                  destination charges)
 * - 'restricted' = details_submitted but Stripe still has currently_due or
 *                  past_due requirements; charges may be limited
 * - 'pending'    = onboarding started but details_submitted=false
 *                  (user hasn't completed the AccountLink flow yet)
 */
export function deriveOnboardingStatus(account: Stripe.Account): ConnectOnboardingStatus {
    if (account.charges_enabled && account.payouts_enabled) return "complete";
    if (account.details_submitted) return "restricted";
    return "pending";
}

interface CreateConnectAccountInput {
    locationId: string;
    locationName: string;
    city: string;
    state: string;
    country: string;
    /** Where Stripe sends the user after onboarding completes or refreshes. */
    returnUrl: string;
    refreshUrl: string;
}

/**
 * Create a Standard connected account for a location and an AccountLink to
 * walk the user through Stripe-hosted onboarding. Caller persists the
 * returned accountId on Location.stripeConnectAccountId immediately so a
 * re-call doesn't orphan accounts.
 */
export async function createConnectAccountWithOnboardingLink(input: CreateConnectAccountInput): Promise<{
    accountId: string;
    onboardingUrl: string;
}> {
    if (!isStripeConfigured()) throw new Error("Stripe is not configured");

    const account = await stripe.accounts.create({
        type: "standard",
        country: input.country || "US",
        metadata: {
            locationId: input.locationId,
            locationName: input.locationName,
        },
    });

    const link = await stripe.accountLinks.create({
        account: account.id,
        return_url: input.returnUrl,
        refresh_url: input.refreshUrl,
        type: "account_onboarding",
    });

    return { accountId: account.id, onboardingUrl: link.url };
}

/**
 * Fetch latest status from Stripe + derive the compact string we store.
 * Returns null if Stripe says the account no longer exists (caller may
 * choose to detach it from the Location).
 */
export async function fetchConnectStatus(accountId: string): Promise<ConnectOnboardingStatus | null> {
    if (!isStripeConfigured()) throw new Error("Stripe is not configured");
    try {
        const account = await stripe.accounts.retrieve(accountId);
        return deriveOnboardingStatus(account);
    } catch (e) {
        const err = e as { code?: string; raw?: { code?: string } };
        if (err?.code === "account_invalid" || err?.raw?.code === "account_invalid") {
            return null;
        }
        throw e;
    }
}

/**
 * Re-issue an onboarding link for a previously-created account that hasn't
 * completed onboarding yet. AccountLinks are short-lived so this is run
 * fresh every time the admin clicks "Continue onboarding".
 */
export async function createOnboardingLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<string> {
    if (!isStripeConfigured()) throw new Error("Stripe is not configured");
    const link = await stripe.accountLinks.create({
        account: accountId,
        return_url: returnUrl,
        refresh_url: refreshUrl,
        type: "account_onboarding",
    });
    return link.url;
}

/**
 * One-time login link to the connected account's Stripe dashboard. Used by
 * the admin status panel "Open Stripe dashboard" button. Returned URLs are
 * single-use, ~5 minutes valid.
 */
export async function createDashboardLoginLink(accountId: string): Promise<string> {
    if (!isStripeConfigured()) throw new Error("Stripe is not configured");
    const link = await stripe.accounts.createLoginLink(accountId);
    return link.url;
}
