"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

// ── Anti-spam helpers ────────────────────────────────────────────────────────

const LINK_PATTERNS = /https?:\/\/|www\.|\.com\b|\.net\b|\.org\b|\.io\b|\.co\b|bit\.ly|t\.co/gi;

function containsLinks(text: string): boolean {
    const matches = text.match(LINK_PATTERNS);
    return (matches?.length || 0) >= 1;
}

function sanitizeText(text: string): string {
    return text.replace(/<[^>]*>/g, "").trim();
}

// ── Submit Review ────────────────────────────────────────────────────────────

export async function submitReview(formData: FormData) {
    const session = await getSession();
    if (!session) return { error: "You must be logged in to submit a review." };

    const productId = formData.get("productId") as string;
    const rating = parseInt(formData.get("rating") as string);
    const title = sanitizeText(formData.get("title") as string || "");
    const body = sanitizeText(formData.get("body") as string || "");
    const photoUrls = formData.get("photoUrls") as string || "";

    // Validation
    if (!productId) return { error: "Product ID is required." };
    if (!rating || rating < 1 || rating > 5) return { error: "Rating must be 1-5 stars." };
    if (title.length < 5 || title.length > 100) return { error: "Title must be 5-100 characters." };
    if (body.length < 10 || body.length > 2000) return { error: "Review must be 10-2000 characters." };

    // Link check
    if (containsLinks(title) || containsLinks(body)) {
        return { error: "Links are not allowed in reviews. Please remove any URLs." };
    }

    // Check one review per product per user
    const existing = await prisma.productReview.findUnique({
        where: { productId_userId: { productId, userId: session.userId } },
    });
    if (existing) return { error: "You have already reviewed this product. You can add a reply to your existing review instead." };

    // Rate limit: max 3 reviews per user per 24h
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await prisma.productReview.count({
        where: { userId: session.userId, createdAt: { gte: dayAgo } },
    });
    if (recentCount >= 3) return { error: "You can submit a maximum of 3 reviews per day. Please try again tomorrow." };

    // Verified purchase check
    const hasPurchased = await prisma.orderItem.findFirst({
        where: {
            productId,
            order: {
                userId: session.userId,
                paymentStatus: "PAID",
            },
        },
    });

    try {
        const review = await prisma.productReview.create({
            data: {
                productId,
                userId: session.userId,
                rating,
                title,
                body,
                isVerifiedPurchase: !!hasPurchased,
                status: "PENDING",
            },
        });

        // Create photo records if any
        const urls = photoUrls.split(",").map(u => u.trim()).filter(Boolean);
        if (urls.length > 0) {
            await prisma.reviewPhoto.createMany({
                data: urls.slice(0, 3).map(url => ({
                    reviewId: review.id,
                    imageUrl: url,
                })),
            });
        }

        const product = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
        if (product) {
            revalidatePath(`/shop/${product.slug}`);
        }

        return { success: true, message: "Thank you! Your review has been submitted and is pending approval." };
    } catch (err: any) {
        console.error("Submit review error:", err);
        if (err.code === "P2002") return { error: "You have already reviewed this product." };
        return { error: "Failed to submit review. Please try again." };
    }
}

// ── Submit Reply ─────────────────────────────────────────────────────────────

export async function submitReply(formData: FormData) {
    const session = await getSession();
    if (!session) return { error: "You must be logged in to reply." };

    const reviewId = formData.get("reviewId") as string;
    const body = sanitizeText(formData.get("body") as string || "");

    if (!reviewId) return { error: "Review ID is required." };
    if (body.length < 5 || body.length > 1000) return { error: "Reply must be 5-1000 characters." };
    if (containsLinks(body)) return { error: "Links are not allowed in replies." };

    // Reply limit: max 3 replies per user per review thread
    const existingReplies = await prisma.reviewReply.count({
        where: { reviewId, userId: session.userId },
    });
    if (existingReplies >= 3) return { error: "Maximum 3 replies per review thread." };

    const isAdmin = session.role === "MASTER_ADMIN";

    try {
        await prisma.reviewReply.create({
            data: {
                reviewId,
                userId: session.userId,
                body,
                isAdminReply: isAdmin,
            },
        });

        const review = await prisma.productReview.findUnique({
            where: { id: reviewId },
            include: { product: { select: { slug: true } } },
        });
        if (review?.product?.slug) {
            revalidatePath(`/shop/${review.product.slug}`);
        }

        return { success: true };
    } catch (err) {
        console.error("Submit reply error:", err);
        return { error: "Failed to submit reply." };
    }
}

// ── Admin: Moderate Review ───────────────────────────────────────────────────

export async function moderateReview(reviewId: string, action: "APPROVED" | "REJECTED", adminNote?: string) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") return { error: "Unauthorized." };

    try {
        const review = await prisma.productReview.update({
            where: { id: reviewId },
            data: { status: action, adminNote: adminNote || null },
            include: { product: { select: { slug: true } } },
        });

        if (review.product?.slug) {
            revalidatePath(`/shop/${review.product.slug}`);
        }
        revalidatePath("/admin/reviews");

        return { success: true };
    } catch (err) {
        console.error("Moderate review error:", err);
        return { error: "Failed to moderate review." };
    }
}

// ── Admin: Delete Review ─────────────────────────────────────────────────────

export async function deleteReview(reviewId: string) {
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") return { error: "Unauthorized." };

    try {
        const review = await prisma.productReview.findUnique({
            where: { id: reviewId },
            include: { product: { select: { slug: true } } },
        });

        await prisma.productReview.delete({ where: { id: reviewId } });

        if (review?.product?.slug) {
            revalidatePath(`/shop/${review.product.slug}`);
        }
        revalidatePath("/admin/reviews");

        return { success: true };
    } catch (err) {
        console.error("Delete review error:", err);
        return { error: "Failed to delete review." };
    }
}
