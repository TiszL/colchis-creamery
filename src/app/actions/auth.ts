"use server";

import bcryptjs from "bcryptjs";
import { randomBytes, randomInt } from "crypto";
import { rateLimit, callerIp, rateLimitMessage } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { setSession, clearSession, getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
    sendVerificationEmail, send2FAEmail, generateVerificationCode,
    sendB2bEmailChangeRequest, sendB2bEmailChangeUnlocked, sendPasswordResetEmail,
    sendKitchenWelcomeEmail,
} from "@/lib/email";
import { normalizeUSPhone } from "@/lib/phone";

// ── Role Constants ────────────────────────────────────────────────────────────
const STAFF_ROLES = ["MASTER_ADMIN", "PRODUCT_MANAGER", "CONTENT_MANAGER", "SALES"];
const CUSTOMER_ROLES = ["B2C_CUSTOMER", "B2B_PARTNER"];

// ──────────────────────────────────────────────────────────────────────────────
// B2C (Retail Customer) Actions
// ──────────────────────────────────────────────────────────────────────────────

export async function loginAction(formData: FormData) {
    const email = ((formData.get("email") as string) || "").trim().toLowerCase();
    const password = formData.get("password") as string;
    // Phase 11: login form posts a hidden `context` so we can scope the
    // user lookup to the right role bucket. Same email may map to BOTH a
    // D2C and a B2B identity now; the form the user submitted dictates
    // which one we resolve. Defaults to 'b2c' so old/missing context still
    // returns the retail account.
    const context = ((formData.get("context") as string) || "b2c").toLowerCase();

    if (!email || !password) {
        return { error: "Email and password are required." };
    }

    // Credential stuffing / password spraying protection: per-IP and per-email
    // fixed windows. Generous enough that a fumbled password never hits it.
    const ip = await callerIp();
    for (const [key, max] of [[`login:ip:${ip}`, 20], [`login:email:${email}`, 8]] as const) {
        const rl = await rateLimit(key, max, 300);
        if (!rl.ok) return { error: rateLimitMessage(rl) };
    }

    try {
        // Phase 11: scope to context-appropriate roles. /b2b/login posts
        // context=b2b so a partner with both identities lands in their B2B
        // account; /login posts context=b2c and lands them in retail.
        // Security: MASTER_ADMIN (and all staff) must NOT authenticate through the
        // retail / B2B doors — those skip the mandatory 2FA enforced by
        // staffLoginAction. Scope the lookup to customer roles only so the retail
        // door can never mint a privileged session with a single factor.
        const acceptedRoles = context === "b2b"
            ? ["B2B_PARTNER"]
            : CUSTOMER_ROLES.filter(r => r !== "B2B_PARTNER");

        const user = await prisma.user.findFirst({
            where: { email, role: { in: acceptedRoles } },
        });

        if (!user || !user.isActive) {
            // If this email is actually a staff/admin account, steer them to the
            // staff portal (which enforces 2FA) instead of a bare "invalid
            // credentials" — the retail door must never authenticate a staff role.
            const staffAccount = await prisma.user.findFirst({
                where: { email, role: { in: [...STAFF_ROLES, "ANALYTICS_VIEWER"] } },
                select: { id: true },
            });
            if (staffAccount) {
                return { error: "Staff accounts must sign in through the staff portal." };
            }
            return { error: "Invalid credentials." };
        }

        // Belt-and-suspenders: still verify the role bucket fits this context
        // even though findFirst already filtered. Defense in depth.
        if (!acceptedRoles.includes(user.role)) {
            return context === "b2b"
                ? { error: "This account isn't a B2B partner. Use the retail sign-in instead." }
                : { error: "Staff/partner accounts must use the dedicated sign-in portal." };
        }

        if (!user.passwordHash) {
            return { error: "Please log in using your social account." };
        }

        const passwordsMatch = await bcryptjs.compare(password, user.passwordHash);

        if (!passwordsMatch) {
            return { error: "Invalid credentials." };
        }

        // Check email verification
        if (!user.emailVerified) {
            // Generate new code and send
            const code = generateVerificationCode();
            const expiry = new Date(Date.now() + 15 * 60 * 1000);

            await prisma.user.update({
                where: { id: user.id },
                data: { verificationCode: code, verificationExpiry: expiry },
            });

            await sendVerificationEmail(user.email, code, user.name || undefined);

            return {
                error: "Please verify your email first. We've sent a new code.",
                needsVerification: true,
                email: user.email,
            };
        }

        await setSession(user.id, user.role, user.email, user.name || undefined);

        return { success: true, role: user.role };
    } catch (error) {
        console.error("Login action error:", error);
        return { error: "An unexpected error occurred during login." };
    }
}

// ── B2B self-service password reset ───────────────────────────────────────────
// Request: always returns ok (never reveals whether the email exists). If a B2B
// partner matches, we mint a single-use token (1h) and email a reset link.
export async function requestB2bPasswordResetAction(formData: FormData): Promise<{ ok: true }> {
    const email = ((formData.get("email") as string) || "").trim().toLowerCase();
    // Email-bomb protection: silently drop over-limit requests (this action
    // never reveals outcomes anyway).
    const resetRl = await rateLimit(`pwreset:ip:${await callerIp()}`, 5, 3600);
    if (!resetRl.ok) return { ok: true };
    if (email) {
        const user = await prisma.user.findFirst({ where: { email, role: "B2B_PARTNER" }, select: { id: true, email: true, name: true } });
        if (user) {
            const token = randomBytes(32).toString("hex");
            await prisma.user.update({
                where: { id: user.id },
                data: { passwordResetToken: token, passwordResetExpiry: new Date(Date.now() + 60 * 60 * 1000) },
            });
            const base = process.env.NEXT_PUBLIC_SITE_URL || "";
            const link = `${base}/en/b2b/reset-password?token=${token}`;
            await sendPasswordResetEmail(user.email, link, user.name || undefined).catch(() => undefined);
        }
    }
    return { ok: true };
}

