import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/location-rbac";
import { getSession } from "@/lib/session";
import { nextOpenAfterToday } from "@/lib/location-hours";
import { isEightySixed } from "@/lib/stock-availability";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";
import type { LocationHours } from "@/lib/location-hours";
import { Power, PowerOff, AlertTriangle } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

/** Bust every surface that renders availability after a menu change. */
function revalidateMenuSurfaces(locationId: string) {
    revalidatePath(`/[locale]/location-portal/${locationId}/menu`, "page");
    revalidatePath("/[locale]/bakery", "page");
    revalidatePath("/[locale]/creamery", "page");
    revalidatePath("/[locale]/shop", "page");
}

// Phase 9c: per-location menu enable/disable toggle. LOCATION_MANAGER + master
// admins can flip this; LOCATION_FULFILLMENT staff can't (permanent delisting
// is a manager call — their tool is the day-of 86 below).
async function toggleStockEnabledAction(formData: FormData) {
    "use server";
    const stockId = formData.get("stockId") as string;
    const next = formData.get("next") === "1"; // "1" = enable, "0" = disable
    if (!stockId) return;

    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
        select: { locationId: true, productId: true },
    });
    if (!stock) return;

    // Permission check: must be MASTER_ADMIN or LOCATION_MANAGER at this location.
    // requireLocationAccess throws/redirects if not — we let that bubble.
    await requireLocationAccess(stock.locationId, ["LOCATION_MANAGER"]);
    const session = await getSession();

    await prisma.$transaction([
        prisma.stock.update({
            where: { id: stockId },
            data: { isEnabled: next },
        }),
        prisma.menuAvailabilityEvent.create({
            data: {
                stockId,
                locationId: stock.locationId,
                productId: stock.productId,
                action: next ? "MENU_SHOW" : "MENU_HIDE",
                byUserId: session?.userId ?? null,
                byName: session?.name || session?.email || "Staff",
            },
        }),
    ]);

    revalidateMenuSurfaces(stock.locationId);
}

// 86 workflow: day-of unavailability. Kitchen staff (LOCATION_FULFILLMENT)
// can 86 — it moves no money and mirrors the physical reality of running out.
// The item stays listed with an unavailable state and self-re-enables at the
// next opening after today (no cron; orderability queries compare the stamp).
async function eightySixTodayAction(formData: FormData) {
    "use server";
    const stockId = formData.get("stockId") as string;
    if (!stockId) return;

    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
        select: { locationId: true, productId: true, location: { select: { hours: true } } },
    });
    if (!stock) return;

    await requireLocationAccess(stock.locationId, ["LOCATION_MANAGER", "LOCATION_FULFILLMENT"]);
    const session = await getSession();

    // Fallback for a location with no configured hours: 24h from now.
    const until =
        nextOpenAfterToday(stock.location.hours as LocationHours) ??
        new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.$transaction([
        prisma.stock.update({
            where: { id: stockId },
            data: { disabledUntil: until },
        }),
        prisma.menuAvailabilityEvent.create({
            data: {
                stockId,
                locationId: stock.locationId,
                productId: stock.productId,
                action: "EIGHTY_SIX_TODAY",
                until,
                byUserId: session?.userId ?? null,
                byName: session?.name || session?.email || "Staff",
            },
        }),
    ]);

    revalidateMenuSurfaces(stock.locationId);
}

// Undo an 86 early (dough turned up after all). Same roles as setting it.
async function restoreEightySixAction(formData: FormData) {
    "use server";
    const stockId = formData.get("stockId") as string;
    if (!stockId) return;

    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
        select: { locationId: true, productId: true },
    });
    if (!stock) return;

    await requireLocationAccess(stock.locationId, ["LOCATION_MANAGER", "LOCATION_FULFILLMENT"]);
    const session = await getSession();

    await prisma.$transaction([
        prisma.stock.update({
            where: { id: stockId },
            data: { disabledUntil: null },
        }),
        prisma.menuAvailabilityEvent.create({
            data: {
                stockId,
                locationId: stock.locationId,
                productId: stock.productId,
                action: "RESTORE",
                byUserId: session?.userId ?? null,
                byName: session?.name || session?.email || "Staff",
            },
        }),
    ]);

    revalidateMenuSurfaces(stock.locationId);
}

const untilFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
});

