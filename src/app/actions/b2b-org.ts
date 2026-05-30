"use server";

/**
 * Tier 2 — B2B Partner Org management: the owner's shop locations
 * (ship-to destinations + optional subcompany billing). Member-management
 * actions live in b2b-members.ts.
 *
 * Every action is OWNER-ONLY and partner-scoped: a member or another partner
 * can't touch these rows.
 */
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPartnerContext } from "@/lib/b2b-partner";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireOwner(): Promise<{ partnerId: string }> {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const ctx = await getPartnerContext(session.userId);
    if (!ctx) throw new Error("No partner profile — place a Resolve order first to initialize it.");
    if (!ctx.isOwner) throw new Error("Only the account owner can manage shops.");
    return { partnerId: ctx.partnerId };
}

function readShopFields(fd: FormData) {
    const str = (k: string) => ((fd.get(k) as string) || "").trim() || null;
    const required = (k: string) => ((fd.get(k) as string) || "").trim();
    const separateBilling = fd.get("separateBilling") === "on" || fd.get("separateBilling") === "true";
    return {
        label: required("label"),
        line1: required("line1"),
        line2: str("line2"),
        city: required("city"),
        state: required("state"),
        postalCode: required("postalCode"),
        contactName: str("contactName"),
        contactPhone: str("contactPhone"),
        // Subcompany billing — only meaningful when separateBilling is on.
        separateBilling,
        billingCompanyName: separateBilling ? str("billingCompanyName") : null,
        billingEin: separateBilling ? str("billingEin") : null,
        billingEmail: separateBilling ? str("billingEmail") : null,
        billingAddress: separateBilling ? str("billingAddress") : null,
    };
}

function validateShop(f: ReturnType<typeof readShopFields>): string | null {
    if (!f.label) return "Shop name is required";
    if (!f.line1 || !f.city || !f.state || !f.postalCode) return "Street, city, state, and ZIP are required";
    if (f.separateBilling && !f.billingCompanyName) return "Separate billing needs the subcompany's legal name";
    return null;
}

export async function createShopLocationAction(fd: FormData): Promise<ActionResult> {
    try {
        const { partnerId } = await requireOwner();
        const f = readShopFields(fd);
        const err = validateShop(f);
        if (err) return { ok: false, error: err };
        await prisma.b2bPartnerLocation.create({ data: { partnerId, ...f } });
        revalidatePath("/[locale]/b2b-portal/locations", "page");
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function updateShopLocationAction(fd: FormData): Promise<ActionResult> {
    try {
        const { partnerId } = await requireOwner();
        const id = fd.get("id") as string;
        if (!id) return { ok: false, error: "Missing shop id" };
        const existing = await prisma.b2bPartnerLocation.findFirst({ where: { id, partnerId }, select: { id: true } });
        if (!existing) return { ok: false, error: "Shop not found" };
        const f = readShopFields(fd);
        const err = validateShop(f);
        if (err) return { ok: false, error: err };
        await prisma.b2bPartnerLocation.update({ where: { id: existing.id }, data: f });
        revalidatePath("/[locale]/b2b-portal/locations", "page");
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function setShopActiveAction(fd: FormData): Promise<ActionResult> {
    try {
        const { partnerId } = await requireOwner();
        const id = fd.get("id") as string;
        const isActive = fd.get("isActive") === "true";
        if (!id) return { ok: false, error: "Missing shop id" };
        const existing = await prisma.b2bPartnerLocation.findFirst({ where: { id, partnerId }, select: { id: true } });
        if (!existing) return { ok: false, error: "Shop not found" };
        await prisma.b2bPartnerLocation.update({ where: { id: existing.id }, data: { isActive } });
        revalidatePath("/[locale]/b2b-portal/locations", "page");
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}