// Reset: validate the token + expiry, set the new password, bump sessionVersion
// (invalidates any existing sessions), and clear the token.
export async function resetPasswordWithTokenAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
    const token = (formData.get("token") as string) || "";
    const password = (formData.get("password") as string) || "";
    if (!token) return { ok: false, error: "Missing reset token." };
    if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

    const user = await prisma.user.findFirst({
        where: { passwordResetToken: token, passwordResetExpiry: { gte: new Date() } },
        select: { id: true },
    });
    if (!user) return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };

    const passwordHash = await bcryptjs.hash(password, 12);
    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordResetToken: null, passwordResetExpiry: null, sessionVersion: { increment: 1 } },
    });
    return { ok: true };
}

export async function registerB2CAction(formData: FormData) {
    const name = formData.get("name") as string;
    // Canonicalize email (trim + lowercase) so casing can't create duplicate
    // accounts or lock users out under the @@unique([email, role]) constraint.
    const email = ((formData.get("email") as string) || "").trim().toLowerCase();
    const password = formData.get("password") as string;

    if (!name || !email || !password || password.length < 8) {
        return { error: "Please provide a valid name, email, and password (min 8 characters)." };
    }

    // Bulk fake-account protection.
    const regRl = await rateLimit(`register:ip:${await callerIp()}`, 5, 3600);
    if (!regRl.ok) return { error: rateLimitMessage(regRl) };

    try {
        // Phase 11: only block duplicates within the SAME role bucket.
        // A person who already has a B2B identity at this email can still
        // open a retail account.
        const existing = await prisma.user.findFirst({
            where: { email, role: "B2C_CUSTOMER" },
        });
        if (existing) {
            return { error: "A retail account with this email already exists." };
        }

        const passwordHash = await bcryptjs.hash(password, 12);
        const code = generateVerificationCode();
        const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        const user = await prisma.user.create({
            data: {
                email,
                name,
                passwordHash,
                role: "B2C_CUSTOMER",
                emailVerified: false,
                verificationCode: code,
                verificationExpiry: expiry,
            },
        });

        // Create empty profile for the customer
        await prisma.userProfile.create({
            data: { userId: user.id },
        });

        // Send verification email
        const emailResult = await sendVerificationEmail(email, code, name);

        if (!emailResult.success) {
            console.error("Failed to send verification email:", emailResult.error);
            // Still allow registration but warn
            return {
                success: true,
                needsVerification: true,
                email,
                warning: "Account created but verification email could not be sent. Please try resending.",
            };
        }

        return { success: true, needsVerification: true, email };
    } catch (error) {
        console.error("Register B2C error:", error);
        return { error: "Failed to create account." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Email Verification Actions
// ──────────────────────────────────────────────────────────────────────────────

export async function verifyEmailAction(email: string, code: string) {
    if (!email || !code || code.length !== 6) {
        return { error: "Please enter a valid 6-digit code." };
    }

    // 6-digit codes are brute-forceable at bot speed — cap attempts per email.
    const verifyRl = await rateLimit(`verify:email:${email.toLowerCase()}`, 8, 600);
    if (!verifyRl.ok) return { error: rateLimitMessage(verifyRl) };

    try {
        // Phase 11: scope to B2C — this flow is only called from the retail
        // verify-email page. A B2B partner with the same email shouldn't be
        // resolved here.
        const user = await prisma.user.findFirst({
            where: { email, role: "B2C_CUSTOMER" },
        });

        if (!user) {
            return { error: "Account not found." };
        }

        if (user.emailVerified) {
            return { success: true, alreadyVerified: true };
        }

        if (!user.verificationCode || !user.verificationExpiry) {
            return { error: "No verification code found. Please request a new one." };
        }

        if (new Date() > user.verificationExpiry) {
            return { error: "Verification code has expired. Please request a new one." };
        }

        if (user.verificationCode !== code) {
            return { error: "Incorrect verification code. Please try again." };
        }

        // Verify the email
        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                verificationCode: null,
                verificationExpiry: null,
            },
        });

        // Set session (log them in)
        await setSession(user.id, user.role, user.email, user.name || undefined);

        return { success: true, role: user.role };
    } catch (error) {
        console.error("Verify email error:", error);
        return { error: "Verification failed. Please try again." };
    }
}

