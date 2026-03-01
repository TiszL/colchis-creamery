"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ──────────────────────────────────────────────────────────────────────────────
// SiteConfig Actions (Key-Value Content Store)
// ──────────────────────────────────────────────────────────────────────────────

export async function upsertSiteConfigAction(formData: FormData) {
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
        revalidatePath("/admin/website");
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
                category: (formData.get("category") as string) || "cheese",
                isActive: formData.get("isActive") === "on",
                isB2cVisible: formData.get("isB2cVisible") === "on",
                isB2bVisible: formData.get("isB2bVisible") === "on",
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
    try {
        await prisma.product.create({
            data: {
                sku: formData.get("sku") as string,
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
                category: (formData.get("category") as string) || "cheese",
                isActive: formData.get("isActive") === "on",
                isB2cVisible: formData.get("isB2cVisible") === "on",
                isB2bVisible: formData.get("isB2bVisible") === "on",
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
