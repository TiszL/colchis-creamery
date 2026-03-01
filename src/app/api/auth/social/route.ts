import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    if (provider === "google") {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = `${siteUrl}/api/auth/callback/google`;

        if (!clientId) {
            return NextResponse.json({ error: "Google Client ID not configured" }, { status: 500 });
        }

        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.searchParams.append("client_id", clientId);
        url.searchParams.append("redirect_uri", redirectUri);
        url.searchParams.append("response_type", "code");
        url.searchParams.append("scope", "email profile");
        url.searchParams.append("access_type", "offline");
        url.searchParams.append("prompt", "consent");

        return NextResponse.redirect(url.toString());
    }

    if (provider === "facebook") {
        const clientId = process.env.FACEBOOK_APP_ID;
        const redirectUri = `${siteUrl}/api/auth/callback/facebook`;

        if (!clientId) {
            return NextResponse.json({ error: "Facebook App ID not configured" }, { status: 500 });
        }

        const url = new URL("https://www.facebook.com/v18.0/dialog/oauth");
        url.searchParams.append("client_id", clientId);
        url.searchParams.append("redirect_uri", redirectUri);
        url.searchParams.append("scope", "email,public_profile");
        url.searchParams.append("response_type", "code");

        return NextResponse.redirect(url.toString());
    }

    if (provider === "twitter") {
        const clientId = process.env.TWITTER_CLIENT_ID;
        const redirectUri = `${siteUrl}/api/auth/callback/twitter`;

        if (!clientId) {
            return NextResponse.json({ error: "Twitter Client ID not configured" }, { status: 500 });
        }

        // Twitter requires code_challenge and state for OAuth 2.0 PKCE
        const state = Math.random().toString(36).substring(7);
        const codeChallenge = "challenge"; // Simplified testing challenge, full PKCE better for prod

        const url = new URL("https://twitter.com/i/oauth2/authorize");
        url.searchParams.append("response_type", "code");
        url.searchParams.append("client_id", clientId);
        url.searchParams.append("redirect_uri", redirectUri);
        url.searchParams.append("scope", "tweet.read users.read offline.access");
        url.searchParams.append("state", state);
        url.searchParams.append("code_challenge", codeChallenge);
        url.searchParams.append("code_challenge_method", "plain");

        const response = NextResponse.redirect(url.toString());
        // Set state in cookie to verify later
        response.cookies.set("twitter_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 60 * 10 });
        return response;
    }

    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
}