export async function resendVerificationAction(email: string) {
    if (!email) {
        return { error: "Email is required." };
    }

    // Email-bomb protection.
    const resendRl = await rateLimit(`resend:email:${email.toLowerCase()}`, 3, 600);
    if (!resendRl.ok) return { error: rateLimitMessage(resendRl) };

    try {
        // Phase 11: B2C-only resend flow.
        const user = await prisma.user.findFirst({
            where: { email, role: "B2C_CUSTOMER" },
        });

        if (!user) {
            // Don't reveal if email exists or not
            return { success: true };
        }

        if (user.emailVerified) {
            return { success: true, alreadyVerified: true };
        }

        // Rate limit: check if last code was sent less than 60 seconds ago
        if (user.verificationExpiry) {
            const lastSent = new Date(user.verificationExpiry.getTime() - 15 * 60 * 1000);
            const secondsSince = (Date.now() - lastSent.getTime()) / 1000;
            if (secondsSince < 60) {
                return {
                    error: `Please wait ${Math.ceil(60 - secondsSince)} seconds before requesting a new code.`,
                };
            }
        }

        const code = generateVerificationCode();
        const expiry = new Date(Date.now() + 15 * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: { verificationCode: code, verificationExpiry: expiry },
        });

        await sendVerificationEmail(email, code, user.name || undefined);

        return { success: true };
    } catch (error) {
        console.error("Resend verification error:", error);
        return { error: "Failed to resend verification code." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// B2B (Wholesaler) Actions
// ──────────────────────────────────────────────────────────────────────────────

export async function registerB2BAction(formData: FormData) {
    const accessCode = formData.get("code") as string;
    const companyName = formData.get("company") as string;
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const password = formData.get("password") as string;

    if (!accessCode || !companyName || !email || !password || password.length < 8) {
        return { error: "Please provide all required fields." };
    }

    try {
        const validCode = await prisma.accessCode.findUnique({
            where: { code: accessCode.toUpperCase() },
        });

        if (!validCode || validCode.type !== "B2B") {
            return { error: "Invalid B2B Access Code." };
        }

        if (validCode.isUsed) {
            return { error: "This Access Code has already been used." };
        }

        if (validCode.expiresAt && validCode.expiresAt < new Date()) {
            return { error: "This Access Code has expired." };
        }

        // Phase 11: instead of rejecting an email mismatch, initiate an
        // email-change confirmation flow. The original invitee gets a
        // confirm-or-deny email; nothing else moves until they click.
        if (validCode.email && validCode.email.toLowerCase() !== email) {
            return await stageAccessCodeEmailChange(validCode.id, validCode.email, email, companyName);
        }

        // Phase 11: only block duplicate B2B identities with this email.
        // A D2C account with the same address is fine and stays separate.
        const existing = await prisma.user.findFirst({
            where: { email, role: "B2B_PARTNER" },
        });
        if (existing) {
            return { error: "A B2B partner account with this email already exists. Sign in instead." };
        }

        const passwordHash = await bcryptjs.hash(password, 12);

        const [, newUser] = await prisma.$transaction([
            prisma.accessCode.update({
                where: { id: validCode.id },
                data: { isUsed: true },
            }),
            prisma.user.create({
                data: {
                    email,
                    passwordHash,
                    name: companyName, // use companyName as display name fallback
                    companyName,
                    role: "B2B_PARTNER",
                    isActiveB2b: true,
                    emailVerified: true, // B2B access code = trusted
                },
            }),
        ]);

        await setSession(newUser.id, newUser.role, newUser.email, newUser.name || newUser.companyName || undefined);

        return { success: true };
    } catch (error) {
        console.error("Register B2B error:", error);
        return { error: "Failed to securely provision B2B partner account." };
    }
}

/**
 * Phase 11 — stage an email-change for a B2B AccessCode and email the
 * original invitee for confirmation. Returns a "pending" response so the
 * register page can show the right UX.
 *
 * Rate-limit: refuses if a pending change was requested in the last 60s.
 * The token expires after 24h; an unconfirmed change just lapses and the
 * code stays locked to the original email until then.
 */
async function stageAccessCodeEmailChange(
    codeId: string,
    originalEmail: string,
    requestedEmail: string,
    companyName: string,
): Promise<{ pendingApproval: true; originalEmail: string } | { error: string }> {
    const code = await prisma.accessCode.findUnique({ where: { id: codeId } });
    if (!code) return { error: "Access code not found." };

    if (code.pendingEmailRequestedAt && Date.now() - code.pendingEmailRequestedAt.getTime() < 60_000) {
        return { error: "Please wait a moment before requesting another email-change." };
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.accessCode.update({
        where: { id: codeId },
        data: {
            pendingEmail: requestedEmail,
            pendingEmailToken: token,
            pendingEmailExpiresAt: expiresAt,
            pendingEmailRequestedAt: new Date(),
        },
    });

    try {
        await sendB2bEmailChangeRequest({
            to: originalEmail,
            originalEmail,
            requestedEmail,
            companyName,
            confirmToken: token,
            accessCode: code.code,
        });
    } catch (e) {
        console.warn("[stageAccessCodeEmailChange] email send failed:", e instanceof Error ? e.message : e);
    }

    return { pendingApproval: true, originalEmail };
}

/**
 * Phase 11 — magic-link target for the original invitee. Confirms an
 * in-flight email change: swaps AccessCode.email to the pendingEmail,
 * clears pending fields, and notifies the new address that registration
 * is unlocked.
 */
export async function confirmAccessCodeEmailChangeAction(token: string): Promise<
    | { ok: true; accessCode: string; newEmail: string }
    | { ok: false; error: string }
> {
    if (!token || token.length < 32) return { ok: false, error: "Invalid confirmation link." };

    try {
        const code = await prisma.accessCode.findUnique({ where: { pendingEmailToken: token } });
        if (!code) return { ok: false, error: "This confirmation link is invalid or already used." };

        if (!code.pendingEmail || !code.pendingEmailExpiresAt) {
            return { ok: false, error: "No pending email change found for this code." };
        }
        if (code.pendingEmailExpiresAt < new Date()) {
            return { ok: false, error: "This confirmation link has expired. Ask the partner to retry." };
        }
        if (code.isUsed) {
            return { ok: false, error: "This access code has already been redeemed." };
        }

        const newEmail = code.pendingEmail;

        await prisma.accessCode.update({
            where: { id: code.id },
            data: {
                email: newEmail,
                pendingEmail: null,
                pendingEmailToken: null,
                pendingEmailExpiresAt: null,
                pendingEmailRequestedAt: null,
            },
        });

        try {
            await sendB2bEmailChangeUnlocked({ to: newEmail, accessCode: code.code });
        } catch (e) {
            console.warn("[confirmAccessCodeEmailChange] new-address email failed:", e instanceof Error ? e.message : e);
        }

        return { ok: true, accessCode: code.code, newEmail };
    } catch (e) {
        console.error("[confirmAccessCodeEmailChange] error:", e);
        return { ok: false, error: "Could not confirm the email change. Please retry." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Staff & Admin Actions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Kitchen (location-staff) accounts keep a B2C_CUSTOMER global role — their
 * access comes from UserLocation rows. After a successful staff-portal login
 * they should land on their first assigned location's live order queue, not
 * /portal. Returns that locationId, or undefined for global-staff roles.
 */
async function getKitchenHome(user: { id: string; role: string }): Promise<string | undefined> {
    if (STAFF_ROLES.includes(user.role) || user.role === "ANALYTICS_VIEWER") return undefined;
    const home = await prisma.userLocation.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { locationId: true },
    });
    return home?.locationId;
}

export async function staffLoginAction(formData: FormData) {
    const loginInput = (formData.get("email") as string)?.trim();
    // Trim to MATCH account creation, which trims the password before hashing.
    // Without this, a trailing space — mobile keyboards auto-append one,
    // copy-paste grabs one — fails bcrypt compare and reads as "Invalid
    // credentials" no matter how carefully the password is re-entered.
    const password = ((formData.get("password") as string) || "").trim();

    if (!loginInput || !password) {
        return { error: "Login ID and password are required." };
    }

    // Staff portal is a high-value target — same stuffing protection as retail.
    const staffIp = await callerIp();
    for (const [key, max] of [[`stafflogin:ip:${staffIp}`, 20], [`stafflogin:id:${loginInput.toLowerCase()}`, 8]] as const) {
        const rl = await rateLimit(key, max, 300);
        if (!rl.ok) return { error: rateLimitMessage(rl) };
    }

    try {
        // Phase 11: staff login is scoped to staff roles only. A person who
        // ALSO has a B2C identity at this address shouldn't get picked here.
        const allowedRoles = [...STAFF_ROLES, "ANALYTICS_VIEWER"];

        // Support both email and username login (username @staff.local).
        // Email matches are case-insensitive — legacy staff rows may be stored
        // mixed-case, and users type emails with arbitrary capitalization.
        let user = await prisma.user.findFirst({
            where: { email: { equals: loginInput, mode: "insensitive" }, role: { in: allowedRoles } },
        });
        if (!user && !loginInput.includes("@")) {
            user = await prisma.user.findFirst({
                where: { email: `${loginInput.toLowerCase()}@staff.local`, role: { in: allowedRoles } },
            });
        }
        // Kitchen (location-staff) accounts: global role stays B2C_CUSTOMER;
        // their access comes from UserLocation rows. They sign in here too.
        if (!user) {
            user = await prisma.user.findFirst({
                where: { email: { equals: loginInput, mode: "insensitive" }, locationRoles: { some: {} } },
            });
        }

        if (!user || !user.isActive) {
            return { error: "Invalid credentials." };
        }

        if (!user.passwordHash) {
            return { error: "Invalid credentials." };
        }

        const passwordsMatch = await bcryptjs.compare(password, user.passwordHash);

        if (!passwordsMatch) {
            return { error: "Invalid credentials." };
        }

        // 2FA for staff roles — check if TOTP is configured (always honored)
        if (user.totpSecret) {
            return {
                success: false,
                needs2FA: true,
                totpEnabled: true,
                email: user.email,
                role: user.role,
                message: "Enter your Google Authenticator code.",
            };
        }

        // Check if 2FA is required (master admin always requires, staff controlled by setting)
        let require2FA = true;
        if (user.role !== "MASTER_ADMIN") {
            const setting = await prisma.siteSetting.findUnique({ where: { key: "staff_2fa_required" } });
            require2FA = setting?.value === "true";
        }

        if (require2FA) {
            // Email-based 2FA
            const code = generateVerificationCode();
            const expiry = new Date(Date.now() + 5 * 60 * 1000);

            await prisma.user.update({
                where: { id: user.id },
                data: { twoFactorCode: code, twoFactorExpiry: expiry },
            });

            const sent = await send2FAEmail(user.email, code, user.name || undefined);
            if (!sent.success) {
                // Don't tell the admin "code sent" when it wasn't — that's a silent
                // lockout. Let them retry instead.
                return { error: "Couldn't send your verification code. Please try again." };
            }

            return {
                success: false,
                needs2FA: true,
                totpEnabled: false,
                email: user.email,
                role: user.role,
                message: "Two-factor code sent to your email.",
            };
        }

        // 2FA not required — log in directly
        await setSession(user.id, user.role, user.email, user.name || undefined);
        return { success: true, role: user.role, kitchenHome: await getKitchenHome(user) };
    } catch (error) {
        console.error("Staff login error:", error);
        return { error: "An unexpected error occurred during login." };
    }
}

export async function verify2FAAction(email: string, code: string) {
    if (!email || !code || code.length !== 6) {
        return { error: "Please enter a valid 6-digit code." };
    }

    // A 6-digit code space is only 1M — unbounded tries make 2FA decorative.
    const tfaRl = await rateLimit(`2fa:email:${email.toLowerCase()}`, 6, 600);
    if (!tfaRl.ok) return { error: rateLimitMessage(tfaRl) };

    try {
        // Phase 11: 2FA flow is staff-only; scope lookup so a same-email
        // B2C account isn't surfaced here. Kitchen (location-staff) accounts
        // are the exception — they authenticate through the staff portal via
        // their UserLocation rows.
        const staffRoles = ["MASTER_ADMIN", "PRODUCT_MANAGER", "CONTENT_MANAGER", "SALES"];
        const user = await prisma.user.findFirst({
            where: {
                email,
                OR: [
                    { role: { in: staffRoles } },
                    { locationRoles: { some: {} } },
                ],
            },
        });

        if (!user) {
            return { error: "Account not found." };
        }

        // If TOTP is enabled, verify with Google Auth
        if (user.totpSecret) {
            const { TOTP } = await import("otpauth");
            const totp = new TOTP({
                issuer: "Colchis Food",
                label: user.email,
                algorithm: "SHA1",
                digits: 6,
                period: 30,
                secret: user.totpSecret,
            });

            const delta = totp.validate({ token: code, window: 1 });
            if (delta === null) {
                return { error: "Invalid authenticator code. Please try again." };
            }

            await setSession(user.id, user.role, user.email, user.name || undefined);
            return { success: true, role: user.role, kitchenHome: await getKitchenHome(user) };
        }

        // Email-based 2FA verification
        if (!user.twoFactorCode || !user.twoFactorExpiry) {
            return { error: "No 2FA code found. Please log in again." };
        }

        if (new Date() > user.twoFactorExpiry) {
            return { error: "2FA code has expired. Please log in again." };
        }

        if (user.twoFactorCode !== code) {
            return { error: "Incorrect code. Please try again." };
        }

        // Clear 2FA code and set session
        await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorCode: null, twoFactorExpiry: null },
        });

        await setSession(user.id, user.role, user.email, user.name || undefined);

        return { success: true, role: user.role, kitchenHome: await getKitchenHome(user) };
    } catch (error) {
        console.error("2FA verification error:", error);
        return { error: "Verification failed. Please try again." };
    }
}

export async function registerStaffAction(formData: FormData) {
    const accessCode = formData.get("code") as string;
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!accessCode || !name || !email || !password || password.length < 8) {
        return { error: "All fields are required. Password must be at least 8 characters." };
    }

    try {
        const validCode = await prisma.accessCode.findUnique({
            where: { code: accessCode.toUpperCase() },
        });

        if (!validCode || validCode.type !== "STAFF") {
            return { error: "Invalid Staff Access Code." };
        }

        if (validCode.isUsed) {
            return { error: "This Access Code has already been used." };
        }

        if (validCode.expiresAt && validCode.expiresAt < new Date()) {
            return { error: "This Access Code has expired." };
        }

        if (validCode.email && validCode.email !== email) {
            return { error: "This Access Code was not assigned to this email." };
        }

        // Phase 11: scope duplicate check to staff roles only — registerStaff
        // is used for the legacy /access-codes onboarding flow.
        const existing = await prisma.user.findFirst({
            where: { email, role: { in: [...STAFF_ROLES, "ANALYTICS_VIEWER"] } },
        });
        if (existing) {
            return { error: "A staff account with this email already exists." };
        }

        const passwordHash = await bcryptjs.hash(password, 12);

        const [, newUser] = await prisma.$transaction([
            prisma.accessCode.update({
                where: { id: validCode.id },
                data: { isUsed: true },
            }),
            prisma.user.create({
                data: {
                    email,
                    name,
                    passwordHash,
                    role: validCode.targetRole,
                    emailVerified: true, // Staff access code = trusted
                },
            }),
        ]);

        await setSession(newUser.id, newUser.role, newUser.email, newUser.name || undefined);

        return { success: true, role: newUser.role };
    } catch (error) {
        console.error("Staff registration error:", error);
        return { error: "Failed to create staff account." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// B2C Account Management Actions
// ──────────────────────────────────────────────────────────────────────────────

export async function updateProfileAction(formData: FormData) {
    const userId = formData.get("userId") as string;
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;

    if (!userId) return { error: "Not authenticated." };

    // Phase 9: validate + normalize US phone, enforce @unique with a friendly
    // error before Prisma throws a raw constraint violation. Empty input clears
    // the phone (allowed).
    let normalizedPhone: string | null = null;
    if (phone && phone.trim()) {
        normalizedPhone = normalizeUSPhone(phone);
        if (!normalizedPhone) {
            return { error: "Please provide a valid US phone number." };
        }
        const conflict = await prisma.user.findFirst({
            where: { phone: normalizedPhone, id: { not: userId } },
            select: { id: true },
        });
        if (conflict) {
            return { error: "This phone number is already registered to another account." };
        }
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                name: name || null,
                phone: normalizedPhone,
            },
        });
        revalidatePath("/account");
        return { success: true };
    } catch (error) {
        console.error("Update profile error:", error);
        return { error: "Failed to update profile." };
    }
}

