import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionTokenValue, getSessionOptions } from "@/lib/session";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    const siteUrl = req.nextUrl.origin;

    if (!code) {
        return NextResponse.redirect(new URL("/login?error=OAuthCodeMissing", siteUrl));
    }

    // CSRF + PKCE: verify state against the cookie set at authorize time and
    // recover the per-request PKCE verifier (no more hardcoded plain challenge).
    const stateCookie = req.cookies.get("twitter_oauth_state")?.value;
    const codeVerifier = req.cookies.get("twitter_oauth_verifier")?.value;
    if (!state || !stateCookie || state !== stateCookie || !codeVerifier) {
        return NextResponse.redirect(new URL("/login?error=OAuthState", siteUrl));
    }

    const clientId = process.env.TWITTER_CLIENT_ID;
    // Twitter PKCE often works with just client ID (public client), but we can pass secret if needed
    // Optional: Twitter PKCE public clients have no secret. undefined (not "")
    // keeps the downstream `if (clientSecret)` guard meaningful.
    const clientSecret = process.env.TWITTER_CLIENT_SECRET || undefined;
    const redirectUri = `${siteUrl}/api/auth/callback/twitter`;

    if (!clientId) {
        return NextResponse.redirect(new URL("/login?error=ConfigurationMissing", siteUrl));
    }

    try {
        // 1. Exchange code for tokens (PKCE)
        const params = new URLSearchParams({
            code,
            grant_type: "authorization_code",
            client_id: clientId,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        });

        // For Twitter OAuth 2.0 PKCE, if it is a Confidential Client, you need the Basic Auth header.
        // If it is a Public Client, you ONLY need the client_id in the body.
        // By default, let's pass it strictly in the body and use Basic Auth ONLY if secret exists.
        const headers: Record<string, string> = {
            "Content-Type": "application/x-www-form-urlencoded"
        };

        if (clientSecret) {
            const encodedId = encodeURIComponent(clientId);
            const encodedSecret = encodeURIComponent(clientSecret);
            const authHeader = Buffer.from(`${encodedId}:${encodedSecret}`).toString("base64");
            headers["Authorization"] = `Basic ${authHeader}`;
        }

        const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
            method: "POST",
            headers,
            body: params,
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || tokenData.error) {
            console.error("Twitter token error FULL RESPONSE:", JSON.stringify(tokenData, null, 2));
            return NextResponse.redirect(new URL(`/login?error=OAuthTokenFailed&details=${encodeURIComponent(tokenData.error_description || tokenData.error || "Unknown")}`, siteUrl));
        }

        // 2. Fetch user profile
        const userRes = await fetch("https://api.twitter.com/2/users/me?user.fields=id,name,username", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userJson = await userRes.json();
        const userData = userJson.data;

        // Twitter v2 might not return email unless elevated permissions are used, 
        // If email is missing, we use a placeholder or fail
        // Note: Twitter API v2 user endpoint doesn't return email natively easily without elevated OAuth 1.0a or specific scopes.
        // Let's use it if available, otherwise fallback to twitter user ID.
        const email = `${userData.username}@twitter.oauth.placeholder`;

        // 3. Find or create user
        // Instead of strict email, we check the account first
        let account = await prisma.account.findUnique({
            where: {
                provider_providerAccountId: {
                    provider: "twitter",
                    providerAccountId: userData.id
                }
            },
            include: { user: true }
        });

        let user;
        if (account) {
            user = account.user;
        } else {
            // Check if email somehow matches. Phase 11: scope to B2C — social
            // login is retail-only; partners use password at /b2b/login.
            user = await prisma.user.findFirst({ where: { email, role: "B2C_CUSTOMER" } });

            if (!user) {
                user = await prisma.user.create({
                    data: {
                        email,
                        name: userData.name || userData.username,
                        role: "B2C_CUSTOMER",
                        profile: {
                            create: {}
                        }
                    }
                });
            }

            await prisma.account.create({
                data: {
                    userId: user.id,
                    provider: "twitter",
                    providerAccountId: userData.id,
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token,
                }
            });
        }

        // 4. Set session via standard JWT system
        const token = await getSessionTokenValue(user.id, user.role, user.email, user.name || undefined);

        // 5. Redirect to account page
        const response = NextResponse.redirect(new URL("/account", siteUrl));
        response.cookies.set("auth_token", token, getSessionOptions());
        response.cookies.delete("twitter_oauth_state");
        response.cookies.delete("twitter_oauth_verifier");
        return response;

    } catch (error) {
        console.error("Twitter OAuth callback error:", error);
        return NextResponse.redirect(new URL("/login?error=OAuthFailed", siteUrl));
    }
}
