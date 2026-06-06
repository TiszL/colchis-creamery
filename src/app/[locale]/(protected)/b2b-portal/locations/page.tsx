import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPartnerContext } from "@/lib/b2b-partner";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Store } from "lucide-react";
import B2BShopsClient from "@/components/b2b/B2BShopsClient";

export const dynamic = "force-dynamic";

export default async function PartnerShopsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations("b2bPortal.locations");
    const session = await getSession();
    if (!session) redirect(`/${locale}/b2b/login`);
    const ctx = await getPartnerContext(session.userId);
    if (!ctx) redirect(`/${locale}/b2b-portal`);
    // Members can't manage shops — only the owner.
    if (!ctx.isOwner) redirect(`/${locale}/b2b-portal`);

    const shops = await prisma.b2bPartnerLocation.findMany({
        where: { partnerId: ctx.partnerId },
        orderBy: [{ isActive: "desc" }, { label: "asc" }],
        select: {
            id: true, label: true, line1: true, line2: true, city: true, state: true, postalCode: true,
            contactName: true, contactPhone: true, isActive: true,
            separateBilling: true, billingCompanyName: true, billingEin: true, billingEmail: true, billingAddress: true,
        },
    });

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-serif text-[#2C2A29] mb-1 flex items-center gap-2">
                    <Store className="w-6 h-6 text-[#CBA153]" /> {t('title')}
                </h1>
                <p className="text-sm text-gray-500">
                    {t('intro')}
                </p>
            </header>
            <B2BShopsClient shops={shops} />
        </div>
    );
}