export async function changePasswordAction(formData: FormData) {
    const userId = formData.get("userId") as string;
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!userId) return { error: "Not authenticated." };
    if (!currentPassword || !newPassword) return { error: "All fields are required." };
    if (newPassword.length < 8) return { error: "New password must be at least 8 characters." };
    if (newPassword !== confirmPassword) return { error: "Passwords do not match." };

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return { error: "User not found." };
        if (!user.passwordHash) return { error: "Social accounts do not have a password to change." };

        const passwordsMatch = await bcryptjs.compare(currentPassword, user.passwordHash);
        if (!passwordsMatch) return { error: "Current password is incorrect." };

        const newHash = await bcryptjs.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newHash },
        });

        return { success: true };
    } catch (error) {
        console.error("Change password error:", error);
        return { error: "Failed to change password." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// TOTP (Google Authenticator) Setup
// ──────────────────────────────────────────────────────────────────────────────

export async function setupTOTPAction() {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") {
        return { error: "Unauthorized." };
    }

    try {
        const { TOTP, Secret } = await import("otpauth");
        const secret = new Secret({ size: 20 });

        const totp = new TOTP({
            issuer: "Colchis Food",
            label: session.email,
            algorithm: "SHA1",
            digits: 6,
            period: 30,
            secret: secret,
        });

        const uri = totp.toString();
        const secretBase32 = secret.base32;

        return { success: true, uri, secret: secretBase32 };
    } catch (error) {
        console.error("TOTP setup error:", error);
        return { error: "Failed to generate TOTP secret." };
    }
}

export async function enableTOTPAction(secret: string, code: string) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") {
        return { error: "Unauthorized." };
    }

    if (!secret || !code || code.length !== 6) {
        return { error: "Please enter a valid 6-digit code." };
    }

    try {
        const { TOTP } = await import("otpauth");
        const totp = new TOTP({
            issuer: "Colchis Food",
            label: session.email,
            algorithm: "SHA1",
            digits: 6,
            period: 30,
            secret: secret,
        });

        const delta = totp.validate({ token: code, window: 1 });
        if (delta === null) {
            return { error: "Invalid code. Please scan the QR code again and enter the current code." };
        }

        await prisma.user.update({
            where: { id: session.userId },
            data: { totpSecret: secret },
        });

        return { success: true };
    } catch (error) {
        console.error("Enable TOTP error:", error);
        return { error: "Failed to enable TOTP." };
    }
}

