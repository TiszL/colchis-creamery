import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { Globe, FileText, ShoppingBag, BookOpen, Save } from 'lucide-react';
import Link from 'next/link';
import { batchUpsertSiteConfigAction } from '@/app/actions/cms';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

// Helper: get config value from array
function getVal(configs: { key: string; value: string }[], key: string, fallback = ""): string {
    return configs.find(c => c.key === key)?.value || fallback;
}

// Server action for forms on this page
async function saveSectionAction(formData: FormData) {
    'use server';
    const entries: { key: string; value: string }[] = [];

    // Iterate all form entries that start with "config."
    for (const [key, value] of formData.entries()) {
        if (key.startsWith("config.")) {
            entries.push({ key: key.replace("config.", ""), value: value as string });
        }
    }

    if (entries.length > 0) {
        const fd = new FormData();
        fd.set("entries", JSON.stringify(entries));
        await batchUpsertSiteConfigAction(fd);
    }
    revalidatePath('/admin/website');
}

export default async function AdminWebsitePage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const configs = await prisma.siteConfig.findMany();
    const productCount = await prisma.product.count();
    const recipeCount = await prisma.recipe.count();
    const articleCount = await prisma.article.count();

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Website Content Manager</h1>
                <p className="text-gray-500 font-light">Edit text, images, and content displayed on the public website.</p>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link href={`/${locale}/admin/website/products`} className="bg-[#1A1A1A] p-6 rounded-xl border border-white/5 hover:border-[#CBA153]/20 transition-all group">
                    <ShoppingBag className="w-6 h-6 text-[#CBA153] mb-3" />
                    <h3 className="text-white font-bold mb-1">Products</h3>
                    <p className="text-gray-500 text-sm">{productCount} products</p>
                    <span className="text-xs text-[#CBA153] mt-3 block group-hover:translate-x-1 transition-transform">Manage Products →</span>
                </Link>
                <Link href={`/${locale}/admin/website/recipes`} className="bg-[#1A1A1A] p-6 rounded-xl border border-white/5 hover:border-[#CBA153]/20 transition-all group">
                    <BookOpen className="w-6 h-6 text-blue-400 mb-3" />
                    <h3 className="text-white font-bold mb-1">Recipes</h3>
                    <p className="text-gray-500 text-sm">{recipeCount} recipes</p>
                    <span className="text-xs text-blue-400 mt-3 block group-hover:translate-x-1 transition-transform">Manage Recipes →</span>
                </Link>
                <Link href={`/${locale}/admin/website/articles`} className="bg-[#1A1A1A] p-6 rounded-xl border border-white/5 hover:border-[#CBA153]/20 transition-all group">
                    <FileText className="w-6 h-6 text-purple-400 mb-3" />
                    <h3 className="text-white font-bold mb-1">Articles</h3>
                    <p className="text-gray-500 text-sm">{articleCount} articles</p>
                    <span className="text-xs text-purple-400 mt-3 block group-hover:translate-x-1 transition-transform">Manage Articles →</span>
                </Link>
            </div>

            {/* Hero Section */}
            <form action={saveSectionAction} className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-[#CBA153]" />
                        <h2 className="text-white font-bold">Hero Section</h2>
                    </div>
                    <button type="submit" className="flex items-center gap-2 bg-[#CBA153] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all">
                        <Save className="w-3.5 h-3.5" /> Save
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Hero Title</label>
                        <input name="config.hero.title" defaultValue={getVal(configs, "hero.title", "Ancient Heritage, Fresh Taste")}
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Hero Subtitle</label>
                        <textarea name="config.hero.subtitle" rows={2} defaultValue={getVal(configs, "hero.subtitle", "Authentic Georgian artisanal cheese, handcrafted in Ohio with premium local milk")}
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-none" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Shop CTA Text</label>
                            <input name="config.hero.shopCta" defaultValue={getVal(configs, "hero.shopCta", "Shop Artisanal Cheese")}
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Wholesale CTA Text</label>
                            <input name="config.hero.wholesaleCta" defaultValue={getVal(configs, "hero.wholesaleCta", "Wholesale Partners")}
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Hero Background Image URL</label>
                        <input name="config.hero.imageUrl" defaultValue={getVal(configs, "hero.imageUrl")}
                            placeholder="https://images.unsplash.com/..."
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600" />
                    </div>
                </div>
            </form>

            {/* Heritage Section */}
            <form action={saveSectionAction} className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-emerald-400" />
                        <h2 className="text-white font-bold">Heritage Page</h2>
                    </div>
                    <button type="submit" className="flex items-center gap-2 bg-[#CBA153] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all">
                        <Save className="w-3.5 h-3.5" /> Save
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Heritage Title</label>
                        <input name="config.heritage.title" defaultValue={getVal(configs, "heritage.title", "A Tradition Spanning Millennia")}
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Heritage Description</label>
                        <textarea name="config.heritage.text" rows={3} defaultValue={getVal(configs, "heritage.text", "From the ancient land of Colchis to the heartland of Ohio, we bring you authentic Georgian cheese crafted with passion and heritage.")}
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Heritage Image URL</label>
                        <input name="config.heritage.imageUrl" defaultValue={getVal(configs, "heritage.imageUrl")}
                            placeholder="https://images.unsplash.com/..."
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-600" />
                    </div>
                </div>
            </form>

            {/* Contact Info */}
            <form action={saveSectionAction} className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-blue-400" />
                        <h2 className="text-white font-bold">Contact Information</h2>
                    </div>
                    <button type="submit" className="flex items-center gap-2 bg-[#CBA153] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all">
                        <Save className="w-3.5 h-3.5" /> Save
                    </button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Email</label>
                        <input name="config.contact.email" defaultValue={getVal(configs, "contact.email", "hello@colchiscreamery.com")}
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Phone</label>
                        <input name="config.contact.phone" defaultValue={getVal(configs, "contact.phone", "+1 (614) 555-0123")}
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Address</label>
                        <input name="config.contact.address" defaultValue={getVal(configs, "contact.address", "Columbus, OH")}
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                    </div>
                </div>
            </form>

            {/* Footer */}
            <form action={saveSectionAction} className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-orange-400" />
                        <h2 className="text-white font-bold">Footer Content</h2>
                    </div>
                    <button type="submit" className="flex items-center gap-2 bg-[#CBA153] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all">
                        <Save className="w-3.5 h-3.5" /> Save
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Tagline</label>
                        <input name="config.footer.tagline" defaultValue={getVal(configs, "footer.tagline", "Ancient Heritage, Fresh Taste")}
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Footer Description</label>
                        <textarea name="config.footer.description" rows={2} defaultValue={getVal(configs, "footer.description", "Authentic Georgian artisanal cheese, handcrafted in Ohio with premium local milk.")}
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-none" />
                    </div>
                </div>
            </form>
        </div>
    );
}
