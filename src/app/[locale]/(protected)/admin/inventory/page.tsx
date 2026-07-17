import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { SalesChannel } from '@prisma/client';
import InventoryClient from '@/components/admin/InventoryClient';
import { saveProductAction, deleteProductAction, quickStockAction } from '@/app/actions/products';

export const dynamic = 'force-dynamic';

const SALES_CHANNELS = Object.values(SalesChannel);

export default async function AdminInventoryPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/portal-login`);

    const [products, productFamilies, productLines, allCategories, locationRows] = await Promise.all([
        prisma.product.findMany({
            orderBy: { name: 'asc' },
            include: {
                stocks: { include: { location: { select: { id: true, name: true, type: true } } } },
                // Phase 9b: section/category badge data for the row + filter tabs.
                productCategory: { select: { slug: true, name: true, sections: true } },
            },
        }),
        prisma.productFamily.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, slug: true, name: true },
        }),
        prisma.productLine.findMany({
            orderBy: { sortOrder: 'asc' },
            include: {
                categories: {
                    orderBy: { sortOrder: 'asc' },
                    select: { id: true, slug: true, name: true },
                },
            },
        }),
        // Phase 9b: replaces ProductKind enum — every product gets a Category, and
        // admin picks from the same flat list (line-anchored or standalone).
        prisma.category.findMany({
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: { id: true, slug: true, name: true, sections: true },
        }),
        prisma.location.findMany({
            where: { isActive: true },
            orderBy: [{ type: 'asc' }, { name: 'asc' }],
            select: {
                id: true, name: true, type: true,
                channels: { where: { isActive: true }, select: { deliveryMethod: true } },
            },
        }),
    ]);

    const locations = locationRows.map(l => ({ id: l.id, name: l.name, type: l.type }));

    const serialized = products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        nameKa: p.nameKa,
        slug: p.slug,
        description: p.description,
        flavorProfile: p.flavorProfile,
        pairsWith: p.pairsWith,
        weight: p.weight,
        ingredients: p.ingredients,
        imageUrl: p.imageUrl,
        images: p.images || [],
        videoUrls: p.videoUrls || [],
        priceB2c: p.priceB2c,
        priceB2b: p.priceB2b,
        stockQuantity: p.stockQuantity,
        isMadeToOrder: p.isMadeToOrder,
        tag: p.tag,
        dietaryTags: p.dietaryTags,
        productLineId: p.productLineId,
        categoryId: p.categoryId,
        productCategory: p.productCategory
            ? { slug: p.productCategory.slug, name: p.productCategory.name, sections: p.productCategory.sections }
            : null,
        status: p.status,
        isActive: p.isActive,
        isB2cVisible: p.isB2cVisible,
        isB2bVisible: p.isB2bVisible,
        isCartOrderable: p.isCartOrderable,
        productFamilyId: p.productFamilyId,
        salesChannel: p.salesChannel,
        packagingType: p.packagingType,
        unitCost: p.unitCost,
        b2bCaseSize: p.b2bCaseSize,
        b2bMinOrderQty: p.b2bMinOrderQty,
        b2bUnitLabel: p.b2bUnitLabel,
        stocks: p.stocks.map(s => ({
            locationId: s.locationId,
            locationName: s.location.name,
            locationType: s.location.type,
            quantity: s.quantity,
        })),
    }));

    const serializedLines = productLines.map(l => ({
        id: l.id,
        slug: l.slug,
        name: l.name,
        badgeColor: l.badgeColor,
        categories: l.categories,
    }));

    return (
        <InventoryClient
            products={serialized}
            productLines={serializedLines}
            productFamilies={productFamilies}
            locations={locations}
            categories={allCategories}
            salesChannels={SALES_CHANNELS}
            locale={locale}
            saveAction={saveProductAction}
            deleteAction={deleteProductAction}
            quickStockAction={quickStockAction}
        />
    );
}
