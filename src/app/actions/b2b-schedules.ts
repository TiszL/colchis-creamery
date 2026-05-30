"use server";

/**
 * Phase 6 (6d) — Recurring order schedule CRUD for B2B partners.
 *
 * Partner-scoped: every action verifies the schedule belongs to the
 * caller's B2bPartner record. Master admin bypasses.
 *
 * Stripe pay-now schedules aren't supported (no Elements at the cron
 * fire site to confirm a charge); UI restricts to RESOLVE_NET_* + the
 * legacy null-method path. Cron handler enforces too.
 */
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getPartnerContext } from "@/lib/b2b-partner";
import { B2bPaymentMethod } from "@prisma/client";

async function getCallerPartnerId(): Promise<{ partnerId: string; isMasterAdmin: boolean; assignedLocationId: string | null }> {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    if (session.role === "MASTER_ADMIN") {
        return { partnerId: "", isMasterAdmin: true, assignedLocationId: null };
    }
    // Owner OR active member — resolve via the shared context so members can
    // manage schedules for their assigned shop.
    const ctx = await getPartnerContext(session.userId);
    if (!ctx) throw new Error("Partner profile not initialized — place a Resolve order first to create it.");
    return { partnerId: ctx.partnerId, isMasterAdmin: false, assignedLocationId: ctx.assignedLocationId };
}

/**
 * Resolve + validate the ship-to shop for a schedule. A scoped member is forced
 * to their assigned shop; the shop must belong to the caller's partner.
 */
async function resolveScheduleShop(fd: FormData, partnerId: string, assignedLocationId: string | null): Promise<string | null> {
    let pid = (fd.get("partnerLocationId") as string) || null;
    if (assignedLocationId) pid = assignedLocationId;
    if (!pid) return null;
    const shop = await prisma.b2bPartnerLocation.findFirst({ where: { id: pid, partnerId }, select: { id: true } });
    if (!shop) throw new Error("Invalid ship-to shop for this account");
    return shop.id;
}

