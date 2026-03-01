import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ShoppingBag, ArrowLeft, Save, Plus, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function saveProductAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const data = {
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        sku: formData.get('sku') as string,
        description: formData.get('description') as string,
        flavorProfile: (formData.get('flavorProfile') as string) || null,
        pairsWith: (formData.get('pairsWith') as string) || null,
        weight: (formData.get('weight') as string) || null,
        ingredients: (formData.get('ingredients') as string) || null,
        imageUrl: formData.get('imageUrl') as string,
        priceB2c: formData.get('priceB2c') as string,
        priceB2b: formData.get('priceB2b') as string,
        stockQuantity: parseInt(formData.get('stockQuantity') as string, 10) || 0,
        category: (formData.get('category') as string) || 'cheese',
        isActive: formData.get('isActive') === 'on',
        isB2cVisible: formData.get('isB2cVisible') === 'on',
        isB2bVisible: formData.get('isB2bVisible') === 'on',
    };

    if (id) {
        await prisma.product.update({ where: { id }, data });
    } else {
        await prisma.product.create({ data });
    }

    revalidatePath('/admin/website/products');
    revalidatePath('/shop');
}

export default async function AdminProductsPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <Link href={`/${locale}/admin/website`} className="text-xs text-[#CBA153] hover:text-white transition-colors flex items-center gap-1 mb-3">
                        <ArrowLeft className="w-3 h-3" /> Back to Website Content
                    </Link>
                    <h1 className="text-3xl font-serif text-white mb-2">Product Manager</h1>
                    <p className="text-gray-500 font-light">Edit product details displayed on the public shop.</p>
                </div>
            </div>

            {/* Product List */}
            {products.map((product: any) => (
                <form key={product.id} action={saveProductAction} className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#2C2A29]">
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold">{product.name}</h3>
                                <span className="text-xs text-gray-500 font-mono">{product.sku}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {product.isActive ? (
                                <span className="text-xs bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded-full flex items-center gap-1"><Eye className="w-3 h-3" /> Active</span>
                            ) : (
                                <span className="text-xs bg-red-900/30 text-red-400 px-2 py-1 rounded-full flex items-center gap-1"><EyeOff className="w-3 h-3" /> Inactive</span>
                            )}
                            <button type="submit" className="flex items-center gap-2 bg-[#CBA153] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all">
                                <Save className="w-3.5 h-3.5" /> Save
                            </button>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <input type="hidden" name="id" value={product.id} />
                        <input type="hidden" name="sku" value={product.sku} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Product Name</label>
                                <input name="name" defaultValue={product.name} required
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Slug</label>
                                <input name="slug" defaultValue={product.slug} required
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Description</label>
                            <textarea name="description" rows={3} defaultValue={product.description} required
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-none" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Flavor Profile</label>
                                <input name="flavorProfile" defaultValue={product.flavorProfile || ''}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Pairs With</label>
                                <input name="pairsWith" defaultValue={product.pairsWith || ''}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Weight</label>
                                <input name="weight" defaultValue={product.weight || ''}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">B2C Price</label>
                                <input name="priceB2c" defaultValue={product.priceB2c}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">B2B Price</label>
                                <input name="priceB2b" defaultValue={product.priceB2b}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Stock</label>
                                <input name="stockQuantity" type="number" defaultValue={product.stockQuantity}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Ingredients</label>
                            <input name="ingredients" defaultValue={product.ingredients || ''}
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Image URL</label>
                            <input name="imageUrl" defaultValue={product.imageUrl}
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                        </div>

                        <div className="flex flex-wrap gap-6 pt-2">
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input type="checkbox" name="isActive" defaultChecked={product.isActive} className="accent-[#CBA153] w-4 h-4" />
                                Active
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input type="checkbox" name="isB2cVisible" defaultChecked={product.isB2cVisible} className="accent-[#CBA153] w-4 h-4" />
                                B2C Visible
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input type="checkbox" name="isB2bVisible" defaultChecked={product.isB2bVisible} className="accent-[#CBA153] w-4 h-4" />
                                B2B Visible
                            </label>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Category</label>
                                <select name="category" defaultValue={product.category || 'cheese'}
                                    className="bg-[#0D0D0D] border border-white/10 text-white py-1 px-3 rounded-lg text-sm focus:outline-none focus:border-[#CBA153]">
                                    <option value="cheese">Cheese</option>
                                    <option value="blend">Blend</option>
                                    <option value="specialty">Specialty</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </form>
            ))}

            {products.length === 0 && (
                <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-12 text-center text-gray-500">
                    No products found. Create your first product from the database.
                </div>
            )}
        </div>
    );
}
