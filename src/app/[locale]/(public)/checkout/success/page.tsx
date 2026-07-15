import SuccessClient from "@/components/checkout/SuccessClient";
import { reconcileOrderFromStripe } from "@/lib/stripe-payment-sync";

interface SuccessPageProps {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{
        payment_intent?: string;
        payment_intent_client_secret?: string;
        redirect_status?: string;
        order_id?: string;
    }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: SuccessPageProps) {
    const { locale } = await params;
    return {
        title: locale === 'en' ? 'Order placed — Colchis Food' : 'Pedido confirmado — Colchis Food',
        robots: { index: false, follow: false },
    };
}

export default async function SuccessPage({ params, searchParams }: SuccessPageProps) {
    const { locale } = await params;
    const sp = await searchParams;

    // Launch hardening — webhook-independent reconciliation. The customer just
    // paid and landed here; sync the order from Stripe directly so a delayed or
    // misconfigured webhook can't leave a charged customer with an UNPAID order
    // (which the reservation cron would then cancel). Idempotent + guarded
    // against racing the webhook. Best-effort: never block the page render.
    if (sp.order_id) {
        try {
            await reconcileOrderFromStripe(sp.order_id);
        } catch (e) {
            console.error('[checkout/success] payment reconciliation failed for order', sp.order_id, ':', e instanceof Error ? e.message : e);
        }
    }

    return (
        <SuccessClient
            locale={locale}
            status={sp.redirect_status ?? 'succeeded'}
            paymentIntentId={sp.payment_intent ?? null}
            orderId={sp.order_id ?? null}
        />
    );
}
