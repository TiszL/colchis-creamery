import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { createScheduleAction, toggleScheduleActiveAction, deleteScheduleAction } from "@/app/actions/b2b-schedules";
import { Repeat, Play, Pause, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

const NET_OPTIONS = [
    { value: "RESOLVE_NET_7",  label: "Resolve · Net 7" },
    { value: "RESOLVE_NET_15", label: "Resolve · Net 15" },
    { value: "RESOLVE_NET_30", label: "Resolve · Net 30" },
    { value: "RESOLVE_NET_45", label: "Resolve · Net 45" },
];

export default async function PartnerSchedulesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const session = await getSession();
    if (!session) redirect(`/${locale}/b2b/login`);
    if (session.role !== "B2B_PARTNER" && session.role !== "MASTER_ADMIN") redirect(`/${locale}/`);

    const partner = session.role === "B2B_PARTNER"
        ? await prisma.b2bPartner.findUnique({ where: { userId: session.userId }, select: { id: true } })
        : null;

    const schedules = partner
        ? await prisma.recurringOrderSchedule.findMany({
            where: { partnerId: partner.id },
            include: { fulfillmentLocation: { select: { id: true, name: true } } },
            orderBy: [{ active: "desc" }, { nextFireAt: "asc" }],
        })
        : [];

    const locations = await prisma.location.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, type: true },
    });

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-serif text-[#2C2A29] mb-2 flex items-center gap-2">
                    <Repeat className="w-6 h-6 text-[#CBA153]" /> Recurring orders
                </h1>
                <p className="text-sm text-gray-500">
                    Set a cadence and we&apos;ll auto-create draft orders. You can pause or delete a schedule any time.
                </p>
            </header>

            {!partner && (
                <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm rounded-lg">
                    Place your first Resolve net-terms order to initialize your partner profile, then come back to set up recurring schedules.
                </div>
            )}

            {/* Existing schedules */}
            <section>
                <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                    {schedules.length} schedule{schedules.length === 1 ? "" : "s"}
                </h2>
                {schedules.length === 0 && (
                    <div className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-6 text-center text-gray-500 text-sm">
                        No schedules yet. Add one below.
                    </div>
                )}
                <div className="space-y-2">
                    {schedules.map(s => {
                        let itemCount = 0;
                        try {
                            const arr = JSON.parse(s.itemsJson) as Array<{ quantity: number }>;
                            itemCount = arr.reduce((n, i) => n + (i.quantity || 0), 0);
                        } catch { /* malformed JSON — surface as 0 */ }
                        return (
                            <div key={s.id} className={`bg-white border border-[#E8E6E1] shadow-sm rounded-xl px-4 py-3 flex items-center justify-between gap-4 ${!s.active ? "opacity-60" : ""}`}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <p className="text-sm font-medium text-[#2C2A29]">{s.name}</p>
                                        <span className="text-[10px] font-mono text-[#CBA153]">{s.paymentMethod.replace(/_/g, " ")}</span>
                                        {!s.active && <span className="text-[10px] font-mono text-amber-600 uppercase tracking-wider">Paused</span>}
                                    </div>
                                    <p className="text-[11px] text-gray-500 font-mono">
                                        every {s.intervalDays}d · {itemCount} units · next: {s.nextFireAt.toISOString().slice(0, 10)}
                                        {s.fulfillmentLocation && <span> · ships from {s.fulfillmentLocation.name}</span>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <form action={toggleScheduleActiveAction}>
                                        <input type="hidden" name="id" value={s.id} />
                                        <button type="submit" className="p-2 text-gray-400 hover:text-[#2C2A29]" title={s.active ? "Pause" : "Resume"}>
                                            {s.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                        </button>
                                    </form>
                                    <form action={deleteScheduleAction}>
                                        <input type="hidden" name="id" value={s.id} />
                                        <button type="submit" className="p-2 text-gray-400 hover:text-red-500" title="Delete">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </form>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Create form */}
            {partner && (
                <section className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                    <h2 className="text-lg font-serif text-[#2C2A29] mb-3">Add a schedule</h2>
                    <form action={async fd => { "use server"; await createScheduleAction(fd); }} className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Name *</label>
                                <input name="name" required placeholder="Weekly sulguni order" className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Interval (days) *</label>
                                <input name="intervalDays" type="number" min={1} defaultValue={7} required className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Payment method *</label>
                                <select name="paymentMethod" defaultValue="RESOLVE_NET_30" required className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]">
                                    {NET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Ship from</label>
                                <select name="fulfillmentLocationId" defaultValue="" className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]">
                                    <option value="">— Auto (default warehouse) —</option>
                                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">First fire</label>
                                <input name="firstFireAt" type="date" className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Items (JSON) *</label>
                            <textarea
                                name="itemsJson"
                                required
                                rows={3}
                                placeholder='[{"productId":"abc...","quantity":5},{"productId":"xyz...","quantity":2}]'
                                className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm font-mono rounded-md focus:outline-none focus:border-[#CBA153]"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Paste product IDs from the wholesale catalog. A drag-and-drop builder is coming.</p>
                        </div>
                        <button type="submit" className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-4 py-2 text-sm font-medium rounded-md transition">
                            Create schedule
                        </button>
                    </form>
                </section>
            )}
        </div>
    );
}
