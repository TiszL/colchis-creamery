'use client';

import { useEffect, useRef, useState, useTransition, useCallback, useMemo } from 'react';
import { APIProvider, useMapsLibrary, Map, AdvancedMarker, Pin, type MapMouseEvent } from '@vis.gl/react-google-maps';
import { MapPin, Plus, Pencil, Trash2, Check, Map as MapIcon, X, Star } from 'lucide-react';
import { saveMyAddress, deleteMyAddress, setDefaultAddress, type UserAddressDto } from '@/app/actions/addresses';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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

// Phase 7b: BroadcastChannel for live cross-tab sync of the saved-address LIST
// (the storage event handles the *active* selection but not the underlying list,
// which is a server prop). Falls back silently in browsers without the API.
const ADDRESS_BROADCAST_NAME = 'colchis-address-sync';

type AddressBroadcastMessage =
    | { type: 'upsert'; dto: UserAddressDto }
    | { type: 'deleted'; id: string }
    | { type: 'setDefault'; id: string };

// Phase 7a.5: extended to persist parsed address components. Checkout needs them
// for Stripe Tax + carrier-API shipping labels. Pre-7a.5 entries (missing the new
// fields) still load cleanly — the fields are optional on the type. Server-side
// checkout validation rejects guest carts whose components didn't make it through.
type GuestSaved = {
    formatted: string;
    lat: number;
    lng: number;
    googlePlaceId: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    // Phase B: optional delivery details — carriers (DD/Uber) use these
    // as driver instructions at dispatch time.
    accessCode?: string;
    buildingName?: string;
    deliveryNotes?: string;
    // Phase 7b: shared cache for the *currently active* address. Set for both
    // guests and logged-in users so that switching the address on /shop is
    // reflected on /bakery, /cart, /checkout, etc. on next mount. For logged-in
    // users we additionally record which saved UserAddress this corresponds to.
    userAddressId?: string;
};

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

/* ─── Shared component-resolver (Phase 8.2) ──────────────────────────────── */

/** Parsed street-address components needed by checkout server actions and live
 *  carrier quotes (Uber Direct requires structured JSON; DoorDash accepts free-
 *  text but components are nicer if available). */
export type ActiveAddressComponents = {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    lat: number;
    lng: number;
    formatted: string;
    googlePlaceId?: string;
    // Phase B: optional delivery details — propagated through to Order snapshot
    // and carrier dispatch (DD dropoff_instructions, Uber dropoff_notes).
    accessCode?: string;
    buildingName?: string;
    deliveryNotes?: string;
};

/**
 * Resolve the parsed components for whatever `activeAddress` currently points at.
 *
 * Logged-in path: look up the matching `UserAddressDto` in the supplied list.
 * Guest path:     read from localStorage (AddressManager persists components
 *                 since 7a.5 + cross-page-sync since 7b).
 *
 * Returns null if components aren't recoverable (e.g. legacy guest entry without
 * components saved, or stale UserAddressDto missing lat/lng). Callers surface
 * "please re-enter your delivery address" in that case.
 */
