"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/authz";

// ──────────────────────────────────────────────────────────────────────────────
// SiteConfig Actions (Key-Value Content Store)
// ──────────────────────────────────────────────────────────────────────────────

export async function upsertSiteConfigAction(formData: FormData) {
    const session = await authorize(["MASTER_ADMIN"]);
    if (!session) return { error: "Unauthorized." };

    const key = formData.get("key") as string;
    const value = formData.get("value") as string;

    if (!key) return { error: "Key is required." };

    try {
        await prisma.siteConfig.upsert({
            where: { key },
            update: { value: value || "" },
            create: { key, value: value || "" },
        });
        revalidatePath("/");
        revalidatePath("/admin/website");
        return { success: true };
    } catch (error) {
        console.error("Upsert site config error:", error);
        return { error: "Failed to update site content." };
    }
}

export async function batchUpsertSiteConfigAction(formData: FormData) {
    const session = await authorize(["MASTER_ADMIN"]);
    if (!session) return { error: "Unauthorized." };

    const entries = formData.get("entries") as string;
    if (!entries) return { error: "No entries provided." };

    try {
        const parsed: { key: string; value: string }[] = JSON.parse(entries);

        for (const { key, value } of parsed) {
            await prisma.siteConfig.upsert({
                where: { key },
                update: { value: value || "" },
                create: { key, value: value || "" },
            });
        }

        revalidatePath("/");
        revalidatePath("/heritage");
        revalidatePath("/faq");
        revalidatePath("/legal/privacy");
        revalidatePath("/legal/terms");
        revalidatePath("/legal/returns");
        revalidatePath("/admin/website");
        revalidatePath("/admin/website/heritage");
        revalidatePath("/admin/website/legal");
        revalidatePath("/wholesale");
        revalidatePath("/contact");
        return { success: true };
    } catch (error) {
        console.error("Batch upsert site config error:", error);
        return { error: "Failed to update site content." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Product CRUD Actions
// ──────────────────────────────────────────────────────────────────────────────

export async function updateProductAction(formData: FormData) {
    const session = await authorize(["MASTER_ADMIN"]);
    if (!session) return { error: "Unauthorized." };

    const id = formData.get("id") as string;
    if (!id) return { error: "Product ID is required." };

    try {
        await prisma.product.update({
            where: { id },
            data: {
                name: formData.get("name") as string,
                slug: formData.get("slug") as string,
                description: formData.get("description") as string,
                flavorProfile: (formData.get("flavorProfile") as string) || null,
                pairsWith: (formData.get("pairsWith") as string) || null,
                weight: (formData.get("weight") as string) || null,
                ingredients: (formData.get("ingredients") as string) || null,
                imageUrl: formData.get("imageUrl") as string,
                priceB2c: formData.get("priceB2c") as string,
                priceB2b: formData.get("priceB2b") as string,
                stockQuantity: parseInt(formData.get("stockQuantity") as string, 10) || 0,
                // Phase 9b: legacy `category` String column dropped. Category is
                // managed via /admin/inventory (categoryId FK on Product).
                isActive: formData.get("isActive") === "on",
                isB2cVisible: formData.get("isB2cVisible") === "on",
                isB2bVisible: formData.get("isB2bVisible") === "on",
                isCartOrderable: formData.get("isCartOrderable") !== "off",
            },
        });
        revalidatePath("/admin/website/products");
        revalidatePath("/shop");
        return { success: true };
    } catch (error) {
        console.error("Update product error:", error);
        return { error: "Failed to update product." };
    }
}

export async function createProductAction(formData: FormData) {
    const session = await authorize(["MASTER_ADMIN"]);
    if (!session) return { error: "Unauthorized." };

    try {
        const slug = formData.get("slug") as string;
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const imageUrl = formData.get("imageUrl") as string;

        // Default 1:1 ProductFamily creation. Admin can later merge SKUs into
        // shared families via the families UI (Phase 1d).
        const family = await prisma.productFamily.upsert({
            where: { slug },
            update: {},
            create: { slug, name, description: description.slice(0, 500), imageUrl },
        });

        // Phase 9b: categoryId is now NOT NULL. This legacy CMS-side create
        // path falls back to the 'cheese' category if the caller didn't pass
        // one (the new /admin/inventory form sends it explicitly).
        const categoryIdRaw = formData.get("categoryId") as string | null;
        let categoryId = categoryIdRaw && categoryIdRaw !== "" ? categoryIdRaw : null;
        if (!categoryId) {
            const fallback = await prisma.category.findUnique({ where: { slug: "cheese" }, select: { id: true } });
            if (!fallback) return { error: "No default category — create one first." };
            categoryId = fallback.id;
        }

        await prisma.product.create({
            data: {
                sku: formData.get("sku") as string,
                name,
                slug,
                description,
                flavorProfile: (formData.get("flavorProfile") as string) || null,
                pairsWith: (formData.get("pairsWith") as string) || null,
                weight: (formData.get("weight") as string) || null,
                ingredients: (formData.get("ingredients") as string) || null,
                imageUrl,
                priceB2c: formData.get("priceB2c") as string,
                priceB2b: formData.get("priceB2b") as string,
                stockQuantity: parseInt(formData.get("stockQuantity") as string, 10) || 0,
                categoryId,
                isActive: formData.get("isActive") === "on",
                isB2cVisible: formData.get("isB2cVisible") === "on",
                isB2bVisible: formData.get("isB2bVisible") === "on",
                isCartOrderable: formData.get("isCartOrderable") !== "off",
                productFamilyId: family.id,
            },
        });
        revalidatePath("/admin/website/products");
        revalidatePath("/shop");
        return { success: true };
    } catch (error) {
        console.error("Create product error:", error);
        return { error: "Failed to create product." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Recipe CRUD Actions
// ──────────────────────────────────────────────────────────────────────────────

export async function createRecipeAction(formData: FormData) {
    const session = await authorize(["MASTER_ADMIN"]);
    if (!session) return { error: "Unauthorized." };

    try {
        await prisma.recipe.create({
            data: {
                title: formData.get("title") as string,
                slug: formData.get("slug") as string,
                description: formData.get("description") as string,
                content: formData.get("content") as string,
                prepTime: (formData.get("prepTime") as string) || null,
                cookTime: (formData.get("cookTime") as string) || null,
                servings: (formData.get("servings") as string) || null,
                difficulty: (formData.get("difficulty") as string) || null,
                imageUrl: (formData.get("imageUrl") as string) || null,
                isPublished: formData.get("isPublished") === "on",
            },
        });
        revalidatePath("/admin/website/recipes");
        revalidatePath("/recipes");
        return { success: true };
    } catch (error) {
        console.error("Create recipe error:", error);
        return { error: "Failed to create recipe." };
    }
}

export async function updateRecipeAction(formData: FormData) {
    const session = await authorize(["MASTER_ADMIN"]);
    if (!session) return { error: "Unauthorized." };

    const id = formData.get("id") as string;
    if (!id) return { error: "Recipe ID is required." };

    try {
        await prisma.recipe.update({
            where: { id },
            data: {
                title: formData.get("title") as string,
                slug: formData.get("slug") as string,
                description: formData.get("description") as string,
                content: formData.get("content") as string,
                prepTime: (formData.get("prepTime") as string) || null,
                cookTime: (formData.get("cookTime") as string) || null,
                servings: (formData.get("servings") as string) || null,
                difficulty: (formData.get("difficulty") as string) || null,
                imageUrl: (formData.get("imageUrl") as string) || null,
                isPublished: formData.get("isPublished") === "on",
            },
        });
        revalidatePath("/admin/website/recipes");
        revalidatePath("/recipes");
        return { success: true };
    } catch (error) {
        console.error("Update recipe error:", error);
        return { error: "Failed to update recipe." };
    }
}

export async function deleteRecipeAction(formData: FormData) {
    const session = await authorize(["MASTER_ADMIN"]);
    if (!session) return { error: "Unauthorized." };

    const id = formData.get("id") as string;
    if (!id) return { error: "Recipe ID is required." };

    try {
        await prisma.recipe.delete({ where: { id } });
        revalidatePath("/admin/website/recipes");
        revalidatePath("/recipes");
        return { success: true };
    } catch (error) {
        console.error("Delete recipe error:", error);
        return { error: "Failed to delete recipe." };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Article CRUD Actions
// ──────────────────────────────────────────────────────────────────────────────

export async function createArticleAction(formData: FormData) {
    const session = await authorize(["MASTER_ADMIN"]);
    if (!session) return { error: "Unauthorized." };

    try {
        await prisma.article.create({
            data: {
                title: formData.get("title") as string,
                slug: formData.get("slug") as string,
                excerpt: (formData.get("excerpt") as string) || null,
                content: formData.get("content") as string,
                coverImage: (formData.get("coverImage") as string) || null,
                tags: (formData.get("tags") as string) || null,
                isPublished: formData.get("isPublished") === "on",
                publishedAt: formData.get("isPublished") === "on" ? new Date() : null,
            },
        });
        revalidatePath("/admin/website/articles");
        return { success: true };
    } catch (error) {
        console.error("Create article error:", error);
        return { error: "Failed to create article." };
    }
}

export async function updateArticleAction(formData: FormData) {
    const session = await authorize(["MASTER_ADMIN"]);
    if (!session) return { error: "Unauthorized." };

    const id = formData.get("id") as string;
    if (!id) return { error: "Article ID is required." };

    try {
        const existing = await prisma.article.findUnique({ where: { id } });
        const wasPublished = existing?.isPublished;
        const isNowPublished = formData.get("isPublished") === "on";

        await prisma.article.update({
            where: { id },
            data: {
                title: formData.get("title") as string,
                slug: formData.get("slug") as string,
                excerpt: (formData.get("excerpt") as string) || null,
                content: formData.get("content") as string,
                coverImage: (formData.get("coverImage") as string) || null,
                tags: (formData.get("tags") as string) || null,
                isPublished: isNowPublished,
                publishedAt: !wasPublished && isNowPublished ? new Date() : existing?.publishedAt,
            },
        });
        revalidatePath("/admin/website/articles");
        return { success: true };
    } catch (error) {
        console.error("Update article error:", error);
        return { error: "Failed to update article." };
    }
}

export async function deleteArticleAction(formData: FormData) {
    const session = await authorize(["MASTER_ADMIN"]);
    if (!session) return { error: "Unauthorized." };

    const id = formData.get("id") as string;
    if (!id) return { error: "Article ID is required." };

    try {
        await prisma.article.delete({ where: { id } });
        revalidatePath("/admin/website/articles");
        return { success: true };
    } catch (error) {
        console.error("Delete article error:", error);
        return { error: "Failed to delete article." };
    }
}
