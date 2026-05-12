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

const ALLOWED = ['MASTER_ADMIN', 'PRODUCT_MANAGER'];

export default async function StaffCategoriesPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || !ALLOWED.includes(session.role)) redirect(`/${locale}/staff`);

    const productLines = await prisma.productLine.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
            categories: {
                orderBy: { sortOrder: 'asc' },
                include: { _count: { select: { products: true } } },
            },
            _count: { select: { products: true } },
        },
    });

    const allProducts = await prisma.product.findMany({
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            sku: true,
            productLineId: true,
            categoryId: true,
        },
    });

    const serializedLines = JSON.parse(JSON.stringify(productLines));
    const serializedProducts = JSON.parse(JSON.stringify(allProducts));

    return (
        <CategoryManager
            productLines={serializedLines}
            allProducts={serializedProducts}
            saveLineAction={saveProductLineAction}
            deleteLineAction={deleteProductLineAction}
            saveCategoryAction={saveCategoryAction}
            deleteCategoryAction={deleteCategoryAction}
            assignAction={assignProductCategoryAction}
        />
    );
}
