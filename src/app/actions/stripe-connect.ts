"use server";

/**
 * Phase 4 (4b) — Stripe Connect server actions invoked from the admin UI.
 *
 * All three are master-admin-only — Connect onboarding mutates legal +
 * payout infrastructure, so it's intentionally not delegated to the
 * per-location operator roles introduced in Phase 2.
 */
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
    createConnectAccountWithOnboardingLink,
    createOnboardingLink,
    fetchConnectStatus,
    createDashboardLoginLink,
} from "@/lib/stripe-connect";

async function assertMasterAdmin(): Promise<void> {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") throw new Error("Forbidden");
}

function siteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/**
 * Create (or re-issue) an onboarding link for a location.
 *
 * - If the location has no stripeConnectAccountId, create a new Standard
 *   connected account first, persist the ID + 'pending' status, then
 *   generate the AccountLink.
 * - If the account already exists but isn't 'complete', just generate a
 *   fresh AccountLink — Stripe handles "resume where you left off".
 * - If the account is already 'complete', do nothing (caller's UI will
 *   show "Open Stripe dashboard" instead).
 */
export async function createOrRefreshOnboardingLinkAction(
    formData: FormData,
): Promise<{ ok: true; onboardingUrl: string } | { ok: false; error: string }> {
    try {
        await assertMasterAdmin();
        const locationId = formData.get("locationId") as string;
        if (!locationId) return { ok: false, error: "locationId is required" };

        const location = await prisma.location.findUnique({
            where: { id: locationId },
            select: {
                id: true, name: true, city: true, state: true, country: true,
                stripeConnectAccountId: true, stripeOnboardingStatus: true,
            },
        });
        if (!location) return { ok: false, error: "Location not found" };

        const returnUrl  = `${siteUrl()}/admin/locations?connect=ok&loc=${location.id}`;
        const refreshUrl = `${siteUrl()}/admin/locations?connect=refresh&loc=${location.id}`;

        // Already complete — caller should show dashboard link instead.
        if (location.stripeOnboardingStatus === "complete" && location.stripeConnectAccountId) {
            return { ok: false, error: "Account is already fully onboarded. Use the dashboard link." };
        }

        let accountId = location.stripeConnectAccountId;
        let onboardingUrl: string;

        if (!accountId) {
            const created = await createConnectAccountWithOnboardingLink({
                locationId: location.id,
                locationName: location.name,
                city: location.city,
                state: location.state,
                country: location.country,
                returnUrl,
                refreshUrl,
            });
            accountId = created.accountId;
            onboardingUrl = created.onboardingUrl;

            // Persist the account ID + initial status BEFORE returning so an
            // interrupted onboarding never orphans the Stripe account.
            await prisma.location.update({
                where: { id: location.id },
                data: {
                    stripeConnectAccountId: accountId,
                    stripeOnboardingStatus: "pending",
                    stripeOnboardingUpdatedAt: new Date(),
                },
            });
        } else {
            onboardingUrl = await createOnboardingLink(accountId, returnUrl, refreshUrl);
        }

        revalidatePath("/[locale]/admin/locations", "page");
        return { ok: true, onboardingUrl };
    } catch (e) {
        console.error("[createOrRefreshOnboardingLinkAction]", e);
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

/**
 * Manual status refresh. Pulls latest from Stripe and updates the cached
 * status string. Webhook (4d) will keep this fresh automatically; this
 * action exists for impatient admins + as a fallback if webhooks are lost.
 */
export async function refreshConnectStatusAction(
    formData: FormData,
): Promise<{ ok: true; status: string | null } | { ok: false; error: string }> {
    try {
        await assertMasterAdmin();
        const locationId = formData.get("locationId") as string;
        if (!locationId) return { ok: false, error: "locationId is required" };

        const location = await prisma.location.findUnique({
            where: { id: locationId },
            select: { stripeConnectAccountId: true },
        });
        if (!location?.stripeConnectAccountId) return { ok: false, error: "No connected account on file" };

        const status = await fetchConnectStatus(location.stripeConnectAccountId);

        // Stripe says the account is gone — clear our pointer so the admin
        // can start fresh. Otherwise just update the status.
        if (status === null) {
            await prisma.location.update({
                where: { id: locationId },
                data: {
                    stripeConnectAccountId: null,
                    stripeOnboardingStatus: null,
                    stripeOnboardingUpdatedAt: new Date(),
                },
            });
        } else {
            await prisma.location.update({
                where: { id: locationId },
                data: {
                    stripeOnboardingStatus: status,
                    stripeOnboardingUpdatedAt: new Date(),
                },
            });
        }

        revalidatePath("/[locale]/admin/locations", "page");
        return { ok: true, status };
    } catch (e) {
        console.error("[refreshConnectStatusAction]", e);
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

/**
 * Get a one-time Stripe-dashboard login URL for the location's connected
 * account. URLs are single-use + short-lived; admin clicks button → we
 * generate fresh URL → redirect to it.
 */
export async function getDashboardLinkAction(
    formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
    try {
        await assertMasterAdmin();
        const locationId = formData.get("locationId") as string;
        if (!locationId) return { ok: false, error: "locationId is required" };

        const location = await prisma.location.findUnique({
            where: { id: locationId },
            select: { stripeConnectAccountId: true, stripeOnboardingStatus: true },
        });
        if (!location?.stripeConnectAccountId) return { ok: false, error: "No connected account on file" };
        if (location.stripeOnboardingStatus !== "complete") {
            return { ok: false, error: "Account onboarding is incomplete — finish onboarding first." };
        }

        const url = await createDashboardLoginLink(location.stripeConnectAccountId);
        return { ok: true, url };
    } catch (e) {
        console.error("[getDashboardLinkAction]", e);
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}
