// Phase 7b.3 — Guest order lookup via signed token.
//
// Public route reached from the "View your order" link in the confirmation
// email. The token in the URL is HS256-signed (see src/lib/order-token.ts);
// possession of the token IS the authentication. No session required.
//
// Auth model: anyone who has the signed token can view the order. Tokens
// expire (30 days by default) so a leaked email becomes useless eventually.
// Re-issuing a token is a future feature ("resend the email" admin action).

import { prisma } from '@/lib/db';
import { verifyOrderToken } from '@/lib/order-token';
import OrderDetailView from '@/components/account/OrderDetailView';
import { productForCart } from '@/lib/cart-product';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ token: string; locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
    const { locale } = await params;
    return {
        title: ({ en: 'Your order', ka: 'თქვენი შეკვეთა', ru: 'Ваш заказ', es: 'Tu pedido' } as Record<string, string>)[locale] ?? 'Your order',
        // Lookup pages are tied to a specific token in the URL — we don't want
        // any of them indexed or followed by crawlers.
        robots: { index: false, follow: false },
    };
}

export default async function GuestOrderLookupPage({ params }: PageProps) {
    const { token, locale } = await params;
    const prefix = locale === 'en' ? '' : `/${locale}`;

    const verified = await verifyOrderToken(token);
    if (!verified) {
        return <InvalidLinkView prefix={prefix} />;
    }

    const order = await prisma.order.findUnique({
        where: { id: verified.orderId },
        include: {
            // Full Product so we can serialize for the Reorder button. View
            // itself only reads `name`; the rest is for reorder.
            orderItems: { include: { product: true } },
            refunds: { orderBy: { createdAt: 'asc' } },
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

    // Token verified but order is gone (deleted, never created, etc.) — treat
    // identically to an invalid token to avoid leaking existence signals.
    if (!order) {
        return <InvalidLinkView prefix={prefix} />;
    }

    // Same reorder-eligibility rules as the logged-in customer path: active +
    // status ACTIVE + cart-orderable (excludes COMING_SOON and wholesale-only).
    const reorderItems = order.orderItems
        .filter(oi => oi.product && oi.product.isActive && oi.product.status === 'ACTIVE' && oi.product.isCartOrderable
            && oi.quantity - oi.refundedQuantity > 0)
        .map(oi => ({
            product: productForCart(oi.product),
            // Reorder what the customer actually received, not removed lines.
            quantity: oi.quantity - oi.refundedQuantity,
        }));
    const reorderSkippedCount = order.orderItems.length - reorderItems.length;

    // No back link — guest may not have an account, so /account isn't a sensible
    // destination. The "Need help?" block + home links elsewhere in the layout
    // handle navigation.
    return (
        <OrderDetailView
            order={order}
            backLink={null}
            locale={locale}
            reorderItems={reorderItems}
            reorderSkippedCount={reorderSkippedCount}
        />
    );
}

function InvalidLinkView({ prefix }: { prefix: string }) {
    return (
        <main style={{ background: '#F5F0E6', minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
            <div style={{ textAlign: 'center', maxWidth: 520 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>
                    Lookup
                </div>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 56, color: '#1F3026', margin: '16px 0 12px', lineHeight: 0.95, letterSpacing: '-0.02em' }}>
                    This link is <em style={{ color: '#A8312C' }}>no longer valid.</em>
                </h1>
                <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 17, color: '#2C3D33', opacity: 0.8, marginBottom: 24 }}>
                    The link may have expired (30 days) or the order isn&apos;t accessible.
                    If you placed an order recently and can&apos;t find it, email us with your order number.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <Link href={`${prefix}/`} style={{ background: '#1F3026', color: '#F5F0E6', padding: '14px 24px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', textDecoration: 'none' }}>
                        Back to home →
                    </Link>
                    <a href="mailto:hello@colchisfood.com" style={{ background: 'transparent', color: '#1F3026', border: '1px solid #1F302655', padding: '14px 24px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', textDecoration: 'none' }}>
                        Email us
                    </a>
                </div>
            </div>
        </main>
    );
}
