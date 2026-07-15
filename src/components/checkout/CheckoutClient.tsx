'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCart } from '@/providers/CartProvider';
import { formatCurrency } from '@/lib/utils';
import AddressManager, { type ActiveAddress, readGuestAddress, getActiveAddressComponents } from '@/components/bakery/AddressManager';
import type { UserAddressDto } from '@/app/actions/addresses';
import { applyFreeShippingRule, type FulfillmentPlan, type ChannelQuote } from '@/lib/shipping';
import { planFulfillment } from '@/app/actions/shipping-plan';
import { createCheckoutSession, type CheckoutInput } from '@/app/actions/checkout';
import { isValidUSPhone } from '@/lib/phone';
import { isOpenNow, nextOpenSlot } from '@/lib/location-hours';
import { BUSINESS_TIMEZONE } from '@/lib/timezone';
import type { DeliveryMethod } from '@prisma/client';

/* ─── Types ────────────────────────────────────────────────────────────── */

type LocationLite = {
    id: string;
    name: string;
    hours: Record<string, string> | null;
};

interface CheckoutClientProps {
    locale: string;
    apiKey: string;
    stripePublishableKey: string;
    isLoggedIn: boolean;
    userAddresses: UserAddressDto[];
    locations: LocationLite[];
    initialContact: { name: string; email: string; phone: string };
}

/* ─── Hours helpers ────────────────────────────────────────────────────── */
// LAUNCH FIX: this file used to carry a private copy of the hours math that
// ran on the CUSTOMER's browser clock — a shopper in another timezone saw
// wrong open/closed hints. isOpenNow/nextOpenSlot now come from the shared
// lib (imported above), which evaluates in the STORE's timezone.

function formatDateTimeShort(d: Date): string {
    return d.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        // Show the slot in STORE time — "opens Thu 7:00 AM" must mean the
        // bakery's morning, not the browser's.
        timeZone: BUSINESS_TIMEZONE,
    });
}

/* ─── Misc helpers ─────────────────────────────────────────────────────── */

function getThumbUrl(url: string): string {
    if (url && url.endsWith('.webp')) return url.replace(/\.webp$/, '-thumb.webp');
    return url;
}

