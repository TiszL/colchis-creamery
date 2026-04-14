'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// ─── Product Line Actions ────────────────────────────────────────────────────

export async function saveProductLineAction(formData: FormData) {
    const id = formData.get('id') as string;
    const data = {
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        tagline: (formData.get('tagline') as string) || null,
        description: (formData.get('description') as string) || null,
        badgeColor: (formData.get('badgeColor') as string) || '#CBA153',
        sortOrder: parseInt(formData.get('sortOrder') as string, 10) || 0,
        isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
    };

    if (id) {
        await prisma.productLine.update({ where: { id }, data });
    } else {
        await prisma.productLine.create({ data });
    }

    revalidatePath('/admin/categories');
    revalidatePath('/staff-portal/categories');
    revalidatePath('/admin/inventory');
    revalidatePath('/shop');
}

export async function deleteProductLineAction(formData: FormData) {
    const id = formData.get('id') as string;
    if (!id) return;

    // Guard: don't delete if products are assigned
    const count = await prisma.product.count({ where: { productLineId: id } });
    if (count > 0) {
        throw new Error(`Cannot delete: ${count} products are still assigned to this line.`);
    }

    // Also delete all categories under this line (guard: no products assigned to them)
    const catCount = await prisma.product.count({
        where: { productCategory: { productLineId: id } },
    });
    if (catCount > 0) {
        throw new Error(`Cannot delete: products are assigned to categories in this line.`);
    }

    await prisma.category.deleteMany({ where: { productLineId: id } });
    await prisma.productLine.delete({ where: { id } });

    revalidatePath('/admin/categories');
    revalidatePath('/staff-portal/categories');
    revalidatePath('/shop');
}

// ─── Category Actions ────────────────────────────────────────────────────────

export async function saveCategoryAction(formData: FormData) {
    const id = formData.get('id') as string;
    const data = {
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        description: (formData.get('description') as string) || null,
        imageUrl: (formData.get('imageUrl') as string) || null,
        productLineId: formData.get('productLineId') as string,
        sortOrder: parseInt(formData.get('sortOrder') as string, 10) || 0,
        isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
    };

    if (id) {
        await prisma.category.update({ where: { id }, data });
    } else {
        await prisma.category.create({ data });
    }

    revalidatePath('/admin/categories');
    revalidatePath('/staff-portal/categories');
    revalidatePath('/admin/inventory');
    revalidatePath('/shop');
}

export async function deleteCategoryAction(formData: FormData) {
    const id = formData.get('id') as string;
    if (!id) return;

    // Guard: don't delete if products are assigned
    const count = await prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
        throw new Error(`Cannot delete: ${count} products are still in this category.`);
    }

    await prisma.category.delete({ where: { id } });

    revalidatePath('/admin/categories');
    revalidatePath('/staff-portal/categories');
    revalidatePath('/shop');
}

// ─── Assign Product to Line + Category ───────────────────────────────────────

export async function assignProductCategoryAction(formData: FormData) {
    const productId = formData.get('productId') as string;
    const productLineId = (formData.get('productLineId') as string) || null;
    const categoryId = (formData.get('categoryId') as string) || null;

    if (!productId) return;

    await prisma.product.update({
        where: { id: productId },
        data: { productLineId, categoryId },
    });

    revalidatePath('/admin/categories');
    revalidatePath('/staff-portal/categories');
    revalidatePath('/admin/inventory');
    revalidatePath('/staff-portal/products');
    revalidatePath('/shop');
}

// ─── Bulk Assign ─────────────────────────────────────────────────────────────

export async function bulkAssignCategoryAction(formData: FormData) {
    const productIds = JSON.parse(formData.get('productIds') as string) as string[];
    const productLineId = (formData.get('productLineId') as string) || null;
    const categoryId = (formData.get('categoryId') as string) || null;

    if (!productIds.length) return;

    await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { productLineId, categoryId },
    });

    revalidatePath('/admin/categories');
    revalidatePath('/staff-portal/categories');
    revalidatePath('/admin/inventory');
    revalidatePath('/shop');
}

// ─── Fetch helpers (used by server components) ───────────────────────────────

export async function getProductLinesWithCategories() {
    return prisma.productLine.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
            categories: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
            },
        },
    });
}

export async function getAllProductLines() {
    return prisma.productLine.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
            categories: { orderBy: { sortOrder: 'asc' } },
            _count: { select: { products: true } },
        },
    });
}

export async function getAllCategories() {
    return prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
            productLine: true,
            _count: { select: { products: true } },
        },
    });
}
