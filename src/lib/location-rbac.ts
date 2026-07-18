/**
 * Phase 2 (2b) — Per-location RBAC helpers.
 *
 * Companion to lib/session.ts. While session.ts answers "who is logged in
 * and what's their GLOBAL role?", this answers "what LOCATIONS can this
 * user touch and with what location-scoped role?".
 *
 * Master admin bypass: MASTER_ADMIN always has full access to every
 * location regardless of UserLocation rows. This is enforced once here so
 * page/layout/action code doesn't have to repeat the check.
 */
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import type { LocationRole } from "@prisma/client";

export interface LocationAccess {
    locationId: string;
    locationName: string;
    roles: LocationRole[]; // a user can hold several roles at one location
}

export interface ResolvedLocationContext {
    userId: string;
    role: string;            // global role from JWT (MASTER_ADMIN, etc.)
    isMasterAdmin: boolean;
    /** Locations the user has explicit access to (empty for MASTER_ADMIN — they bypass). */
    locations: LocationAccess[];
}

/**
 * Resolve the current user's location-scoped access. Returns null when not
 * signed in. For master admins, locations[] is empty (they bypass per-row
 * checks); callers should consult isMasterAdmin and grant access globally.
 */
export async function getLocationContext(): Promise<ResolvedLocationContext | null> {
    const session = await getSession();
    if (!session) return null;

    const isMasterAdmin = session.role === "MASTER_ADMIN";

    if (isMasterAdmin) {
        return {
            userId: session.userId,
            role: session.role,
            isMasterAdmin: true,
            locations: [],
        };
    }

    const rows = await prisma.userLocation.findMany({
        where: { userId: session.userId },
        include: { location: { select: { id: true, name: true } } },
    });

    const grouped = new Map<string, LocationAccess>();
    for (const r of rows) {
        const existing = grouped.get(r.locationId);
        if (existing) {
            existing.roles.push(r.role);
        } else {
            grouped.set(r.locationId, {
                locationId: r.locationId,
                locationName: r.location.name,
                roles: [r.role],
            });
        }
    }

    return {
        userId: session.userId,
        role: session.role,
        isMasterAdmin: false,
        locations: Array.from(grouped.values()),
    };
}

/**
 * Page-guard: redirect-unless-authorized. Returns the resolved context
 * (with the matched location for non-admins) once it's confirmed the user
 * may access this location with at least one of `requiredRoles` (or any
 * role when requiredRoles is omitted).
 *
 * - Not signed in → redirect to /portal-login
 * - Signed in but lacks role → redirect to /staff (which will render their
 *   own scope), avoids leaking which locations exist
 * - Master admin → always granted; matchedLocation is null (they're global)
 */
export async function requireLocationAccess(
    locationId: string,
    requiredRoles?: LocationRole[],
): Promise<{ ctx: ResolvedLocationContext; matchedLocation: LocationAccess | null }> {
    const ctx = await getLocationContext();
    if (!ctx) redirect("/portal-login");

    if (ctx.isMasterAdmin) return { ctx, matchedLocation: null };

    const match = ctx.locations.find(l => l.locationId === locationId);
    if (!match) redirect("/staff");

    if (requiredRoles && requiredRoles.length > 0) {
        const ok = match.roles.some(r => requiredRoles.includes(r));
        if (!ok) redirect("/staff");
    }

    return { ctx, matchedLocation: match };
}

/**
 * Lightweight check used in non-page contexts (server actions, API routes).
 * Returns a boolean rather than redirecting so the caller can surface a
 * specific error to the client.
 */
export async function hasLocationRole(
    userId: string,
    locationId: string,
    role?: LocationRole,
): Promise<boolean> {
    const row = await prisma.userLocation.findFirst({
        where: {
            userId,
            locationId,
            ...(role ? { role } : {}),
        },
        select: { id: true },
    });
    return row !== null;
}

/**
 * For server actions invoked by a logged-in user. Throws when the caller
 * lacks the role at the location. Master admin bypass.
 *
 * `roles` is ALL the caller's roles at this location (not just the matched
 * ones) so callers can apply finer gates — e.g. a SERVER passing the shared
 * queue gate but being limited to dine-in mutations. Empty for master admin.
 */
export async function assertLocationRole(
    locationId: string,
    requiredRoles: LocationRole[],
): Promise<{ userId: string; isMasterAdmin: boolean; roles: LocationRole[] }> {
    const session = await getSession();
    if (!session) throw new Error("Not signed in");
    if (session.role === "MASTER_ADMIN") {
        return { userId: session.userId, isMasterAdmin: true, roles: [] };
    }
    const rows = await prisma.userLocation.findMany({
        where: { userId: session.userId, locationId },
        select: { role: true },
    });
    const roles = rows.map(r => r.role);
    if (!roles.some(r => requiredRoles.includes(r))) throw new Error("Forbidden: missing location role");
    return { userId: session.userId, isMasterAdmin: false, roles };
}
