// Phase 7b.2/7b.3 — Shared order detail view.
//
// Pure render component. Used by:
//   - /account/orders/[id]    (logged-in customer viewing their own order)
//   - /orders/[token]         (guest lookup via signed-token link from confirmation email)
//
// Auth + token verification lives in each caller. This component just renders
// the supplied order data. Server component (no client interactivity needed).

import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import ReorderButton from './ReorderButton';
import CancelOrderButton from './CancelOrderButton';
import { BUSINESS_TIMEZONE } from '@/lib/timezone';
import {
    customerOrderStage,
    fulfillmentStage,
    fulfillmentTimeline,
    type CustomerStage,
    type TimelineStep,
} from '@/lib/customer-order-status';
import type { Product } from '@/types';

export type OrderDetailViewData = {
    id: string;
    createdAt: Date;
    orderStatus: string;
    paymentStatus: string;
    subtotalAmount: string | null;
    shippingAmount: string | null;
    taxAmount: string | null;
    // Voluntary tip (cents) — QR table orders only; 0 elsewhere.
    tipCents: number;
    totalAmount: string;
    shippingAddress: string | null;
    orderItems: {
        id: string;
        quantity: number;
        unitPrice: string;
        refundedQuantity: number;
        amendmentId: string | null;
        product: { name: string };
    }[];
    // Phase 2 — modification transparency: the refund ledger renders in the
    // totals card and drives the "Order updated" badge + adjusted total.
    refunds: {
        id: string;
        amountCents: number;
        reason: string;
        notes: string | null;
        createdAt: Date;
    }[];
    // Phase 2b — payment-link amendments (added items). PENDING_PAYMENT renders
    // an awaiting-payment banner; PAID lines carry amendmentId and show a note.
    amendments: {
        id: string;
        status: string;
        itemsCents: number;
        taxCents: number;
    }[];
    fulfillments: {
        id: string;
        deliveryMethod: string;
        status: string;
        courierStatus: string | null;
        courierName: string | null;
        courierDropoffEtaAt: Date | null;
        shippingCost: string | null;
        trackingNumber: string | null;
        location: { name: string };
        items: {
            id: string;
            quantity: number;
            orderItem: { unitPrice: string; refundedQuantity: number; product: { name: string } };
        }[];
    }[];
};

interface OrderDetailViewProps {
    order: OrderDetailViewData;
    /** Optional back navigation. Null = no back link (e.g. for guest lookup). */
    backLink?: { href: string; label: string } | null;
    /** Locale prefix builder for client-side nav (used by ReorderButton). */
    locale: string;
    /** Items eligible to reorder — server pre-filters to still-active products. */
    reorderItems?: { product: Product; quantity: number }[];
    /** Count of source-order items skipped because they're no longer available. */
    reorderSkippedCount?: number;
    /** Phase 7b.5: when set, render the cancel CTA. Only the customer's
        logged-in page passes this — guest token lookups omit it (guests
        cancel via email-us). Server has re-validated eligibility. */
    cancelInfo?: { orderId: string; minutesRemaining: number } | null;
}

function fmtMoney(s: string | null | undefined): string {
    if (!s) return '$0.00';
    const n = parseFloat(s);
    return isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
}

function fmtChannel(deliveryMethod: string): string {
    return deliveryMethod.replace(/_/g, ' ');
}

function trackingButtonLabel(deliveryMethod: string): string {
    switch (deliveryMethod) {
        case 'DOORDASH_DRIVE':   return 'Track on DoorDash';
        case 'UBER_DIRECT':      return 'Track on Uber';
        case 'UPS_2DAY':  return 'Track on UPS';
        case 'OWN_DELIVERY': return 'Track with our driver';
        default:                 return 'Track delivery';
    }
}

function statusColors(status: string): { bg: string; fg: string; border: string } {
    switch (status) {
        case 'PENDING':          return { bg: '#EAE2D2', fg: '#7A8278', border: '#1F302622' };
        case 'CONFIRMED':        return { bg: '#E8EEF2', fg: '#2C3D33', border: '#2C3D3333' };
        case 'PREPARING':        return { bg: '#FCEEDB', fg: '#B96A3D', border: '#B96A3D55' };
        case 'OUT_FOR_DELIVERY': return { bg: '#E3DDF0', fg: '#5C4A8C', border: '#5C4A8C55' };
        case 'DELIVERED':        return { bg: '#DDE9DC', fg: '#1F3026', border: '#1F302655' };
        case 'CANCELLED':        return { bg: '#FBEAE9', fg: '#A8312C', border: '#A8312C55' };
        default:                 return { bg: '#EAE2D2', fg: '#7A8278', border: '#1F302622' };
    }
}

