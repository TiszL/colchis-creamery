import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

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
                    kind: true, status: true, isB2cVisible: true,
                },
            },
        },
        orderBy: { product: { name: "asc" } },
    });

    return (
        <div className="space-y-6 max-w-4xl">
            <header>
                <h1 className="text-2xl font-serif mb-1">Menu</h1>
                <p className="text-sm text-gray-500">
                    {stocks.length} SKU{stocks.length === 1 ? "" : "s"} carried at this location.
                    Master admin defines the global catalog; this page will gain per-location enable/disable toggles in a follow-up.
                </p>
            </header>

            {stocks.length === 0 && (
                <div className="bg-[#161616] border border-[#ffffff0A] p-10 text-center text-gray-500 text-sm">
                    No SKUs stocked at this location yet. Master admin can add them via Admin → Inventory.
                </div>
            )}

            <div className="bg-[#161616] border border-[#ffffff0A] divide-y divide-[#ffffff0A]">
                {stocks.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                                <p className="text-sm text-white truncate">{s.product.name}</p>
                                <span className="text-[10px] font-mono text-gray-500">{s.product.sku}</span>
                                <span className="text-[10px] font-mono text-[#B96A3D]">{s.product.salesChannel.replace(/_/g, " ")}</span>
                                {s.product.status !== "ACTIVE" && (
                                    <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">{s.product.status}</span>
                                )}
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="text-sm text-white font-mono">{s.quantity === null ? "MTO" : s.quantity}</div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">in stock</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