export async function createScheduleAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const { partnerId, isMasterAdmin, assignedLocationId } = await getCallerPartnerId();
        if (isMasterAdmin) return { ok: false, error: "Admin should create schedules from the partner's portal as the partner." };

        const name = (formData.get("name") as string)?.trim();
        const intervalDays = parseInt(formData.get("intervalDays") as string, 10);
        const paymentMethod = formData.get("paymentMethod") as B2bPaymentMethod;
        const itemsJsonRaw = (formData.get("itemsJson") as string)?.trim() || "[]";
        const firstFireRaw = formData.get("firstFireAt") as string | null;
        const locationId = (formData.get("fulfillmentLocationId") as string) || null;

        if (!name) return { ok: false, error: "Name is required" };
        if (!Number.isFinite(intervalDays) || intervalDays < 1) return { ok: false, error: "intervalDays must be ≥ 1" };
        if (!paymentMethod) return { ok: false, error: "paymentMethod is required" };
        if (paymentMethod === "STRIPE_CARD" || paymentMethod === "STRIPE_ACH") {
            return { ok: false, error: "Stripe pay-now isn't supported for recurring schedules yet — pick a Resolve net term." };
        }

        // Validate items JSON shape: [{ productId, quantity }, ...]
        let parsed: unknown;
        try { parsed = JSON.parse(itemsJsonRaw); }
        catch { return { ok: false, error: "itemsJson is not valid JSON" }; }
        if (!Array.isArray(parsed) || parsed.length === 0) return { ok: false, error: "itemsJson must be a non-empty array" };
        for (const it of parsed) {
            if (
                typeof it !== "object" || it === null ||
                typeof (it as { productId?: unknown }).productId !== "string" ||
                typeof (it as { quantity?: unknown }).quantity !== "number" ||
                ((it as { quantity: number }).quantity) < 1
            ) {
                return { ok: false, error: "Each item must be { productId: string, quantity: number ≥ 1 }" };
            }
        }

        const firstFireAt = firstFireRaw ? new Date(firstFireRaw) : new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);

        const partnerLocationId = await resolveScheduleShop(formData, partnerId, assignedLocationId);

        await prisma.recurringOrderSchedule.create({
            data: {
                partnerId,
                name,
                intervalDays,
                paymentMethod,
                itemsJson: JSON.stringify(parsed),
                nextFireAt: firstFireAt,
                fulfillmentLocationId: locationId,
                partnerLocationId,
            },
        });

        revalidatePath("/[locale]/b2b-portal/schedules", "page");
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function updateScheduleAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const { partnerId, isMasterAdmin, assignedLocationId } = await getCallerPartnerId();
        const id = formData.get("id") as string;
        if (!id) return { ok: false, error: "Missing schedule id" };
        const where = isMasterAdmin ? { id } : { id, partnerId };
        const existing = await prisma.recurringOrderSchedule.findFirst({ where, select: { id: true } });
        if (!existing) return { ok: false, error: "Schedule not found" };

        const name = (formData.get("name") as string)?.trim();
        const intervalDays = parseInt(formData.get("intervalDays") as string, 10);
        const paymentMethod = formData.get("paymentMethod") as B2bPaymentMethod;
        const itemsJsonRaw = (formData.get("itemsJson") as string)?.trim() || "[]";
        const locationId = (formData.get("fulfillmentLocationId") as string) || null;

        if (!name) return { ok: false, error: "Name is required" };
        if (!Number.isFinite(intervalDays) || intervalDays < 1) return { ok: false, error: "Interval must be ≥ 1 day" };
        if (!paymentMethod) return { ok: false, error: "Payment method is required" };
        if (paymentMethod === "STRIPE_CARD" || paymentMethod === "STRIPE_ACH") {
            return { ok: false, error: "Stripe pay-now isn't supported for recurring schedules — pick a Resolve net term." };
        }
        let parsed: unknown;
        try { parsed = JSON.parse(itemsJsonRaw); } catch { return { ok: false, error: "Invalid items" }; }
        if (!Array.isArray(parsed) || parsed.length === 0) return { ok: false, error: "Add at least one item" };
        for (const it of parsed) {
            if (
                typeof it !== "object" || it === null ||
                typeof (it as { productId?: unknown }).productId !== "string" ||
                typeof (it as { quantity?: unknown }).quantity !== "number" ||
                ((it as { quantity: number }).quantity) < 1
            ) {
                return { ok: false, error: "Each item must have a product and quantity ≥ 1" };
            }
        }

        const partnerLocationId = await resolveScheduleShop(formData, partnerId, assignedLocationId);

        await prisma.recurringOrderSchedule.update({
            where: { id: existing.id },
            data: { name, intervalDays, paymentMethod, itemsJson: JSON.stringify(parsed), fulfillmentLocationId: locationId, partnerLocationId },
        });
        revalidatePath("/[locale]/b2b-portal/schedules", "page");
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function toggleScheduleActiveAction(formData: FormData): Promise<void> {
    const { partnerId, isMasterAdmin } = await getCallerPartnerId();
    const id = formData.get("id") as string;
    if (!id) return;

    const where = isMasterAdmin ? { id } : { id, partnerId };
    const schedule = await prisma.recurringOrderSchedule.findFirst({ where, select: { id: true, active: true } });
    if (!schedule) return;

    await prisma.recurringOrderSchedule.update({
        where: { id: schedule.id },
        data: { active: !schedule.active },
    });
    revalidatePath("/[locale]/b2b-portal/schedules", "page");
}

export async function deleteScheduleAction(formData: FormData): Promise<void> {
    const { partnerId, isMasterAdmin } = await getCallerPartnerId();
    const id = formData.get("id") as string;
    if (!id) return;

    const where = isMasterAdmin ? { id } : { id, partnerId };
    const schedule = await prisma.recurringOrderSchedule.findFirst({ where, select: { id: true } });
    if (!schedule) return;

    await prisma.recurringOrderSchedule.delete({ where: { id: schedule.id } });
    revalidatePath("/[locale]/b2b-portal/schedules", "page");
}
