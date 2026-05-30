import { signToken, verifyToken } from "./auth";
import { cookies } from "next/headers";
import { prisma } from "./db";

export function getSessionOptions() {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7); // 7 days

    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        expires: expiry,
        path: "/",
    };
}

export async function getSessionTokenValue(
    userId: string,
    role: string,
    email: string,
    name?: string
) {
    // Stamp the current session version into the token so it can be invalidated
    // later (role change / forced logout) by bumping User.sessionVersion.
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { sessionVersion: true },
    });
    return signToken({ userId, role, email, name: name || "", sessionVersion: user?.sessionVersion ?? 0 });
}

export async function setSession(
    userId: string,
    role: string,
    email: string,
    name?: string
) {
    const token = await getSessionTokenValue(userId, role, email, name);
    (await cookies()).set("auth_token", token, getSessionOptions());
}

export async function clearSession() {
    (await cookies()).delete("auth_token");
}

export async function getSessionToken(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get("auth_token")?.value || null;
}

export async function getSession() {
    const token = await getSessionToken();
    if (!token) return null;
    const payload = await verifyToken(token);
    if (!payload) return null;
    // Live validation: reject the session if the user is gone, has been
    // deactivated, or the token's session version is stale (a role change or
    // forced logout bumps User.sessionVersion). This is what makes a
    // demoted/fired user lose access immediately instead of riding their
    // existing 7-day cookie. Note: middleware can't do this (no DB at the edge),
    // so getSession() is the authoritative gate the pages/actions rely on.
    const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { isActive: true, sessionVersion: true },
    });
    if (!user || !user.isActive || user.sessionVersion !== (payload.sessionVersion ?? 0)) {
        return null;
    }
    return payload;
}
