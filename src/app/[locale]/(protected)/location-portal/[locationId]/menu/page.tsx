import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/location-rbac";
import { Power, PowerOff } from "lucide-react";

export const dynamic = "force-dynamic";

// Phase 9c: per-location menu enable/disable toggle. LOCATION_MANAGER + master
// admins can flip this; LOCATION_FULFILLMENT staff can't (they're order-only).
async function toggleStockEnabledAction(formData: FormData) {
    "use server";
    const stockId = formData.get("stockId") as string;
    const next = formData.get("next") === "1"; // "1" = enable, "0" = disable
    if (!stockId) return;

    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
        select: { locationId: true },
    });
    if (!stock) return;

    // Permission check: must be MASTER_ADMIN or LOCATION_MANAGER at this location.
    // requireLocationAccess throws/redirects if not — we let that bubble.
    await requireLocationAccess(stock.locationId, ["LOCATION_MANAGER"]);

    await prisma.stock.update({
        where: { id: stockId },
        data: { isEnabled: next },
    });

    revalidatePath(`/[locale]/location-portal/${stock.locationId}/menu`, "page");
    // Public catalog/availability queries respect isEnabled — bust those too
    // so a disabled SKU disappears from the storefront immediately.
    revalidatePath("/[locale]/bakery", "page");
    revalidatePath("/[locale]/creamery", "page");
    revalidatePath("/[locale]/shop", "page");
}

export default async function LocationMenuPage({
    params,
}: {
    params: Promise<{ locale: string; locationId: string }>;
}) {
    const { locationId } = await params;

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

    const enabledCount = stocks.filter(s => s.isEnabled).length;
    const disabledCount = stocks.length - enabledCount;

    return (
        <div className="space-y-6 max-w-4xl">
            <header>
                <h1 className="text-2xl font-serif mb-1">Menu</h1>
                <p className="text-sm text-gray-500">
                    {stocks.length} SKU{stocks.length === 1 ? "" : "s"} carried at this location
                    {disabledCount > 0 && (
                        <> · <span className="text-amber-400">{disabledCount} hidden from menu</span></>
                    )}
                    . Master admin defines the global catalog; flip the toggle to hide a SKU from
                    customers at this location without losing the on-hand count.
                </p>
            </header>

            {stocks.length === 0 && (
                <div className="bg-[#161616] border border-[#ffffff0A] p-10 text-center text-gray-500 text-sm">
                    No SKUs stocked at this location yet. Master admin can add them via Admin → Inventory.
                </div>
            )}

            <div className="bg-[#161616] border border-[#ffffff0A] divide-y divide-[#ffffff0A]">
                {stocks.map(s => (
                    <div
                        key={s.id}
                        className={`flex items-center justify-between px-5 py-3 ${s.isEnabled ? "" : "opacity-50"}`}
                    >
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
                            </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                                <div className="text-sm text-white font-mono">{s.quantity === null ? "MTO" : s.quantity}</div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider">in stock</div>
                            </div>
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
                        </div>
                    </div>
                ))}
            </div>

            {enabledCount > 0 && (
                <p className="text-[10px] text-gray-600 uppercase tracking-wider">
                    Green power icon = visible on public storefront · grey = hidden (stock count preserved).
                </p>
            )}
        </div>
    );
}
