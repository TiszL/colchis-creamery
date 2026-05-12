import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { Globe, FileText, ShoppingBag, BookOpen, Save, Search, Home, ChefHat, Store, Handshake } from 'lucide-react';
import Link from 'next/link';
import { batchUpsertSiteConfigAction } from '@/app/actions/cms';
import { revalidatePath } from 'next/cache';
import ContactLocationsEditor from '@/components/admin/ContactLocationsEditor';
import FooterEditor from '@/components/admin/FooterEditor';

export const dynamic = 'force-dynamic';

function getVal(configs: { key: string; value: string }[], key: string, fallback = ""): string {
    return configs.find(c => c.key === key)?.value || fallback;
}

async function saveSectionAction(formData: FormData) {
    'use server';
    const entries: { key: string; value: string }[] = [];
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

const mono = { fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' as const };
const inputCls = 'w-full bg-[#0C0C0C] border border-[#B96A3D22] text-[#F5F0E6] py-3 px-4 focus:outline-none focus:border-[#B96A3D] text-sm';

export default async function AdminWebsitePage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/portal-login`);

    const configs = await prisma.siteConfig.findMany();
    const productCount = await prisma.product.count();
    const recipeCount = await prisma.recipe.count();
    const articleCount = await prisma.article.count();

    const pageCards = [
        { href: `/${locale}/admin/website/homepage`, icon: Home, title: 'Homepage', subtitle: 'Hero, Story, Process, Press, Visit' },
        { href: `/${locale}/admin/website/creamery`, icon: Store, title: 'Creamery Page', subtitle: 'Shop hero, method, delivery, subscription' },
        { href: `/${locale}/admin/website/bakery`, icon: ChefHat, title: 'Bakery Page', subtitle: 'Bakery hero, menu items, delivery zones' },
        { href: `/${locale}/admin/website/products`, icon: ShoppingBag, title: 'Products', subtitle: `${productCount} products` },
        { href: `/${locale}/admin/website/recipes`, icon: BookOpen, title: 'Recipes', subtitle: `${recipeCount} recipes` },
        { href: `/${locale}/admin/website/articles`, icon: FileText, title: 'Journal', subtitle: `${articleCount} articles` },
        { href: `/${locale}/admin/website/wholesale`, icon: Handshake, title: 'Wholesale Page', subtitle: 'B2B landing, partner info' },
        { href: `/${locale}/admin/website/heritage`, icon: Globe, title: 'Heritage Page', subtitle: 'Sections, media & translations' },
        { href: `/${locale}/admin/website/legal`, icon: FileText, title: 'Legal & FAQ', subtitle: 'FAQ, Privacy, Terms, Returns' },
        { href: `/${locale}/admin/website/seo`, icon: Search, title: 'SEO & Social', subtitle: 'Google images & metadata' },
    ];

    return (
        <div className="space-y-8">
            <div>
                <span className="text-[9px] text-[#D9A876] block mb-2" style={mono}>№ 08 — Content</span>
                <h1 className="text-3xl text-[#F5F0E6]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontStyle: 'italic' }}>Website Content Manager</h1>
                <p className="text-[#7A8278] text-sm mt-1" style={{ fontFamily: 'var(--font-sans)' }}>Edit text, images, and content displayed on the public website.</p>
            </div>

            {/* Page Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pageCards.map(card => (
                    <Link key={card.href} href={card.href} className="bg-[#161616] p-6 border border-[#B96A3D22] hover:border-[#B96A3D44] transition-all group">
                        <card.icon className="w-6 h-6 text-[#B96A3D] mb-3" />
                        <h3 className="text-[#F5F0E6] font-medium mb-1" style={{ fontFamily: 'var(--font-serif)' }}>{card.title}</h3>
                        <p className="text-[#7A8278] text-[10px]" style={mono}>{card.subtitle}</p>
                        <span className="text-[10px] text-[#B96A3D] mt-3 block group-hover:translate-x-1 transition-transform" style={mono}>Edit →</span>
                    </Link>
                ))}
            </div>

            {/* Contact Info */}
            <form action={saveSectionAction} className="bg-[#161616] border border-[#B96A3D22] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#B96A3D22] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-[#B96A3D]" />
                        <div>
                            <h2 className="text-[#F5F0E6] font-medium" style={{ fontFamily: 'var(--font-serif)' }}>Contact Information</h2>
                            <p className="text-[#7A8278] text-[10px] mt-0.5" style={mono}>Displayed on contact page, footer, and SEO</p>
                        </div>
                    </div>
                    <button type="submit" className="flex items-center gap-2 bg-[#B96A3D] text-[#F5F0E6] px-4 py-2 text-[10px] hover:bg-[#F5F0E6] hover:text-[#1F3026] transition-all" style={mono}>
                        <Save className="w-3.5 h-3.5" /> Save
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[9px] text-[#D9A876] mb-2" style={mono}>Email</label>
                            <input name="config.contact.email" defaultValue={getVal(configs, "contact.email", "hello@colchisfood.com")} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-[9px] text-[#D9A876] mb-2" style={mono}>Phone</label>
                            <input name="config.contact.phone" defaultValue={getVal(configs, "contact.phone", "+1 (614) 555-0123")} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-[9px] text-[#D9A876] mb-2" style={mono}>Working Hours</label>
                            <input name="config.contact.hours" defaultValue={getVal(configs, "contact.hours", "Monday - Friday: 9 AM - 5 PM EST")} className={inputCls} />
                        </div>
                    </div>
                </div>
            </form>

            {/* Business Locations */}
            <ContactLocationsEditor configs={JSON.parse(JSON.stringify(configs))} apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''} />

            {/* Footer */}
            <FooterEditor initialData={{
                tagline: getVal(configs, 'footer.tagline', 'Ancient heritage, fresh every day.'),
                address: getVal(configs, 'footer.address', '5340 Tuller Rd\nDublin, Ohio 43017\nMade by hand, since 2026'),
                columns: (() => { try { return JSON.parse(getVal(configs, 'footer.columns', '')); } catch { return null; } })(),
            }} />
        </div>
    );
}
