import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setSession } from "@/lib/session";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
        return NextResponse.redirect(new URL("/login?error=OAuthCodeMissing", req.url));
    }

    const clientId = process.env.TWITTER_CLIENT_ID;
    // Twitter PKCE often works with just client ID (public client), but we can pass secret if needed
    const clientSecret = process.env.TWITTER_CLIENT_SECRET || "";
    const siteUrl = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const redirectUri = `${siteUrl}/api/auth/callback/twitter`;

    if (!clientId) {
        return NextResponse.redirect(new URL("/login?error=ConfigurationMissing", req.url));
    }

    try {
        // 1. Exchange code for tokens (PKCE)
        const params = new URLSearchParams({
            code,
            grant_type: "authorization_code",
            client_id: clientId,
            redirect_uri: redirectUri,
            code_verifier: "challenge", // Same as in initiator route (plain method)
        });

        const headers: Record<string, string> = {
            "Content-Type": "application/x-www-form-urlencoded"
        };

        if (clientSecret) {
            const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
            headers["Authorization"] = `Basic ${authHeader}`;
        }

        const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
            method: "POST",
            headers,
            body: params,
        });

        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            console.error("Twitter token error:", tokenData);
            return NextResponse.redirect(new URL("/login?error=OAuthTokenFailed", req.url));
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
            // Check if email somehow matches
            user = await prisma.user.findUnique({ where: { email } });

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
        await setSession(user.id, user.role, user.email, user.name || undefined);

        // 5. Redirect to account page
        return NextResponse.redirect(new URL("/account", req.url));

    } catch (error) {
        console.error("Twitter OAuth callback error:", error);
        return NextResponse.redirect(new URL("/login?error=OAuthFailed", req.url));
    }
}