export function getActiveAddressComponents(
    activeAddress: ActiveAddress,
    userAddresses: UserAddressDto[],
): ActiveAddressComponents | null {
    const found = userAddresses.find(a => a.id === activeAddress.id);
    if (found && found.latitude !== null && found.longitude !== null) {
        return {
            line1: found.addressLine1,
            line2: found.addressLine2 || undefined,
            city: found.city,
            state: found.state,
            postalCode: found.postalCode,
            country: found.country,
            lat: found.latitude,
            lng: found.longitude,
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
                googlePlaceId: g.googlePlaceId || undefined,
                accessCode: g.accessCode || undefined,
                buildingName: g.buildingName || undefined,
                deliveryNotes: g.deliveryNotes || undefined,
            };
        }
    }
    return null;
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
    // Phase 10: edit flow — when set, the add-form renders pre-filled with this
    // address's data; save passes the id to saveMyAddress for an update instead
    // of a create.
    const [editingId, setEditingId] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    // Keep local list in sync with fresh server props (e.g. after revalidate /
    // login / navigation between AddressManager mount points). Without this the
    // useState initializer above runs only once per mount and the picker shows
    // stale data even after the server has new rows.
    useEffect(() => {
        setAddresses(initialAddresses);
    }, [initialAddresses]);

    // Pending "new address" buffer (filled from Places autocomplete OR map pin)
    const [pendingPlace, setPendingPlace] = useState<ParsedPlace | null>(null);
    const [pendingLabel, setPendingLabel] = useState('');
    // Phase B — extended delivery-details buffer. Optional fields collected
    // alongside any new address. Carriers (DD/Uber) consume these as driver
    // dropoff_instructions / dropoff_notes at dispatch time.
    const [pendingAddressLine2, setPendingAddressLine2] = useState('');
    const [pendingAccessCode, setPendingAccessCode] = useState('');
    const [pendingBuildingName, setPendingBuildingName] = useState('');
    const [pendingDeliveryNotes, setPendingDeliveryNotes] = useState('');
    const resetPendingDetails = () => {
        setPendingLabel('');
        setPendingAddressLine2('');
        setPendingAccessCode('');
        setPendingBuildingName('');
        setPendingDeliveryNotes('');
    };

    // Begin editing an existing saved address. Pre-fills the same form the
    // add-new flow uses: the form is presented in "edit" mode and a Save call
    // passes the id through to saveMyAddress (which updates instead of creates).
    const startEdit = (a: UserAddressDto) => {
        setEditingId(a.id);
        setIsAdding(true);
        setShowPicker(true);
        setShowMapPicker(false);
        setSaveError(null);
        setSaveSuccess(null);
        // Seed pendingPlace from the existing row so the user can save without
        // having to re-pick the street. If they want to MOVE the pin, the
        // PlacesAutocomplete / map-picker buttons still work and will overwrite.
        setPendingPlace(a.latitude !== null && a.longitude !== null ? {
            formatted: dtoToFormatted(a),
            addressLine1: a.addressLine1,
            city: a.city,
            state: a.state,
            postalCode: a.postalCode,
            country: a.country,
            lat: a.latitude,
            lng: a.longitude,
            googlePlaceId: a.googlePlaceId || '',
        } : null);
        setPendingLabel(a.label || '');
        setPendingAddressLine2(a.addressLine2 || '');
        setPendingAccessCode(a.accessCode || '');
        setPendingBuildingName(a.buildingName || '');
        setPendingDeliveryNotes(a.deliveryNotes || '');
    };

    // Universal "exit the form" cleanup. Used by Cancel buttons in both add
    // and edit flows so we don't leak partial state into the next entry.
    const exitAddOrEdit = () => {
        setIsAdding(false);
        setEditingId(null);
        setPendingPlace(null);
        resetPendingDetails();
        setShowMapPicker(false);
        setSaveError(null);
    };
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

    // Auto-select address on mount for logged-in users.
    // Phase 7b: prefer the user's last-picked address (read from the shared
    // localStorage cache) so navigation between /shop, /bakery, /cart, /checkout
    // keeps the same selection. Falls back to isDefault on first visit or if the
    // stored id is stale (e.g., user deleted that address).
    useEffect(() => {
        if (!isLoggedIn || activeAddress) return;
        const stored = readGuestAddress();
        if (stored?.userAddressId) {
            const matched = addresses.find(a => a.id === stored.userAddressId);
            if (matched) {
                const active = dtoToActive(matched);
                if (active) {
                    onActiveAddressChange(active);
                    return;
                }
            }
        }
        const def = addresses.find(a => a.isDefault) || addresses[0];
        if (def) {
            const active = dtoToActive(def);
            if (active) onActiveAddressChange(active);
        }
    }, [isLoggedIn, addresses, activeAddress, onActiveAddressChange]);

    // Phase 7b: cross-tab broadcast for the saved-addresses LIST. When tab A
    // adds/edits/deletes/sets-default, tab B's AddressManager updates its local
    // list without requiring a page reload. Note: the `message` event fires on
    // OTHER tabs only — same-tab postMessage doesn't loop back (per the API),
    // so the broadcaster's own setAddresses + receivers stay in sync.
    const broadcastRef = useRef<BroadcastChannel | null>(null);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
        const channel = new BroadcastChannel(ADDRESS_BROADCAST_NAME);
        broadcastRef.current = channel;
        const handler = (e: MessageEvent<AddressBroadcastMessage>) => {
            const msg = e.data;
            switch (msg.type) {
                case 'upsert':
                    setAddresses(prev => {
                        const others = prev.filter(a => a.id !== msg.dto.id);
                        // If incoming is the new default, clear isDefault on others to mirror server constraint
                        const cleaned = msg.dto.isDefault ? others.map(a => ({ ...a, isDefault: false })) : others;
                        return [...cleaned, msg.dto].sort((a, b) =>
                            a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1,
                        );
                    });
                    break;
                case 'deleted':
                    setAddresses(prev => prev.filter(a => a.id !== msg.id));
                    break;
                case 'setDefault':
                    setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === msg.id })));
                    break;
            }
        };
        channel.addEventListener('message', handler);
        return () => {
            channel.removeEventListener('message', handler);
            channel.close();
            broadcastRef.current = null;
        };
    }, []);

    // Phase 7b: cross-tab live sync of the ACTIVE address (separate concern
    // from the list above). The `storage` event fires in tab B when tab A
    // writes to the same localStorage key. Same-tab writes don't fire (by
    // spec), so no feedback loop.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handler = (e: StorageEvent) => {
            if (e.key !== GUEST_STORAGE_KEY) return;
            const fresh = readGuestAddress();
            if (!fresh) {
                onActiveAddressChange(null);
                return;
            }
            // Prefer the matching saved-address record for logged-in users so the
            // ActiveAddress.id stays canonical (matches AddressManager's picker).
            if (isLoggedIn && fresh.userAddressId) {
                const matched = addresses.find(a => a.id === fresh.userAddressId);
                if (matched) {
                    const active = dtoToActive(matched);
                    if (active) {
                        onActiveAddressChange(active);
                        return;
                    }
                }
            }
            onActiveAddressChange({
                id: fresh.userAddressId || 'guest',
                label: null,
                formatted: fresh.formatted,
                lat: fresh.lat,
                lng: fresh.lng,
                googlePlaceId: fresh.googlePlaceId,
            });
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, [isLoggedIn, addresses, onActiveAddressChange]);

    /* ─── Handlers ───────────────────────────────────────────────────────── */

    const selectAddress = (a: UserAddressDto) => {
        const active = dtoToActive(a);
        if (active) {
            onActiveAddressChange(active);
            // Phase 7b: persist to the shared localStorage cache so other pages
            // pick up this selection on mount. Skip if lat/lng aren't available
            // (legacy UserAddress rows pre-Places-autocomplete).
            if (a.latitude !== null && a.longitude !== null) {
                saveGuestAddress({
                    formatted: dtoToFormatted(a),
                    lat: a.latitude,
                    lng: a.longitude,
                    googlePlaceId: a.googlePlaceId || '',
                    addressLine1: a.addressLine1,
                    addressLine2: a.addressLine2 || undefined,
                    city: a.city,
                    state: a.state,
                    postalCode: a.postalCode,
                    country: a.country,
                    userAddressId: a.id,
                });
            }
            setShowPicker(false);
        }
    };

    const clearActive = () => {
        // Phase 7b: clear shared cache for guests AND logged-in users so the
        // next mount falls back through hydration logic (default for logged-in).
        clearGuestAddress();
        onActiveAddressChange(null);
        setShowPicker(false);
        setIsAdding(false);
        setPendingPlace(null);
        resetPendingDetails();
        setShowMapPicker(false);
    };

    // Address pending deletion. The shared ConfirmDialog component handles the
    // modal UX (ESC / backdrop / focus / styling); we just track which row.
    const [deleteConfirm, setDeleteConfirm] = useState<UserAddressDto | null>(null);

    // Phase B: guests now also use the pendingPlace buffer so they can fill in
    // optional delivery details (apt/access/notes) before committing. The
    // explicit "Use this address" button below replaces what used to be an
    // immediate save the moment Places autocomplete returned a result.
    const handleGuestSave = () => {
        if (!pendingPlace) return;
        const p = pendingPlace;
        saveGuestAddress({
            formatted: p.formatted,
            lat: p.lat,
            lng: p.lng,
            googlePlaceId: p.googlePlaceId,
            addressLine1: p.addressLine1,
            addressLine2: pendingAddressLine2.trim() || undefined,
            city: p.city,
            state: p.state,
            postalCode: p.postalCode,
            country: p.country,
            accessCode:    pendingAccessCode.trim()    || undefined,
            buildingName:  pendingBuildingName.trim()  || undefined,
            deliveryNotes: pendingDeliveryNotes.trim() || undefined,
        });
        onActiveAddressChange({
            id: 'guest',
            label: null,
            formatted: p.formatted,
            lat: p.lat,
            lng: p.lng,
            googlePlaceId: p.googlePlaceId,
        });
        setPendingPlace(null);
        resetPendingDetails();
        setShowMapPicker(false);
    };

    // Phase B — reusable JSX for the optional delivery-detail inputs. Shown
    // below the address label in each save flow (logged-in add-new, logged-in
    // initial-add, guest). State is shared via closure.
    const renderDeliveryDetailFields = () => (
        <>
            <input
                value={pendingAddressLine2}
                onChange={e => setPendingAddressLine2(e.target.value)}
                placeholder="Apt / Suite / Unit (optional)"
                style={{ padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: 14, color: '#1F3026', background: '#FFFFFF', border: '1px solid #1F302633', outline: 'none' }}
            />
            <details style={{ background: '#F5F0E6', border: '1px solid #1F302622', padding: '10px 12px' }}>
                <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', color: '#B96A3D', textTransform: 'uppercase', userSelect: 'none' }}>
                    + Access code, building, delivery notes
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                    <input
                        value={pendingAccessCode}
                        onChange={e => setPendingAccessCode(e.target.value)}
                        placeholder="Access / gate / buzzer code"
                        style={{ padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: 14, color: '#1F3026', background: '#FFFFFF', border: '1px solid #1F302633', outline: 'none' }}
                    />
                    <input
                        value={pendingBuildingName}
                        onChange={e => setPendingBuildingName(e.target.value)}
                        placeholder="Building name"
                        style={{ padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: 14, color: '#1F3026', background: '#FFFFFF', border: '1px solid #1F302633', outline: 'none' }}
                    />
                    <textarea
                        value={pendingDeliveryNotes}
                        onChange={e => setPendingDeliveryNotes(e.target.value)}
                        placeholder='Delivery notes for the driver (e.g. "Leave at door", "Side entrance", "Ring buzzer 3x")'
                        rows={3}
                        style={{ padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: 14, color: '#1F3026', background: '#FFFFFF', border: '1px solid #1F302633', outline: 'none', resize: 'vertical' }}
                    />
                </div>
            </details>
        </>
    );

    const handleSaveLoggedIn = () => {
        if (!pendingPlace) return;
        setSaveError(null);
        setSaveSuccess(null);

        const wasEditing = editingId;
        const editingExisting = wasEditing ? addresses.find(a => a.id === wasEditing) : null;
        // Preserve isDefault on edit; otherwise auto-default the first address
        // ever saved. Server-side handler enforces single-default invariant.
        const shouldFlagDefault =
            (wasEditing && editingExisting?.isDefault === true) ||
            (!wasEditing && addresses.length === 0);

        const fd = new FormData();
        if (wasEditing) fd.set('id', wasEditing);
        fd.set('addressLine1', pendingPlace.addressLine1);
        fd.set('city', pendingPlace.city);
        fd.set('state', pendingPlace.state);
        fd.set('postalCode', pendingPlace.postalCode);
        fd.set('country', pendingPlace.country);
        fd.set('latitude', String(pendingPlace.lat));
        fd.set('longitude', String(pendingPlace.lng));
        fd.set('googlePlaceId', pendingPlace.googlePlaceId);
        if (pendingLabel.trim()) fd.set('label', pendingLabel.trim());
        if (pendingAddressLine2.trim()) fd.set('addressLine2', pendingAddressLine2.trim());
        if (pendingAccessCode.trim()) fd.set('accessCode', pendingAccessCode.trim());
        if (pendingBuildingName.trim()) fd.set('buildingName', pendingBuildingName.trim());
        if (pendingDeliveryNotes.trim()) fd.set('deliveryNotes', pendingDeliveryNotes.trim());
        if (shouldFlagDefault) fd.set('isDefault', 'on');

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
            broadcastRef.current?.postMessage({ type: 'upsert', dto: saved } satisfies AddressBroadcastMessage);

            // Auto-select rule:
            //  - First-ever address: select it (nothing else to pick).
            //  - Edit of the currently-active address: re-emit so consumers
            //    pick up the new lat/lng / formatted string immediately.
            //  - Subsequent ADD-NEW: leave current active alone so the user
            //    can add many addresses without each hijacking the selection.
            const isFirst = addresses.length === 0;
            const editingActive = wasEditing && activeAddress?.id === wasEditing;
            if (isFirst || editingActive) {
                const active = dtoToActive(saved);
                if (active) onActiveAddressChange(active);
                if (isFirst) setShowPicker(false);
            }

            setIsAdding(false);
            setEditingId(null);
            setPendingPlace(null);
            resetPendingDetails();
            setShowMapPicker(false);
            const verb = wasEditing ? 'updated' : 'saved';
            setSaveSuccess(saved.label ? `"${saved.label}" ${verb}` : `Address ${verb}`);
            setTimeout(() => setSaveSuccess(null), 2500);
        });
    };

    // Two-step delete: request opens the in-app confirm; commit performs
    // the actual deletion. Splitting them lets us style the prompt to match
    // the site instead of using `window.confirm` (native OS dialog).
    const requestDelete = (a: UserAddressDto) => {
        setDeleteConfirm(a);
    };

    const commitDelete = () => {
        const target = deleteConfirm;
        if (!target) return;
        setDeleteConfirm(null);
        startTransition(async () => {
            const ok = await deleteMyAddress(target.id);
            if (ok) {
                const next = addresses.filter(a => a.id !== target.id);
                setAddresses(next);
                broadcastRef.current?.postMessage({ type: 'deleted', id: target.id } satisfies AddressBroadcastMessage);
                if (activeAddress?.id === target.id) {
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
                broadcastRef.current?.postMessage({ type: 'setDefault', id } satisfies AddressBroadcastMessage);
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
                {/* Banner action: single button per context.
                    - Logged-in: "Switch / Add" — opens the picker where the user
                      can select another saved address OR click "Add new address".
                      Both flows live behind one affordance so we don't show two
                      buttons that ultimately go to the same panel.
                    - Guest:     "Change" — clears the localStorage entry +
                      re-shows the search form (their only entry mechanism). */}
                <button
                    onClick={() => { if (isLoggedIn) { setShowPicker(true); } else { clearActive(); } }}
                    style={{ background: 'transparent', border: '1px solid #1F302633', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#1F3026', textTransform: 'uppercase', cursor: 'pointer', padding: '8px 14px', flexShrink: 0 }}
                >
                    {isLoggedIn ? 'Switch / Add' : 'Change'}
                </button>
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
                                    {/* Per-row actions. Each has an icon AND a text label so
                                        a user can't mistake Edit for Set-default at a glance.
                                        Colors are distinct: Edit = neutral, Default = copper
                                        (brand accent / favorite), Delete = red. */}
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => startEdit(a)}
                                            title="Edit this address (label, apt, street, notes)"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid #1F302633', color: '#1F3026', cursor: 'pointer', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase' }}
                                        >
                                            <Pencil className="w-3 h-3" /> Edit
                                        </button>
                                        {!a.isDefault && (
                                            <button
                                                onClick={() => handleSetDefault(a.id)}
                                                title="Mark as your default address (auto-selected on next visit)"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid #B96A3D55', color: '#B96A3D', cursor: 'pointer', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase' }}
                                            >
                                                <Star className="w-3 h-3" /> Default
                                            </button>
                                        )}
                                        <button
                                            onClick={() => requestDelete(a)}
                                            title="Delete this saved address"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid #A8312C55', color: '#A8312C', cursor: 'pointer', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase' }}
                                        >
                                            <Trash2 className="w-3 h-3" /> Delete
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!isAdding && (
                    <button
                        onClick={() => { setEditingId(null); setPendingPlace(null); resetPendingDetails(); setIsAdding(true); setShowMapPicker(false); setSaveError(null); }}
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', color: '#B96A3D', textTransform: 'uppercase' }}>
                                    {editingId ? 'Edit address' : 'New address'}
                                </span>
                                {editingId && (
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontStyle: 'italic', color: '#7A8278' }}>
                                        Change the street below to move the pin, or just update label / apt / notes.
                                    </span>
                                )}
                            </div>
                            <PlacesAutocomplete
                                onPlace={p => { setPendingPlace(p); setShowMapPicker(false); setSaveError(null); }}
                                placeholder={editingId ? 'Type a new street to move this address…' : 'Start typing your address…'}
                                autoFocus={!editingId}
                            />
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
                                        if (pendingPlace) return { lat: pendingPlace.lat, lng: pendingPlace.lng };
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
                                        {editingId ? 'Address: ' : 'Selected: '}<strong>{pendingPlace.formatted}</strong>
                                    </div>
                                    <input
                                        value={pendingLabel}
                                        onChange={e => setPendingLabel(e.target.value)}
                                        placeholder="Label (Home, Work, Mom's…) — optional"
                                        style={{ padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: 14, color: '#1F3026', background: '#FFFFFF', border: '1px solid #1F302633', outline: 'none' }}
                                    />
                                    {renderDeliveryDetailFields()}
                                    {saveError && (
                                        <div style={{ background: '#A8312C', color: '#F5F0E6', padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.4 }}>
                                            {saveError}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={handleSaveLoggedIn}
                                            style={{ background: '#B96A3D', border: 'none', color: '#F5F0E6', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', cursor: 'pointer', padding: '12px 22px' }}>
                                            {editingId ? 'Save changes' : 'Save address'}
                                        </button>
                                        <button onClick={exitAddOrEdit}
                                            style={{ background: 'transparent', border: '1px solid #1F302633', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#1F3026', textTransform: 'uppercase', cursor: 'pointer', padding: '12px 18px' }}>
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </APIProvider>
                )}

                <ConfirmDialog
                    open={deleteConfirm !== null}
                    variant="light"
                    tone="danger"
                    eyebrow="Confirm removal"
                    title="Delete this address?"
                    body={deleteConfirm && (
                        <>
                            <div style={{ background: '#FFFFFF', border: '1px solid #1F302622', padding: '14px 16px', marginBottom: 12 }}>
                                {deleteConfirm.label && (
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#B96A3D', textTransform: 'uppercase', marginBottom: 4 }}>
                                        {deleteConfirm.label}
                                    </div>
                                )}
                                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#1F3026', lineHeight: 1.45 }}>
                                    {dtoToFormatted(deleteConfirm)}
                                </div>
                            </div>
                            <span>It will be removed from your saved addresses. Active orders that already shipped to this address are unaffected.</span>
                        </>
                    )}
                    confirmLabel="Delete address"
                    onConfirm={commitDelete}
                    onCancel={() => setDeleteConfirm(null)}
                />
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
                                {renderDeliveryDetailFields()}
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
                        <PlacesAutocomplete onPlace={p => { setPendingPlace(p); setShowMapPicker(false); }} autoFocus />
                        <button
                            type="button"
                            onClick={() => setShowMapPicker(s => !s)}
                            style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#B96A3D', textTransform: 'uppercase', cursor: 'pointer', padding: '2px 0', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'underline' }}
                        >
                            {showMapPicker ? <><X className="w-3 h-3" /> Hide map</> : <><MapIcon className="w-3 h-3" /> Can&apos;t find it? Drop a pin on the map</>}
                        </button>
                        {showMapPicker && <MapPinPicker onPlace={p => setPendingPlace(p)} />}
                        {pendingPlace && (
                            <>
                                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#2C3D33', padding: '4px 0' }}>
                                    Selected: <strong>{pendingPlace.formatted}</strong>
                                </div>
                                {renderDeliveryDetailFields()}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={handleGuestSave}
                                        style={{ background: '#1F3026', border: 'none', color: '#F5F0E6', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', cursor: 'pointer', padding: '12px 22px' }}>
                                        Use this address →
                                    </button>
                                    <button onClick={() => { setPendingPlace(null); resetPendingDetails(); setShowMapPicker(false); }}
                                        style={{ background: 'transparent', border: '1px solid #1F302633', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: '#1F3026', textTransform: 'uppercase', cursor: 'pointer', padding: '12px 18px' }}>
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </APIProvider>
        </div>
    );
}
