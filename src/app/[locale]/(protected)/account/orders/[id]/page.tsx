// Phase 7b.2 — Customer-facing order detail (logged-in path).
//
// Auth: the order must belong to the logged-in user. Treat "not yours" the same
// as "doesn't exist" (404) so we never leak the existence of foreign order ids.
// Render is the shared OrderDetailView used by both /account/orders/[id] and
// /orders/[token] (guest path).

import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import OrderDetailView from '@/components/account/OrderDetailView';
import { productForCart } from '@/lib/cart-product';
import { CANCEL_WINDOW_MS, PAST_CONFIRMED_FULFILLMENT_STATUSES } from '@/lib/order-policy';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string; locale: string }>;
}

export default async function CustomerOrderDetailPage({ params }: PageProps) {
    const { id, locale } = await params;
    const prefix = locale === 'en' ? '' : `/${locale}`;

    const session = await getSession();
    if (!session?.userId) redirect(`${prefix}/login`);

    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            // Full Product (not just `name`) so we can serialize into a cart
            // Product for the Reorder button. OrderDetailView only uses `name`
            // from this relation; the rest is for reorder.
            orderItems: { include: { product: true } },
            fulfillments: {
                orderBy: { createdAt: 'asc' },
                include: {
                    location: { select: { name: true } },
                    items: {
                        include: {
                            orderItem: {
                                include: { product: { select: { name: true } } },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!order || order.userId !== session.userId) notFound();

    // Reorder eligibility: product must still exist, be active, AND status ACTIVE.
    // COMING_SOON products are excluded — don't let customer queue items that
    // aren't actually orderable yet (would surprise them at checkout).
    const reorderItems = order.orderItems
        .filter(oi => oi.product && oi.product.isActive && oi.product.status === 'ACTIVE')
        .map(oi => ({
            product: productForCart(oi.product),
            quantity: oi.quantity,
        }));
    const reorderSkippedCount = order.orderItems.length - reorderItems.length;

    // Cancel eligibility (UI hint only — server re-validates inside the action).
    // Server component runs once per request; Date.now() impurity is intentional.
    // eslint-disable-next-line react-hooks/purity
    const ageMs = Date.now() - order.createdAt.getTime();
    const cancelEligible =
        order.paymentStatus === 'PAID' &&
        order.orderStatus !== 'CANCELLED' &&
        ageMs < CANCEL_WINDOW_MS &&
        !order.fulfillments.some(f => PAST_CONFIRMED_FULFILLMENT_STATUSES.has(f.status));
    const cancelInfo = cancelEligible
        ? { orderId: order.id, minutesRemaining: Math.max(1, Math.ceil((CANCEL_WINDOW_MS - ageMs) / 60000)) }
        : null;

    return (
        <OrderDetailView
            order={order}
            backLink={{ href: `${prefix}/account`, label: 'My account' }}
            locale={locale}
            reorderItems={reorderItems}
            reorderSkippedCount={reorderSkippedCount}
            cancelInfo={cancelInfo}
        />
    );
}
