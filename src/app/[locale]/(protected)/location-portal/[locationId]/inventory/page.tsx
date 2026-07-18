import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/location-rbac";
import { receiveStockAction } from "@/app/actions/inventory";
import { PackagePlus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LocationInventoryPage({
    params,
}: {
    params: Promise<{ locale: string; locationId: string }>;
}) {
    const { locationId } = await params;
    // Kitchen surfaces only — waitstaff (SERVER role) have no business here.
    await requireLocationAccess(locationId, ["LOCATION_MANAGER", "LOCATION_FULFILLMENT"]);

    const [stocks, batches, location] = await Promise.all([
        prisma.stock.findMany({
            where: { locationId },
            include: {
                product: { select: { id: true, sku: true, name: true, salesChannel: true, isMadeToOrder: true } },
            },
            orderBy: [{ quantity: "asc" }, { product: { name: "asc" } }],
        }),
        // Recent + active batches at this location (last 30 days plus any with positive qty)
        prisma.productBatch.findMany({
            where: { locationId, OR: [{ quantity: { gt: 0 } }, { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }] },
            include: { product: { select: { sku: true, name: true } } },
            orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
            take: 50,
        }),
        prisma.location.findUnique({
            where: { id: locationId },
            select: {
                allowsChannels: true,
                stocks: {
                    include: { product: { select: { id: true, name: true, sku: true, isMadeToOrder: true, salesChannel: true } } },
                },
            },
        }),
    ]);

    // Product picker: SKUs the location actually carries (have a Stock row),
    // excluding MTO since you don't "receive" made-to-order inventory.
    const receivableProducts = (location?.stocks || [])
        .map(s => s.product)
        .filter(p => !p.isMadeToOrder)
        .sort((a, b) => a.name.localeCompare(b.name));

    // Per-Stock.lowStockThreshold (defaults to 0). A Stock row is "low" when
    // quantity <= its own threshold (which is 0 by default — meaning only
    // out-of-stock rows count until the admin sets a higher threshold per SKU).
    const lowStock = stocks.filter(s => s.quantity !== null && s.quantity <= s.lowStockThreshold);
    const mto      = stocks.filter(s => s.quantity === null);
    const inStock  = stocks.filter(s => s.quantity !== null && s.quantity > s.lowStockThreshold);

    const today = new Date();
    const inSevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return (
        <div className="space-y-8 max-w-4xl">
            <header>
                <h1 className="text-2xl font-serif mb-1">Inventory</h1>
                <p className="text-sm text-gray-500">
                    Receive new shipments, see lot-level batch detail, and watch expiry.
                </p>
            </header>

            {/* ── Receive form ──────────────────────────────────────────── */}
            <section className="bg-[#161616] border border-[#ffffff0A] p-5">
                <h2 className="text-[11px] font-mono uppercase tracking-wider text-[#B96A3D] mb-3 flex items-center gap-1.5">
                    <PackagePlus className="w-3.5 h-3.5" /> Receive a shipment
                </h2>
                {receivableProducts.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No SKUs carried at this location yet. Add stock via Admin → Inventory first.</p>
                ) : (
                    <form action={async fd => { "use server"; await receiveStockAction(fd); }} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 items-end">
                        <input type="hidden" name="locationId" value={locationId} />
                        <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Product</label>
                            <select name="productId" required className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm">
                                {receivableProducts.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Qty *</label>
                            <input name="quantity" type="number" min={1} required placeholder="100" className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Lot #</label>
                            <input name="lotNumber" placeholder="SUL-2026W21-A" className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm font-mono" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Mfg date</label>
                            <input name="manufacturedAt" type="date" className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Expires</label>
                            <input name="expiresAt" type="date" className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                        </div>
                        <div className="md:col-span-5">
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Notes</label>
                            <input name="notes" placeholder="optional" className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] placeholder-gray-700 text-sm" />
                        </div>
                        <div>
                            <button type="submit" className="w-full bg-[#B96A3D] text-black px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider hover:bg-[#a85d35] transition-colors">
                                Receive
                            </button>
                        </div>
                    </form>
                )}
                <p className="text-[9px] text-gray-600 mt-2 uppercase tracking-wider">
                    Creates a tracked batch + audit row. Updates the cached stock count atomically.
                </p>
            </section>

            {/* ── Stock summary ─────────────────────────────────────────── */}
            {lowStock.length > 0 && <StockSection title="Low stock" tone="red" rows={lowStock} />}
            {inStock.length > 0 && <StockSection title="In stock" tone="neutral" rows={inStock} />}
            {mto.length > 0 && <StockSection title="Made-to-order (untracked)" tone="neutral" rows={mto} />}

            {/* ── Batch detail with expiry highlight ────────────────────── */}
            {batches.length > 0 && (
                <section>
                    <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                        Batches <span className="text-gray-600">· {batches.length} active or recent</span>
                    </h2>
                    <div className="bg-[#161616] border border-[#ffffff0A] divide-y divide-[#ffffff0A]">
                        {batches.map(b => {
                            const expiringSoon = b.expiresAt && b.expiresAt <= inSevenDays && b.quantity > 0;
                            const expired      = b.expiresAt && b.expiresAt <= today && b.quantity > 0;
                            const depleted     = b.quantity === 0;
                            return (
                                <div key={b.id} className={`flex items-center justify-between px-4 py-2.5 ${expired ? "bg-red-950/20" : expiringSoon ? "bg-amber-950/15" : ""}`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <p className="text-sm text-white truncate">{b.product.name}</p>
                                        <span className="text-[10px] font-mono text-gray-500">{b.product.sku}</span>
                                        {b.lotNumber && <span className="text-[10px] font-mono text-[#B96A3D]">{b.lotNumber}</span>}
                                        {b.expiresAt && (
                                            <span className={`text-[10px] font-mono ${expired ? "text-red-400" : expiringSoon ? "text-amber-400" : "text-gray-600"}`}>
                                                {expired ? "EXPIRED · " : expiringSoon ? "EXPIRES " : "exp "}{b.expiresAt.toISOString().slice(0, 10)}
                                            </span>
                                        )}
                                        {!b.expiresAt && b.lotNumber === null && <span className="text-[10px] font-mono text-gray-700 italic">legacy</span>}
                                    </div>
                                    <div className={`text-sm font-mono shrink-0 ${depleted ? "text-gray-600" : expired ? "text-red-400" : "text-white"}`}>
                                        {b.quantity}<span className="text-gray-600">/{b.initialQuantity}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {stocks.length === 0 && (
                <div className="bg-[#161616] border border-[#ffffff0A] p-10 text-center text-gray-500 text-sm">
                    No stock rows at this location.
                </div>
            )}
        </div>
    );
}

function StockSection({
    title, tone, rows,
}: {
    title: string;
    tone: "red" | "neutral";
    rows: Array<{ id: string; quantity: number | null; lowStockThreshold: number; product: { sku: string; name: string; salesChannel: string; isMadeToOrder: boolean } }>;
}) {
    return (
        <div>
            <h2 className={`text-[11px] font-mono uppercase tracking-wider mb-2 ${tone === "red" ? "text-red-400" : "text-gray-500"}`}>
                {title} <span className="text-gray-600">· {rows.length}</span>
            </h2>
            <div className="bg-[#161616] border border-[#ffffff0A] divide-y divide-[#ffffff0A]">
                {rows.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                            <p className="text-sm text-white truncate">{s.product.name}</p>
                            <span className="text-[10px] font-mono text-gray-500">{s.product.sku}</span>
                            <span className="text-[10px] font-mono text-[#B96A3D]">{s.product.salesChannel.replace(/_/g, " ")}</span>
                        </div>
                        <div className={`text-sm font-mono ${tone === "red" ? "text-red-400" : "text-white"}`}>
                            {s.quantity === null ? "MTO" : s.quantity}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
