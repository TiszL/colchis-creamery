import { prisma as db } from '@/lib/db';
import { getSession } from '@/lib/session';
import Link from 'next/link';
import { CheckCircle, Clock, Package } from 'lucide-react';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// B2B order totals are stored as unprefixed numeric strings; render with a "$".
function money(s: string | null | undefined): string {
    const n = Number(String(s ?? '').replace(/[^0-9.-]+/g, '')) || 0;
    return `$${n.toFixed(2)}`;
}

interface SuccessProps {
    params: Promise<{ locale: string }>;
    // Stripe appends payment_intent, payment_intent_client_secret, redirect_status
    // to the return_url. We trust order_id (we created it ourselves) for lookup.
    searchParams: Promise<{
        order_id?: string;
        payment_intent?: string;
        redirect_status?: string;
    }>;
}

export default async function B2BOrderSuccessPage({ params, searchParams }: SuccessProps) {
    const { locale } = await params;
    const { order_id: orderId, redirect_status } = await searchParams;
    const prefix = locale === 'en' ? '' : `/${locale}`;

    // Auth — partner can only see their own orders. getSession enforces the live
    // isActive/sessionVersion check.
    const session = await getSession();
    if (!session?.userId) redirect(`${prefix}/b2b/login`);

    if (!orderId) {
        return (
            <div className="max-w-2xl mx-auto py-16 text-center">
                <h1 className="text-3xl font-serif text-[#2C2A29] mb-3">No order reference</h1>
                <p className="text-gray-500 mb-6">We couldn&apos;t find an order_id in the URL.</p>
                <Link href={`${prefix}/b2b-portal`} className="bg-[#CBA153] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#b08d47] transition">
                    Back to dashboard
                </Link>
            </div>
        );
    }

    const order = await db.order.findUnique({
        where: { id: orderId },
        select: {
            id: true, userId: true, orderType: true,
            paymentStatus: true, orderStatus: true,
            totalAmount: true, createdAt: true,
            stripePaymentIntentId: true,
        },
    });

    if (!order || order.userId !== session.userId) {
        return (
            <div className="max-w-2xl mx-auto py-16 text-center">
                <h1 className="text-3xl font-serif text-[#2C2A29] mb-3">Order not found</h1>
                <p className="text-gray-500 mb-6">We couldn&apos;t find this order under your account.</p>
                <Link href={`${prefix}/b2b-portal`} className="bg-[#CBA153] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#b08d47] transition">
                    Back to dashboard
                </Link>
            </div>
        );
    }

    // Stripe's redirect_status: "succeeded" | "processing" (ACH) | "requires_payment_method"
    // We trust the DB's paymentStatus when it's PAID — the webhook is the source
    // of truth. But Stripe redirects faster than the webhook on ACH, so we
    // also fall back to redirect_status for the initial UI state.
    const isPaid = order.paymentStatus === 'PAID';
    const isProcessing = !isPaid && (redirect_status === 'processing' || order.orderStatus === 'AWAITING_PAYMENT');
    const isFailed = redirect_status === 'requires_payment_method';

    return (
        <div className="max-w-3xl mx-auto py-12 space-y-8">
            <div className="text-center space-y-4">
                {isPaid && <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />}
                {isProcessing && <Clock className="w-16 h-16 text-amber-500 mx-auto" />}
                {isFailed && <div className="w-16 h-16 rounded-full bg-red-100 mx-auto flex items-center justify-center text-red-600 text-3xl">!</div>}

                <h1 className="text-4xl font-serif text-[#2C2A29]">
                    {isPaid && 'Payment confirmed'}
                    {isProcessing && 'Processing payment…'}
                    {isFailed && 'Payment needs attention'}
                    {!isPaid && !isProcessing && !isFailed && 'Order placed'}
                </h1>
                <p className="text-gray-500">
                    {isPaid && 'Stock has been deducted. Your dispatch will appear in Recent Shipments shortly.'}
                    {isProcessing && 'ACH transfers settle in 1-3 business days. You’ll see this order flip to Confirmed once Stripe finalizes the payment.'}
                    {isFailed && 'Stripe was unable to charge the payment method. Please try a different card or contact sales.'}
                </p>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-xl p-6 shadow-sm space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Order reference</span>
                    <span className="font-mono text-[#2C2A29]">{order.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total</span>
                    <span className="font-bold text-[#CBA153]">{money(order.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Payment</span>
                    <span className={`font-medium ${isPaid ? 'text-emerald-600' : isFailed ? 'text-red-600' : 'text-amber-600'}`}>
                        {order.paymentStatus}
                    </span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Order status</span>
                    <span className="font-medium text-[#2C2A29]">{order.orderStatus}</span>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href={`${prefix}/b2b-portal`} className="bg-[#2C2A29] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#1f1d1c] transition flex items-center justify-center gap-2">
                    <Package className="w-4 h-4" />
                    View all orders
                </Link>
                <Link href={`${prefix}/b2b-portal/order`} className="bg-white border border-[#E8E6E1] text-[#2C2A29] px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition">
                    Place another order
                </Link>
            </div>
        </div>
    );
}
