// Phase 7a.8 — Admin order detail page.
//
// Shows everything about a single Order: customer + items + per-fulfillment
// breakdown + Stripe references. Admin advances each OrderFulfillment.status
// manually (Phase 8 will auto-update via carrier webhooks).

import { prisma as db } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ArrowLeft, MapPin, Package, CreditCard, User as UserIcon, Truck, RotateCcw } from 'lucide-react';
import AdminRefundForm from '@/components/admin/AdminRefundForm';

export const dynamic = 'force-dynamic';

const FULFILLMENT_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] as const;
type FulfillmentStatus = typeof FULFILLMENT_STATUSES[number];

// Linear advance path. CANCELLED is reachable from any non-terminal state via
// the cancel button, not via Advance.
const NEXT_STATUS: Record<FulfillmentStatus, FulfillmentStatus | null> = {
    PENDING: 'CONFIRMED',
    CONFIRMED: 'PREPARING',
    PREPARING: 'OUT_FOR_DELIVERY',
    OUT_FOR_DELIVERY: 'DELIVERED',
    DELIVERED: null,
    CANCELLED: null,
};

async function updateFulfillmentStatus(formData: FormData) {
    'use server';
    const fulfillmentId = formData.get('fulfillmentId') as string | null;
    const nextStatus = formData.get('nextStatus') as string | null;
    const orderId = formData.get('orderId') as string | null;

    if (!fulfillmentId || !nextStatus || !orderId) return;
    if (!FULFILLMENT_STATUSES.includes(nextStatus as FulfillmentStatus)) return;

    await db.orderFulfillment.update({
        where: { id: fulfillmentId },
        data: { status: nextStatus },
    });

    revalidatePath(`/[locale]/admin/orders/${orderId}`, 'page');
    revalidatePath('/[locale]/admin/orders', 'page');
}

function fmtMoney(s: string | null | undefined): string {
    if (!s) return '$0.00';
    const n = parseFloat(s);
    return isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
}

function fmtChannel(deliveryMethod: string): string {
    return deliveryMethod.replace(/_/g, ' ');
}

function statusBadgeClasses(status: string): string {
    switch (status) {
        case 'PENDING':          return 'bg-gray-100 text-gray-700 border-gray-200';
        case 'CONFIRMED':        return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'PREPARING':        return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'OUT_FOR_DELIVERY': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
        case 'DELIVERED':        return 'bg-green-100 text-green-800 border-green-200';
        case 'CANCELLED':        return 'bg-red-100 text-red-800 border-red-200';
        default:                 return 'bg-gray-100 text-gray-700 border-gray-200';
    }
}

interface PageProps {
    params: Promise<{ id: string; locale: string }>;
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
    const { id, locale } = await params;
    const prefix = locale === 'en' ? '' : `/${locale}`;

    const order = await db.order.findUnique({
        where: { id },
        include: {
            user: { select: { id: true, email: true, name: true, phone: true, role: true } },
            orderItems: {
                include: { product: { select: { id: true, name: true, kind: true } } },
            },
            fulfillments: {
                orderBy: { createdAt: 'asc' },
                include: {
                    location: { select: { id: true, name: true } },
                    items: {
                        include: {
                            orderItem: {
                                include: { product: { select: { id: true, name: true } } },
                            },
                        },
                    },
                },
            },
            shipment: true,
            refunds: {
                orderBy: { createdAt: 'desc' },
                include: { initiatedBy: { select: { id: true, name: true, email: true } } },
            },
        },
    });

    if (!order) notFound();

    // Refund math for the form's remaining-balance hint + the history card
    const totalCents = Math.round((parseFloat(order.totalAmount) || 0) * 100);
    const refundedCents = order.refunds.reduce((sum, r) => sum + r.amountCents, 0);
    const remainingCents = Math.max(0, totalCents - refundedCents);
    const canRefund = !!order.stripePaymentIntentId && remainingCents > 0;