export async function disableTOTPAction(code: string) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") {
        return { error: "Unauthorized." };
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: session.userId } });
        if (!user || !user.totpSecret) {
            return { error: "TOTP is not enabled." };
        }

        const { TOTP } = await import("otpauth");
        const totp = new TOTP({
            issuer: "Colchis Food",
            label: user.email,
            algorithm: "SHA1",
            digits: 6,
            period: 30,
            secret: user.totpSecret,
        });

        const delta = totp.validate({ token: code, window: 1 });
        if (delta === null) {
            return { error: "Invalid code. Must verify to disable TOTP." };
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { totpSecret: null },
        });

        return { success: true };
    } catch (error) {
        console.error("Disable TOTP error:", error);
        return { error: "Failed to disable TOTP." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Admin: Create / Delete Staff Accounts
// ──────────────────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 12; i++) {
        // crypto.randomInt — Math.random() is predictable enough to matter for
        // credentials that gate staff/admin surfaces.
        password += chars.charAt(randomInt(chars.length));
    }
    return password;
}

export async function createStaffAccountAction(formData: FormData) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") {
        return { error: "Unauthorized." };
    }

    const name = formData.get("name") as string;
    const loginId = (formData.get("loginId") as string)?.trim();
    const role = formData.get("role") as string;

    if (!name || !role) {
        return { error: "Name and role are required." };
    }

    // Viewer can be created without login credentials
    // Staff must have a username or email
    const isViewer = role === "ANALYTICS_VIEWER";
    if (!isViewer && !loginId) {
        return { error: "Staff accounts require a username or email." };
    }

    const validRoles = ["PRODUCT_MANAGER", "CONTENT_MANAGER", "SALES", "ANALYTICS_VIEWER"];
    if (!validRoles.includes(role)) {
        return { error: "Invalid role." };
    }

    // Determine email: if loginId looks like email use it, otherwise generate a placeholder
    const isEmail = loginId && loginId.includes("@");
    const email = isEmail ? loginId : loginId ? `${loginId.toLowerCase().replace(/\s+/g, "")}@staff.local` : `viewer-${Date.now()}@viewer.local`;

    try {
        // Phase 11: staff creation — scope to staff roles only. Admins
        // creating staff accounts shouldn't be blocked by a coincidentally-
        // matching B2C / B2B email.
        const existing = await prisma.user.findFirst({
            where: { email, role: { in: [...STAFF_ROLES, "ANALYTICS_VIEWER"] } },
        });
        if (existing) {
            return { error: `A staff account with this ${isEmail ? "email" : "username"} already exists.` };
        }

        const tempPassword = generateTempPassword();
        const passwordHash = await bcryptjs.hash(tempPassword, 12);

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                role,
                passwordHash,
                emailVerified: true,
                isActive: true,
            },
        });

        revalidatePath("/admin/staff");
        return {
            success: true,
            tempPassword,
            createdUser: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                isActive: newUser.isActive,
                createdAt: newUser.createdAt.toISOString(),
            },
        };
    } catch (error) {
        console.error("Create staff account error:", error);
        return { error: "Failed to create account." };
    }
}

