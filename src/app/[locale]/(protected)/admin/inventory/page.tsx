import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import InventoryClient from '@/components/admin/InventoryClient';

export const dynamic = 'force-dynamic';

async function saveProductAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;

    const images = formData.getAll('images[]').filter(v => (v as string).trim() !== '') as string[];
    const videoUrls = formData.getAll('videoUrls[]').filter(v => (v as string).trim() !== '') as string[];

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
        images,
        videoUrls,
        priceB2c: formData.get('priceB2c') as string,
        priceB2b: formData.get('priceB2b') as string,
        stockQuantity: parseInt(formData.get('stockQuantity') as string, 10) || 0,
        category: (formData.get('category') as string) || 'cheese',
        status: (formData.get('status') as any) || 'ACTIVE',
        isActive: (formData.get('status') as string) !== 'INACTIVE',
        isB2cVisible: formData.get('isB2cVisible') === 'on',
        isB2bVisible: formData.get('isB2bVisible') === 'on',
    };

    if (id) {
        await prisma.product.update({ where: { id }, data });
    } else {
        await prisma.product.create({ data });
    }

    revalidatePath('/admin/inventory');
    revalidatePath('/shop');
}

async function deleteProductAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    if (id) {
        await prisma.product.delete({ where: { id } });
        revalidatePath('/admin/inventory');
        revalidatePath('/shop');
    }
}

async function quickStockAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const stock = parseInt(formData.get('stock') as string, 10);

    if (id && !isNaN(stock)) {
        await prisma.product.update({
            where: { id },
            data: { stockQuantity: stock },
        });
        revalidatePath('/admin/inventory');
        revalidatePath('/shop');
    }
}

export default async function AdminInventoryPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
    const productLines = await prisma.productLine.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
            categories: {
                orderBy: { sortOrder: 'asc' },
                select: { id: true, slug: true, name: true },
            },
        },
    });

    // Serialize for client component
    const serialized = products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
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
        category: p.category,
        productLineId: p.productLineId,
        categoryId: p.categoryId,
        status: p.status,
        isActive: p.isActive,
        isB2cVisible: p.isB2cVisible,
        isB2bVisible: p.isB2bVisible,
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
            locale={locale}
            saveAction={saveProductAction}
            deleteAction={deleteProductAction}
            quickStockAction={quickStockAction}
        />
    );
}
