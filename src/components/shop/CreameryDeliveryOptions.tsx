'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { MapPin, Loader2 } from 'lucide-react';
import type { DeliveryMethod } from '@prisma/client';
import { readGuestAddress, type ActiveAddress } from '@/components/bakery/AddressManager';
import { getAvailableCreameryProducts, type CreameryAvailabilityResult } from '@/app/actions/creamery-availability';

function channelMeta(c: DeliveryMethod): { label: string; eta: string } {
    switch (c) {
        case 'UPS_2DAY':   return { label: 'UPS Ground 2-day shipping', eta: '1–2 days · cold pack' };
        case 'OWN_DELIVERY':  return { label: 'Hot delivery (own driver)',  eta: '~25 min · 12 mi radius' };
        case 'DOORDASH_DRIVE':    return { label: 'DoorDash',                   eta: '~30–45 min · local' };
        case 'UBER_DIRECT':       return { label: 'Uber Eats',                  eta: '~30–45 min · local' };
        case 'IN_STORE_PICKUP':   return { label: 'In-store pickup',            eta: '~15 min ready' };
        case 'IN_STORE_DINE_IN':  return { label: 'Dine-in at the bakery',     eta: '' };
        default:                  return { label: c.replace(/_/g, ' '), eta: '' };
    }
}

/**
 * Address-aware "How you can get it" panel for the creamery PDP.
 *
 * Mirrors the bakery PDP's delivery section: shows all configured channels for this
 * product, fades + tags ones the customer's address can't reach.
 *
 * - For logged-in users: server primes `initialAddress` from their default UserAddress.
 * - For guests: hydrates from localStorage on mount.
 */
export default function CreameryDeliveryOptions({
    productId,
    offeredChannels,
    locale,
    initialAddress,
    isLoggedIn,
}: {
    productId: string;
    offeredChannels: DeliveryMethod[];
    locale: string;
    initialAddress: ActiveAddress | null;
    isLoggedIn: boolean;
}) {
    const prefix = locale === 'en' ? '' : `/${locale}`;
    const [activeAddress, setActiveAddress] = useState<ActiveAddress | null>(initialAddress);
    const [availability, setAvailability] = useState<CreameryAvailabilityResult | null>(null);
    const [loading, setLoading] = useState(false);

    // Hydrate guest address from localStorage on mount
    useEffect(() => {
        if (activeAddress || isLoggedIn) return;
        const guest = readGuestAddress();
        if (guest) {
            setActiveAddress({
                id: 'guest',
                label: null,
                formatted: guest.formatted,
                lat: guest.lat,
                lng: guest.lng,
                googlePlaceId: guest.googlePlaceId,
            });
        }
    }, [activeAddress, isLoggedIn]);

    const fetchAvailability = useCallback(async (lat: number, lng: number) => {
        setLoading(true);
        try {
            const result = await getAvailableCreameryProducts(lat, lng);
            setAvailability(result);
        } catch (e) {
            console.error('Creamery PDP availability fetch failed:', e);
            setAvailability(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeAddress) fetchAvailability(activeAddress.lat, activeAddress.lng);
        else setAvailability(null);
    }, [activeAddress, fetchAvailability]);

    const customerMatch = availability ? availability.products.find(p => p.id === productId) || null : null;
    const customerEligibleChannels = customerMatch ? customerMatch.eligibleChannels : (availability ? [] : null);

    return (
        <section className="ch-section" style={{ background: "#EAE2D2", padding: "60px 56px", borderTop: "1px solid #1F302622" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
                    <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>
                            How you can get it
                        </div>
                        <div className="ch-h2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 36, lineHeight: 1.1, marginTop: 10, color: "#1F3026", letterSpacing: "-0.02em" }}>
                            Cold chain, <em style={{ color: "#B96A3D", fontWeight: 400 }}>to your door.</em>
                        </div>
                    </div>
                    {activeAddress && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase" }}>
                            <MapPin className="w-3 h-3" /> {activeAddress.formatted.split(',').slice(0, 2).join(',')}
                        </div>
                    )}
                </div>

                {loading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase", marginBottom: 14 }}>
                        <Loader2 className="w-3 h-3 animate-spin" /> Checking availability…
                    </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                    {offeredChannels.length === 0 && (
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "#7A8278", fontStyle: "italic" }}>
                            No delivery channels configured yet for this product.
                        </div>
                    )}
                    {offeredChannels.map(ch => {
                        const meta = channelMeta(ch);
                        const reachable = customerEligibleChannels === null
                            ? true                                   // unknown — show as configured
                            : customerEligibleChannels.includes(ch); // known — filter
                        return (
                            <div key={ch} style={{
                                background: "#F5F0E6",
                                border: "1px solid #1F302614",
                                padding: "16px 18px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                                opacity: reachable ? 1 : 0.45,
                            }}>
                                <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, color: "#1F3026", lineHeight: 1.2 }}>
                                    {meta.label}
                                </div>
                                {meta.eta && (
                                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", color: "#7A8278", textTransform: "uppercase" }}>
                                        {meta.eta}
                                    </div>
                                )}
                                {!reachable && customerEligibleChannels !== null && (
                                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "#A8312C", textTransform: "uppercase", marginTop: 2 }}>
                                        Out of range for your address
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {!activeAddress && (
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#2C3D33", marginTop: 18, lineHeight: 1.5 }}>
                        <Link href={`${prefix}/shop`} style={{ color: "#B96A3D", textDecoration: "underline" }}>Set your delivery address</Link> on the shop to see which of these reach you.
                    </p>
                )}
            </div>
        </section>
    );
}
