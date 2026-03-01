import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionTokenValue, getSessionOptions } from "@/lib/session";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    const siteUrl = req.nextUrl.origin;

    if (!code) {
        return NextResponse.redirect(new URL("/login?error=OAuthCodeMissing", siteUrl));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${siteUrl}/api/auth/callback/google`;

    if (!clientId || !clientSecret) {
        return NextResponse.redirect(new URL("/login?error=ConfigurationMissing", siteUrl));
    }

    try {
        // 1. Exchange code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });

        const tokenData = await tokenRes.json();
        if (tokenData.error) {
            console.error("Google token error:", tokenData);
            return NextResponse.redirect(new URL("/login?error=OAuthTokenFailed", siteUrl));
        }

        // 2. Fetch user profile
        const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userData = await userRes.json();

        if (!userData.email) {
            return NextResponse.redirect(new URL("/login?error=EmailRequired", siteUrl));
        }

        // 3. Find or create user
        let user = await prisma.user.findUnique({
            where: { email: userData.email }
        });

        if (!user) {
            // Create user and profile
            user = await prisma.user.create({
                data: {
                    email: userData.email,
                    name: userData.name || "Customer",
                    role: "B2C_CUSTOMER",
                    profile: {
                        create: {}
                    }
                }
            });
        }

        // Ensure Account link exists
        const account = await prisma.account.findUnique({
            where: {
                provider_providerAccountId: {
                    provider: "google",
                    providerAccountId: userData.id
                }
            }
        });

        if (!account) {
            await prisma.account.create({
                data: {
                    userId: user.id,
                    provider: "google",
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
        return response;

    } catch (error: any) {
        console.error("Google OAuth callback error:", error);
        return NextResponse.json({
            error: "OAuthFailed",
            message: error?.message,
            stack: error?.stack,
            name: error?.name
        }, { status: 500 });
    }
}
