import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import InventoryClient from '@/components/admin/InventoryClient';
import { saveProductAction, deleteProductAction, quickStockAction } from '@/app/actions/products';

export const dynamic = 'force-dynamic';

const ALLOWED = ['MASTER_ADMIN', 'PRODUCT_MANAGER'];

export default async function StaffProductsB2BPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || !ALLOWED.includes(session.role)) redirect(`/${locale}/staff`);

    const products = await prisma.product.findMany({
        where: { isB2bVisible: true },
        orderBy: { name: 'asc' },
    });

    const productLines = await prisma.productLine.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
            categories: {
                orderBy: { sortOrder: 'asc' },
                select: { id: true, slug: true, name: true },
            },
        },
    });

    const serialized = products.map(p => ({
        id: p.id, sku: p.sku, name: p.name, slug: p.slug,
        description: p.description, flavorProfile: p.flavorProfile,
        pairsWith: p.pairsWith, weight: p.weight, ingredients: p.ingredients,
        imageUrl: p.imageUrl, images: p.images || [], videoUrls: p.videoUrls || [],
        priceB2c: p.priceB2c, priceB2b: p.priceB2b, stockQuantity: p.stockQuantity,
        category: p.category, productLineId: p.productLineId, categoryId: p.categoryId,
        status: p.status, isActive: p.isActive,
        isB2cVisible: p.isB2cVisible, isB2bVisible: p.isB2bVisible,
    }));

    const serializedLines = productLines.map(l => ({
        id: l.id, slug: l.slug, name: l.name, badgeColor: l.badgeColor,
        categories: l.categories,
    }));

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">B2B Product Catalog</h1>
                <p className="text-gray-500 font-light">Manage wholesale products, B2B pricing, and availability.</p>
            </div>
            <InventoryClient
                products={serialized}
                productLines={serializedLines}
                locale={locale}
                saveAction={saveProductAction}
                deleteAction={deleteProductAction}
                quickStockAction={quickStockAction}
            />
        </div>
    );
}
