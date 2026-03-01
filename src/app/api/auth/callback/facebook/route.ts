import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setSession } from "@/lib/session";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    const siteUrl = req.nextUrl.origin;

    if (!code) {
        return NextResponse.redirect(new URL("/login?error=OAuthCodeMissing", siteUrl));
    }

    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = `${siteUrl}/api/auth/callback/facebook`;

    if (!clientId || !clientSecret) {
        return NextResponse.redirect(new URL("/login?error=ConfigurationMissing", siteUrl));
    }

    try {
        // 1. Exchange code for tokens
        const tokenRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${clientId}&redirect_uri=${redirectUri}&client_secret=${clientSecret}&code=${code}`);

        const tokenData = await tokenRes.json();
        if (tokenData.error) {
            console.error("Facebook token error:", tokenData);
            return NextResponse.redirect(new URL("/login?error=OAuthTokenFailed", siteUrl));
        }

        // 2. Fetch user profile
        const userRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${tokenData.access_token}`);
        const userData = await userRes.json();

        if (!userData.email) {
            return NextResponse.redirect(new URL("/login?error=EmailRequired", siteUrl));
        }

        // 3. Find or create user
        let user = await prisma.user.findUnique({
            where: { email: userData.email }
        });

        if (!user) {
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
                    provider: "facebook",
                    providerAccountId: userData.id
                }
            }
        });

        if (!account) {
            await prisma.account.create({
                data: {
                    userId: user.id,
                    provider: "facebook",
                    providerAccountId: userData.id,
                    accessToken: tokenData.access_token,
                }
            });
        }

        // 4. Set session via standard JWT system
        await setSession(user.id, user.role, user.email, user.name || undefined);

        // 5. Redirect to account page
        return NextResponse.redirect(new URL("/account", siteUrl));

    } catch (error) {
        console.error("Facebook OAuth callback error:", error);
        return NextResponse.redirect(new URL("/login?error=OAuthFailed", siteUrl));
    }
}
