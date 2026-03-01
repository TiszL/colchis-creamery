"use server";

import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSession, clearSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

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

        const user = await prisma.user.create({
            data: {
                email,
                name,
                passwordHash,
                role: "B2C_CUSTOMER",
            },
        });

        // Create empty profile for the customer
        await prisma.userProfile.create({
            data: { userId: user.id },
        });

        await setSession(user.id, user.role, user.email, user.name || undefined);

        return { success: true };
    } catch (error) {
        console.error("Register B2C error:", error);
        return { error: "Failed to create account." };
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

        // Only staff/admin/analytics roles can use staff login
        const allowedRoles = [...STAFF_ROLES, "ANALYTICS_VIEWER"];
        if (!allowedRoles.includes(user.role)) {
            return { error: "This portal is for staff only. Please use the customer login." };
        }

        if (!user.passwordHash) {
            return { error: "Invalid credentials." };
        }

        const passwordsMatch = await bcryptjs.compare(password, user.passwordHash);

        if (!passwordsMatch) {
            return { error: "Invalid credentials." };
        }

        await setSession(user.id, user.role, user.email, user.name || undefined);

        return { success: true, role: user.role };
    } catch (error) {
        console.error("Staff login error:", error);
        return { error: "An unexpected error occurred during login." };
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
// Logout
// ──────────────────────────────────────────────────────────────────────────────

export async function logoutAction() {
    await clearSession();
    revalidatePath("/");
}