export default async function LocationMenuPage({
    params,
}: {
    params: Promise<{ locale: string; locationId: string }>;
}) {
    const { locationId } = await params;
    const { ctx, matchedLocation } = await requireLocationAccess(locationId);
    const isManager = ctx.isMasterAdmin || (matchedLocation?.roles.includes("LOCATION_MANAGER") ?? false);
    const now = new Date();

    const stocks = await prisma.stock.findMany({
        where: { locationId },
        include: {
            product: {
                select: {
                    id: true, sku: true, name: true, salesChannel: true,
                    productCategory: { select: { slug: true, name: true } },
                    status: true, isB2cVisible: true,
                },
            },
        },
        orderBy: { product: { name: "asc" } },
    });

    // Paid orders still in the kitchen pipeline that contain an item this
    // page currently shows as unavailable (86'd or hidden) — the kitchen
    // should call those customers (order-modification flow handles the rest).
    const unavailableProductIds = stocks
        .filter(s => !s.isEnabled || isEightySixed(s, now))
        .map(s => s.productId);
    const affectedOrdersByProduct = new Map<string, Set<string>>();
    if (unavailableProductIds.length > 0) {
        const lines = await prisma.orderFulfillmentItem.findMany({
            where: {
                fulfillment: {
                    locationId,
                    status: { in: ["PENDING", "CONFIRMED", "PREPARING"] },
                    order: { paymentStatus: "PAID" },
                },
                orderItem: { productId: { in: unavailableProductIds } },
            },
            select: {
                fulfillment: { select: { orderId: true } },
                orderItem: { select: { productId: true, quantity: true, refundedQuantity: true } },
            },
        });
        for (const line of lines) {
            if (line.orderItem.quantity - line.orderItem.refundedQuantity <= 0) continue;
            const set = affectedOrdersByProduct.get(line.orderItem.productId) ?? new Set<string>();
            set.add(line.fulfillment.orderId);
            affectedOrdersByProduct.set(line.orderItem.productId, set);
        }
    }

    const enabledCount = stocks.filter(s => s.isEnabled).length;
    const disabledCount = stocks.length - enabledCount;
    const eightySixedCount = stocks.filter(s => isEightySixed(s, now)).length;

    return (
        <div className="space-y-6 max-w-4xl">
            <header>
                <h1 className="text-2xl font-serif mb-1">Menu</h1>
                <p className="text-sm text-gray-500">
                    {stocks.length} SKU{stocks.length === 1 ? "" : "s"} carried at this location
                    {disabledCount > 0 && (
                        <> · <span className="text-amber-400">{disabledCount} hidden from menu</span></>
                    )}
                    {eightySixedCount > 0 && (
                        <> · <span className="text-orange-400">{eightySixedCount} 86&apos;d today</span></>
                    )}
                    . &ldquo;86 today&rdquo; marks an item sold out until the next opening — it stays
                    on the menu with an unavailable badge and comes back automatically.
                    {isManager && " The power toggle hides a SKU from the storefront entirely (count preserved)."}
                </p>
            </header>

            {stocks.length === 0 && (
                <div className="bg-[#161616] border border-[#ffffff0A] p-10 text-center text-gray-500 text-sm">
                    No SKUs stocked at this location yet. Master admin can add them via Admin → Inventory.
                </div>
            )}

            <div className="bg-[#161616] border border-[#ffffff0A] divide-y divide-[#ffffff0A]">
                {stocks.map(s => {
                    const eightySixed = isEightySixed(s, now);
                    const affected = affectedOrdersByProduct.get(s.productId)?.size ?? 0;
                    return (
                        <div
                            key={s.id}
                            className={`px-5 py-3 ${s.isEnabled ? "" : "opacity-50"}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <p className="text-sm text-white truncate">{s.product.name}</p>
                                        <span className="text-[10px] font-mono text-gray-500">{s.product.sku}</span>
                                        {s.product.productCategory && (
                                            <span className="text-[10px] font-mono text-[#B96A3D]">{s.product.productCategory.name}</span>
                                        )}
                                        <span className="text-[10px] font-mono text-gray-600">{s.product.salesChannel.replace(/_/g, " ")}</span>
                                        {s.product.status !== "ACTIVE" && (
                                            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">{s.product.status}</span>
                                        )}
                                        {!s.isEnabled && (
                                            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider bg-amber-900/20 px-1.5 py-0.5">hidden</span>
                                        )}
                                        {eightySixed && s.disabledUntil && (
                                            <span className="text-[10px] font-mono text-orange-400 uppercase tracking-wider bg-orange-900/20 px-1.5 py-0.5">
                                                86&apos;d · back {untilFmt.format(s.disabledUntil)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-right">
                                        <div className="text-sm text-white font-mono">{s.quantity === null ? "MTO" : s.quantity}</div>
                                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">in stock</div>
                                    </div>
                                    {s.isEnabled && (eightySixed ? (
                                        <form action={restoreEightySixAction}>
                                            <input type="hidden" name="stockId" value={s.id} />
                                            <button
                                                type="submit"
                                                className="text-[10px] font-mono uppercase tracking-wider px-3 py-2 border border-orange-800 text-orange-300 hover:bg-orange-900/20 transition-colors"
                                            >
                                                Restore now
                                            </button>
                                        </form>
                                    ) : (
                                        <form action={eightySixTodayAction}>
                                            <input type="hidden" name="stockId" value={s.id} />
                                            <button
                                                type="submit"
                                                title="Sold out for the rest of today — comes back at next opening"
                                                className="text-[10px] font-mono uppercase tracking-wider px-3 py-2 border border-[#ffffff1A] text-gray-300 hover:border-orange-800 hover:text-orange-300 transition-colors"
                                            >
                                                86 today
                                            </button>
                                        </form>
                                    ))}
                                    {isManager && (
                                        <form action={toggleStockEnabledAction}>
                                            <input type="hidden" name="stockId" value={s.id} />
                                            <input type="hidden" name="next" value={s.isEnabled ? "0" : "1"} />
                                            <button
                                                type="submit"
                                                title={s.isEnabled ? "Hide from public menu" : "Show on public menu"}
                                                className={`p-2 transition-colors ${s.isEnabled ? "text-emerald-400 hover:text-emerald-300" : "text-gray-600 hover:text-emerald-400"}`}
                                            >
                                                {s.isEnabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </div>
                            {affected > 0 && (
                                <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-300 bg-amber-900/15 border border-amber-900/40 px-3 py-2">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                        {affected} paid pending order{affected === 1 ? "" : "s"} include{affected === 1 ? "s" : ""} this item —
                                        call the customer{affected === 1 ? "" : "s"} from the{" "}
                                        <Link href={`/location-portal/${locationId}/orders`} className="underline hover:text-amber-200">Orders queue</Link>.
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {enabledCount > 0 && (
                <p className="text-[10px] text-gray-600 uppercase tracking-wider">
                    86 today = sold out until next opening (auto-restores) ·
                    {isManager ? " green power icon = visible on public storefront, grey = hidden (stock count preserved)." : " ask a manager to remove an item from the menu permanently."}
                </p>
            )}
        </div>
    );
}
