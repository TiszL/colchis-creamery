'use client';

import { useEffect, useRef, useState, useTransition, useCallback, useMemo } from 'react';
import { APIProvider, useMapsLibrary, Map, AdvancedMarker, Pin, type MapMouseEvent } from '@vis.gl/react-google-maps';
import { ChevronDown, MapPin, Plus, Pencil, Trash2, Check, Map as MapIcon, X } from 'lucide-react';
import { saveMyAddress, deleteMyAddress, setDefaultAddress, type UserAddressDto } from '@/app/actions/addresses';

/**
 * Address used to drive bakery availability.
 * For logged-in users, sourced from a UserAddress row.
 * For guests, sourced from localStorage.
 */
export type ActiveAddress = {
    /** UserAddress.id for logged-in users; "guest" for localStorage entry. */
    id: string;
    label: string | null;
    formatted: string;
    lat: number;
    lng: number;
    googlePlaceId: string | null;
};

const GUEST_STORAGE_KEY = 'colchis-delivery-address';

type GuestSaved = { formatted: string; lat: number; lng: number; googlePlaceId: string };

export function readGuestAddress(): GuestSaved | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && typeof parsed.formatted === 'string') {
            return parsed as GuestSaved;
        }
    } catch { /* ignore */ }
    return null;
}

function saveGuestAddress(addr: GuestSaved) {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(addr)); } catch { /* ignore */ }
}

function clearGuestAddress() {
    if (typeof window === 'undefined') return;
    try { window.localStorage.removeItem(GUEST_STORAGE_KEY); } catch { /* ignore */ }
}

function dtoToFormatted(a: UserAddressDto): string {
    const line2 = a.addressLine2 ? `, ${a.addressLine2}` : '';
    return `${a.addressLine1}${line2}, ${a.city}, ${a.state} ${a.postalCode}`;
}

function dtoToActive(a: UserAddressDto): ActiveAddress | null {
    if (a.latitude === null || a.longitude === null) return null;
    return {
        id: a.id,
        label: a.label,
        formatted: dtoToFormatted(a),
        lat: a.latitude,
        lng: a.longitude,
        googlePlaceId: a.googlePlaceId,
    };
}

/* ─── Places autocomplete (extracted) ────────────────────────────────────── */

type ParsedPlace = {
    formatted: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    lat: number;
    lng: number;
    googlePlaceId: string;
};

function PlacesAutocomplete({
    onPlace,
    placeholder,
    autoFocus,
}: {
    onPlace: (p: ParsedPlace) => void;
    placeholder?: string;
    autoFocus?: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const places = useMapsLibrary('places');
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!places || !inputRef.current) return;
        setAutocomplete(
            new places.Autocomplete(inputRef.current, {
                fields: ['geometry', 'formatted_address', 'address_components', 'place_id'],
                componentRestrictions: { country: 'us' },
                types: ['address'],
            }),
        );
    }, [places]);

    useEffect(() => {
        if (!autocomplete) return;
        const listener = autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            const lat = place.geometry?.location?.lat();
            const lng = place.geometry?.location?.lng();
            if (typeof lat !== 'number' || typeof lng !== 'number') return;

            const comps = place.address_components || [];
            const get = (type: string) => comps.find(c => c.types.includes(type))?.long_name || '';
            const getShort = (type: string) => comps.find(c => c.types.includes(type))?.short_name || '';
            const streetNumber = get('street_number');
            const route = get('route');
            const line1 = [streetNumber, route].filter(Boolean).join(' ') || place.formatted_address || '';

            onPlace({
                formatted: place.formatted_address || '',
                addressLine1: line1,
                city: get('locality') || get('postal_town') || get('sublocality') || '',
                state: getShort('administrative_area_level_1') || '',
                postalCode: get('postal_code') || '',
                country: getShort('country') || 'US',
                lat,
                lng,
                googlePlaceId: place.place_id || '',
            });
            setQuery('');
        });
        return () => listener.remove();
    }, [autocomplete, onPlace]);

    useEffect(() => {
        if (autoFocus) inputRef.current?.focus();
    }, [autoFocus]);

    return (
        <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder || 'Start typing your address…'}
            style={{
                width: '100%',
                padding: '14px 18px',
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                color: '#1F3026',
                background: '#F5F0E6',
                border: '1px solid #1F302633',
                outline: 'none',
            }}
        />
    );
}