// Colors for the DERIVED customer stage (see src/lib/customer-order-status.ts).
// RECEIVED amber, CONFIRMED blue, PREPARING purple, READY emerald, ON_THE_WAY
// sky, DELIVERED green, CANCELLED red, REFUNDED gray.
function stageColors(stage: CustomerStage): { bg: string; fg: string; border: string } {
    switch (stage) {
        case 'PAYMENT_PENDING': return { bg: '#EAE2D2', fg: '#7A8278', border: '#1F302622' };
        case 'RECEIVED':        return { bg: '#FCEEDB', fg: '#B45309', border: '#B4530955' };
        case 'CONFIRMED':       return { bg: '#E0EAF7', fg: '#1D4ED8', border: '#1D4ED855' };
        case 'PREPARING':       return { bg: '#E3DDF0', fg: '#5C4A8C', border: '#5C4A8C55' };
        case 'READY':           return { bg: '#D9F0E5', fg: '#047857', border: '#04785755' };
        case 'ON_THE_WAY':      return { bg: '#DDEDF7', fg: '#0369A1', border: '#0369A155' };
        case 'DELIVERED':       return { bg: '#DDE9DC', fg: '#1F3026', border: '#1F302655' };
        case 'CANCELLED':       return { bg: '#FBEAE9', fg: '#A8312C', border: '#A8312C55' };
        case 'REFUNDED':        return { bg: '#EAE2D2', fg: '#7A8278', border: '#1F302622' };
    }
}

// Display label for a per-fulfillment stage (customerOrderStage returns its
// own label; fulfillmentStage returns just the stage key).
function stageLabel(stage: CustomerStage): string {
    switch (stage) {
        case 'PAYMENT_PENDING': return 'Processing payment';
        case 'RECEIVED':        return 'Order received';
        case 'CONFIRMED':       return 'Confirmed';
        case 'PREPARING':       return 'Preparing';
        case 'READY':           return 'Ready';
        case 'ON_THE_WAY':      return 'On the way';
        case 'DELIVERED':       return 'Delivered';
        case 'CANCELLED':       return 'Cancelled';
        case 'REFUNDED':        return 'Refunded';
    }
}

function fmtEta(d: Date | string): string {
    return new Date(d).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TIMEZONE,
    });
}