/**
 * Create a kitchen (location-staff) account in one step: a User with a REAL
 * email (2FA codes are delivered there — no @staff.local placeholders) plus
 * the UserLocation row that grants their portal access. Global role stays
 * B2C_CUSTOMER; all authority is location-scoped.
 */
export async function createLocationStaffAction(formData: FormData) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") {
        return { error: "Unauthorized." };
    }

    const name = ((formData.get("name") as string) || "").trim();
    const email = ((formData.get("email") as string) || "").trim().toLowerCase();
    const password = ((formData.get("password") as string) || "").trim();
    const locationId = formData.get("locationId") as string;
    const locationRole = formData.get("locationRole") as string;

    if (!name || !email || !locationId || !locationRole) {
        return { error: "Name, email, location and role are required." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: "Please enter a real email address — sign-in verification codes are delivered there." };
    }
    if (!["LOCATION_MANAGER", "LOCATION_FULFILLMENT"].includes(locationRole)) {
        return { error: "Invalid location role." };
    }
    if (password && password.length < 8) {
        return { error: "Password must be at least 8 characters (or leave blank to auto-generate one)." };
    }

    try {
        const location = await prisma.location.findFirst({
            where: { id: locationId, isActive: true },
            select: { id: true, name: true },
        });
        if (!location) return { error: "Location not found or inactive." };

        // Never hijack an existing identity at this email — but DO reuse an
        // orphaned kitchen account. "Orphaned" = B2C_CUSTOMER whose last
        // location role was removed and who has no customer footprint (no
        // orders, no addresses, no B2B links). Without reuse, removing a
        // kitchen account permanently bricks its email for re-creation
        // (the orphan is invisible in every admin list).
        const existing = await prisma.user.findMany({
            where: { email: { equals: email, mode: "insensitive" } },
            select: {
                id: true,
                role: true,
                locationRoles: { select: { id: true }, take: 1 },
                b2bPartner: { select: { id: true } },
                partnerMembership: { select: { id: true } },
                _count: { select: { orders: true, addresses: true } },
            },
        });
        const isOrphan = (u: (typeof existing)[number]) =>
            u.role === "B2C_CUSTOMER" && u.locationRoles.length === 0 &&
            !u.b2bPartner && !u.partnerMembership &&
            u._count.orders === 0 && u._count.addresses === 0;
        const orphan = existing.find(isOrphan);
        if (existing.length > 0 && !orphan) {
            const taken = existing.some(u => u.locationRoles.length > 0 || u.role !== "B2C_CUSTOMER");
            if (taken) {
                return { error: "An account with this email already exists — manage it below or in /admin/staff." };
            }
            return { error: "This email belongs to an existing customer account. Assign them with the \"assign existing user\" form on their location below instead of creating a new account." };
        }

        const generated = !password;
        const finalPassword = password || generateTempPassword();
        const passwordHash = await bcryptjs.hash(finalPassword, 12);

        await prisma.$transaction(async tx => {
            const user = orphan
                ? await tx.user.update({
                    where: { id: orphan.id },
                    data: { name, passwordHash, emailVerified: true, isActive: true },
                })
                : await tx.user.create({
                    data: {
                        name,
                        email,
                        role: "B2C_CUSTOMER",
                        passwordHash,
                        emailVerified: true,
                        isActive: true,
                    },
                });
            await tx.userLocation.create({
                data: { userId: user.id, locationId: location.id, role: locationRole as any },
            });
        });

        // Best-effort welcome email — account creation already succeeded.
        try {
            await sendKitchenWelcomeEmail({ to: email, name, locationName: location.name });
        } catch (e) {
            console.warn("[createLocationStaffAction] welcome email failed:", e instanceof Error ? e.message : e);
        }

        revalidatePath("/admin/staff");
        revalidatePath("/admin/location-staff");
        return {
            success: true,
            tempPassword: generated ? finalPassword : undefined,
            createdUser: { name, email },
        };
    } catch (error) {
        console.error("Create location staff error:", error);
        return { error: "Failed to create kitchen account." };
    }
}

