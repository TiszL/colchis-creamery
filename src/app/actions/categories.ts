'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/authz';

const CATEGORY_EDITORS = ['MASTER_ADMIN', 'PRODUCT_MANAGER'];

// ─── Product Line Actions ────────────────────────────────────────────────────

export async function saveProductLineAction(formData: FormData) {
    await requireRole(CATEGORY_EDITORS);
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
    await requireRole(CATEGORY_EDITORS);
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

const VALID_SECTIONS = ['creamery', 'bakery', 'shop', 'wholesale'] as const;

export async function saveCategoryAction(formData: FormData) {
    await requireRole(CATEGORY_EDITORS);
    const id = formData.get('id') as string;
    // Phase 9a: productLineId is optional. Empty form value → null (decoupled
    // category like "Drinks" that doesn't live under any marketing tier).
    const productLineIdRaw = formData.get('productLineId') as string;
    const productLineId = productLineIdRaw && productLineIdRaw !== '' ? productLineIdRaw : null;
    // Sections come from checkboxes; FormData.getAll returns an array.
    const sections = (formData.getAll('sections') as string[])
        .filter(s => (VALID_SECTIONS as readonly string[]).includes(s));

    const data = {
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        description: (formData.get('description') as string) || null,
        imageUrl: (formData.get('imageUrl') as string) || null,
        productLineId,
        sections,
        sortOrder: parseInt(formData.get('sortOrder') as string, 10) || 0,
        isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
    };

    if (id) {
        await prisma.category.update({ where: { id }, data });
    } else {
        await prisma.category.create({ data });
    }

    revalidatePath('/admin/categories');
    revalidatePath('/admin/inventory');
    revalidatePath('/creamery');
    revalidatePath('/bakery');
    revalidatePath('/shop');
}

export async function deleteCategoryAction(formData: FormData) {
    await requireRole(CATEGORY_EDITORS);
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
    await requireRole(CATEGORY_EDITORS);
    const productId = formData.get('productId') as string;
    const productLineIdRaw = formData.get('productLineId') as string;
    const categoryIdRaw = formData.get('categoryId') as string;

    if (!productId) return;

    // Phase 9b: Product.categoryId is NOT NULL, so we only update it if the
    // caller actually sent one. productLineId is nullable → empty value clears
    // the relation via Prisma's { set: null } shape.
    const data: { productLineId?: string | { set: null }; categoryId?: string } = {};
    if (productLineIdRaw === '') data.productLineId = { set: null };
    else if (productLineIdRaw) data.productLineId = productLineIdRaw;
    if (categoryIdRaw) data.categoryId = categoryIdRaw;

    if (Object.keys(data).length === 0) return;

    await prisma.product.update({
        where: { id: productId },
        data,
    });

    revalidatePath('/admin/categories');
    revalidatePath('/admin/inventory');
    revalidatePath('/shop');
}

// ─── Bulk Assign ─────────────────────────────────────────────────────────────

export async function bulkAssignCategoryAction(formData: FormData) {
    await requireRole(CATEGORY_EDITORS);
    const productIds = JSON.parse(formData.get('productIds') as string) as string[];
    const productLineIdRaw = formData.get('productLineId') as string;
    const categoryIdRaw = formData.get('categoryId') as string;

    if (!productIds.length) return;

    const data: { productLineId?: string | { set: null }; categoryId?: string } = {};
    if (productLineIdRaw === '') data.productLineId = { set: null };
    else if (productLineIdRaw) data.productLineId = productLineIdRaw;
    if (categoryIdRaw) data.categoryId = categoryIdRaw;
    if (Object.keys(data).length === 0) return;

    await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data,
    });

    revalidatePath('/admin/categories');
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