/* ─── Map pin picker (reverse-geocodes a clicked location) ───────────────── */

/**
 * Fallback for when Places autocomplete can't find the customer's address —
 * shows a clickable map. Each click drops a pin, reverse-geocodes to address
 * components, and fires `onPlace` with the same shape Places autocomplete uses.
 *
 * Map is centered on Dublin OH (close to our bakery), zoomed mid-level so users
 * can pan to wherever they live.
 */
function MapPinPicker({
    onPlace,
    initialCenter = { lat: 40.0992, lng: -83.1141 }, // Dublin OH (near our bakery)
}: {
    onPlace: (p: ParsedPlace) => void;
    initialCenter?: { lat: number; lng: number };
}) {
    const geocodingLib = useMapsLibrary('geocoding');
    const geocoder = useMemo(
        () => (geocodingLib ? new geocodingLib.Geocoder() : null),
        [geocodingLib],
    );
    const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const handleMapClick = useCallback((ev: MapMouseEvent) => {
        const latLng = ev.detail?.latLng;
        if (!latLng) return;
        setMarker({ lat: latLng.lat, lng: latLng.lng });
        setError(null);

        if (!geocoder) {
            setError('Map not ready yet — try again in a moment.');
            return;
        }

        setBusy(true);
        geocoder.geocode({ location: latLng }, (results, status) => {
            setBusy(false);
            if (status !== 'OK' || !results || results.length === 0) {
                setError('Couldn’t identify an address at that spot. Try a clearer location.');
                return;
            }
            const place = results[0];
            const comps = place.address_components || [];
            const get = (type: string) => comps.find(c => c.types.includes(type))?.long_name || '';
            const getShort = (type: string) => comps.find(c => c.types.includes(type))?.short_name || '';
            const streetNumber = get('street_number');
            const route = get('route');
            const line1 = [streetNumber, route].filter(Boolean).join(' ') || place.formatted_address || '';
            const city = get('locality') || get('postal_town') || get('sublocality') || get('administrative_area_level_2') || '';
            const state = getShort('administrative_area_level_1') || '';
            const postalCode = get('postal_code') || ''; // optional — some rural pins miss this

            // Only city + state are strictly required for delivery routing; ZIP is best-effort.
            if (!city || !state) {
                setError('Picked spot is too vague to identify (no city/state). Try clicking closer to a building or street.');
                return;
            }

            onPlace({
                formatted: place.formatted_address || '',
                addressLine1: line1,
                city,
                state,
                postalCode,
                country: getShort('country') || 'US',
                lat: latLng.lat,
                lng: latLng.lng,
                googlePlaceId: place.place_id || '',
            });
        });
    }, [geocoder, onPlace]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#7A8278', textTransform: 'uppercase', margin: 0 }}>
                ◐ Click anywhere on the map to drop a pin — we’ll fetch the address
            </p>
            <div style={{ width: '100%', height: 360, border: '1px solid #1F302633', position: 'relative' }}>
                <Map
                    defaultCenter={initialCenter}
                    defaultZoom={11}
                    onClick={handleMapClick}
                    mapId="colchis_address_pin_picker"
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                    zoomControl={true}
                    streetViewControl={false}
                    mapTypeControl={false}
                >
                    {marker && (
                        <AdvancedMarker position={marker}>
                            <Pin background="#B96A3D" borderColor="#1F3026" glyphColor="#F5F0E6" scale={1.2} />
                        </AdvancedMarker>
                    )}
                </Map>
                {busy && (
                    <div style={{ position: 'absolute', top: 8, right: 8, background: '#F5F0E6', padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.24em', color: '#B96A3D', textTransform: 'uppercase' }}>
                        Looking up…
                    </div>
                )}
            </div>
            {error && (
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#A8312C', padding: '4px 0' }}>{error}</div>
            )}
        </div>
    );
}

/* ─── Manager ────────────────────────────────────────────────────────────── */

export default function AddressManager({
    apiKey,
    isLoggedIn,
    initialAddresses,
    activeAddress,
    onActiveAddressChange,
}: {
    apiKey: string;
    isLoggedIn: boolean;
    initialAddresses: UserAddressDto[];
    activeAddress: ActiveAddress | null;
    onActiveAddressChange: (a: ActiveAddress | null) => void;
}) {
    const [addresses, setAddresses] = useState<UserAddressDto[]>(initialAddresses);
    const [showPicker, setShowPicker] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [, startTransition] = useTransition();

    // Pending "new address" buffer (filled from Places autocomplete OR map pin)
    const [pendingPlace, setPendingPlace] = useState<ParsedPlace | null>(null);
    const [pendingLabel, setPendingLabel] = useState('');
    // Map-fallback toggle — shared across both entry points (guest + logged-in add-new)
    const [showMapPicker, setShowMapPicker] = useState(false);
    // Feedback from server (validation errors / success)
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    // Hydrate guest address from localStorage on mount (if no active address yet)
    useEffect(() => {
        if (activeAddress || isLoggedIn) return;
        const guest = readGuestAddress();
        if (guest) {
            onActiveAddressChange({
                id: 'guest',
                label: null,
                formatted: guest.formatted,
                lat: guest.lat,
                lng: guest.lng,
                googlePlaceId: guest.googlePlaceId,
            });
        }
    }, [activeAddress, isLoggedIn, onActiveAddressChange]);

    // Auto-select default address on mount for logged-in users
    useEffect(() => {
        if (!isLoggedIn || activeAddress) return;
        const def = addresses.find(a => a.isDefault) || addresses[0];
        if (def) {
            const active = dtoToActive(def);
            if (active) onActiveAddressChange(active);
        }
    }, [isLoggedIn, addresses, activeAddress, onActiveAddressChange]);

    /* ─── Handlers ───────────────────────────────────────────────────────── */

    const selectAddress = (a: UserAddressDto) => {
        const active = dtoToActive(a);
        if (active) {
            onActiveAddressChange(active);
            setShowPicker(false);
        }
    };

    const clearActive = () => {
        if (!isLoggedIn) clearGuestAddress();
        onActiveAddressChange(null);
        setShowPicker(false);
        setIsAdding(false);
        setPendingPlace(null);
        setPendingLabel('');
        setShowMapPicker(false);
    };

    const handleGuestPlace = (p: ParsedPlace) => {
        saveGuestAddress({ formatted: p.formatted, lat: p.lat, lng: p.lng, googlePlaceId: p.googlePlaceId });
        onActiveAddressChange({
            id: 'guest',
            label: null,
            formatted: p.formatted,
            lat: p.lat,
            lng: p.lng,
            googlePlaceId: p.googlePlaceId,
        });
    };

    const handleSaveLoggedIn = () => {
        if (!pendingPlace) return;
        setSaveError(null);
        setSaveSuccess(null);

        const fd = new FormData();
        fd.set('addressLine1', pendingPlace.addressLine1);
        fd.set('city', pendingPlace.city);
        fd.set('state', pendingPlace.state);
        fd.set('postalCode', pendingPlace.postalCode);
        fd.set('country', pendingPlace.country);
        fd.set('latitude', String(pendingPlace.lat));
        fd.set('longitude', String(pendingPlace.lng));
        fd.set('googlePlaceId', pendingPlace.googlePlaceId);
        if (pendingLabel.trim()) fd.set('label', pendingLabel.trim());
        if (addresses.length === 0) fd.set('isDefault', 'on');

        startTransition(async () => {
            const result = await saveMyAddress(fd);
            if (!result.ok) {
                setSaveError(result.error);
                return;
            }
            const saved = result.address;
            const next = [...addresses.filter(a => a.id !== saved.id), saved].sort((a, b) =>
                a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1,
            );
            setAddresses(next);

            // If this is the user's FIRST address, auto-select it (no point not to).
            // For subsequent adds, leave their current active selection alone so they
            // can save many addresses in a row without each one hijacking the active.
            const isFirst = addresses.length === 0;
            if (isFirst) {
                const active = dtoToActive(saved);
                if (active) onActiveAddressChange(active);
                setShowPicker(false);
            }

            setIsAdding(false);
            setPendingPlace(null);
            setPendingLabel('');
            setShowMapPicker(false);
            setSaveSuccess(saved.label ? `"${saved.label}" saved` : 'Address saved');
            setTimeout(() => setSaveSuccess(null), 2500);
        });
    };

    const handleDelete = (id: string) => {
        if (!confirm('Delete this address?')) return;
        startTransition(async () => {
            const ok = await deleteMyAddress(id);
            if (ok) {
                const next = addresses.filter(a => a.id !== id);
                setAddresses(next);
                if (activeAddress?.id === id) {
                    const fallback = next.find(a => a.isDefault) || next[0];
                    onActiveAddressChange(fallback ? dtoToActive(fallback) : null);
                }
            }
        });
    };

    const handleSetDefault = (id: string) => {
        startTransition(async () => {
            const ok = await setDefaultAddress(id);
            if (ok) {
                setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
            }
        });
    };

    /* ─── Render ─────────────────────────────────────────────────────────── */

    // Banner mode: address chosen → compact picker
    if (activeAddress && !showPicker) {
        return (
            <div style={{
                background: '#F5F0E6',
                border: '1px solid #1F302622',
                padding: '14px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                    <MapPin className="w-4 h-4" style={{ color: '#B96A3D', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#B96A3D', textTransform: 'uppercase' }}>
                            Delivering to {activeAddress.label ? `· ${activeAddress.label}` : ''}
                        </span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: '#1F3026', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {activeAddress.formatted}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {isLoggedIn && (
                        <button
                            onClick={() => setShowPicker(true)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid #1F302633', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#1F3026', textTransform: 'uppercase', cursor: 'pointer', padding: '8px 12px' }}
                        >
                            <ChevronDown className="w-3 h-3" /> Switch
                        </button>
                    )}
                    <button
                        onClick={clearActive}
                        style={{ background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#1F3026', textTransform: 'uppercase', cursor: 'pointer', padding: '8px 10px', borderBottom: '1px solid #1F302633' }}
                    >
                        Change
                    </button>
                </div>
            </div>
        );
    }

    // Picker mode (logged-in): list saved + add-new
    if (isLoggedIn && showPicker) {
        return (
            <div style={{ background: '#EAE2D2', border: '1px solid #1F302622', padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>
                        Choose a delivery address
                    </span>
                    <button onClick={() => { setShowPicker(false); setIsAdding(false); }}
                        style={{ background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#1F3026', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Cancel
                    </button>
                </div>

                {addresses.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {addresses.map(a => {
                            const isActive = activeAddress?.id === a.id;
                            const geoMissing = a.latitude === null || a.longitude === null;
                            return (
                                <div key={a.id} style={{
                                    background: '#F5F0E6',
                                    border: isActive ? '2px solid #B96A3D' : '1px solid #1F302622',
                                    padding: '14px 18px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 12,
                                }}>
                                    <button
                                        onClick={() => selectAddress(a)}
                                        disabled={geoMissing}
                                        style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: geoMissing ? 'not-allowed' : 'pointer', padding: 0, opacity: geoMissing ? 0.4 : 1 }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {a.label && (
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.22em', color: '#B96A3D', textTransform: 'uppercase' }}>
                                                    {a.label}
                                                </span>
                                            )}
                                            {a.isDefault && (
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', color: '#2C3D33', background: '#1F302610', padding: '2px 7px', textTransform: 'uppercase' }}>
                                                    Default
                                                </span>
                                            )}
                                            {geoMissing && (
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#A8312C', textTransform: 'uppercase' }}>
                                                    No coordinates
                                                </span>
                                            )}
                                            {isActive && <Check className="w-3 h-3" style={{ color: '#B96A3D' }} />}
                                        </div>
                                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#1F3026', marginTop: 4 }}>
                                            {dtoToFormatted(a)}
                                        </div>
                                    </button>
                                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                        {!a.isDefault && (
                                            <button onClick={() => handleSetDefault(a.id)} title="Set as default"
                                                style={{ background: 'transparent', border: 'none', color: '#7A8278', cursor: 'pointer', padding: 6 }}>
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(a.id)} title="Delete"
                                            style={{ background: 'transparent', border: 'none', color: '#A8312C', cursor: 'pointer', padding: 6 }}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1F3026', border: 'none', color: '#F5F0E6', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', cursor: 'pointer', padding: '12px 18px', alignSelf: 'flex-start' }}
                    >
                        <Plus className="w-3.5 h-3.5" /> Add new address
                    </button>
                )}

                {saveSuccess && (
                    <div style={{ background: '#2C3D33', color: '#F5F0E6', padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase' }}>
                        ✓ {saveSuccess}
                    </div>
                )}
                {isAdding && (
                    <APIProvider apiKey={apiKey}>
                        <div style={{ background: '#F5F0E6', border: '1px solid #1F302633', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <PlacesAutocomplete onPlace={p => { setPendingPlace(p); setShowMapPicker(false); setSaveError(null); }} autoFocus />
                            <button
                                type="button"
                                onClick={() => setShowMapPicker(s => !s)}
                                style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#B96A3D', textTransform: 'uppercase', cursor: 'pointer', padding: '2px 0', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'underline' }}
                            >
                                {showMapPicker ? <><X className="w-3 h-3" /> Hide map</> : <><MapIcon className="w-3 h-3" /> Can&apos;t find it? Drop a pin on the map</>}
                            </button>
                            {showMapPicker && (
                                <MapPinPicker
                                    onPlace={p => { setPendingPlace(p); setSaveError(null); }}
                                    initialCenter={(() => {
                                        const seed = addresses.find(a => a.latitude !== null && a.longitude !== null);
                                        return seed && seed.latitude !== null && seed.longitude !== null
                                            ? { lat: seed.latitude, lng: seed.longitude }
                                            : undefined;
                                    })()}
                                />
                            )}
                            {pendingPlace && (
                                <>
                                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#2C3D33', padding: '8px 0' }}>
                                        Selected: <strong>{pendingPlace.formatted}</strong>
                                    </div>
                                    <input
                                        value={pendingLabel}
                                        onChange={e => setPendingLabel(e.target.value)}
                                        placeholder="Label (Home, Work, Mom's…) — optional"
                                        style={{ padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: 14, color: '#1F3026', background: '#FFFFFF', border: '1px solid #1F302633', outline: 'none' }}
                                    />
                                    {saveError && (
                                        <div style={{ background: '#A8312C', color: '#F5F0E6', padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.4 }}>
                                            {saveError}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={handleSaveLoggedIn}
                                            style={{ background: '#B96A3D', border: 'none', color: '#F5F0E6', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', cursor: 'pointer', padding: '12px 22px' }}>
                                            Save address
                                        </button>
                                        <button onClick={() => { setIsAdding(false); setPendingPlace(null); setPendingLabel(''); setShowMapPicker(false); setSaveError(null); }}
                                            style={{ background: 'transparent', border: '1px solid #1F302633', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#1F3026', textTransform: 'uppercase', cursor: 'pointer', padding: '12px 18px' }}>
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </APIProvider>
                )}
            </div>
        );
    }

    // Initial entry mode — guest or logged-in user with zero addresses
    return (
        <div style={{ background: '#EAE2D2', border: '1px solid #1F302622', padding: '32px 30px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.32em', color: '#B96A3D', textTransform: 'uppercase' }}>
                    {isLoggedIn ? '№ 00 — Add your delivery address' : '№ 00 — Where should we deliver?'}
                </div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 32, lineHeight: 1.1, color: '#1F3026', margin: '12px 0 0 0', letterSpacing: '-0.02em' }}>
                    {isLoggedIn
                        ? <>Save an address to see <em style={{ color: '#B96A3D', fontWeight: 400 }}>what we can deliver</em>.</>
                        : <>Tell us your address — we&apos;ll show only <em style={{ color: '#B96A3D', fontWeight: 400 }}>what reaches you</em>.</>}
                </h3>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#2C3D33', marginTop: 10, maxWidth: 580, lineHeight: 1.5 }}>
                    Hot khachapuri within 12 mi of our Dublin OH bakery, frozen items further via DoorDash & Uber Eats. {!isLoggedIn && 'Your address stays in your browser; sign in to save multiple.'}
                </p>
            </div>
            <APIProvider apiKey={apiKey}>
                {isLoggedIn ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <PlacesAutocomplete onPlace={p => { setPendingPlace(p); setShowMapPicker(false); setSaveError(null); }} autoFocus />
                        <button
                            type="button"
                            onClick={() => setShowMapPicker(s => !s)}
                            style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#B96A3D', textTransform: 'uppercase', cursor: 'pointer', padding: '2px 0', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'underline' }}
                        >
                            {showMapPicker ? <><X className="w-3 h-3" /> Hide map</> : <><MapIcon className="w-3 h-3" /> Can&apos;t find it? Drop a pin on the map</>}
                        </button>
                        {showMapPicker && <MapPinPicker onPlace={p => { setPendingPlace(p); setSaveError(null); }} />}
                        {pendingPlace && (
                            <>
                                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#2C3D33' }}>
                                    Selected: <strong>{pendingPlace.formatted}</strong>
                                </div>
                                <input
                                    value={pendingLabel}
                                    onChange={e => setPendingLabel(e.target.value)}
                                    placeholder="Label (Home, Work…) — optional"
                                    style={{ padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: 14, color: '#1F3026', background: '#FFFFFF', border: '1px solid #1F302633', outline: 'none' }}
                                />
                                {saveError && (
                                    <div style={{ background: '#A8312C', color: '#F5F0E6', padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.4 }}>
                                        {saveError}
                                    </div>
                                )}
                                <button onClick={handleSaveLoggedIn}
                                    style={{ alignSelf: 'flex-start', background: '#B96A3D', border: 'none', color: '#F5F0E6', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', cursor: 'pointer', padding: '12px 22px' }}>
                                    Save & use address
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <PlacesAutocomplete onPlace={p => { handleGuestPlace(p); setShowMapPicker(false); }} autoFocus />
                        <button
                            type="button"
                            onClick={() => setShowMapPicker(s => !s)}
                            style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#B96A3D', textTransform: 'uppercase', cursor: 'pointer', padding: '2px 0', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'underline' }}
                        >
                            {showMapPicker ? <><X className="w-3 h-3" /> Hide map</> : <><MapIcon className="w-3 h-3" /> Can&apos;t find it? Drop a pin on the map</>}
                        </button>
                        {showMapPicker && <MapPinPicker onPlace={handleGuestPlace} />}
                    </div>
                )}
            </APIProvider>
        </div>
    );
}
