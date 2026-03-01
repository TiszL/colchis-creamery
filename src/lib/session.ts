import { signToken, verifyToken } from "./auth";
import { cookies } from "next/headers";

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
    return signToken({ userId, role, email, name: name || "" });
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
    return verifyToken(token);
}
