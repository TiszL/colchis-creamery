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
    // against racing the webhook. Bounded: maxAgeMs keeps this public page from
    // being an unauthenticated Stripe-API amplifier for dead order ids, and the
    // render never waits more than 10s — the cron finishes any rescue this page
    // ran out of time for. Best-effort: never block the page render on failure.
    if (sp.order_id) {
        try {
            await Promise.race([
                reconcileOrderFromStripe(sp.order_id, { maxAgeMs: 24 * 60 * 60 * 1000 }),
                new Promise<void>(resolve => setTimeout(resolve, 10_000)),
            ]);
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
