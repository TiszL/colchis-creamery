'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { SalesChannel } from '@prisma/client';

export async function saveProductAction(formData: FormData) {
    const id = formData.get('id') as string;

    const images = formData.getAll('images[]').filter(v => (v as string).trim() !== '') as string[];
    const videoUrls = formData.getAll('videoUrls[]').filter(v => (v as string).trim() !== '') as string[];
    // Phase 8: ProductChannel dropped — channels[] form field still posted by
    // legacy admin form but ignored. SalesChannel + Location.allowsChannels are
    // the source of truth now.

    const stocksRaw = (formData.get('stocksJson') as string) || '[]';
    let stocks: Array<{ locationId: string; quantity: number | null }> = [];
    try { stocks = JSON.parse(stocksRaw); }
    catch { stocks = []; }

    const isMadeToOrder = formData.get('isMadeToOrder') === 'on';
    // Phase 9b: ProductKind enum dropped. salesChannel is required from the admin
    // form; default to LOCAL_COLD only if some legacy caller forgot it.
    const salesChannel = (formData.get('salesChannel') as SalesChannel) || SalesChannel.LOCAL_COLD;
    const slug = formData.get('slug') as string;
    // Phase 9b: categoryId is now NOT NULL on Product. Admin form must send it.
    const categoryId = (formData.get('categoryId') as string) || null;
    if (!categoryId) {
        throw new Error('categoryId is required (Phase 9b — Product.categoryId became NOT NULL).');
    }

    const legacyStockInput = formData.get('stockQuantity');
    const computedTotal = stocks.reduce((sum, s) => sum + (typeof s.quantity === 'number' ? s.quantity : 0), 0);
    const stockQuantity = legacyStockInput !== null && legacyStockInput !== ''
        ? (parseInt(legacyStockInput as string, 10) || 0)
        : computedTotal;

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const imageUrl = formData.get('imageUrl') as string;

    const data = {
        name,
        nameKa: (formData.get('nameKa') as string) || null,
        slug,
        sku: formData.get('sku') as string,
        description,
        flavorProfile: (formData.get('flavorProfile') as string) || null,
        pairsWith: (formData.get('pairsWith') as string) || null,
        weight: (formData.get('weight') as string) || null,
        ingredients: (formData.get('ingredients') as string) || null,
        imageUrl,
        images,
        videoUrls,
        priceB2c: formData.get('priceB2c') as string,
        priceB2b: formData.get('priceB2b') as string,
        stockQuantity,
        salesChannel,
        packagingType: (formData.get('packagingType') as string) || null,
        unitCost: (formData.get('unitCost') as string) || null,
        isMadeToOrder,
        tag: (formData.get('tag') as string) || null,
        productLineId: (formData.get('productLineId') as string) || null,
        categoryId,
        status: (formData.get('status') as 'ACTIVE' | 'INACTIVE' | 'COMING_SOON') || 'ACTIVE',
        isActive: (formData.get('status') as string) !== 'INACTIVE',
        isB2cVisible: formData.get('isB2cVisible') === 'on',
        isB2bVisible: formData.get('isB2bVisible') === 'on',
        // Phase 10: gates the public Add-to-cart button. When false, the product
        // is still listed but the PDP/card shows a wholesale-request CTA instead.
        isCartOrderable: formData.get('isCartOrderable') === 'on',
    };

    let productId: string;
    if (id) {
        // Update — productFamilyId stays whatever it already was; admin UI in
        // 1d will expose explicit family re-assignment.
        const updated = await prisma.product.update({ where: { id }, data });
        productId = updated.id;
    } else {
        // Create — ensure a ProductFamily exists. Default behaviour is 1:1
        // (one family per product, using the product slug). Admin can merge
        // families later via the families UI in 1d.
        const formFamilyId = (formData.get('productFamilyId') as string) || null;
        const familyId = formFamilyId ?? (await prisma.productFamily.upsert({
            where: { slug },
            update: {},
            create: { slug, name, description: description.slice(0, 500), imageUrl },
        })).id;

        const created = await prisma.product.create({
            data: { ...data, productFamilyId: familyId },
        });
        productId = created.id;
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