export async function resetStaffPasswordAction(userId: string, newPassword?: string) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") {
        return { error: "Unauthorized." };
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return { error: "User not found." };
        if (user.role === "MASTER_ADMIN") return { error: "Use the Security page to change your own password." };

        const password = newPassword && newPassword.length >= 4 ? newPassword : generateTempPassword();
        const passwordHash = await bcryptjs.hash(password, 12);

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash, sessionVersion: { increment: 1 } },
        });

        revalidatePath("/admin/staff");
        return { success: true, newPassword: password };
    } catch (error) {
        console.error("Reset staff password error:", error);
        return { error: "Failed to reset password." };
    }
}

export async function deleteStaffAccountAction(userId: string) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") {
        return { error: "Unauthorized." };
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return { error: "User not found." };
        if (user.role === "MASTER_ADMIN") return { error: "Cannot delete admin accounts." };

        await prisma.userProfile.deleteMany({ where: { userId } });
        await prisma.dashboardAccess.deleteMany({ where: { userId } });
        await prisma.account.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });

        revalidatePath("/admin/staff");
        return { success: true };
    } catch (error) {
        console.error("Delete staff account error:", error);
        return { error: "Failed to delete account." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Admin: 2FA Toggle & Quick Reset
// ──────────────────────────────────────────────────────────────────────────────

export async function get2FASettingAction() {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") {
        return { error: "Unauthorized." };
    }

    try {
        const setting = await prisma.siteSetting.findUnique({ where: { key: "staff_2fa_required" } });
        return { success: true, enabled: setting?.value === "true" };
    } catch (error) {
        console.error("Get 2FA setting error:", error);
        return { error: "Failed to read setting." };
    }
}

export async function toggle2FAAction(enabled: boolean) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") {
        return { error: "Unauthorized." };
    }

    try {
        await prisma.siteSetting.upsert({
            where: { key: "staff_2fa_required" },
            update: { value: enabled ? "true" : "false" },
            create: { key: "staff_2fa_required", value: enabled ? "true" : "false" },
        });

        revalidatePath("/admin/staff");
        return { success: true, enabled };
    } catch (error) {
        console.error("Toggle 2FA error:", error);
        return { error: "Failed to update setting." };
    }
}

