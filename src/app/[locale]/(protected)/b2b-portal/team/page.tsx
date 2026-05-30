import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPartnerContext } from "@/lib/b2b-partner";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import B2BTeamClient from "@/components/b2b/B2BTeamClient";

export const dynamic = "force-dynamic";

export default async function PartnerTeamPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session) redirect(`/${locale}/b2b/login`);
    const ctx = await getPartnerContext(session.userId);
    if (!ctx) redirect(`/${locale}/b2b-portal`);
    if (!ctx.isOwner) redirect(`/${locale}/b2b-portal`); // members can't manage the team

    const [members, shops] = await Promise.all([
        prisma.b2bPartnerMember.findMany({
            where: { partnerId: ctx.partnerId },
            orderBy: [{ status: "asc" }, { createdAt: "asc" }],
            select: { id: true, email: true, name: true, status: true, canViewBilling: true, assignedLocationId: true },
        }),
        prisma.b2bPartnerLocation.findMany({
            where: { partnerId: ctx.partnerId, isActive: true },
            orderBy: { label: "asc" },
            select: { id: true, label: true },
        }),
    ]);

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-serif text-[#2C2A29] mb-1 flex items-center gap-2">
                    <Users className="w-6 h-6 text-[#CBA153]" /> Team
                </h1>
                <p className="text-sm text-gray-500">
                    Invite teammates to order on your account. Assign someone to a shop to limit them to that location,
                    or leave them unassigned to order for any shop. Choose whether each person can see billing.
                </p>
            </header>
            <B2BTeamClient members={members} shops={shops} />
        </div>
    );
}
