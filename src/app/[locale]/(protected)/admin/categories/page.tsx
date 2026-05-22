import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import CategoryManager from '@/components/admin/CategoryManager';
import {
    saveProductLineAction,
    deleteProductLineAction,
    saveCategoryAction,
    deleteCategoryAction,
    assignProductCategoryAction,
} from '@/app/actions/categories';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/portal-login`);

    const [productLines, standaloneCategories, allProducts] = await Promise.all([
        prisma.productLine.findMany({
            orderBy: { sortOrder: 'asc' },
            include: {
                categories: {
                    orderBy: { sortOrder: 'asc' },
                    include: { _count: { select: { products: true } } },
                },
                _count: { select: { products: true } },
            },
        }),
        // Phase 9a: categories that aren't chained under a marketing tier
        // (e.g. "Drinks") live in their own top-level section.
        prisma.category.findMany({
            where: { productLineId: null },
            orderBy: { sortOrder: 'asc' },
            include: { _count: { select: { products: true } } },
        }),
        prisma.product.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true, name: true, sku: true,
                productLineId: true, categoryId: true,
            },
        }),
    ]);

    const serializedLines = JSON.parse(JSON.stringify(productLines));
    const serializedStandalone = JSON.parse(JSON.stringify(standaloneCategories));
    const serializedProducts = JSON.parse(JSON.stringify(allProducts));

    return (
        <CategoryManager
            productLines={serializedLines}
            standaloneCategories={serializedStandalone}
            allProducts={serializedProducts}
            saveLineAction={saveProductLineAction}
            deleteLineAction={deleteProductLineAction}
            saveCategoryAction={saveCategoryAction}
            deleteCategoryAction={deleteCategoryAction}
            assignAction={assignProductCategoryAction}
        />
    );
}
