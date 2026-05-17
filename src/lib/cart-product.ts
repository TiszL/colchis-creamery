// Phase 7b.4 — Prisma Product → cart Product serializer.
//
// CartProvider's `Product` type (src/types/index.ts) treats priceB2c/priceB2b
// as `number`, while Prisma stores them as `String` (matching the rest of the
// money convention in this codebase). This helper does the coercion in one
// place so the order-detail pages can pass past-order items into the cart.

import type { Product as PrismaProduct } from '@prisma/client';
import type { Product as CartProduct } from '@/types';

export function productForCart(p: PrismaProduct): CartProduct {
    return {
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
        priceB2c: parseFloat(p.priceB2c),
        priceB2b: parseFloat(p.priceB2b),
        stockQuantity: p.stockQuantity ?? 0,
        isActive: p.isActive,
        status: p.status as CartProduct['status'],
        isCartOrderable: p.isCartOrderable,
        productLineId: p.productLineId,
        categoryId: p.categoryId,
    };
}
