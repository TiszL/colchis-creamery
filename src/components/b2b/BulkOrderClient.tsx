'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Calculator, FileText, ChevronDown } from 'lucide-react';
import { validateB2bQty, constraintHint, unitLabelOf } from '@/lib/b2b-moq';
import { loadStripe, type Stripe as StripeJs, type StripeElementLocale } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Map site locale → Stripe Elements locale. Stripe doesn't currently support
// Georgian (ka) so we fall through to 'auto', which makes Stripe pick the
// closest match based on the browser's Accept-Language header (typically
// English for ka-GE browsers — fine fallback).
function stripeLocaleFor(siteLocale: string): StripeElementLocale {
    switch (siteLocale) {
        case 'en': return 'en';
        case 'ru': return 'ru';
        case 'es': return 'es';
        default:   return 'auto';
    }
}

interface ShopOpt { id: string; label: string; line1: string; line2: string | null; city: string; state: string; postalCode: string }

interface BulkOrderClientProps {
    products: any[];
    discount: number;
    /** Stripe publishable key — passed in from the server page so this
     *  component doesn't need NEXT_PUBLIC_* on the bundler hot path. */
    stripePublishableKey: string;
    /** Locale prefix used for the success redirect URL. */
    locale: string;
    /** Reorder: pre-filled quantities keyed by productId (from a past order). */
    initialQuantities?: Record<string, number>;
    /** Tier 2 — the partner's shops (ship-to). Picking one fills the ship-to. */
    shops?: ShopOpt[];
    /** Tier 2 — a scoped member is locked to this shop id (can't pick another). */
    lockedShopId?: string | null;
}

type PaymentMethodChoice = 'STRIPE_CARD' | 'STRIPE_ACH' | 'RESOLVE_NET_7' | 'RESOLVE_NET_15' | 'RESOLVE_NET_30' | 'RESOLVE_NET_45';

// Tier 2 — optional purchase-order metadata. Lives in the OUTER component so it
// survives the BulkOrderInner remount that happens when the payment method
// toggles between a Stripe (<Elements>-wrapped) and non-Stripe path.
interface PoDetails {
    poNumber: string;
    requestedDeliveryDate: string;
    shipLine1: string;
    shipLine2: string;
    shipCity: string;
    shipState: string;
    shipPostal: string;
    notes: string;
}
const EMPTY_PO: PoDetails = {
    poNumber: '', requestedDeliveryDate: '', shipLine1: '', shipLine2: '',
    shipCity: '', shipState: '', shipPostal: '', notes: '',
};

const PAYMENT_OPTIONS: { value: PaymentMethodChoice; label: string; hint: string }[] = [
    { value: 'RESOLVE_NET_30', label: 'Resolve · Net 30',  hint: 'Pay in 30 days · credit check' },
    { value: 'RESOLVE_NET_15', label: 'Resolve · Net 15',  hint: 'Pay in 15 days' },
    { value: 'RESOLVE_NET_7',  label: 'Resolve · Net 7',   hint: 'Pay in 7 days' },
    { value: 'RESOLVE_NET_45', label: 'Resolve · Net 45',  hint: 'Pay in 45 days · subject to credit' },
    { value: 'STRIPE_ACH',     label: 'Pay now · ACH',     hint: 'Bank transfer · 1-3 day settlement' },
    { value: 'STRIPE_CARD',    label: 'Pay now · Card',    hint: 'Card · instant settlement, higher processing fee' },
];

const isStripePath = (m: PaymentMethodChoice): boolean => m === 'STRIPE_CARD' || m === 'STRIPE_ACH';

/* ─── Stripe Elements (memoized loader) ─────────────────────────────────── */

const stripePromiseCache = new Map<string, Promise<StripeJs | null>>();
function getStripePromise(publishableKey: string): Promise<StripeJs | null> | null {
    if (!publishableKey) return null;
    let promise = stripePromiseCache.get(publishableKey);
    if (!promise) {
        promise = loadStripe(publishableKey);
        stripePromiseCache.set(publishableKey, promise);
    }
    return promise;
}

/* ─── Outer wrapper ─────────────────────────────────────────────────────── */

