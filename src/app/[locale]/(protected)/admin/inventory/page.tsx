import { prisma as db } from '@/lib/db';
import { PackageSearch, Edit2 } from 'lucide-react';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

async function updateStockAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const stockQuantity = parseInt(formData.get('stock') as string, 10);
    const isActive = formData.get('isActive') === 'on';

    if (id && !isNaN(stockQuantity)) {
        await db.product.update({
            where: { id },
            data: { stockQuantity, isActive }
        });
        revalidatePath('/[locale]/admin/inventory', 'page');
    }
}

export default async function AdminInventoryPage() {
    const products = await db.product.findMany({
        orderBy: { name: 'asc' }
    });

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-serif text-[#2C2A29] flex items-center gap-3">
                        <PackageSearch className="w-8 h-8 text-[#CBA153]" />
                        Master Inventory
                    </h1>
                    <p className="text-gray-500 mt-1">Manage physical stock levels available for both B2C and B2B channels.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-700">
                        <thead className="bg-[#FDFBF7] text-gray-500 font-medium border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">Product</th>
                                <th className="px-6 py-4">SKU</th>
                                <th className="px-6 py-4 text-right">Physical Stock (Qty)</th>
                                <th className="px-6 py-4 text-center">Active</th>
                                <th className="px-6 py-4 text-right">B2C Price</th>
                                <th className="px-6 py-4 text-right">B2B Base Price</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {products.map((product: any) => (
                                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded border border-gray-200 overflow-hidden bg-white">
                                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="font-medium text-gray-900">{product.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-gray-500 object-cover">
                                        {product.sku}
                                    </td>
                                    <td className="px-6 py-4">
                                        <form action={updateStockAction} className="flex justify-end items-center gap-2">
                                            <input type="hidden" name="id" value={product.id} />
                                            <input type="hidden" name="isActive" value={product.isActive ? 'on' : 'off'} />
                                            <input
                                                type="number"
                                                name="stock"
                                                defaultValue={product.stockQuantity}
                                                className="w-20 text-right text-gray-900 border-gray-300 rounded focus:ring-[#CBA153] focus:border-[#CBA153] py-1 px-2"
                                            />
                                            <button type="submit" className="p-1.5 text-gray-400 hover:text-[#CBA153] transition-colors rounded hover:bg-amber-50" title="Quick Update Stock">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </form>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {product.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-600">
                                        {product.priceB2c}
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-gray-900 flex flex-col items-end">
                                        {product.priceB2b}
                                        <span className="text-[10px] text-gray-400 font-normal uppercase">Before Discount</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {/* Placeholder for future full edit modal */}
                                        <button className="text-sm text-indigo-600 hover:text-indigo-900 font-medium">Edit Details</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