// Compact horizontal step row: done = filled dot + reached line, current =
// accent ring + emphasized label, upcoming = muted. Tiny labels + flex-1
// columns keep 4–6 steps legible on mobile.
function StepTimeline({ steps }: { steps: TimelineStep[] }) {
    const accent = '#B96A3D';
    const done = '#1F3026';
    const muted = '#C9C2B2';
    return (
        <div style={{ display: 'flex', padding: '18px 16px 14px', borderBottom: '1px solid #1F302614' }}>
            {steps.map((s, i) => {
                const isDone = s.state === 'done';
                const isCurrent = s.state === 'current';
                return (
                    <div key={s.key} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <div style={{ flex: 1, height: 2, background: i === 0 ? 'transparent' : (isDone || isCurrent ? done : muted) }} />
                            <div style={{
                                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                                background: isDone ? done : isCurrent ? accent : '#fff',
                                border: `2px solid ${isDone ? done : isCurrent ? accent : muted}`,
                                boxShadow: isCurrent ? `0 0 0 3px ${accent}33` : 'none',
                            }} />
                            <div style={{ flex: 1, height: 2, background: i === steps.length - 1 ? 'transparent' : (isDone ? done : muted) }} />
                        </div>
                        <div style={{
                            marginTop: 8, padding: '0 2px',
                            fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em',
                            textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.4,
                            color: isCurrent ? '#1F3026' : isDone ? '#2C3D33' : '#9AA096',
                            fontWeight: isCurrent ? 700 : 400,
                        }}>
                            {s.label}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// Customer-friendly courier progress label (courierStatus is carrier-driven,
// separate from the kitchen's fulfillment status). DISPATCH_FAILED is internal
// — staff sees it in the portal with a Retry button; customers never do.
function courierCopy(courierStatus: string): string | null {
    switch (courierStatus) {
        case 'REQUESTED':        return 'Courier requested';
        case 'CONFIRMED':        return 'Driver assigned';
        case 'OUT_FOR_DELIVERY': return 'On the way';
        case 'DELIVERED':        return 'Delivered';
        case 'CANCELLED':        return 'Delivery issue — we will contact you';
        default:                 return null; // DISPATCH_FAILED + unknowns: hidden
    }
}

function statusCopy(status: string): string {
    switch (status) {
        case 'PENDING':          return 'Waiting for the kitchen to confirm.';
        case 'CONFIRMED':        return 'Confirmed — we’ll start preparing soon.';
        case 'PREPARING':        return 'In the bench right now.';
        case 'OUT_FOR_DELIVERY': return 'On its way to you.';
        case 'DELIVERED':        return 'Delivered. Enjoy.';
        case 'CANCELLED':        return 'Cancelled.';
        default:                 return '';
    }
}

export default function OrderDetailView({
    order,
    backLink,
    locale,
    reorderItems = [],
    reorderSkippedCount = 0,
    cancelInfo = null,
}: OrderDetailViewProps) {
    const shortId = order.id.slice(0, 8).toUpperCase();
    const placedOn = new Date(order.createdAt).toLocaleString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });
    // Derived customer stage — honest across kitchen + courier progress
    // (order.orderStatus 'CONFIRMED' only means "paid"; see customer-order-status).
    const orderStage = customerOrderStage(order, order.fulfillments);
    const orderColors = stageColors(orderStage.stage);

    return (
        <main style={{ background: '#F5F0E6', minHeight: '100vh' }}>
            {/* Banner */}
            <section style={{ background: '#1F3026', color: '#F5F0E6', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#F5F0E606 1px, transparent 1px), linear-gradient(90deg, #F5F0E606 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />
                <div className="ch-od-banner" style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 56px 36px', position: 'relative' }}>
                    {backLink && (
                        <Link href={backLink.href} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', color: '#D9A876', textTransform: 'uppercase', textDecoration: 'none', opacity: 0.85 }}>
                            ← {backLink.label}
                        </Link>
                    )}
                    <div style={{ marginTop: backLink ? 18 : 0, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 24, justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.32em', color: '#D9A876', textTransform: 'uppercase' }}>
                                Order #{shortId}
                            </div>
                            <h1 className="ch-od-h1" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 64, lineHeight: 0.95, letterSpacing: '-0.03em', margin: '12px 0 0' }}>
                                Your order, <em style={{ color: '#D9A876', fontWeight: 300 }}>tracked.</em>
                            </h1>
                            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16, opacity: 0.78, marginTop: 14 }}>
                                Placed {placedOn}
                            </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                            <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em',
                                textTransform: 'uppercase', padding: '8px 14px',
                                background: orderColors.bg, color: orderColors.fg,
                                border: `1px solid ${orderColors.border}`,
                            }}>
                                {orderStage.label}
                            </span>
                            {order.refunds.length > 0 && order.paymentStatus === 'PAID' && (
                                <span style={{
                                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.24em',
                                    textTransform: 'uppercase', padding: '6px 12px',
                                    background: '#B96A3D22', color: '#D9A876', border: '1px solid #B96A3D66',
                                }}>
                                    Order updated · partially refunded
                                </span>
                            )}
                            {orderStage.description && (
                                <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13, color: '#F5F0E6', opacity: 0.78, textAlign: 'right', maxWidth: 280 }}>
                                    {orderStage.description}
                                </span>
                            )}
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#F5F0E6', textTransform: 'uppercase', opacity: 0.7 }}>
                                Payment · {order.paymentStatus}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <div className="ch-od-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 56px 96px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 48, alignItems: 'flex-start' }}>
                {/* Left column: fulfillments + items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {order.fulfillments.length > 0 ? order.fulfillments.map((f, idx) => {
                        const fStage = fulfillmentStage(f);
                        const colors = stageColors(fStage);
                        return (
                            <section key={f.id} style={{ background: '#fff', border: '1px solid #1F302622' }}>
                                <header className="ch-od-card-header" style={{ padding: '20px 28px', borderBottom: '1px solid #1F302614', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                                    <div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>
                                            № {String(idx + 1).padStart(2, '0')} — Fulfillment {idx + 1} of {order.fulfillments.length}
                                        </div>
                                        <h2 className="ch-od-loc-h2" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontStyle: 'italic', fontSize: 24, color: '#1F3026', margin: '4px 0 0' }}>
                                            {f.location.name}
                                        </h2>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#7A8278', textTransform: 'uppercase', marginTop: 6 }}>
                                            {fmtChannel(f.deliveryMethod)}{f.shippingCost ? ` · ${fmtMoney(f.shippingCost)}` : ''}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                                        <span style={{
                                            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em',
                                            textTransform: 'uppercase', padding: '6px 12px',
                                            background: colors.bg, color: colors.fg, border: `1px solid ${colors.border}`,
                                        }}>
                                            {stageLabel(fStage)}
                                        </span>
                                        {f.courierStatus && courierCopy(f.courierStatus) && (() => {
                                            const cColors = statusColors(f.courierStatus);
                                            return (
                                                <span style={{
                                                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em',
                                                    textTransform: 'uppercase', padding: '5px 10px',
                                                    background: cColors.bg, color: cColors.fg, border: `1px solid ${cColors.border}`,
                                                }}>
                                                    {courierCopy(f.courierStatus)}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </header>
                                <StepTimeline steps={fulfillmentTimeline(f)} />
                                {statusCopy(f.status) && (
                                    <div style={{ padding: '14px 28px', background: '#F5F0E6', borderBottom: '1px solid #1F302614' }}>
                                        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15, color: '#2C3D33', margin: 0 }}>
                                            {statusCopy(f.status)}
                                        </p>
                                    </div>
                                )}
                                {(f.courierName || f.courierDropoffEtaAt) && (
                                    <div style={{ padding: '12px 28px', borderBottom: '1px solid #1F302614' }}>
                                        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15, color: '#2C3D33', margin: 0 }}>
                                            {f.courierName && <>Your courier: <span style={{ fontStyle: 'normal', fontWeight: 500 }}>{f.courierName}</span></>}
                                            {f.courierName && f.courierDropoffEtaAt && ' · '}
                                            {f.courierDropoffEtaAt && <>Arriving around {fmtEta(f.courierDropoffEtaAt)}</>}
                                        </p>
                                    </div>
                                )}
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {f.items.map((it, i) => (
                                        (() => {
                                            // Modification transparency: refundedQuantity is
                                            // order-level; edits only exist on single-leg orders,
                                            // so the per-line subtraction is exact in practice.
                                            const effective = Math.max(0, it.quantity - it.orderItem.refundedQuantity);
                                            const removed = effective <= 0;
                                            const reduced = !removed && it.orderItem.refundedQuantity > 0;
                                            return (
                                        <li key={it.id} style={{ padding: '14px 28px', borderBottom: i === f.items.length - 1 ? 'none' : '1px solid #1F302614', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, opacity: removed ? 0.55 : 1 }}>
                                            <div>
                                                <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 17, color: '#1F3026', textDecoration: removed ? 'line-through' : 'none' }}>
                                                    {it.orderItem.product.name}
                                                </div>
                                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: removed ? '#A8312C' : '#7A8278', textTransform: 'uppercase', marginTop: 3 }}>
                                                    {removed
                                                        ? 'Removed · refunded'
                                                        : reduced
                                                            ? <>×{effective} <s style={{ opacity: 0.6 }}>×{it.quantity}</s> · {fmtMoney(it.orderItem.unitPrice)}/ea · partially refunded</>
                                                            : <>×{it.quantity} · {fmtMoney(it.orderItem.unitPrice)}/ea</>}
                                                </div>
                                            </div>
                                            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: '#1F3026', textDecoration: removed ? 'line-through' : 'none' }}>
                                                {fmtMoney((parseFloat(it.orderItem.unitPrice) * (removed ? it.quantity : effective)).toFixed(2))}
                                            </div>
                                        </li>
                                            );
                                        })()
                                    ))}
                                </ul>
                                {f.trackingNumber && (
                                    <div style={{ padding: '20px 28px', borderTop: '1px solid #1F302614', background: '#EAE2D2' }}>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase', marginBottom: 12 }}>
                                            {f.trackingNumber.startsWith('http') ? 'Live tracking' : 'Tracking number'}
                                        </div>
                                        {/* Courier legs store a tracking URL; UPS stores a plain
                                            tracking code. Only URLs are safe to render as links. */}
                                        {f.trackingNumber.startsWith('http') ? (
                                            <>
                                                <a
                                                    href={f.trackingNumber}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        display: 'inline-block',
                                                        background: '#1F3026',
                                                        color: '#F5F0E6',
                                                        padding: '13px 24px',
                                                        fontFamily: 'var(--font-mono)',
                                                        fontSize: 10,
                                                        letterSpacing: '0.32em',
                                                        textTransform: 'uppercase',
                                                        textDecoration: 'none',
                                                    }}
                                                >
                                                    {trackingButtonLabel(f.deliveryMethod)} →
                                                </a>
                                                <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#7A8278', textTransform: 'uppercase' }}>
                                                    Opens in new tab · Live updates from your driver
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{
                                                    display: 'inline-block',
                                                    background: '#fff',
                                                    border: '1px solid #1F302622',
                                                    padding: '13px 24px',
                                                    fontFamily: 'var(--font-mono)',
                                                    fontSize: 14,
                                                    letterSpacing: '0.12em',
                                                    color: '#1F3026',
                                                    userSelect: 'all',
                                                }}>
                                                    {f.trackingNumber}
                                                </div>
                                                <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#7A8278', textTransform: 'uppercase' }}>
                                                    {trackingButtonLabel(f.deliveryMethod)} — enter this code on the carrier&apos;s site
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </section>
                        );
                    }) : (
                        // Legacy order pre-fulfillment-rollout — fall back to orderItems list
                        <section style={{ background: '#fff', border: '1px solid #1F302622' }}>
                            <header style={{ padding: '20px 28px', borderBottom: '1px solid #1F302614' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>№ 01 — Items</div>
                                <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontStyle: 'italic', fontSize: 24, color: '#1F3026', margin: '4px 0 0' }}>Order contents</h2>
                            </header>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {order.orderItems.map((oi, i) => {
                                    const effective = Math.max(0, oi.quantity - oi.refundedQuantity);
                                    const removed = effective <= 0;
                                    return (
                                    <li key={oi.id} style={{ padding: '14px 28px', borderBottom: i === order.orderItems.length - 1 ? 'none' : '1px solid #1F302614', display: 'flex', justifyContent: 'space-between', gap: 16, opacity: removed ? 0.55 : 1 }}>
                                        <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 17, color: '#1F3026', textDecoration: removed ? 'line-through' : 'none' }}>
                                            {oi.product.name} <span style={{ color: '#7A8278', fontStyle: 'normal' }}>×{removed ? oi.quantity : effective}</span>
                                            {removed && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: '#A8312C', textTransform: 'uppercase', marginLeft: 10 }}>Removed · refunded</span>}
                                        </div>
                                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: '#1F3026', textDecoration: removed ? 'line-through' : 'none' }}>
                                            {fmtMoney((parseFloat(oi.unitPrice) * (removed ? oi.quantity : effective)).toFixed(2))}
                                        </div>
                                    </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}

                    {/* "Need help?" card */}
                    <section style={{ background: '#EAE2D2', border: '1px solid #1F302622', padding: 28 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>Need help?</div>
                        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16, color: '#2C3D33', margin: '8px 0 0', lineHeight: 1.55 }}>
                            Questions about this order? Email us at <a href={`mailto:hello@colchisfood.com?subject=${encodeURIComponent(`Order #${shortId}`)}`} style={{ color: '#B96A3D', textDecoration: 'none', borderBottom: '1px solid #B96A3D55' }}>hello@colchisfood.com</a> — your order number is already pre-filled.
                        </p>
                    </section>
                </div>

                {/* Right column: reorder + totals + shipping address */}
                <aside className="ch-od-aside" style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'sticky', top: 100 }}>
                    {/* Cancel CTA — only when server says the order is still in the
                        cancel window. Above Reorder because cancel is more time-sensitive. */}
                    {cancelInfo && (
                        <section style={{ background: '#fff', border: '1px solid #A8312C55', padding: '20px 28px' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#A8312C', textTransform: 'uppercase' }}>
                                Changed your mind?
                            </div>
                            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14, color: '#7A8278', margin: '6px 0 14px', lineHeight: 1.45 }}>
                                If the kitchen hasn&apos;t started yet, you can cancel for a full refund.
                            </p>
                            <CancelOrderButton orderId={cancelInfo.orderId} minutesRemaining={cancelInfo.minutesRemaining} />
                        </section>
                    )}

                    {/* Reorder CTA — only show if we received reorderItems prop */}
                    {(reorderItems.length > 0 || reorderSkippedCount > 0) && (
                        <section style={{ background: '#fff', border: '1px solid #1F302622', padding: '20px 28px' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>
                                Order again
                            </div>
                            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14, color: '#7A8278', margin: '6px 0 14px', lineHeight: 1.45 }}>
                                Drop these items back into your cart at today&apos;s prices.
                            </p>
                            <ReorderButton items={reorderItems} locale={locale} skippedCount={reorderSkippedCount} />
                        </section>
                    )}

                    <section style={{ background: '#fff', border: '1px solid #1F302622' }}>
                        <header style={{ padding: '20px 28px', borderBottom: '1px solid #1F302614' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>The reckoning</div>
                            <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontStyle: 'italic', fontSize: 22, color: '#1F3026', margin: '4px 0 0' }}>Totals</h3>
                        </header>
                        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <SumRow label="Subtotal" value={fmtMoney(order.subtotalAmount)} />
                            <SumRow label="Shipping" value={fmtMoney(order.shippingAmount)} />
                            <SumRow label="Sales tax" value={fmtMoney(order.taxAmount)} />
                            {order.tipCents > 0 && (
                                <SumRow label="Tip for your server" value={formatCurrency(order.tipCents / 100)} />
                            )}
                            {order.amendments.filter(a => a.status === 'PENDING_PAYMENT').map(a => (
                                <div key={a.id} style={{ padding: '10px 12px', background: '#EAE2D2', border: '1px solid #B96A3D44', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', color: '#8A4F2D', textTransform: 'uppercase' }}>
                                    Payment link sent — ${((a.itemsCents + a.taxCents) / 100).toFixed(2)} for added items. They appear here once paid.
                                </div>
                            ))}
                            {order.refunds.map(r => (
                                <SumRow
                                    key={r.id}
                                    label={r.reason === 'kitchen_item_removed' ? 'Refund · items removed' : 'Refund'}
                                    value={`− $${(r.amountCents / 100).toFixed(2)}`}
                                />
                            ))}
                        </div>
                        <div style={{ padding: '18px 28px', borderTop: '1px solid #1F302622', background: '#F5F0E6', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#7A8278', textTransform: 'uppercase' }}>
                                {order.refunds.length > 0 ? 'Total after refunds · USD' : 'Total · USD'}
                            </div>
                            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 32, color: '#1F3026', letterSpacing: '-0.02em', lineHeight: 1 }}>
                                {order.refunds.length > 0 && (
                                    <s style={{ fontSize: 18, color: '#7A8278', marginRight: 12 }}>{formatCurrency(parseFloat(order.totalAmount))}</s>
                                )}
                                {formatCurrency(Math.max(0, parseFloat(order.totalAmount) - order.refunds.reduce((s, r) => s + r.amountCents, 0) / 100))}
                            </div>
                        </div>
                    </section>

                    {order.shippingAddress && (
                        <section style={{ background: '#fff', border: '1px solid #1F302622', padding: '20px 28px' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>Shipping to</div>
                            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: '#1F3026', margin: '8px 0 0', lineHeight: 1.5 }}>
                                {order.shippingAddress}
                            </p>
                        </section>
                    )}
                </aside>
            </div>
        </main>
    );
}

function SumRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', color: '#7A8278', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: '#1F3026' }}>{value}</span>
        </div>
    );
}
