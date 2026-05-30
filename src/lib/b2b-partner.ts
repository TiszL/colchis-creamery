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
