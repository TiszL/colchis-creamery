import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 5;

export default async function LocationInventoryPage({
    params,
}: {
    params: Promise<{ locale: string; locationId: string }>;
}) {
    const { locationId } = await params;

    const stocks = await prisma.stock.findMany({
        where: { locationId },
        include: {
            product: {
                select: { id: true, sku: true, name: true, salesChannel: true, isMadeToOrder: true },
            },
        },
        orderBy: [{ quantity: "asc" }, { product: { name: "asc" } }],
    });

    const lowStock = stocks.filter(s => s.quantity !== null && s.quantity <= LOW_STOCK_THRESHOLD);
    const mto = stocks.filter(s => s.quantity === null);
    const inStock = stocks.filter(s => s.quantity !== null && s.quantity > LOW_STOCK_THRESHOLD);

    return (
        <div className="space-y-8 max-w-4xl">
            <header>
                <h1 className="text-2xl font-serif mb-1">Inventory</h1>
                <p className="text-sm text-gray-500">
                    Read-only snapshot. Stock receiving, transfers, and lot/batch tracking land in Phase 3.
                    For now, master admin updates stock via Admin → Inventory.
                </p>
            </header>

            {lowStock.length > 0 && (
                <Section title="Low stock" tone="red" rows={lowStock} />
            )}
            {inStock.length > 0 && (
                <Section title="In stock" tone="neutral" rows={inStock} />
            )}
            {mto.length > 0 && (
                <Section title="Made-to-order (untracked)" tone="neutral" rows={mto} />
            )}

            {stocks.length === 0 && (
                <div className="bg-[#161616] border border-[#ffffff0A] p-10 text-center text-gray-500 text-sm">
                    No stock rows at this location.
                </div>
            )}
        </div>
    );
}

function Section({
    title, tone, rows,
}: {
    title: string;
    tone: "red" | "neutral";
    rows: Array<{ id: string; quantity: number | null; product: { sku: string; name: string; salesChannel: string; isMadeToOrder: boolean } }>;
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
