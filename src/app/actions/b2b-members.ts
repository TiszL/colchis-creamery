"use server";

/**
 * Tier 2 — B2B Partner Org: member (additional human login) management.
 *
 * Owner-only management actions + a public acceptInvite. The OWNER is
 * B2bPartner.userId; members are B2bPartnerMember rows. Members are role
 * B2B_PARTNER users linked via B2bPartnerMember.userId, optionally scoped to
 * one shop (assignedLocationId) and optionally allowed to view billing.
 */
import { prisma } from "@/lib/db";
import { getSession, setSession } from "@/lib/session";
import { getPartnerContext } from "@/lib/b2b-partner";
import { sendPartnerInviteEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import bcryptjs from "bcryptjs";
import { randomBytes } from "crypto";

type ActionResult = { ok: true; note?: string } | { ok: false; error: string };

async function requireOwner(): Promise<{ partnerId: string; companyName: string }> {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const ctx = await getPartnerContext(session.userId);
    if (!ctx) throw new Error("No partner profile — place a Resolve order first to initialize it.");
    if (!ctx.isOwner) throw new Error("Only the account owner can manage the team.");
    const org = await prisma.b2bPartner.findUnique({ where: { id: ctx.partnerId }, select: { companyName: true } });
    return { partnerId: ctx.partnerId, companyName: org?.companyName || "Your partner" };
}

/** Verify a shop id belongs to the partner (or null = org-wide). */
async function resolveAssignedLocation(fd: FormData, partnerId: string): Promise<string | null> {
    const id = (fd.get("assignedLocationId") as string) || "";
    if (!id) return null;
    const shop = await prisma.b2bPartnerLocation.findFirst({ where: { id, partnerId }, select: { id: true } });
    return shop?.id ?? null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inviteMemberAction(fd: FormData): Promise<ActionResult> {
    try {
        const { partnerId, companyName } = await requireOwner();
        const email = ((fd.get("email") as string) || "").trim().toLowerCase();
        const name = ((fd.get("name") as string) || "").trim() || null;
        const canViewBilling = fd.get("canViewBilling") === "on" || fd.get("canViewBilling") === "true";
        const mode = (fd.get("mode") as string) === "password" ? "password" : "email";
        if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email" };

        const assignedLocationId = await resolveAssignedLocation(fd, partnerId);

        // No duplicate member with this email in the org.
        const dupe = await prisma.b2bPartnerMember.findFirst({ where: { partnerId, email }, select: { id: true } });
        if (dupe) return { ok: false, error: "That email is already on your team." };

        if (mode === "password") {
            const password = (fd.get("password") as string) || "";
            if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters" };
            // Per-role uniqueness: a B2B_PARTNER user with this email can't already exist.
            const existingUser = await prisma.user.findFirst({ where: { email, role: "B2B_PARTNER" }, select: { id: true } });
            if (existingUser) return { ok: false, error: "A wholesale login with this email already exists." };
            const passwordHash = await bcryptjs.hash(password, 12);
            await prisma.$transaction(async tx => {
                const user = await tx.user.create({
                    data: { email, passwordHash, name: name || email, role: "B2B_PARTNER", isActiveB2b: true, emailVerified: true },
                });
                await tx.b2bPartnerMember.create({
                    data: { partnerId, email, name, userId: user.id, assignedLocationId, canViewBilling, status: "ACTIVE", acceptedAt: new Date() },
                });
            });
            revalidatePath("/[locale]/b2b-portal/team", "page");
            return { ok: true, note: "Member created. Share the password you set with them." };
        }

        // Email accept-link flow.
        const token = randomBytes(24).toString("hex");
        const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await prisma.b2bPartnerMember.create({
            data: { partnerId, email, name, assignedLocationId, canViewBilling, status: "PENDING", inviteToken: token, inviteExpiry },
        });
        const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        const shop = assignedLocationId
            ? await prisma.b2bPartnerLocation.findUnique({ where: { id: assignedLocationId }, select: { label: true } })
            : null;
        try {
            await sendPartnerInviteEmail({
                to: email,
                acceptLink: `${base}/en/b2b/accept-invite?token=${token}`,
                inviterCompany: companyName,
                name: name || undefined,
                shopLabel: shop?.label ?? null,
            });
        } catch (e) {
            console.warn("[inviteMember] email send failed:", e instanceof Error ? e.message : e);
            return { ok: true, note: "Member invited, but the email failed to send — you can resend it." };
        }
        revalidatePath("/[locale]/b2b-portal/team", "page");
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function updateMemberAction(fd: FormData): Promise<ActionResult> {
    try {
        const { partnerId } = await requireOwner();
        const id = fd.get("id") as string;
        if (!id) return { ok: false, error: "Missing member id" };
        const member = await prisma.b2bPartnerMember.findFirst({ where: { id, partnerId }, select: { id: true } });
        if (!member) return { ok: false, error: "Member not found" };
        const name = ((fd.get("name") as string) || "").trim() || null;
        const canViewBilling = fd.get("canViewBilling") === "on" || fd.get("canViewBilling") === "true";
        const assignedLocationId = await resolveAssignedLocation(fd, partnerId);
        await prisma.b2bPartnerMember.update({ where: { id: member.id }, data: { name, canViewBilling, assignedLocationId } });
        revalidatePath("/[locale]/b2b-portal/team", "page");
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function setMemberStatusAction(fd: FormData): Promise<ActionResult> {
    try {
        const { partnerId } = await requireOwner();
        const id = fd.get("id") as string;
        const status = fd.get("status") === "ACTIVE" ? "ACTIVE" : "DISABLED";
        if (!id) return { ok: false, error: "Missing member id" };
        const member = await prisma.b2bPartnerMember.findFirst({ where: { id, partnerId }, select: { id: true, userId: true } });
        if (!member) return { ok: false, error: "Member not found" };
        await prisma.b2bPartnerMember.update({ where: { id: member.id }, data: { status } });
        // Disabling: bump the linked user's sessionVersion so their live cookie
        // stops working immediately (the layout also gates inactive members).
        if (status === "DISABLED" && member.userId) {
            await prisma.user.update({ where: { id: member.userId }, data: { sessionVersion: { increment: 1 } } }).catch(() => undefined);
        }
        revalidatePath("/[locale]/b2b-portal/team", "page");
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function removeMemberAction(fd: FormData): Promise<ActionResult> {
    try {
        const { partnerId } = await requireOwner();
        const id = fd.get("id") as string;
        if (!id) return { ok: false, error: "Missing member id" };
        const member = await prisma.b2bPartnerMember.findFirst({ where: { id, partnerId }, select: { id: true, userId: true } });
        if (!member) return { ok: false, error: "Member not found" };
        await prisma.b2bPartnerMember.delete({ where: { id: member.id } });
        // The orphaned User (if any) keeps its row but can no longer resolve to
        // an org via getPartnerContext, so it loses all portal access. Bump its
        // sessionVersion to drop any live session too.
        if (member.userId) {
            await prisma.user.update({ where: { id: member.userId }, data: { sessionVersion: { increment: 1 } } }).catch(() => undefined);
        }
        revalidatePath("/[locale]/b2b-portal/team", "page");
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

/** Public — the invited teammate sets their name + password and is logged in. */
export async function acceptInviteAction(fd: FormData): Promise<ActionResult> {
    try {
        const token = ((fd.get("token") as string) || "").trim();
        const name = ((fd.get("name") as string) || "").trim();
        const password = (fd.get("password") as string) || "";
        if (!token) return { ok: false, error: "Missing invitation token" };
        if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters" };

        const member = await prisma.b2bPartnerMember.findUnique({
            where: { inviteToken: token },
            select: { id: true, email: true, name: true, status: true, inviteExpiry: true, userId: true },
        });
        if (!member || member.status !== "PENDING" || member.userId) {
            return { ok: false, error: "This invitation is invalid or already used." };
        }
        if (member.inviteExpiry && member.inviteExpiry < new Date()) {
            return { ok: false, error: "This invitation has expired. Ask your account owner to resend it." };
        }
        const existingUser = await prisma.user.findFirst({ where: { email: member.email, role: "B2B_PARTNER" }, select: { id: true } });
        if (existingUser) return { ok: false, error: "A wholesale login with this email already exists. Please sign in." };

        const passwordHash = await bcryptjs.hash(password, 12);
        const finalName = name || member.name || member.email;
        const user = await prisma.$transaction(async tx => {
            const u = await tx.user.create({
                data: { email: member.email, passwordHash, name: finalName, role: "B2B_PARTNER", isActiveB2b: true, emailVerified: true },
            });
            await tx.b2bPartnerMember.update({
                where: { id: member.id },
                data: { userId: u.id, name: finalName, status: "ACTIVE", acceptedAt: new Date(), inviteToken: null, inviteExpiry: null },
            });
            return u;
        });
        // Auto-login → straight into the portal.
        await setSession(user.id, user.role, user.email, user.name || undefined);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}
