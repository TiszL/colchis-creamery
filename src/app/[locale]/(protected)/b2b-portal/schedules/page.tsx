import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPartnerContext } from "@/lib/b2b-partner";
import { redirect } from "next/navigation";
import { Repeat } from "lucide-react";
import B2BSchedulesClient from "@/components/b2b/B2BSchedulesClient";

export const dynamic = "force-dynamic";

export default async function PartnerSchedulesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const session = await getSession();
    if (!session) redirect(`/${locale}/b2b/login`);
    if (session.role !== "B2B_PARTNER" && session.role !== "MASTER_ADMIN") redirect(`/${locale}/`);

    // Owner or active member — members manage schedules for their assigned shop.
    const ctx = await getPartnerContext(session.userId);
    const partnerId = ctx?.partnerId ?? null;
    const lockedShopId = ctx?.assignedLocationId ?? null;

    const [rawSchedules, products, locations, shops] = await Promise.all([
        partnerId
            ? prisma.recurringOrderSchedule.findMany({
                where: { partnerId },
                orderBy: [{ active: "desc" }, { nextFireAt: "asc" }],
            })
            : Promise.resolve([]),
        prisma.product.findMany({
            where: { status: "ACTIVE", isB2bVisible: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
        }),
        prisma.location.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
        }),
        partnerId
            ? prisma.b2bPartnerLocation.findMany({
                where: { partnerId, isActive: true },
                orderBy: { label: "asc" },
                select: { id: true, label: true, city: true, state: true },
            })
            : Promise.resolve([]),
    ]);

    const schedules = rawSchedules.map(s => {
        let items: { productId: string; quantity: number }[] = [];
        try {
            const arr = JSON.parse(s.itemsJson);
            if (Array.isArray(arr)) items = arr.filter(i => i && typeof i.productId === "string" && typeof i.quantity === "number");
        } catch { /* malformed — show empty */ }
        return {
            id: s.id,
            name: s.name,
            intervalDays: s.intervalDays,
            paymentMethod: s.paymentMethod as string,
            active: s.active,
            nextFireAt: s.nextFireAt.toISOString(),
            fulfillmentLocationId: s.fulfillmentLocationId,
            partnerLocationId: s.partnerLocationId,
            items,
        };
    });

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-serif text-[#2C2A29] mb-1 flex items-center gap-2">
                    <Repeat className="w-6 h-6 text-[#CBA153]" /> Recurring orders
                </h1>
                <p className="text-sm text-gray-500">
                    Set a cadence and we&apos;ll auto-place the order. Pause, edit, or delete any time.
                </p>
            </header>

            {!partnerId ? (
                <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm rounded-lg">
                    Place your first Resolve net-terms order to initialize your partner profile, then come back to set up recurring schedules.
                </div>
            ) : (
                <B2BSchedulesClient schedules={schedules} products={products} locations={locations} shops={shops} lockedShopId={lockedShopId} />
            )}
        </div>
    );
}
