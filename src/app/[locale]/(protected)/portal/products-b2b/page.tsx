import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import InventoryClient from '@/components/admin/InventoryClient';
import { saveProductAction, deleteProductAction, quickStockAction } from '@/app/actions/products';
import { ProductKind, FulfillmentChannel, SalesChannel } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ALLOWED = ['MASTER_ADMIN', 'PRODUCT_MANAGER'];
const PRODUCT_KINDS = Object.values(ProductKind);
const FULFILLMENT_CHANNELS = Object.values(FulfillmentChannel);
const SALES_CHANNELS = Object.values(SalesChannel);

export default async function StaffProductsB2BPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || !ALLOWED.includes(session.role)) redirect(`/${locale}/staff`);

    const products = await prisma.product.findMany({
        where: { isB2bVisible: true },
        orderBy: { name: 'asc' },
        include: {
            channels: true,
            stocks: { include: { location: { select: { id: true, name: true, type: true } } } },
        },
    });

    const productFamilies = await prisma.productFamily.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, slug: true, name: true },
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

    const locationRows = await prisma.location.findMany({
        where: { isActive: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        select: {
            id: true,
            name: true,
            type: true,
            channels: { where: { isActive: true }, select: { channel: true } },
        },
    });
    const locations = locationRows.map(l => ({
        id: l.id,
        name: l.name,
        type: l.type,
        channels: l.channels.map(c => c.channel),
    }));

    const serialized = products.map(p => ({
        id: p.id, sku: p.sku, name: p.name, nameKa: p.nameKa, slug: p.slug,
        description: p.description, flavorProfile: p.flavorProfile,
        pairsWith: p.pairsWith, weight: p.weight, ingredients: p.ingredients,
        imageUrl: p.imageUrl, images: p.images || [], videoUrls: p.videoUrls || [],
        priceB2c: p.priceB2c, priceB2b: p.priceB2b, stockQuantity: p.stockQuantity,
        category: p.category, kind: p.kind, isMadeToOrder: p.isMadeToOrder, tag: p.tag,
        productLineId: p.productLineId, categoryId: p.categoryId,
        status: p.status, isActive: p.isActive,
        isB2cVisible: p.isB2cVisible, isB2bVisible: p.isB2bVisible, isCartOrderable: p.isCartOrderable,
        productFamilyId: p.productFamilyId, salesChannel: p.salesChannel,
        packagingType: p.packagingType, unitCost: p.unitCost,
        channels: p.channels.map(c => c.channel),
        stocks: p.stocks.map(s => ({
            locationId: s.locationId,
            locationName: s.location.name,
            locationType: s.location.type,
            quantity: s.quantity,
        })),
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
                productFamilies={productFamilies}
                locations={locations}
                productKinds={PRODUCT_KINDS}
                fulfillmentChannels={FULFILLMENT_CHANNELS}
                salesChannels={SALES_CHANNELS}
                locale={locale}
                saveAction={saveProductAction}
                deleteAction={deleteProductAction}
                quickStockAction={quickStockAction}
            />
        </div>
    );
}