export default function BulkOrderClient(props: BulkOrderClientProps) {
    const { stripePublishableKey, discount, products } = props;

    // We re-mount BulkOrderInner when the cart subtotal changes so Stripe
    // Elements can recompute pricing in deferred mode (`amount` is part of
    // the <Elements> options on init).
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodChoice>('RESOLVE_NET_30');
    const [quantities, setQuantities] = useState<Record<string, number>>(props.initialQuantities ?? {});
    const [po, setPo] = useState<PoDetails>(EMPTY_PO);
    // Ship-to shop: locked shop for scoped members, else first shop, else manual ('').
    const [shopId, setShopId] = useState<string>(props.lockedShopId ?? (props.shops?.[0]?.id ?? ''));

    const availableProducts = products.filter(p => p.isActive && (p.availableQty === null || p.availableQty > 0));

    // Compute current cart total in cents — Stripe Elements deferred mode
    // wants this upfront so it can show the right "Pay $X" CTA.
    const totalCents = useMemo(() => {
        let cents = 0;
        for (const p of availableProducts) {
            const qty = quantities[p.id] || 0;
            const unit = parseFloat(p.priceB2b.replace(/[^0-9.-]+/g, "")) || 0;
            const discounted = unit * (1 - discount / 100);
            cents += Math.round(discounted * 100) * qty;
        }
        return cents;
    }, [availableProducts, quantities, discount]);

    const stripePromise = useMemo(
        () => isStripePath(paymentMethod) ? getStripePromise(stripePublishableKey) : null,
        [paymentMethod, stripePublishableKey],
    );

    const inner = (
        <BulkOrderInner
            {...props}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            quantities={quantities}
            setQuantities={setQuantities}
            po={po}
            setPo={setPo}
            shopId={shopId}
            setShopId={setShopId}
            totalCents={totalCents}
        />
    );

    // Wrap in <Elements> only when a Stripe payment path is active. The Elements
    // provider must be mounted BEFORE PaymentElement renders, so we toggle this
    // at the outer level based on the user's payment-method choice. amount > 0
    // is required by Stripe — fall back to $1 placeholder while the cart is
    // empty (we disable submit anyway).
    if (isStripePath(paymentMethod) && stripePromise) {
        return (
            <Elements
                stripe={stripePromise}
                options={{
                    mode: 'payment',
                    amount: Math.max(totalCents, 100),
                    currency: 'usd',
                    // Stripe best practice: pass site locale so PaymentElement UI
                    // (labels, error messages, 3DS prompts) matches the user's
                    // chosen language. ka maps to 'auto' (Stripe doesn't support
                    // Georgian yet — falls back to browser language).
                    locale: stripeLocaleFor(props.locale),
                    appearance: { theme: 'night', variables: { colorPrimary: '#CBA153' } },
                }}
            >
                {inner}
            </Elements>
        );
    }

    return inner;
}

/* ─── Inner component (rendered with or without <Elements>) ─────────────── */

interface InnerProps extends BulkOrderClientProps {
    paymentMethod: PaymentMethodChoice;
    setPaymentMethod: (m: PaymentMethodChoice) => void;
    quantities: Record<string, number>;
    setQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    po: PoDetails;
    setPo: React.Dispatch<React.SetStateAction<PoDetails>>;
    shopId: string;
    setShopId: (id: string) => void;
    totalCents: number;
}

