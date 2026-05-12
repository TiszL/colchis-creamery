'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { ProductKind, FulfillmentChannel } from '@prisma/client';

export async function saveProductAction(formData: FormData) {
    const id = formData.get('id') as string;

    const images = formData.getAll('images[]').filter(v => (v as string).trim() !== '') as string[];
    const videoUrls = formData.getAll('videoUrls[]').filter(v => (v as string).trim() !== '') as string[];
    const channels = formData.getAll('channels[]').filter(v => !!v) as FulfillmentChannel[];

    const stocksRaw = (formData.get('stocksJson') as string) || '[]';
    let stocks: Array<{ locationId: string; quantity: number | null }> = [];
    try { stocks = JSON.parse(stocksRaw); }
    catch { stocks = []; }

    const isMadeToOrder = formData.get('isMadeToOrder') === 'on';
    const kind = (formData.get('kind') as ProductKind) || ProductKind.CREAMERY_CHEESE;

    const legacyStockInput = formData.get('stockQuantity');
    const computedTotal = stocks.reduce((sum, s) => sum + (typeof s.quantity === 'number' ? s.quantity : 0), 0);
    const stockQuantity = legacyStockInput !== null && legacyStockInput !== ''
        ? (parseInt(legacyStockInput as string, 10) || 0)
        : computedTotal;

    const data = {
        name: formData.get('name') as string,
        nameKa: (formData.get('nameKa') as string) || null,
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
        stockQuantity,
        category: (formData.get('category') as string) || 'cheese',
        kind,
        isMadeToOrder,
        tag: (formData.get('tag') as string) || null,
        productLineId: (formData.get('productLineId') as string) || null,
        categoryId: (formData.get('categoryId') as string) || null,
        status: (formData.get('status') as 'ACTIVE' | 'INACTIVE' | 'COMING_SOON') || 'ACTIVE',
        isActive: (formData.get('status') as string) !== 'INACTIVE',
        isB2cVisible: formData.get('isB2cVisible') === 'on',
        isB2bVisible: formData.get('isB2bVisible') === 'on',
    };

    let productId: string;
    if (id) {
        const updated = await prisma.product.update({ where: { id }, data });
        productId = updated.id;
    } else {
        const created = await prisma.product.create({ data });
        productId = created.id;
    }

    await prisma.productChannel.deleteMany({ where: { productId } });
    if (channels.length > 0) {
        await prisma.productChannel.createMany({
            data: channels.map(ch => ({ productId, channel: ch })),
            skipDuplicates: true,
        });
    }

    for (const s of stocks) {
        if (!s.locationId) continue;
        const quantity = isMadeToOrder ? null : s.quantity;
        await prisma.stock.upsert({
            where: { locationId_productId: { locationId: s.locationId, productId } },
            update: { quantity },
            create: { locationId: s.locationId, productId, quantity },
        });
    }

    revalidatePath('/admin/inventory');
    revalidatePath('/staff-portal/products');
    revalidatePath('/shop');
    revalidatePath('/bakery');
}

export async function deleteProductAction(formData: FormData) {
    const id = formData.get('id') as string;
    if (id) {
        await prisma.product.delete({ where: { id } });
        revalidatePath('/admin/inventory');
        revalidatePath('/staff-portal/products');
        revalidatePath('/shop');
        revalidatePath('/bakery');
    }
}

export async function quickStockAction(formData: FormData) {
    const id = formData.get('id') as string;
    const stock = parseInt(formData.get('stock') as string, 10);

    if (id && !isNaN(stock)) {
        await prisma.product.update({
            where: { id },
            data: { stockQuantity: stock },
        });
        revalidatePath('/admin/inventory');
        revalidatePath('/staff-portal/products');
        revalidatePath('/shop');
    }
}