    const customerName = order.user.name || (order.guestEmail ? '(guest)' : '(unnamed)');
    const customerEmail = order.guestEmail || order.user.email;
    const customerPhone = order.guestPhone || order.user.phone;
    const shortId = order.id.slice(0, 8).toUpperCase();

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* ─── Header ───────────────────────────────────────────── */}
            <div>
                <Link
                    href={`${prefix}/admin/orders`}
                    className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-3"
                >
                    <ArrowLeft className="w-4 h-4" />
                    All orders
                </Link>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-serif text-[#2C2A29] flex items-center gap-3">
                            <Package className="w-7 h-7 text-[#B96A3D]" />
                            Order #{shortId}
                        </h1>
                        <p className="text-gray-500 mt-1 text-sm">
                            Placed {new Date(order.createdAt).toLocaleString('en-US', {
                                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                                hour: 'numeric', minute: '2-digit',
                            })} · {order.orderType}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 text-xs font-medium uppercase tracking-wider rounded-full border ${statusBadgeClasses(order.orderStatus)}`}>
                            {order.orderStatus}
                        </span>
                        <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${
                            order.paymentStatus === 'PAID' ? 'bg-green-50 text-green-700 border border-green-200'
                            : order.paymentStatus === 'FAILED' ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                            {order.paymentStatus}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ─── Left column: customer + items ──────────────────── */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer card */}
                    <section className="bg-white border border-gray-200 p-6 shadow-sm">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#B96A3D] mb-3 flex items-center gap-2">
                            <UserIcon className="w-4 h-4" /> Customer
                        </h2>
                        <div className="space-y-1 text-sm text-gray-800">
                            <div className="font-medium">{customerName}</div>
                            {customerEmail && <div className="text-gray-600">{customerEmail}</div>}
                            {customerPhone && <div className="text-gray-600">{customerPhone}</div>}
                            <div className="text-xs text-gray-500 mt-2 uppercase tracking-wider">
                                {order.user.role}{order.guestEmail ? ' · guest checkout' : ''}
                            </div>
                        </div>
                        {order.shippingAddress && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3" /> Ship to
                                </div>
                                <div className="text-sm text-gray-800">{order.shippingAddress}</div>
                                {order.shippingLat !== null && order.shippingLng !== null && (
                                    <div className="text-xs text-gray-400 mt-1 font-mono">
                                        {order.shippingLat.toFixed(4)}, {order.shippingLng.toFixed(4)}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Fulfillments — main 7a.8 feature */}
                    <section className="space-y-4">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#B96A3D] flex items-center gap-2">
                            <Truck className="w-4 h-4" /> Fulfillments ({order.fulfillments.length})
                        </h2>

                        {order.fulfillments.length === 0 && (
                            <div className="bg-white border border-gray-200 p-6 text-sm text-gray-500 italic">
                                No fulfillments — order may have been created before multi-fulfillment rollout.
                            </div>
                        )}

                        {order.fulfillments.map((f, idx) => {
                            const next = NEXT_STATUS[f.status as FulfillmentStatus] ?? null;
                            const terminal = f.status === 'DELIVERED' || f.status === 'CANCELLED';
                            return (
                                <div key={f.id} className="bg-white border border-gray-200 shadow-sm">
                                    <header className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                                Fulfillment {idx + 1} of {order.fulfillments.length}
                                            </div>
                                            <div className="text-base text-[#2C2A29] mt-0.5 font-medium">
                                                {f.location.name} · <span className="text-gray-600">{fmtChannel(f.deliveryMethod)}</span>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${statusBadgeClasses(f.status)}`}>
                                            {f.status.replace(/_/g, ' ')}
                                        </span>
                                    </header>
                                    <div className="px-6 py-4 space-y-3">
                                        <ul className="text-sm text-gray-800 space-y-1">
                                            {f.items.map(it => (
                                                <li key={it.id} className="flex justify-between">
                                                    <span>{it.orderItem.product.name} <span className="text-gray-500">×{it.quantity}</span></span>
                                                    <span className="text-gray-600 font-mono text-xs">
                                                        {fmtMoney((parseFloat(it.orderItem.unitPrice) * it.quantity).toFixed(2))}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100 text-xs">
                                            <KV label="Shipping" value={fmtMoney(f.shippingCost)} />
                                            <KV label="Packaging" value={f.packagingType || '—'} />
                                            <KV label="Scheduled" value={f.scheduledFor ? new Date(f.scheduledFor).toLocaleString() : 'ASAP'} />
                                            <KV label="Tracking" value={f.trackingNumber || '—'} />
                                        </div>
                                    </div>
                                    {!terminal && (
                                        <footer className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
                                            {next && (
                                                <form action={updateFulfillmentStatus}>
                                                    <input type="hidden" name="orderId" value={order.id} />
                                                    <input type="hidden" name="fulfillmentId" value={f.id} />
                                                    <input type="hidden" name="nextStatus" value={next} />
                                                    <button
                                                        type="submit"
                                                        className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider bg-[#2C2A29] text-white hover:bg-black transition rounded"
                                                    >
                                                        Advance to {next.replace(/_/g, ' ')} →
                                                    </button>
                                                </form>
                                            )}
                                            <form action={updateFulfillmentStatus}>
                                                <input type="hidden" name="orderId" value={order.id} />
                                                <input type="hidden" name="fulfillmentId" value={f.id} />
                                                <input type="hidden" name="nextStatus" value="CANCELLED" />
                                                <button
                                                    type="submit"
                                                    className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider border border-red-300 text-red-700 hover:bg-red-50 transition rounded"
                                                >
                                                    Cancel
                                                </button>
                                            </form>
                                        </footer>
                                    )}
                                </div>
                            );
                        })}
                    </section>

                    {/* Order items (raw — useful for sanity checking against fulfillment items) */}
                    <section className="bg-white border border-gray-200 p-6 shadow-sm">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#B96A3D] mb-3">All items</h2>
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[480px]">
                            <thead className="text-xs text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="text-left pb-2">Product</th>
                                    <th className="text-right pb-2">Qty</th>
                                    <th className="text-right pb-2">Unit</th>
                                    <th className="text-right pb-2">Line</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {order.orderItems.map(oi => (
                                    <tr key={oi.id}>
                                        <td className="py-2 text-gray-800">{oi.product.name}</td>
                                        <td className="py-2 text-right text-gray-600">{oi.quantity}</td>
                                        <td className="py-2 text-right text-gray-600 font-mono text-xs">{fmtMoney(oi.unitPrice)}</td>
                                        <td className="py-2 text-right text-gray-900 font-mono text-xs">{fmtMoney((parseFloat(oi.unitPrice) * oi.quantity).toFixed(2))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </section>
                </div>

                {/* ─── Right column: totals + Stripe refs ─────────────── */}
                <aside className="space-y-6">
                    {/* Totals */}
                    <section className="bg-white border border-gray-200 p-6 shadow-sm">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#B96A3D] mb-4">Totals</h2>
                        <div className="space-y-2 text-sm">
                            <Row label="Subtotal" value={fmtMoney(order.subtotalAmount)} />
                            <Row label="Shipping" value={fmtMoney(order.shippingAmount)} />
                            <Row label="Tax" value={fmtMoney(order.taxAmount)} />
                            <div className="pt-3 border-t border-gray-200 flex justify-between items-baseline">
                                <span className="text-xs font-bold uppercase tracking-wider text-[#B96A3D]">Total</span>
                                <span className="text-xl font-serif text-[#2C2A29]">{fmtMoney(order.totalAmount)}</span>
                            </div>
                        </div>
                    </section>

                    {/* Stripe references */}
                    <section className="bg-white border border-gray-200 p-6 shadow-sm">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#B96A3D] mb-3 flex items-center gap-2">
                            <CreditCard className="w-4 h-4" /> Stripe
                        </h2>
                        <div className="space-y-3 text-xs">
                            <Ref label="Payment Intent" value={order.stripePaymentIntentId} stripePath={order.stripePaymentIntentId ? `/payments/${order.stripePaymentIntentId}` : null} />
                            <Ref label="Tax Calculation" value={order.stripeTaxCalculationId} />
                            <Ref label="Tax Transaction" value={order.stripeTaxTransactionId} />
                            <Ref label="Invoice" value={order.stripeInvoiceId} />
                        </div>
                        {order.stripeTaxCalculationId && !order.stripeTaxTransactionId && order.paymentStatus === 'PAID' && (
                            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                                ⚠ Tax calculated but transaction not recorded — webhook may have hit a transient Stripe Tax outage. Retry tooling lands in 7b.
                            </div>
                        )}
                    </section>

                    {/* Reservation status */}
                    {order.reservationExpiresAt && (
                        <section className="bg-amber-50 border border-amber-200 p-4 text-xs">
                            <div className="font-bold uppercase tracking-wider text-amber-800 mb-1">Reservation active</div>
                            <div className="text-amber-900">
                                Stock held until {new Date(order.reservationExpiresAt).toLocaleString()}.
                                {' '}Cleared automatically on payment success or by 7b cleanup cron.
                            </div>
                        </section>
                    )}

                    {/* Refunds (Phase 7b.6) */}
                    <section className="bg-white border border-gray-200 p-6 shadow-sm">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#B96A3D] mb-3 flex items-center gap-2">
                            <RotateCcw className="w-4 h-4" /> Refunds
                        </h2>
                        {/* Summary */}
                        <div className="space-y-2 text-xs mb-4">
                            <div className="flex justify-between">
                                <span className="text-gray-500 uppercase tracking-wider">Total charged</span>
                                <span className="text-gray-900 font-mono">{fmtMoney(order.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 uppercase tracking-wider">Refunded so far</span>
                                <span className="text-gray-900 font-mono">${(refundedCents / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-gray-200">
                                <span className="font-bold uppercase tracking-wider text-[#B96A3D]">Remaining</span>
                                <span className="font-mono text-gray-900 font-bold">${(remainingCents / 100).toFixed(2)}</span>
                            </div>
                        </div>

                        {/* History */}
                        {order.refunds.length > 0 ? (
                            <div className="mb-4 space-y-2">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">History</div>
                                {order.refunds.map(r => (
                                    <div key={r.id} className="p-2 bg-gray-50 border border-gray-200 text-xs">
                                        <div className="flex justify-between items-baseline gap-2">
                                            <span className="font-mono font-bold text-gray-900">${(r.amountCents / 100).toFixed(2)}</span>
                                            <span className="text-gray-500 text-[10px]">{new Date(r.createdAt).toLocaleString()}</span>
                                        </div>
                                        <div className="mt-1 text-gray-700">
                                            <span className="font-medium">{r.reason.replace(/_/g, ' ')}</span>
                                            {' · '}
                                            <span className="text-gray-500">
                                                {r.initiatedBy ? (r.initiatedBy.name || r.initiatedBy.email) : 'system'}
                                            </span>
                                        </div>
                                        {r.notes && (
                                            <div className="mt-1 text-gray-600 italic">&ldquo;{r.notes}&rdquo;</div>
                                        )}
                                        <div className="mt-1 flex gap-2 text-[9px] uppercase tracking-wider text-gray-400">
                                            {r.restoredStock && <span>· stock restored</span>}
                                            {r.reversedTax && <span>· tax reversed</span>}
                                            {r.stripeRefundId && <span className="font-mono normal-case lowercase">{r.stripeRefundId}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mb-4 text-xs text-gray-500 italic">No refunds yet.</div>
                        )}

                        {/* New refund form */}
                        {canRefund ? (
                            <div className="pt-4 border-t border-gray-200">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Issue new refund</div>
                                <AdminRefundForm orderId={order.id} remainingCents={remainingCents} />
                            </div>
                        ) : (
                            <div className="pt-4 border-t border-gray-200 text-xs text-gray-500 italic">
                                {!order.stripePaymentIntentId
                                    ? 'No payment intent — nothing to refund.'
                                    : 'Order is fully refunded.'}
                            </div>
                        )}
                    </section>
                </aside>
            </div>
        </div>
    );
}

/* ─── Tiny presentational helpers (file-local) ─────────────────────────── */

function KV({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
            <div className="text-sm text-gray-800 mt-0.5 truncate">{value}</div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between text-gray-700">
            <span>{label}</span>
            <span className="font-mono text-xs text-gray-900">{value}</span>
        </div>
    );
}

function Ref({ label, value, stripePath }: { label: string; value: string | null; stripePath?: string | null }) {
    const baseStripeUrl = 'https://dashboard.stripe.com/test'; // _test_ subroute in dev mode
    return (
        <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">{label}</div>
            {value ? (
                stripePath ? (
                    <a
                        href={`${baseStripeUrl}${stripePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-blue-700 hover:underline break-all"
                    >
                        {value}
                    </a>
                ) : (
                    <div className="font-mono text-xs text-gray-700 break-all">{value}</div>
                )
            ) : (
                <div className="text-xs text-gray-400 italic">—</div>
            )}
        </div>
    );
}