export async function quickResetPasswordAction(userId: string) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") {
        return { error: "Unauthorized." };
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return { error: "User not found." };
        if (user.role === "MASTER_ADMIN") return { error: "Use the Security page for admin accounts." };

        const password = generateTempPassword();
        const passwordHash = await bcryptjs.hash(password, 12);

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash, sessionVersion: { increment: 1 } },
        });

        revalidatePath("/admin/staff");
        return { success: true, newPassword: password };
    } catch (error) {
        console.error("Quick reset password error:", error);
        return { error: "Failed to reset password." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Admin: global role + per-location role assignment (Stage 2 unified staff)
// ──────────────────────────────────────────────────────────────────────────────

const ASSIGNABLE_GLOBAL_ROLES = [
    "PRODUCT_MANAGER", "CONTENT_MANAGER", "SALES",
    "ANALYTICS_VIEWER", "B2C_CUSTOMER",
] as const;

export async function changeUserGlobalRoleAction(userId: string, newRole: string) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") return { error: "Unauthorized." };
    if (!ASSIGNABLE_GLOBAL_ROLES.includes(newRole as any)) {
        return { error: "Invalid role." };
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (!user) return { error: "User not found." };
        // Refuse to demote/promote master admins from this surface — they
        // must be managed via the Security page so the elevation chain is
        // deliberate and audited separately.
        if (user.role === "MASTER_ADMIN") return { error: "Master admin role is managed in Security." };
        if (newRole === "MASTER_ADMIN") return { error: "Promote to master admin from the Security page." };

        // Bump sessionVersion so the user's existing JWT (with the old role) is
        // rejected by getSession on their next request — they re-login and pick
        // up the new role instead of riding the stale cookie for up to 7 days.
        await prisma.user.update({
            where: { id: userId },
            data: { role: newRole, sessionVersion: { increment: 1 } },
        });
        revalidatePath("/admin/staff");
        return { success: true };
    } catch (error) {
        console.error("Change user global role error:", error);
        return { error: "Failed to change role." };
    }
}

export async function assignLocationRoleAction(formData: FormData) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") return { error: "Unauthorized." };

    const userId = formData.get("userId") as string;
    const locationId = formData.get("locationId") as string;
    const role = formData.get("role") as string;
    if (!userId || !locationId || !role) return { error: "Missing fields." };

    const validRoles = ["LOCATION_MANAGER", "LOCATION_FULFILLMENT", "B2B_SALES_MANAGER"];
    if (!validRoles.includes(role)) return { error: "Invalid location role." };

    try {
        await prisma.userLocation.upsert({
            where: { userId_locationId_role: { userId, locationId, role: role as any } },
            update: {},
            create: { userId, locationId, role: role as any },
        });
        revalidatePath("/admin/staff");
        revalidatePath("/admin/location-staff");
        return { success: true };
    } catch (error) {
        console.error("Assign location role error:", error);
        return { error: "Failed to assign role." };
    }
}

export async function removeLocationRoleAction(userLocationId: string) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") return { error: "Unauthorized." };
    if (!userLocationId) return { error: "Missing id." };

    try {
        const row = await prisma.userLocation.findUnique({
            where: { id: userLocationId },
            select: { userId: true },
        });
        await prisma.userLocation.delete({ where: { id: userLocationId } });

        // If that was the LAST location role of a pure kitchen account
        // (B2C_CUSTOMER with no customer footprint), delete the User row too.
        // Otherwise the "removed" account lives on invisibly — it appears in no
        // admin list, blocks its email from re-creation, and reads to the admin
        // as a delete that mysteriously didn't take.
        if (row) {
            const user = await prisma.user.findUnique({
                where: { id: row.userId },
                select: {
                    id: true,
                    role: true,
                    locationRoles: { select: { id: true }, take: 1 },
                    b2bPartner: { select: { id: true } },
                    partnerMembership: { select: { id: true } },
                    _count: { select: { orders: true, addresses: true } },
                },
            });
            const pureKitchenAccount =
                user &&
                user.role === "B2C_CUSTOMER" &&
                user.locationRoles.length === 0 &&
                !user.b2bPartner && !user.partnerMembership &&
                user._count.orders === 0 && user._count.addresses === 0;
            if (pureKitchenAccount) {
                await prisma.user.delete({ where: { id: user.id } });
                console.log("[removeLocationRoleAction] Deleted orphaned kitchen account", user.id);
            }
        }

        revalidatePath("/admin/staff");
        revalidatePath("/admin/location-staff");
        return { success: true };
    } catch (error) {
        console.error("Remove location role error:", error);
        return { error: "Failed to remove role." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Logout
// ──────────────────────────────────────────────────────────────────────────────

export async function logoutAction() {
    await clearSession();
    revalidatePath("/");
    redirect("/portal-login");
}

