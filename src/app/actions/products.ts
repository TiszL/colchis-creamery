'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function saveProductAction(formData: FormData) {
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
        productLineId: (formData.get('productLineId') as string) || null,
        categoryId: (formData.get('categoryId') as string) || null,
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
    revalidatePath('/staff-portal/products');
    revalidatePath('/shop');
}

export async function deleteProductAction(formData: FormData) {
    const id = formData.get('id') as string;
    if (id) {
        await prisma.product.delete({ where: { id } });
        revalidatePath('/admin/inventory');
        revalidatePath('/staff-portal/products');
        revalidatePath('/shop');
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
