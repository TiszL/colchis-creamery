import SuccessClient from "@/components/checkout/SuccessClient";

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
    return (
        <SuccessClient
            locale={locale}
            status={sp.redirect_status ?? 'succeeded'}
            paymentIntentId={sp.payment_intent ?? null}
            orderId={sp.order_id ?? null}
        />
    );
}
