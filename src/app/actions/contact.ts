"use server";

import { sendContactFormEmail } from "@/lib/email";

// ── In-memory rate limiter (per IP simulation via timestamp) ─────────────────
// In production with multiple serverless instances, this resets per cold start,
// which is acceptable. For heavy traffic, use Redis-based rate limiting.
const recentSubmissions = new Map<string, number[]>();

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 3; // max 3 submissions per window

function isRateLimited(fingerprint: string): boolean {
    const now = Date.now();
    const timestamps = recentSubmissions.get(fingerprint) || [];
    
    // Clean old entries
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    recentSubmissions.set(fingerprint, recent);
    
    if (recent.length >= RATE_LIMIT_MAX) return true;
    
    recent.push(now);
    recentSubmissions.set(fingerprint, recent);
    return false;
}

// ── Server Action ────────────────────────────────────────────────────────────
export async function submitContactFormAction(formData: FormData) {
    // 1. Honeypot check — if bot filled the hidden field, silently succeed
    const honeypot = formData.get("website") as string;
    if (honeypot) {
        console.log("[Contact] Honeypot triggered — likely bot.");
        // Return success to not reveal the trap
        return { success: true };
    }

    // 2. Timing check — bots submit instantly, humans take >2s
    const loadedAt = formData.get("_t") as string;
    if (loadedAt) {
        const elapsed = Date.now() - parseInt(loadedAt, 10);
        if (elapsed < 2000) {
            console.log("[Contact] Submitted too fast (<2s) — likely bot.");
            return { success: true };
        }
    }

    // 3. Extract and validate fields
    const name = (formData.get("name") as string || "").trim();
    const email = (formData.get("email") as string || "").trim();
    const message = (formData.get("message") as string || "").trim();

    if (!name || name.length < 2) return { error: "Please enter your full name." };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address." };
    if (!message || message.length < 10) return { error: "Message must be at least 10 characters." };
    if (name.length > 100) return { error: "Name is too long." };
    if (email.length > 200) return { error: "Email is too long." };
    if (message.length > 5000) return { error: "Message is too long (max 5000 characters)." };

    // 4. Check for common spam patterns
    const spamPatterns = [
        /\b(viagra|cialis|casino|poker|lottery|prize)\b/i,
        /https?:\/\/[^\s]+\.[^\s]+/gi, // URLs in message (suspicious for contact forms)
    ];
    const urlCount = (message.match(/https?:\/\//gi) || []).length;
    if (urlCount > 2) return { error: "Too many links in message." };
    for (const pattern of spamPatterns) {
        if (pattern.test(message)) {
            console.log("[Contact] Spam pattern detected in message.");
            return { success: true }; // Silent success to not reveal detection
        }
    }

    // 5. Rate limiting (by email fingerprint)
    if (isRateLimited(email)) {
        return { error: "You've sent too many messages. Please try again in a few minutes." };
    }

    // 6. Send email via Resend
    const result = await sendContactFormEmail({ name, email, message });

    if (!result.success) {
        console.error("[Contact] Email send failed:", result.error);
        return { error: "Failed to send message. Please try again or email us directly." };
    }

    return { success: true };
}
