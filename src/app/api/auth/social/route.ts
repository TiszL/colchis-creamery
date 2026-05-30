import { NextRequest, NextResponse } from "next/server";

// ── PKCE + CSRF-state helpers ────────────────────────────────────────────────
function base64url(bytes: Uint8Array): string {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(byteLen = 32): string {
    const bytes = new Uint8Array(byteLen);
    crypto.getRandomValues(bytes);
    return base64url(bytes);
}

async function pkceChallengeS256(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return base64url(new Uint8Array(digest));
}

const STATE_COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 10, // 10 minutes
    path: "/",
};

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    const siteUrl = req.nextUrl.origin;

    if (provider === "google") {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = `${siteUrl}/api/auth/callback/google`;

        if (!clientId) {
            return NextResponse.json({ error: "Google Client ID not configured" }, { status: 500 });
        }

        const state = randomToken();
        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.searchParams.append("client_id", clientId);
        url.searchParams.append("redirect_uri", redirectUri);
        url.searchParams.append("response_type", "code");
        url.searchParams.append("scope", "email profile");
        url.searchParams.append("access_type", "offline");
        url.searchParams.append("prompt", "consent");
        url.searchParams.append("state", state);

        const response = NextResponse.redirect(url.toString());
        response.cookies.set("google_oauth_state", state, STATE_COOKIE_OPTS);
        return response;
    }

    if (provider === "facebook") {
        const clientId = process.env.FACEBOOK_APP_ID;
        const redirectUri = `${siteUrl}/api/auth/callback/facebook`;

        if (!clientId) {
            return NextResponse.json({ error: "Facebook App ID not configured" }, { status: 500 });
        }

        const state = randomToken();
        const url = new URL("https://www.facebook.com/v18.0/dialog/oauth");
        url.searchParams.append("client_id", clientId);
        url.searchParams.append("redirect_uri", redirectUri);
        url.searchParams.append("scope", "email,public_profile");
        url.searchParams.append("response_type", "code");
        url.searchParams.append("state", state);

        const response = NextResponse.redirect(url.toString());
        response.cookies.set("facebook_oauth_state", state, STATE_COOKIE_OPTS);
        return response;
    }

    if (provider === "twitter") {
        const clientId = process.env.TWITTER_CLIENT_ID;
        const redirectUri = `${siteUrl}/api/auth/callback/twitter`;

        if (!clientId) {
            return NextResponse.json({ error: "Twitter Client ID not configured" }, { status: 500 });
        }

        // Real PKCE: a fresh random verifier per request (stored httpOnly so the
        // callback can recover it) + an S256 challenge. Replaces the old
        // hardcoded `plain` challenge, which defeated PKCE entirely.
        const state = randomToken();
        const codeVerifier = randomToken(48); // base64url(48 bytes) ≈ 64 chars (PKCE allows 43–128)
        const codeChallenge = await pkceChallengeS256(codeVerifier);

        const url = new URL("https://twitter.com/i/oauth2/authorize");
        url.searchParams.append("response_type", "code");
        url.searchParams.append("client_id", clientId);
        url.searchParams.append("redirect_uri", redirectUri);
        url.searchParams.append("scope", "tweet.read users.read offline.access");
        url.searchParams.append("state", state);
        url.searchParams.append("code_challenge", codeChallenge);
        url.searchParams.append("code_challenge_method", "S256");

        const response = NextResponse.redirect(url.toString());
        response.cookies.set("twitter_oauth_state", state, STATE_COOKIE_OPTS);
        response.cookies.set("twitter_oauth_verifier", codeVerifier, STATE_COOKIE_OPTS);
        return response;
    }

    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
}
