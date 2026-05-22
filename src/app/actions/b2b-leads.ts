"use server";

/**
 * Phase 6 (6g) — B2B lead lifecycle actions.
 *
 * Two server actions:
 * - submitB2bApplicationAction: public — anyone can POST a wholesale
 *   application from /wholesale/apply. Creates a B2bLead with status NEW.
 * - inviteB2bPartnerAction: master-admin or B2B_SALES_MANAGER — issues
 *   an AccessCode + emails the contact + flips the lead to CONTACTED.
 */
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { randomBytes } from "crypto";
import { sendB2bApprovalEmail } from "@/lib/email";

function generateAccessCode(): string {
    return randomBytes(6).toString("hex").toUpperCase();
}

/**
 * Public — accepts a wholesale application from /wholesale/apply.
 * Creates a B2bLead row; admin reviews + invites via inviteB2bPartnerAction.
 */
export async function submitB2bApplicationAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const companyName     = (formData.get("companyName") as string)?.trim();
        const contactName     = (formData.get("contactName") as string)?.trim() || null;
        const email           = (formData.get("email") as string)?.trim().toLowerCase();
        const phone           = (formData.get("phone") as string)?.trim() || null;
        const address         = (formData.get("address") as string)?.trim() || null;
        const expectedVolume  = (formData.get("expectedVolume") as string)?.trim() || null;
        const message         = (formData.get("message") as string)?.trim() || null;

        if (!companyName) return { ok: false, error: "Company name is required" };
        if (!email || !email.includes("@")) return { ok: false, error: "Valid email is required" };

        await prisma.b2bLead.create({
            data: { companyName, contactName, email, phone, address, expectedVolume, message, status: "NEW" },
        });

        revalidatePath("/[locale]/admin/requests", "page");
        revalidatePath("/[locale]/admin/b2b", "page");
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Could not submit application" };
    }
}

/**
 * Admin — issue an AccessCode for an approved lead + email it + mark the
 * lead CONTACTED. The partner uses the code to complete signup via the
 * existing /b2b/register flow.
 */
export async function inviteB2bPartnerAction(formData: FormData): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
    try {
        const session = await getSession();
        if (!session) return { ok: false, error: "Unauthorized" };
        if (session.role !== "MASTER_ADMIN") {
            const has = await prisma.userLocation.findFirst({
                where: { userId: session.userId, role: "B2B_SALES_MANAGER" },
                select: { id: true },
            });
            if (!has) return { ok: false, error: "Forbidden" };
        }

        const leadId = formData.get("leadId") as string;
        if (!leadId) return { ok: false, error: "leadId is required" };

        const lead = await prisma.b2bLead.findUnique({ where: { id: leadId } });
        if (!lead) return { ok: false, error: "Lead not found" };

        const code = generateAccessCode();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30-day window

        await prisma.$transaction([
            prisma.accessCode.create({
                data: {
                    code,
                    type: "B2B",
                    targetRole: "B2B_PARTNER",
                    email: lead.email,
                    expiresAt,
                },
            }),
            prisma.b2bLead.update({
                where: { id: leadId },
                data: { status: "CONTACTED", assignedTo: session.userId },
            }),
        ]);

        // Email best-effort — code is also visible to admin who can resend manually.
        try {
            await sendB2bApprovalEmail(lead.email, code, lead.companyName, lead.contactName);
        } catch (e) {
            console.warn("[inviteB2bPartner] Email send failed:", e instanceof Error ? e.message : e);
        }

        revalidatePath("/[locale]/admin/requests", "page");
        revalidatePath("/[locale]/admin/b2b", "page");
        return { ok: true, code };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Invite failed" };
    }
}
