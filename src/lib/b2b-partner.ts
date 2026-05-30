import { prisma } from "@/lib/db";

/**
 * Tier 2 — B2B Partner Org resolution.
 *
 * A partner org has one OWNER (B2bPartner.userId) plus any number of invited
 * member logins (B2bPartnerMember). This resolves which org a given user acts
 * for, and with what scope, so every B2B surface treats owners and members
 * uniformly instead of assuming `b2bPartner.findUnique({where:{userId}})`.
 */
export interface PartnerContext {
    partnerId: string;
    isOwner: boolean;
    memberId: string | null;
    /** Shop this member is locked to. null = owner or org-wide member (all shops). */
    assignedLocationId: string | null;
    /** Whether this login may see invoices/AR. Owners always can. */
    canViewBilling: boolean;
}

/**
 * Resolve the partner context for a user, as owner or ACTIVE member.
 * Returns null for non-B2B users and for pending/disabled members.
 */
export async function getPartnerContext(userId: string): Promise<PartnerContext | null> {
    const owner = await prisma.b2bPartner.findUnique({ where: { userId }, select: { id: true } });
    if (owner) {
        return { partnerId: owner.id, isOwner: true, memberId: null, assignedLocationId: null, canViewBilling: true };
    }
    const member = await prisma.b2bPartnerMember.findUnique({
        where: { userId },
        select: { id: true, partnerId: true, assignedLocationId: true, canViewBilling: true, status: true },
    });
    if (member && member.status === "ACTIVE") {
        return {
            partnerId: member.partnerId,
            isOwner: false,
            memberId: member.id,
            assignedLocationId: member.assignedLocationId,
            canViewBilling: member.canViewBilling,
        };
    }
    return null;
}

/** The owner's User id for a partner org (used for the org-wide contract/pricing). */
export async function getOwnerUserId(partnerId: string): Promise<string | null> {
    const p = await prisma.b2bPartner.findUnique({ where: { id: partnerId }, select: { userId: true } });
    return p?.userId ?? null;
}

/**
 * Every User id that belongs to an org: the owner + all ACTIVE members with a
 * linked account. Used so an owner sees orders placed by anyone in the org.
 */
export async function getOrgUserIds(partnerId: string): Promise<string[]> {
    const [owner, members] = await Promise.all([
        prisma.b2bPartner.findUnique({ where: { id: partnerId }, select: { userId: true } }),
        prisma.b2bPartnerMember.findMany({
            where: { partnerId, status: "ACTIVE", userId: { not: null } },
            select: { userId: true },
        }),
    ]);
    const ids = new Set<string>();
    if (owner?.userId) ids.add(owner.userId);
    for (const m of members) if (m.userId) ids.add(m.userId);
    return Array.from(ids);
}
