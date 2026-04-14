"use server";

import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSession, clearSession, getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendVerificationEmail, send2FAEmail, generateVerificationCode } from "@/lib/email";

// ── Role Constants ────────────────────────────────────────────────────────────
const STAFF_ROLES = ["MASTER_ADMIN", "PRODUCT_MANAGER", "CONTENT_MANAGER", "SALES"];
const CUSTOMER_ROLES = ["B2C_CUSTOMER", "B2B_PARTNER"];

// ──────────────────────────────────────────────────────────────────────────────
// B2C (Retail Customer) Actions
// ──────────────────────────────────────────────────────────────────────────────

export async function loginAction(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { error: "Email and password are required." };
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.isActive) {
            return { error: "Invalid credentials." };
        }

        // Customer login should only work for customer roles
        if (!CUSTOMER_ROLES.includes(user.role) && user.role !== "MASTER_ADMIN") {
            return { error: "Staff accounts must use the staff login portal." };
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

export async function registerB2CAction(formData: FormData) {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!name || !email || !password || password.length < 8) {
        return { error: "Please provide a valid name, email, and password (min 8 characters)." };
    }

    try {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return { error: "An account with this email already exists." };
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

    try {
        const user = await prisma.user.findUnique({ where: { email } });

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

    try {
        const user = await prisma.user.findUnique({ where: { email } });

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
    const email = formData.get("email") as string;
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

        if (validCode.email && validCode.email !== email) {
            return { error: "This Access Code was not assigned to this email." };
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return { error: "An account with this email already exists." };
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
                    companyName,
                    role: "B2B_PARTNER",
                    isActiveB2b: true,
                    emailVerified: true, // B2B access code = trusted
                },
            }),
        ]);

        await setSession(newUser.id, newUser.role, newUser.email, newUser.name || undefined);

        return { success: true };
    } catch (error) {
        console.error("Register B2B error:", error);
        return { error: "Failed to securely provision B2B partner account." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Staff & Admin Actions
// ──────────────────────────────────────────────────────────────────────────────

export async function staffLoginAction(formData: FormData) {
    const loginInput = (formData.get("email") as string)?.trim();
    const password = formData.get("password") as string;

    if (!loginInput || !password) {
        return { error: "Login ID and password are required." };
    }

    try {
        // Support both email and username login
        // If no @ sign, try appending @staff.local for username-based accounts
        let user = await prisma.user.findUnique({ where: { email: loginInput } });
        console.log("[STAFF_LOGIN] Step 1 - find exact:", loginInput, "found:", !!user);
        if (!user && !loginInput.includes("@")) {
            const staffEmail = `${loginInput.toLowerCase()}@staff.local`;
            user = await prisma.user.findUnique({ where: { email: staffEmail } });
            console.log("[STAFF_LOGIN] Step 2 - find staff.local:", staffEmail, "found:", !!user);
        }

        if (!user || !user.isActive) {
            console.log("[STAFF_LOGIN] FAIL: user not found or inactive", { found: !!user, isActive: user?.isActive });
            return { error: "Invalid credentials." };
        }

        // Only staff/admin/analytics roles can use staff login
        const allowedRoles = [...STAFF_ROLES, "ANALYTICS_VIEWER"];
        if (!allowedRoles.includes(user.role)) {
            console.log("[STAFF_LOGIN] FAIL: role not allowed:", user.role);
            return { error: "This portal is for staff only. Please use the customer login." };
        }

        if (!user.passwordHash) {
            console.log("[STAFF_LOGIN] FAIL: no password hash");
            return { error: "Invalid credentials." };
        }

        const passwordsMatch = await bcryptjs.compare(password, user.passwordHash);
        console.log("[STAFF_LOGIN] Step 3 - password match:", passwordsMatch);

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

            await send2FAEmail(user.email, code, user.name || undefined);

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
        return { success: true, role: user.role };
    } catch (error) {
        console.error("Staff login error:", error);
        return { error: "An unexpected error occurred during login." };
    }
}

export async function verify2FAAction(email: string, code: string) {
    if (!email || !code || code.length !== 6) {
        return { error: "Please enter a valid 6-digit code." };
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        const staffRoles = ["MASTER_ADMIN", "PRODUCT_MANAGER", "CONTENT_MANAGER", "SALES"];
        if (!user || !staffRoles.includes(user.role)) {
            return { error: "Account not found." };
        }

        // If TOTP is enabled, verify with Google Auth
        if (user.totpSecret) {
            const { TOTP } = await import("otpauth");
            const totp = new TOTP({
                issuer: "Colchis Creamery",
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
            return { success: true, role: user.role };
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

        return { success: true, role: user.role };
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

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return { error: "An account with this email already exists." };
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

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                name: name || null,
                phone: phone || null,
            },
        });
        revalidatePath("/account");
        return { success: true };
    } catch (error) {
        console.error("Update profile error:", error);
        return { error: "Failed to update profile." };
    }
}

export async function updateAddressAction(formData: FormData) {
    const userId = formData.get("userId") as string;
    const shippingAddress = formData.get("shippingAddress") as string;
    const shippingCity = formData.get("shippingCity") as string;
    const shippingState = formData.get("shippingState") as string;
    const shippingZip = formData.get("shippingZip") as string;
    const shippingCountry = formData.get("shippingCountry") as string;

    if (!userId) return { error: "Not authenticated." };

    try {
        await prisma.userProfile.upsert({
            where: { userId },
            update: {
                shippingAddress: shippingAddress || null,
                shippingCity: shippingCity || null,
                shippingState: shippingState || null,
                shippingZip: shippingZip || null,
                shippingCountry: shippingCountry || "US",
            },
            create: {
                userId,
                shippingAddress: shippingAddress || null,
                shippingCity: shippingCity || null,
                shippingState: shippingState || null,
                shippingZip: shippingZip || null,
                shippingCountry: shippingCountry || "US",
            },
        });
        revalidatePath("/account");
        return { success: true };
    } catch (error) {
        console.error("Update address error:", error);
        return { error: "Failed to update address." };
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
            issuer: "Colchis Creamery",
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
            issuer: "Colchis Creamery",
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
            issuer: "Colchis Creamery",
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
        password += chars.charAt(Math.floor(Math.random() * chars.length));
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
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return { error: `An account with this ${isEmail ? "email" : "username"} already exists.` };
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
            data: { passwordHash },
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
            data: { passwordHash },
        });

        revalidatePath("/admin/staff");
        return { success: true, newPassword: password };
    } catch (error) {
        console.error("Quick reset password error:", error);
        return { error: "Failed to reset password." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Logout
// ──────────────────────────────────────────────────────────────────────────────

export async function logoutAction() {
    await clearSession();
    revalidatePath("/");
    redirect("/staff");
}