function isValidEmail(s: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Resolve full parsed address components for the active address.
 * Logged-in: pull from the UserAddressDto already in props.
 * Guest:     pull from localStorage (AddressManager persists components since 7a.5).
 * Returns null if components are missing (legacy guest entry) — caller surfaces error
 * and prompts re-entry via AddressManager.
 */
function getAddressComponents(
    activeAddress: ActiveAddress,
    userAddresses: UserAddressDto[],
): CheckoutInput['address'] | null {
    const found = userAddresses.find(a => a.id === activeAddress.id);
    if (found) {
        return {
            line1: found.addressLine1,
            line2: found.addressLine2 || undefined,
            city: found.city,
            state: found.state,
            postalCode: found.postalCode,
            country: found.country,
            lat: found.latitude ?? activeAddress.lat,
            lng: found.longitude ?? activeAddress.lng,
            formatted: activeAddress.formatted,
            googlePlaceId: found.googlePlaceId || undefined,
            accessCode: found.accessCode || undefined,
            buildingName: found.buildingName || undefined,
            deliveryNotes: found.deliveryNotes || undefined,
        };
    }
    if (activeAddress.id === 'guest') {
        const g = readGuestAddress();
        if (g?.addressLine1 && g.city && g.state && g.postalCode && g.country) {
            return {
                line1: g.addressLine1,
                line2: g.addressLine2 || undefined,
                city: g.city,
                state: g.state,
                postalCode: g.postalCode,
                country: g.country,
                lat: g.lat,
                lng: g.lng,
                formatted: g.formatted,
                googlePlaceId: g.googlePlaceId,
                accessCode: g.accessCode || undefined,
                buildingName: g.buildingName || undefined,
                deliveryNotes: g.deliveryNotes || undefined,
            };
        }
    }
    return null;
}

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

/* ─── Component ────────────────────────────────────────────────────────── */

export default function CheckoutClient({
    locale,
    apiKey,
    stripePublishableKey,
    isLoggedIn,
    userAddresses,
    locations,
    initialContact,
}: CheckoutClientProps) {
    const { items, subtotal } = useCart();
    const prefix = locale === 'en' ? '' : `/${locale}`;

    const locationById = useMemo(() => {
        const m = new Map<string, LocationLite>();
        for (const l of locations) m.set(l.id, l);
        return m;
    }, [locations]);

    // Form state
    const [contact, setContact] = useState(initialContact);
    const [activeAddress, setActiveAddress] = useState<ActiveAddress | null>(null);
    const [plan, setPlan] = useState<FulfillmentPlan | null>(null);
    const [planning, setPlanning] = useState(false);
    const [selectedChannels, setSelectedChannels] = useState<Record<string, DeliveryMethod>>({});
    // Tracks which groups the user has explicitly touched, so the auto-default
    // doesn't overwrite their pick when the plan refetches.
    const touchedChannels = useRef<Set<string>>(new Set());
    const [placingOrder, setPlacingOrder] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    // Launch polish — two-step pay: "Place order" creates the PaymentIntent and
    // returns the EXACT charge (incl. tax); the customer sees that total and
    // explicitly clicks "Pay $X" before any money moves. Cleared whenever the
    // cart/address/method changes (the abandoned intent is swept by the
    // reservation cron).
    const [pendingPayment, setPendingPayment] = useState<{
        clientSecret: string;
        orderId: string;
        totals: { subtotal: string; shipping: string; tax: string; total: string };
    } | null>(null);

    const stripePromise = useMemo(() => getStripePromise(stripePublishableKey), [stripePublishableKey]);

    // Refetch plan when items or address change (same pattern as CartClient).
    const refetchPlan = useCallback(async () => {
        if (!activeAddress || items.length === 0) {
            setPlan(null);
            return;
        }
        setPlanning(true);
        try {
            const components = getActiveAddressComponents(activeAddress, userAddresses);
            const result = await planFulfillment(
                items.map(i => ({ productId: i.product.id, quantity: i.quantity })),
                activeAddress.lat,
                activeAddress.lng,
                activeAddress.formatted, // Phase 8.1: enables live DoorDash quotes
                // Phase 8.2: structured components enable live Uber Direct quotes
                components ? {
                    line1: components.line1,
                    line2: components.line2,
                    city: components.city,
                    state: components.state,
                    postalCode: components.postalCode,
                    country: components.country,
                } : undefined,
            );
            setPlan(result);
        } catch (e) {
            console.error('Checkout planFulfillment failed:', e);
            setPlan(null);
        } finally {
            setPlanning(false);
        }
    }, [activeAddress, items, userAddresses]);

    useEffect(() => { refetchPlan(); }, [refetchPlan]);

    // Default channel selection: cheapest per group (planFulfillment already sorts).
    // Don't overwrite groups the user touched.
    useEffect(() => {
        if (!plan) return;
        setSelectedChannels(prev => {
            const next: Record<string, DeliveryMethod> = { ...prev };
            for (const g of plan.groups) {
                if (!touchedChannels.current.has(g.locationId) && g.availableChannels.length > 0) {
                    next[g.locationId] = g.availableChannels[0].deliveryMethod;
                }
            }
            for (const k of Object.keys(next)) {
                if (!plan.groups.some(g => g.locationId === k)) delete next[k];
            }
            return next;
        });
    }, [plan]);

    const handleChannelChange = (locationId: string, deliveryMethod: DeliveryMethod) => {
        touchedChannels.current.add(locationId);
        setSelectedChannels(prev => ({ ...prev, [locationId]: deliveryMethod }));
    };

    const selectedQuotes = useMemo<ChannelQuote[]>(() => {
        if (!plan) return [];
        const out: ChannelQuote[] = [];
        for (const g of plan.groups) {
            const channel = selectedChannels[g.locationId];
            const q = g.availableChannels.find(c => c.deliveryMethod === channel);
            if (q) out.push(q);
        }
        return out;
    }, [plan, selectedChannels]);

    const quotesWithFreeShipping = useMemo(
        () => applyFreeShippingRule(selectedQuotes, subtotal),
        [selectedQuotes, subtotal],
    );
    const shippingTotal = quotesWithFreeShipping.reduce((s, q) => s + q.shippingCost, 0);
    const estimatedTotal = subtotal + shippingTotal;
    const hasFreeShipping = quotesWithFreeShipping.some(q => q.isFreeShipping);

    // Gating
    const contactValid =
        contact.name.trim().length > 0 &&
        isValidEmail(contact.email) &&
        isValidUSPhone(contact.phone);
    const addressValid = !!activeAddress;
    const allGroupsSelected =
        !!plan && plan.groups.length > 0 &&
        plan.groups.every(g => !!selectedChannels[g.locationId]);
    const noUndeliverable = !!plan && !plan.hasUndeliverable;
    const canPlaceOrder =
        contactValid && addressValid && allGroupsSelected && noUndeliverable && !placingOrder;

    /**
     * Phase 8.x — Stripe Elements deferred-mode flow.
     * One click does it all: validate card → reserve stock + create PaymentIntent → confirm.
     *
     * 1. elements.submit() validates the card form client-side (errors surface here).
     * 2. createCheckoutSession runs (reserves stock, computes tax, returns clientSecret).
     * 3. stripe.confirmPayment finalizes — redirects to /checkout/success on success,
     *    handles 3DS challenges, surfaces card-decline errors inline.
     */
    const handlePlaceOrder = async (
        stripe: import('@stripe/stripe-js').Stripe,
        elements: import('@stripe/stripe-js').StripeElements,
    ) => {
        if (!canPlaceOrder || !activeAddress || !plan) return;

        const addressComponents = getAddressComponents(activeAddress, userAddresses);
        if (!addressComponents) {
            setSubmitError('Please re-enter your delivery address — some fields are missing.');
            return;
        }

        setPlacingOrder(true);
        setSubmitError(null);

        try {
            // 1. Validate the card form client-side. Returns an error if user
            // hasn't filled it out properly — Stripe Elements shows inline hints.
            const { error: submitError } = await elements.submit();
            if (submitError) {
                setSubmitError(submitError.message ?? 'Please complete the card details.');
                setPlacingOrder(false);
                return;
            }

            // 2. Server-side: reserve stock, compute tax, create PaymentIntent.
            const result = await createCheckoutSession({
                items: items.map(i => ({ productId: i.product.id, quantity: i.quantity })),
                address: addressComponents,
                selectedChannels: Object.entries(selectedChannels).map(([locationId, deliveryMethod]) => ({
                    locationId,
                    deliveryMethod,
                })),
                contact,
            });
            if (!result.ok) {
                setSubmitError(result.error);
                setPlacingOrder(false);
                return;
            }

            // 3. STOP — show the exact tax-inclusive total. The customer must
            // see what they'll actually be charged and click "Pay $X" before
            // any money moves (launch polish: the old flow charged a total the
            // customer never saw).
            setPendingPayment({ clientSecret: result.clientSecret, orderId: result.orderId, totals: result.totals });
            setPlacingOrder(false);
        } catch (e) {
            console.error('handlePlaceOrder threw:', e);
            setSubmitError('Could not reach the payment server. Please try again.');
            setPlacingOrder(false);
        }
    };

    /** Step 2 of 2 — the explicit "Pay $X" click. */
    const handleConfirmPayment = async (
        stripe: import('@stripe/stripe-js').Stripe,
        elements: import('@stripe/stripe-js').StripeElements,
    ) => {
        if (!pendingPayment || placingOrder) return;
        setPlacingOrder(true);
        setSubmitError(null);
        try {
            // Revalidate the card form (the customer may have edited it while
            // reviewing the total).
            const { error: submitError } = await elements.submit();
            if (submitError) {
                setSubmitError(submitError.message ?? 'Please complete the card details.');
                setPlacingOrder(false);
                return;
            }
            const returnUrl = `${window.location.origin}${prefix}/checkout/success?order_id=${pendingPayment.orderId}`;
            const { error: confirmError } = await stripe.confirmPayment({
                elements,
                clientSecret: pendingPayment.clientSecret,
                confirmParams: { return_url: returnUrl },
            });
            if (confirmError) {
                setSubmitError(confirmError.message ?? 'Payment failed. Check your card and try again.');
                setPlacingOrder(false);
            }
            // On non-3DS success Stripe still redirects to return_url, so we
            // don't reset placingOrder there — the page unmounts.
        } catch (e) {
            console.error('handleConfirmPayment threw:', e);
            setSubmitError('Could not reach the payment server. Please try again.');
            setPlacingOrder(false);
        }
    };

    // Any change to what's being bought invalidates the quoted total. Keyed on
    // VALUES, not object identity — providers re-emit identical objects on
    // unrelated renders, which must not wipe the pending confirmation.
    const pendingInvalidationKey = useMemo(
        () =>
            JSON.stringify({
                items: items.map(i => [i.product.id, i.quantity]),
                addr: activeAddress?.formatted ?? null,
                channels: selectedChannels,
            }),
        [items, activeAddress, selectedChannels],
    );
    useEffect(() => {
        setPendingPayment(null);
    }, [pendingInvalidationKey]);

    /* ─── Empty state ────────────────────────────────────────────────── */

    if (items.length === 0) {
        return (
            <main style={{ background: '#F5F0E6', minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
                <div style={{ textAlign: 'center', maxWidth: 520 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>№ 03 — Checkout</div>
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 64, color: '#1F3026', margin: '16px 0 12px', lineHeight: 0.95, letterSpacing: '-0.02em' }}>
                        Nothing to <em style={{ color: '#B96A3D' }}>check out.</em>
                    </h1>
                    <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontStyle: 'italic', color: '#2C3D33', opacity: 0.8, marginBottom: 28 }}>
                        Your basket is empty. Add a wheel or a khachapuri first.
                    </p>
                    <Link href={`${prefix}/shop`} style={{ background: '#1F3026', color: '#F5F0E6', padding: '16px 28px', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.32em', textTransform: 'uppercase', textDecoration: 'none' }}>
                        Browse the shop →
                    </Link>
                </div>
            </main>
        );
    }

    /* ─── Main render (conditionally wrapped in <Elements>) ──────────── */

    const body = (
        <main style={{ background: '#F5F0E6', minHeight: '100vh' }}>
            {/* Banner */}
            <section className="ch-checkout-banner" style={{ background: '#1F3026', color: '#F5F0E6', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#F5F0E606 1px, transparent 1px), linear-gradient(90deg, #F5F0E606 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />
                <div className="ch-checkout-banner-inner" style={{ maxWidth: 1440, margin: '0 auto', padding: '56px 56px 36px', position: 'relative' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.32em', color: '#D9A876', textTransform: 'uppercase' }}>
                        № 03 — Checkout · {items.length} {items.length === 1 ? 'item' : 'items'}
                    </div>
                    <h1 className="ch-checkout-h1" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 76, lineHeight: 0.95, letterSpacing: '-0.03em', margin: '18px 0 0' }}>
                        The reckoning,<br /><em style={{ color: '#D9A876', fontWeight: 300 }}>finalized.</em>
                    </h1>
                </div>
            </section>

            <div className="ch-checkout-body" style={{ maxWidth: 1440, margin: '0 auto', padding: '40px 56px 96px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)', gap: 48, alignItems: 'flex-start' }}>
                {/* Form column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {/* § Contact */}
                    <SectionCard num="01" eyebrow="Contact" title="Who's ordering?">
                        <div className="ch-checkout-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <TextField label="Full name" value={contact.name} onChange={v => setContact(c => ({ ...c, name: v }))} required />
                            <TextField
                                label="Phone"
                                value={contact.phone}
                                onChange={v => setContact(c => ({ ...c, phone: v }))}
                                type="tel"
                                required
                                hint={contact.phone && !isValidUSPhone(contact.phone) ? 'Valid US phone, e.g. (614) 377-6128' : undefined}
                            />
                        </div>
                        <div style={{ marginTop: 14 }}>
                            <TextField
                                label="Email"
                                value={contact.email}
                                onChange={v => setContact(c => ({ ...c, email: v }))}
                                type="email"
                                required
                                hint={contact.email && !isValidEmail(contact.email) ? 'Enter a valid email' : undefined}
                            />
                        </div>
                        {!isLoggedIn && (
                            <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.24em', color: '#7A8278', textTransform: 'uppercase' }}>
                                ◐ Guest checkout — we&apos;ll send a confirmation email
                            </div>
                        )}
                    </SectionCard>

                    {/* § Address */}
                    <SectionCard num="02" eyebrow="Address" title="Where to?">
                        <AddressManager
                            apiKey={apiKey}
                            isLoggedIn={isLoggedIn}
                            initialAddresses={userAddresses}
                            activeAddress={activeAddress}
                            onActiveAddressChange={setActiveAddress}
                        />
                    </SectionCard>

                    {/* § Delivery method per group */}
                    <SectionCard num="03" eyebrow="Delivery" title="How should we send it?">
                        {!activeAddress && (
                            <div style={{ padding: '20px 0', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16, color: '#7A8278' }}>
                                Set a delivery address above to see your options.
                            </div>
                        )}
                        {activeAddress && planning && !plan && (
                            <div style={{ padding: '20px 0', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#7A8278', textTransform: 'uppercase' }}>
                                ● Checking delivery options…
                            </div>
                        )}
                        {activeAddress && planning && plan && (
                            <div style={{ padding: '0 0 12px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.24em', color: '#B96A3D', textTransform: 'uppercase' }}>
                                ● Updating live prices…
                            </div>
                        )}
                        {activeAddress && plan && plan.hasUndeliverable && (
                            <div style={{ padding: 14, background: '#FBEAE9', border: '1px solid #A8312C44', marginBottom: 14 }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', color: '#A8312C', textTransform: 'uppercase' }}>
                                    ⚠ Some items can&apos;t ship to this address
                                </div>
                                <ul style={{ marginTop: 8, paddingLeft: 20, fontFamily: 'var(--font-sans)', fontSize: 13, color: '#2C3D33' }}>
                                    {plan.undeliverableItems.map(u => (
                                        <li key={u.productId}>{u.productName} — {u.reason}</li>
                                    ))}
                                </ul>
                                <div style={{ marginTop: 10, fontFamily: 'var(--font-sans)', fontSize: 12, color: '#2C3D33' }}>
                                    <Link href={`${prefix}/cart`} style={{ color: '#1F3026', borderBottom: '1px solid #1F3026', textDecoration: 'none' }}>Edit cart →</Link>
                                </div>
                            </div>
                        )}
                        {activeAddress && plan && plan.groups.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {plan.groups.map((g, idx) => {
                                    const location = locationById.get(g.locationId);
                                    const hasMTO = g.items.some(i => i.isMadeToOrder);
                                    const openNow = hasMTO && location ? isOpenNow(location.hours) : true;
                                    const nextOpen = hasMTO && location && !openNow ? nextOpenSlot(location.hours) : null;
                                    return (
                                        <div key={g.locationId} style={{ background: '#EAE2D2', border: '1px solid #1F302622', padding: 20 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
                                                <div>
                                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>
                                                        Fulfillment {idx + 1} of {plan.groups.length}
                                                    </div>
                                                    <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, color: '#1F3026', marginTop: 2 }}>{g.locationName}</div>
                                                </div>
                                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#7A8278', textTransform: 'uppercase', textAlign: 'right' }}>
                                                    {g.items.map(i => `${i.productName} ×${i.quantity}`).join(' · ')}
                                                </div>
                                            </div>
                                            {hasMTO && !openNow && nextOpen && (
                                                <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff', border: '1px solid #B96A3D55', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#B96A3D', textTransform: 'uppercase' }}>
                                                    ⌛ Scheduled — bakery opens {formatDateTimeShort(nextOpen)}
                                                </div>
                                            )}
                                            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {/* Quote round produced nothing (transient carrier/DB failure) —
                                                    give the customer a visible retry instead of a silent dead-end
                                                    with a permanently disabled Place Order. */}
                                                {g.availableChannels.length === 0 && !planning && (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 14px', background: '#fff', border: '1px solid #B96A3D55' }}>
                                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#1F3026' }}>
                                                            We couldn&apos;t load delivery options for this location just now.
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => refetchPlan()}
                                                            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', background: '#1F3026', color: '#F5F0E6', border: 'none', padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                        >
                                                            Try again
                                                        </button>
                                                    </div>
                                                )}
                                                {g.availableChannels.map(quote => {
                                                    const selected = selectedChannels[g.locationId] === quote.deliveryMethod;
                                                    const eta =
                                                        quote.etaMinutes !== null ? `~${quote.etaMinutes} min`
                                                        : quote.deliveryMethod === 'UPS_2DAY' ? '1–2 days'
                                                        : '';
                                                    const priceLabel = quote.shippingCost === 0 ? 'Free' : `$${quote.shippingCost.toFixed(2)}`;
                                                    return (
                                                        <label
                                                            key={quote.deliveryMethod}
                                                            style={{
                                                                display: 'grid',
                                                                gridTemplateColumns: '20px 1fr auto',
                                                                gap: 12,
                                                                alignItems: 'center',
                                                                padding: '12px 14px',
                                                                background: selected ? '#1F3026' : '#fff',
                                                                color: selected ? '#F5F0E6' : '#1F3026',
                                                                border: `1px solid ${selected ? '#1F3026' : '#1F302633'}`,
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name={`channel-${g.locationId}`}
                                                                checked={selected}
                                                                onChange={() => handleChannelChange(g.locationId, quote.deliveryMethod)}
                                                                style={{ accentColor: '#B96A3D', cursor: 'pointer' }}
                                                            />
                                                            <div>
                                                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase' }}>
                                                                    {quote.deliveryMethod.replace(/_/g, ' ')}
                                                                </div>
                                                                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, marginTop: 2, opacity: 0.85 }}>
                                                                    {quote.carrier}{eta ? ` · ${eta}` : ''} · {quote.distanceMiles.toFixed(1)} mi
                                                                </div>
                                                            </div>
                                                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                                                                {priceLabel}
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </SectionCard>

                    {/* § Payment — Stripe Elements PaymentElement, always visible (deferred mode) */}
                    <SectionCard num="04" eyebrow="Payment" title="Card details">
                        {!stripePublishableKey ? (
                            <div style={{ padding: 28, border: '1px dashed #A8312C55', background: '#FBEAE9', textAlign: 'center' }}>
                                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#A8312C', textTransform: 'uppercase', margin: 0 }}>
                                    ⚠ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not set
                                </p>
                            </div>
                        ) : (
                            <PaymentElement options={{ layout: 'tabs' }} />
                        )}
                    </SectionCard>
                </div>

                {/* Summary column */}
                <aside style={{ position: 'sticky', top: 100 }}>
                    <div style={{ background: '#fff', border: '1px solid #1F302622' }}>
                        <div style={{ padding: '20px 28px', borderBottom: '1px solid #1F302614' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>№ 05</div>
                            <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontStyle: 'italic', fontSize: 26, color: '#1F3026', margin: '4px 0 0' }}>Your order</h3>
                        </div>

                        <div style={{ padding: '14px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {items.map(item => (
                                <div key={item.product.id} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 12, alignItems: 'center' }}>
                                    <div style={{ width: 48, height: 48, background: '#EAE2D2', border: '1px solid #1F302614', overflow: 'hidden' }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={getThumbUrl(item.product.imageUrl)} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15, color: '#1F3026', lineHeight: 1.2 }}>{item.product.name}</div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.24em', color: '#7A8278', textTransform: 'uppercase', marginTop: 2 }}>
                                            ×{item.quantity} · {formatCurrency(item.product.priceB2c)}/ea
                                        </div>
                                    </div>
                                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: '#1F3026' }}>
                                        {formatCurrency(item.product.priceB2c * item.quantity)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ padding: '14px 28px 18px', borderTop: '1px solid #1F302614', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <SumRow label="Subtotal" value={pendingPayment ? `$${pendingPayment.totals.subtotal}` : formatCurrency(subtotal)} />
                            <SumRow
                                label="Shipping"
                                value={pendingPayment ? `$${pendingPayment.totals.shipping}`
                                    : !activeAddress ? 'Add address'
                                    : selectedQuotes.length === 0 ? '—'
                                    : hasFreeShipping ? 'Free (UPS over $100)'
                                    : formatCurrency(shippingTotal)}
                                muted={!pendingPayment && (!activeAddress || selectedQuotes.length === 0)}
                            />
                            <SumRow
                                label="Sales tax"
                                value={pendingPayment ? `$${pendingPayment.totals.tax}` : 'Shown before you pay'}
                                muted={!pendingPayment}
                            />
                        </div>

                        <div style={{ padding: '18px 28px', borderTop: '1px solid #1F302622', background: '#F5F0E6', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: pendingPayment ? '#1F3026' : '#7A8278', textTransform: 'uppercase' }}>
                                    {pendingPayment ? 'Total — you will be charged' : 'Estimated total'}
                                </div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.24em', color: '#7A8278', marginTop: 4, textTransform: 'uppercase' }}>
                                    {pendingPayment ? 'USD · tax included' : 'USD · tax shown before you pay'}
                                </div>
                            </div>
                            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 40, color: '#1F3026', letterSpacing: '-0.02em', lineHeight: 1 }}>
                                {pendingPayment ? `$${pendingPayment.totals.total}` : formatCurrency(estimatedTotal)}
                            </div>
                        </div>

                        <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* Two-step pay (launch polish): "Place order" locks in the
                                exact tax-inclusive total; "Pay $X" is the explicit charge
                                confirmation. PaymentElement is mounted upfront either way. */}
                            <PlaceOrderButton
                                canPlaceOrder={pendingPayment ? true : canPlaceOrder}
                                placingOrder={placingOrder}
                                onPlaceOrder={pendingPayment ? handleConfirmPayment : handlePlaceOrder}
                                label={
                                    placingOrder ? 'Processing…'
                                    : pendingPayment ? `Pay $${pendingPayment.totals.total} →`
                                    : 'Place order →'
                                }
                            />
                            {pendingPayment && !placingOrder && (
                                <button
                                    type="button"
                                    onClick={() => setPendingPayment(null)}
                                    style={{ background: 'transparent', color: '#7A8278', border: 'none', padding: '4px 0', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer' }}
                                >
                                    ← Change something first
                                </button>
                            )}
                            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#7A8278', textAlign: 'center', lineHeight: 1.5 }}>
                                By placing your order you agree to our{' '}
                                <Link href={`${prefix}/legal/terms`} style={{ color: '#1F3026' }}>Terms</Link>,{' '}
                                <Link href={`${prefix}/legal/privacy`} style={{ color: '#1F3026' }}>Privacy Policy</Link> and{' '}
                                <Link href={`${prefix}/legal/returns`} style={{ color: '#1F3026' }}>Refund Policy</Link>.
                            </div>
                            {submitError && (
                                <div style={{ padding: 12, background: '#FFF7E6', border: '1px solid #D9A87688', fontFamily: 'var(--font-sans)', fontSize: 12.5, color: '#2C3D33', lineHeight: 1.5 }}>
                                    {submitError}
                                </div>
                            )}
                            {!canPlaceOrder && !submitError && (
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#7A8278', textTransform: 'uppercase', textAlign: 'center' }}>
                                    {!contactValid ? 'Fill in contact details'
                                        : !addressValid ? 'Set a delivery address'
                                        : !noUndeliverable ? 'Remove undeliverable items'
                                        : !allGroupsSelected ? 'Choose a delivery method for each group'
                                        : 'Ready'}
                                </div>
                            )}
                            <Link href={`${prefix}/cart`} style={{ background: 'transparent', color: '#1F3026', border: '1px solid #1F302655', padding: '12px 0', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                                ← Edit cart
                            </Link>
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    );

    // Phase 8.x — Stripe Elements deferred-payment mode. Mount once with the
    // current estimated total (in cents) and let Stripe compute the rest server-
    // side at confirm time. Stripe's minimum charge is $0.50 USD so we floor at 50.
    if (!stripePromise) {
        // No publishable key — render body raw so we still show the empty/setup
        // warning in the §04 card; can't use Stripe hooks without Elements but
        // the rest of the form still works.
        return body;
    }

    return (
        <Elements
            stripe={stripePromise}
            options={{
                mode: 'payment',
                amount: Math.max(50, Math.round(estimatedTotal * 100)),
                currency: 'usd',
                appearance: {
                    theme: 'flat',
                    variables: {
                        colorPrimary: '#1F3026',
                        colorBackground: '#F5F0E6',
                        colorText: '#1F3026',
                        colorDanger: '#A8312C',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        borderRadius: '0px',
                        spacingUnit: '4px',
                    },
                },
            }}
        >
            {body}
        </Elements>
    );
}

/* ─── Submit button ────────────────────────────────────────────────────── */
//
// Single button — uses useStripe/useElements (always available since the parent
// always wraps in <Elements> in deferred mode). Click runs:
//   elements.submit() → createCheckoutSession → stripe.confirmPayment
// in one go. PaymentElement is mounted upfront so the customer fills card details
// at the same time as everything else.

function PlaceOrderButton({
    canPlaceOrder,
    placingOrder,
    onPlaceOrder,
    label,
}: {
    canPlaceOrder: boolean;
    placingOrder: boolean;
    onPlaceOrder: (
        stripe: import('@stripe/stripe-js').Stripe,
        elements: import('@stripe/stripe-js').StripeElements,
    ) => void;
    label: string;
}) {
    const stripe = useStripe();
    const elements = useElements();

    const handleClick = () => {
        if (!stripe || !elements) return;
        onPlaceOrder(stripe, elements);
    };

    const ready = !!stripe && !!elements && canPlaceOrder;
    return (
        <button
            onClick={handleClick}
            disabled={!ready}
            style={{
                background: ready ? '#1F3026' : '#7A8278',
                color: '#F5F0E6',
                border: 'none',
                padding: '18px 0',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                cursor: ready ? 'pointer' : 'not-allowed',
                opacity: ready ? 1 : 0.7,
            }}
        >
            {label}
        </button>
    );
}

/* ─── Local presentational components ──────────────────────────────────── */

function SectionCard({ num, eyebrow, title, children }: { num: string; eyebrow: string; title: string; children: React.ReactNode }) {
    return (
        <section style={{ background: '#fff', border: '1px solid #1F302622' }}>
            <header style={{ padding: '20px 28px', borderBottom: '1px solid #1F302614' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>№ {num} — {eyebrow}</div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontStyle: 'italic', fontSize: 26, color: '#1F3026', margin: '4px 0 0' }}>{title}</h2>
            </header>
            <div style={{ padding: 28 }}>{children}</div>
        </section>
    );
}

function TextField({
    label, value, onChange, type = 'text', required, hint, disabled,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    required?: boolean;
    hint?: string;
    disabled?: boolean;
}) {
    return (
        <label style={{ display: 'block' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', color: '#7A8278', textTransform: 'uppercase', marginBottom: 6 }}>
                {label}{required ? ' *' : ''}
            </div>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                required={required}
                disabled={disabled}
                style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    color: '#1F3026',
                    background: disabled ? '#EAE2D2' : '#F5F0E6',
                    border: '1px solid #1F302633',
                    outline: 'none',
                    opacity: disabled ? 0.75 : 1,
                }}
            />
            {hint && (
                <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#A8312C', textTransform: 'uppercase' }}>
                    {hint}
                </div>
            )}
        </label>
    );
}

function SumRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', color: '#7A8278', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: muted ? '#7A8278' : '#1F3026', fontStyle: muted ? 'italic' : 'normal' }}>{value}</span>
        </div>
    );
}