function BulkOrderInner({
    products, discount, locale, shops, lockedShopId,
    paymentMethod, setPaymentMethod,
    quantities, setQuantities,
    po, setPo,
    shopId, setShopId,
    totalCents,
}: InnerProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Stripe hooks — only meaningful when paymentMethod is a STRIPE_* path
    // and we're inside an <Elements> provider. They return null otherwise.
    const stripe = useStripe();
    const elements = useElements();

    const availableProducts = products.filter(p => p.isActive && (p.availableQty === null || p.availableQty > 0));
    const prefix = locale === 'en' ? '' : `/${locale}`;

    const updPo = (k: keyof PoDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setPo(prev => ({ ...prev, [k]: e.target.value }));

    const shopList = shops ?? [];
    const selectedShop = shopList.find(s => s.id === shopId) ?? null;
    const lockedShop = lockedShopId ? (shopList.find(s => s.id === lockedShopId) ?? null) : null;

    const handleQuantityChange = (productId: string, value: string, maxStock: number) => {
        let parsed = parseInt(value, 10);
        if (isNaN(parsed) || parsed < 0) parsed = 0;
        if (parsed > maxStock) parsed = maxStock;
        setQuantities(prev => ({ ...prev, [productId]: parsed }));
    };

    const totals = useMemo(() => {
        let subtotal = 0;
        availableProducts.forEach(product => {
            const qty = quantities[product.id] || 0;
            const price = parseFloat(product.priceB2b.replace(/[^0-9.-]+/g, "")) || 0;
            subtotal += qty * price;
        });
        const discountAmount = subtotal * (discount / 100);
        const total = subtotal - discountAmount;
        return { subtotal, discountAmount, total };
    }, [availableProducts, quantities, discount]);

    // Tier 2 — per-line MOQ/case violations (advisory; server re-checks).
    const lineErrors = useMemo(() => {
        const errs: Record<string, string> = {};
        for (const p of availableProducts) {
            const qty = quantities[p.id] || 0;
            if (qty <= 0) continue;
            const e = validateB2bQty(qty, { caseSize: p.b2bCaseSize, minOrderQty: p.b2bMinOrderQty, unitLabel: p.b2bUnitLabel });
            if (e) errs[p.id] = e;
        }
        return errs;
    }, [availableProducts, quantities]);
    const hasLineErrors = Object.keys(lineErrors).length > 0;

    const isOrderEmpty = totals.total === 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isOrderEmpty) return;
        if (hasLineErrors) {
            setSubmitError('Some quantities don’t meet wholesale minimums or case sizes. Adjust the highlighted lines.');
            return;
        }

        setSubmitError(null);
        setIsSubmitting(true);

        const orderItems = Object.entries(quantities)
            .filter(([, qty]) => qty > 0)
            .map(([id, qty]) => ({ id, quantity: qty }));

        try {
            // Stripe path: validate card form client-side BEFORE we touch
            // the server. Errors from Elements render inline; we abort here.
            if (isStripePath(paymentMethod)) {
                if (!stripe || !elements) {
                    setSubmitError('Payment form is still loading. Please wait a moment and try again.');
                    setIsSubmitting(false);
                    return;
                }
                const { error: validateErr } = await elements.submit();
                if (validateErr) {
                    setSubmitError(validateErr.message ?? 'Please complete the payment details.');
                    setIsSubmitting(false);
                    return;
                }
            }

            // Server: reserve stock, create Order + Fulfillments, and (for
            // Stripe paths) create a PaymentIntent + return clientSecret.
            const response = await fetch('/api/b2b/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: orderItems,
                    paymentMethod,
                    // Tier 2 — ship to a saved shop (server snapshots its address) or,
                    // when none is picked, the manually-typed ship-to below.
                    partnerLocationId: shopId || undefined,
                    poNumber: po.poNumber || undefined,
                    notes: po.notes || undefined,
                    requestedDeliveryDate: po.requestedDeliveryDate || undefined,
                    shipTo: shopId ? undefined : {
                        line1: po.shipLine1 || undefined,
                        line2: po.shipLine2 || undefined,
                        city: po.shipCity || undefined,
                        state: po.shipState || undefined,
                        postal: po.shipPostal || undefined,
                    },
                }),
            });

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                setSubmitError(errBody.error || 'Order failed. Please try again.');
                setIsSubmitting(false);
                return;
            }

            const data = await response.json();

            // Stripe path: confirm payment with the returned clientSecret.
            // Stripe redirects to return_url on success (incl. 3DS).
            if (isStripePath(paymentMethod)) {
                if (!data.clientSecret) {
                    setSubmitError('Server did not return a payment session. Please contact sales.');
                    setIsSubmitting(false);
                    return;
                }
                if (!stripe || !elements) {
                    setSubmitError('Payment form lost its connection. Please refresh.');
                    setIsSubmitting(false);
                    return;
                }

                const returnUrl = `${window.location.origin}${prefix}/b2b-portal/order/success?order_id=${data.orderId}`;
                const { error: confirmErr } = await stripe.confirmPayment({
                    elements,
                    clientSecret: data.clientSecret,
                    confirmParams: { return_url: returnUrl },
                });
                if (confirmErr) {
                    setSubmitError(confirmErr.message ?? 'Payment failed. Check your card and try again.');
                    setIsSubmitting(false);
                }
                // On non-3DS success Stripe redirects to return_url and this
                // component unmounts — no need to reset state.
                return;
            }

            // Resolve net-terms or legacy path: redirect or refresh.
            if (data.invoicePayUrl) {
                window.location.href = data.invoicePayUrl;
                return;
            }
            router.push(`${prefix}/b2b-portal`);
            router.refresh();
        } catch (err) {
            console.error('Bulk order submit failed:', err);
            setSubmitError('Network error. Please try again.');
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Products List */}
            <div className="lg:col-span-2 space-y-4">

                {/* Tier 2 — Ship-to shop selector (partner's own locations) */}
                {(shopList.length > 0 || lockedShop) && (
                    <div className="bg-white rounded-xl shadow-sm border border-[#E8E6E1] p-4">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Ship to</label>
                        {lockedShopId ? (
                            <p className="text-sm text-[#2C2A29]">{lockedShop?.label ?? 'Your shop'} <span className="text-xs text-gray-400">(your assigned shop)</span></p>
                        ) : (
                            <select value={shopId} onChange={e => setShopId(e.target.value)}
                                className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]">
                                {shopList.map(s => <option key={s.id} value={s.id}>{s.label} — {s.city}, {s.state}</option>)}
                                <option value="">Enter address manually…</option>
                            </select>
                        )}
                        {selectedShop && (
                            <p className="text-[11px] text-gray-500 mt-1.5">
                                {selectedShop.line1}{selectedShop.line2 ? `, ${selectedShop.line2}` : ''}, {selectedShop.city}, {selectedShop.state} {selectedShop.postalCode}
                            </p>
                        )}
                    </div>
                )}

                {/* Tier 2 — Purchase-order details (optional, collapsible) */}
                <details className="bg-white rounded-xl shadow-sm border border-[#E8E6E1] overflow-hidden group">
                    <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-[#2C2A29] flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#CBA153]" /> Purchase order details
                            <span className="text-xs text-gray-400 font-normal">(optional)</span>
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition" />
                    </summary>
                    <div className="px-4 pb-4 pt-3 space-y-3 border-t border-[#E8E6E1]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">PO number</label>
                                <input value={po.poNumber} onChange={updPo('poNumber')} placeholder="e.g. PO-10482"
                                    className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Requested delivery date</label>
                                <input type="date" value={po.requestedDeliveryDate} onChange={updPo('requestedDeliveryDate')}
                                    className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]" />
                            </div>
                        </div>
                        {shopId === '' && (
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Ship-to address</label>
                                <input value={po.shipLine1} onChange={updPo('shipLine1')} placeholder="Street address"
                                    className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153] mb-2" />
                                <input value={po.shipLine2} onChange={updPo('shipLine2')} placeholder="Suite / unit (optional)"
                                    className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153] mb-2" />
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    <input value={po.shipCity} onChange={updPo('shipCity')} placeholder="City"
                                        className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]" />
                                    <input value={po.shipState} onChange={updPo('shipState')} placeholder="State"
                                        className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]" />
                                    <input value={po.shipPostal} onChange={updPo('shipPostal')} placeholder="ZIP"
                                        className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]" />
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Order notes</label>
                            <textarea value={po.notes} onChange={updPo('notes')} rows={2} placeholder="Delivery instructions, dock hours, etc."
                                className="w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153] resize-none" />
                        </div>
                    </div>
                </details>

                {availableProducts.map(product => {
                    const priceNum = parseFloat(product.priceB2b.replace(/[^0-9.-]+/g, "")) || 0;
                    const discountedPrice = priceNum * (1 - (discount / 100));
                    const hint = constraintHint({ caseSize: product.b2bCaseSize, minOrderQty: product.b2bMinOrderQty });
                    const unitLbl = unitLabelOf({ unitLabel: product.b2bUnitLabel });
                    const lineErr = lineErrors[product.id];

                    return (
                        <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-[#E8E6E1] flex flex-col sm:flex-row gap-4 sm:gap-6 sm:items-center">
                            <div className="w-full h-32 sm:w-24 sm:h-24 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="font-serif text-lg text-[#2C2A29]">{product.name}</h3>
                                <p className="text-sm text-gray-500 line-clamp-1">{product.description}</p>
                                <div className="mt-2 flex items-center gap-4 text-sm">
                                    <span className="text-gray-400 line-through">{product.priceB2b}</span>
                                    <span className="font-bold text-[#CBA153]">${discountedPrice.toFixed(2)} <span className="text-xs text-gray-400 font-normal">/ {unitLbl}</span></span>
                                </div>
                            </div>

                            <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2 sm:border-l border-t sm:border-t-0 border-[#E8E6E1] pt-3 sm:pt-0 sm:pl-6 sm:ml-auto">
                                <label className="text-xs text-gray-500 font-medium uppercase">Order Qty</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step={product.b2bCaseSize ?? undefined}
                                        max={product.availableQty ?? undefined}
                                        value={quantities[product.id] || ''}
                                        onChange={(e) => handleQuantityChange(product.id, e.target.value, product.availableQty ?? Infinity)}
                                        className={`w-20 text-right border rounded-md py-1.5 px-3 focus:ring-[#CBA153] outline-none transition ${lineErr ? 'border-red-400 focus:border-red-400' : 'border-[#E8E6E1] focus:border-[#CBA153]'}`}
                                        placeholder="0"
                                    />
                                </div>
                                {product.availableQty === null ? (
                                    <span className="text-[10px] font-medium text-[#CBA153]">Made to order</span>
                                ) : (
                                    <span className={`text-[10px] font-medium ${product.availableQty < 50 ? 'text-red-500' : 'text-green-600'}`}>
                                        {product.availableQty} in stock
                                    </span>
                                )}
                                {hint && <span className="text-[9px] text-gray-400 font-mono">{hint}</span>}
                                {lineErr && <span className="text-[10px] font-medium text-red-500 text-right">{lineErr}</span>}
                            </div>
                        </div>
                    );
                })}

                {availableProducts.length === 0 && (
                    <div className="bg-white p-12 rounded-xl text-center text-gray-500 border border-[#E8E6E1] shadow-sm">
                        No products are currently available for bulk order.
                    </div>
                )}
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
                <div className="bg-[#2C2A29] rounded-xl shadow-lg sticky top-6 overflow-hidden">
                    <div className="p-6 border-b border-gray-700">
                        <h2 className="text-xl font-serif text-white flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-[#CBA153]" />
                            Order Summary
                        </h2>
                    </div>

                    <div className="p-6 space-y-4 text-white">
                        <div className="flex justify-between text-gray-300">
                            <span>Subtotal</span>
                            <span>${totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[#CBA153]">
                            <span>Contract Discount ({discount}%)</span>
                            <span>-${totals.discountAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                            <span>Logistics & Freight</span>
                            <span className="text-xs mt-1">Calculated post-order</span>
                        </div>

                        <div className="pt-4 mt-4 border-t border-gray-700 flex justify-between items-end">
                            <div>
                                <span className="block text-sm text-gray-400">Total Estimated</span>
                                <span className="text-xs text-gray-500 line-through">${totals.subtotal.toFixed(2)}</span>
                            </div>
                            <span className="text-3xl font-serif text-white">${totals.total.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-900 border-t border-gray-800 space-y-4">
                        {/* Phase 6 (6c) — payment method choice */}
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wider">Payment method</label>
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value as PaymentMethodChoice)}
                                className="w-full bg-gray-950 border border-gray-800 text-white py-2 px-3 text-sm rounded focus:outline-none focus:border-[#CBA153]"
                                disabled={isSubmitting}
                            >
                                {PAYMENT_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-gray-500 mt-1">
                                {PAYMENT_OPTIONS.find(o => o.value === paymentMethod)?.hint}
                            </p>
                        </div>

                        {/* Phase 10: PaymentElement renders here when a Stripe path is
                            selected. It self-manages 3DS, card / ACH bank-debit toggling,
                            and inline validation messages. */}
                        {isStripePath(paymentMethod) && (
                            <div className="bg-[#0C0C0C] border border-gray-800 rounded p-4 space-y-3">
                                <PaymentElement
                                    options={{
                                        layout: 'tabs',
                                        wallets: { applePay: 'never', googlePay: 'never' },
                                    }}
                                />
                                {/* Stripe best practice: disclose the saved-payment-method
                                    intent when using setup_future_usage. Required for SCA +
                                    helps partners understand recurring-order billing. */}
                                <p className="text-[10px] text-gray-500 leading-relaxed">
                                    By submitting, you authorize Colchis Food to save this payment method
                                    and charge it for future recurring orders you set up. You can manage
                                    saved methods or cancel recurring schedules anytime from your B2B portal.
                                </p>
                            </div>
                        )}

                        {submitError && (
                            <div className="bg-red-950/30 border border-red-900/50 text-red-300 text-xs p-3 rounded">
                                {submitError}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isOrderEmpty || isSubmitting || hasLineErrors || (isStripePath(paymentMethod) && !stripe)}
                            className={`w-full py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${isOrderEmpty || isSubmitting || hasLineErrors ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-[#CBA153] hover:bg-[#b08d47] text-white shadow-md'
                                }`}
                        >
                            {isSubmitting
                                ? (isStripePath(paymentMethod) ? 'Charging…' : 'Processing…')
                                : (isStripePath(paymentMethod) ? `Pay $${totals.total.toFixed(2)}` : 'Submit Bulk Order')}
                        </button>

                        <div className="text-[10px] text-gray-500 text-center flex flex-col items-center gap-1">
                            <ShieldCheck className="w-4 h-4 text-gray-400" />
                            <span>
                                {paymentMethod.startsWith('RESOLVE_')
                                    ? 'Resolve will issue an invoice with the selected net term.'
                                    : 'Payment is processed by Stripe. Stock is reserved on submit and released if payment fails.'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

        </form>
    );
}
