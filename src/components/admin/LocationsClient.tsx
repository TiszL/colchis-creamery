'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { MapPin, Plus, Pencil, Trash2, Save, Loader2, Search, X, Power, AlertTriangle } from 'lucide-react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import type { LocationType, FulfillmentChannel } from '@prisma/client';

type ChannelRow = {
    channel: FulfillmentChannel;
    radiusMiles: number | null;
    maxDriveHours: number | null;
    flatFee: string | null;
    perMileFee: string | null;
    priceMultiplier: number;
    isActive: boolean;
};

type LocationRow = {
    id: string;
    name: string;
    type: LocationType;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
    googlePlaceId: string | null;
    phone: string | null;
    hours: unknown;
    isActive: boolean;
    notes: string | null;
    stockCount: number;
    fulfillmentCount: number;
    channels: ChannelRow[];
};

type Props = {
    locations: LocationRow[];
    locationTypes: LocationType[];
    fulfillmentChannels: FulfillmentChannel[];
    apiKey: string;
    locale: string;
    saveAction: (fd: FormData) => Promise<void>;
    deleteAction: (fd: FormData) => Promise<void>;
    toggleActiveAction: (fd: FormData) => Promise<void>;
};

// Sensible default channel config for a freshly-created location, based on type.
// Empty array if the user explicitly picks no defaults.
function defaultChannelsForType(type: LocationType): Partial<Record<FulfillmentChannel, Partial<ChannelRow>>> {
    if (type === 'BAKERY') {
        return {
            HOT_DELIVERY_OWN: { radiusMiles: 12, priceMultiplier: 1.0 },
            DOORDASH_DRIVE: { radiusMiles: 20, priceMultiplier: 1.0 },
            UBER_DIRECT: { radiusMiles: 20, priceMultiplier: 1.0 },
            IN_STORE_PICKUP: { radiusMiles: null, priceMultiplier: 1.0 },
            IN_STORE_DINE_IN: { radiusMiles: null, priceMultiplier: 1.0 },
        };
    }
    if (type === 'D2C_COLD_WAREHOUSE') {
        return {
            UPS_GROUND_2DAY: { radiusMiles: null, maxDriveHours: 20, priceMultiplier: 1.0 },
        };
    }
    if (type === 'B2B_3PL_WAREHOUSE') {
        return {}; // B2B configured later
    }
    return {};
}

function channelLabel(c: FulfillmentChannel): string {
    return c.replace(/_/g, ' ');
}

function typeLabel(t: LocationType): string {
    if (t === 'BAKERY') return 'Bakery';
    if (t === 'D2C_COLD_WAREHOUSE') return 'D2C Cold Warehouse';
    if (t === 'B2B_3PL_WAREHOUSE') return 'B2B 3PL Warehouse';
    return t;
}

/* Google Places Autocomplete — fills full address parts + lat/lng + place_id */
function PlacesAddressInput({
    onSelect,
}: {
    onSelect: (parsed: {
        name?: string;
        addressLine1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        latitude: number;
        longitude: number;
        googlePlaceId: string;
        phone?: string;
    }) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const places = useMapsLibrary('places');
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!places || !inputRef.current) return;
        setAutocomplete(
            new places.Autocomplete(inputRef.current, {
                fields: ['name', 'geometry', 'formatted_address', 'address_components', 'place_id', 'formatted_phone_number'],
                componentRestrictions: { country: 'us' },
            })
        );
    }, [places]);

    useEffect(() => {
        if (!autocomplete) return;
        const listener = autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            const components = place.address_components || [];

            const get = (type: string) => components.find(c => c.types.includes(type))?.long_name || '';
            const getShort = (type: string) => components.find(c => c.types.includes(type))?.short_name || '';

            const streetNumber = get('street_number');
            const route = get('route');
            const addressLine1 = [streetNumber, route].filter(Boolean).join(' ') || place.formatted_address || '';

            onSelect({
                name: place.name,
                addressLine1,
                city: get('locality') || get('postal_town') || get('sublocality') || '',
                state: getShort('administrative_area_level_1'),
                postalCode: get('postal_code'),
                country: getShort('country') || 'US',
                latitude: place.geometry?.location?.lat() || 0,
                longitude: place.geometry?.location?.lng() || 0,
                googlePlaceId: place.place_id || '',
                phone: place.formatted_phone_number,
            });
            setQuery('');
        });
        return () => listener.remove();
    }, [autocomplete, onSelect]);

    return (
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-[#B96A3D]" />
            </div>
            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search Google for address — auto-fills lat/lng & place id..."
                className="w-full bg-white text-black font-medium py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#B96A3D] text-sm"
            />
        </div>
    );
}

export default function LocationsClient({
    locations,
    locationTypes,
    fulfillmentChannels,
    apiKey,
    saveAction,
    deleteAction,
    toggleActiveAction,
}: Props) {
    const [editing, setEditing] = useState<LocationRow | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const openCreate = () => {
        setEditing(null);
        setIsCreating(true);
    };

    const openEdit = (loc: LocationRow) => {
        setIsCreating(false);
        setEditing(loc);
    };

    const closeDrawer = () => {
        setIsCreating(false);
        setEditing(null);
    };

    const handleDelete = (loc: LocationRow) => {
        if (loc.stockCount > 0 || loc.fulfillmentCount > 0) {
            alert(`Cannot delete — this location has ${loc.stockCount} stock rows and ${loc.fulfillmentCount} order fulfillments. Deactivate it instead.`);
            return;
        }
        if (!confirm(`Delete "${loc.name}"? This cannot be undone.`)) return;
        const fd = new FormData();
        fd.set('id', loc.id);
        startTransition(async () => {
            await deleteAction(fd);
            showToast('Location deleted');
        });
    };

    const handleToggle = (loc: LocationRow) => {
        const fd = new FormData();
        fd.set('id', loc.id);
        fd.set('isActive', String(!loc.isActive));
        startTransition(async () => {
            await toggleActiveAction(fd);
            showToast(loc.isActive ? 'Deactivated' : 'Activated');
        });
    };

    const drawerOpen = isCreating || editing !== null;

    return (
        <div className="min-h-screen bg-[#0C0C0C] text-white">
            {/* Header */}
            <div className="border-b border-[#ffffff0A] bg-[#0F0F0F] px-6 py-5 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-[#B96A3D]" />
                    <div>
                        <h1 className="text-white text-lg font-bold">Locations</h1>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                            Bakeries · Warehouses · Fulfillment Channels
                        </p>
                    </div>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-[#B96A3D] text-black px-5 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-white transition-all"
                >
                    <Plus className="w-3.5 h-3.5" /> Add Location
                </button>
            </div>

            {toast && (
                <div className="fixed top-4 right-4 z-50 bg-emerald-900/90 border border-emerald-700 text-emerald-100 px-4 py-2.5 text-sm">
                    ✓ {toast}
                </div>
            )}

            {/* List */}
            <div className="p-6 space-y-4 max-w-5xl">
                {locations.length === 0 && (
                    <div className="text-center py-16 text-gray-600">
                        <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p>No locations yet. Add your first one.</p>
                    </div>
                )}

                {locations.map(loc => (
                    <div
                        key={loc.id}
                        className={`bg-[#161616] border ${loc.isActive ? 'border-[#ffffff0A]' : 'border-amber-900/40'} p-5 transition-colors`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                    <h2 className="text-white text-base font-bold truncate">{loc.name}</h2>
                                    <span className="text-[9px] bg-[#B96A3D]/20 text-[#B96A3D] px-2 py-0.5 uppercase tracking-wider">
                                        {typeLabel(loc.type)}
                                    </span>
                                    {!loc.isActive && (
                                        <span className="text-[9px] bg-amber-900/40 text-amber-400 px-2 py-0.5 uppercase tracking-wider">
                                            Inactive
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-400">
                                    {loc.addressLine1}{loc.addressLine2 ? `, ${loc.addressLine2}` : ''}, {loc.city}, {loc.state} {loc.postalCode}
                                </p>
                                <p className="text-[10px] text-gray-600 mt-1 font-mono">
                                    {loc.latitude !== null && loc.longitude !== null
                                        ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`
                                        : 'No coordinates — edit to geocode via Google'}
                                    {loc.googlePlaceId && ` · place: ${loc.googlePlaceId.slice(0, 20)}…`}
                                </p>

                                {/* Channels summary */}
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {loc.channels.length === 0 && (
                                        <span className="text-[10px] text-gray-600 italic">No channels configured</span>
                                    )}
                                    {loc.channels.map(c => (
                                        <span
                                            key={c.channel}
                                            className="text-[10px] bg-[#0C0C0C] border border-[#ffffff0A] text-gray-400 px-2 py-1 font-mono"
                                            title={`mult ${c.priceMultiplier}× · ${c.radiusMiles !== null ? `${c.radiusMiles}mi` : c.maxDriveHours !== null ? `${c.maxDriveHours}h drive` : 'no radius'}`}
                                        >
                                            {channelLabel(c.channel)}
                                            {c.radiusMiles !== null && <span className="text-[#B96A3D] ml-1">{c.radiusMiles}mi</span>}
                                            {c.maxDriveHours !== null && <span className="text-[#B96A3D] ml-1">{c.maxDriveHours}h</span>}
                                        </span>
                                    ))}
                                </div>

                                <div className="mt-2 text-[10px] text-gray-600">
                                    {loc.stockCount} stock rows · {loc.fulfillmentCount} fulfillments
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => handleToggle(loc)}
                                    disabled={isPending}
                                    className={`p-2 transition-colors ${loc.isActive ? 'text-gray-500 hover:text-amber-400' : 'text-amber-500 hover:text-emerald-400'}`}
                                    title={loc.isActive ? 'Deactivate' : 'Activate'}
                                >
                                    <Power className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => openEdit(loc)}
                                    className="p-2 text-gray-500 hover:text-[#B96A3D] transition-colors"
                                    title="Edit"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(loc)}
                                    disabled={isPending}
                                    className="p-2 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                                    title="Delete (only if no stock/fulfillments)"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Drawer */}
            {drawerOpen && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-40" onClick={closeDrawer} />
                    <LocationDrawer
                        location={editing}
                        isCreating={isCreating}
                        locationTypes={locationTypes}
                        fulfillmentChannels={fulfillmentChannels}
                        apiKey={apiKey}
                        saveAction={saveAction}
                        onClose={closeDrawer}
                        onSaved={() => {
                            closeDrawer();
                            showToast('Saved');
                        }}
                    />
                </>
            )}
        </div>
    );
}

/* ─── Edit / Create Drawer ─────────────────────────────────────────────── */

function LocationDrawer({
    location,
    isCreating,
    locationTypes,
    fulfillmentChannels,
    apiKey,
    saveAction,
    onClose,
    onSaved,
}: {
    location: LocationRow | null;
    isCreating: boolean;
    locationTypes: LocationType[];
    fulfillmentChannels: FulfillmentChannel[];
    apiKey: string;
    saveAction: (fd: FormData) => Promise<void>;
    onClose: () => void;
    onSaved: () => void;
}) {
    // Form state — controlled inputs so Places Autocomplete can populate them
    const [type, setType] = useState<LocationType>(location?.type || 'BAKERY');
    const [name, setName] = useState(location?.name || '');
    const [addressLine1, setAddressLine1] = useState(location?.addressLine1 || '');
    const [addressLine2, setAddressLine2] = useState(location?.addressLine2 || '');
    const [city, setCity] = useState(location?.city || '');
    const [state, setState] = useState(location?.state || '');
    const [postalCode, setPostalCode] = useState(location?.postalCode || '');
    const [country, setCountry] = useState(location?.country || 'US');
    const [latitude, setLatitude] = useState<string>(location?.latitude !== null && location?.latitude !== undefined ? String(location.latitude) : '');
    const [longitude, setLongitude] = useState<string>(location?.longitude !== null && location?.longitude !== undefined ? String(location.longitude) : '');
    const [googlePlaceId, setGooglePlaceId] = useState(location?.googlePlaceId || '');
    const [phone, setPhone] = useState(location?.phone || '');
    const [hoursJson, setHoursJson] = useState(
        location?.hours ? JSON.stringify(location.hours, null, 2) : ''
    );
    const [isActive, setIsActive] = useState(location?.isActive ?? true);
    const [notes, setNotes] = useState(location?.notes || '');

    // Channel state: keyed by channel enum
    const [channelMap, setChannelMap] = useState<Record<string, ChannelRow & { enabled: boolean }>>(() => {
        const initial: Record<string, ChannelRow & { enabled: boolean }> = {};
        for (const ch of fulfillmentChannels) {
            const existing = location?.channels.find(c => c.channel === ch);
            const defaults = defaultChannelsForType(type)[ch as keyof ReturnType<typeof defaultChannelsForType>];
            initial[ch] = {
                channel: ch,
                enabled: !!existing || (isCreating && !!defaults),
                radiusMiles: existing?.radiusMiles ?? defaults?.radiusMiles ?? null,
                maxDriveHours: existing?.maxDriveHours ?? defaults?.maxDriveHours ?? null,
                flatFee: existing?.flatFee ?? null,
                perMileFee: existing?.perMileFee ?? null,
                priceMultiplier: existing?.priceMultiplier ?? defaults?.priceMultiplier ?? 1.0,
                isActive: true,
            };
        }
        return initial;
    });

    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const updateChannel = (ch: FulfillmentChannel, patch: Partial<ChannelRow & { enabled: boolean }>) => {
        setChannelMap(prev => ({ ...prev, [ch]: { ...prev[ch], ...patch } }));
    };

    // When type changes during CREATE, re-apply defaults for un-enabled channels
    const handleTypeChange = (newType: LocationType) => {
        setType(newType);
        if (!isCreating) return; // don't auto-shuffle on existing locations
        const defaults = defaultChannelsForType(newType);
        setChannelMap(prev => {
            const next = { ...prev };
            for (const ch of fulfillmentChannels) {
                const def = defaults[ch as keyof typeof defaults];
                next[ch] = {
                    ...next[ch],
                    enabled: !!def,
                    radiusMiles: def?.radiusMiles ?? next[ch].radiusMiles,
                    maxDriveHours: def?.maxDriveHours ?? next[ch].maxDriveHours,
                    priceMultiplier: def?.priceMultiplier ?? next[ch].priceMultiplier,
                };
            }
            return next;
        });
    };

    const handlePlaceSelected = (parsed: {
        name?: string;
        addressLine1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        latitude: number;
        longitude: number;
        googlePlaceId: string;
        phone?: string;
    }) => {
        if (!name && parsed.name) setName(parsed.name);
        setAddressLine1(parsed.addressLine1);
        setCity(parsed.city);
        setState(parsed.state);
        setPostalCode(parsed.postalCode);
        setCountry(parsed.country || 'US');
        setLatitude(String(parsed.latitude));
        setLongitude(String(parsed.longitude));
        setGooglePlaceId(parsed.googlePlaceId);
        if (!phone && parsed.phone) setPhone(parsed.phone);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Minimal client-side validation
        if (!name.trim()) { setError('Name is required'); return; }
        if (!addressLine1.trim()) { setError('Address is required'); return; }
        if (!city.trim() || !state.trim() || !postalCode.trim()) { setError('City, State, ZIP are required'); return; }

        // Validate hours JSON if present
        if (hoursJson.trim()) {
            try { JSON.parse(hoursJson); }
            catch { setError('Hours JSON is invalid — fix or clear it'); return; }
        }

        const fd = new FormData();
        if (location?.id) fd.set('id', location.id);
        fd.set('type', type);
        fd.set('name', name);
        fd.set('addressLine1', addressLine1);
        fd.set('addressLine2', addressLine2);
        fd.set('city', city);
        fd.set('state', state);
        fd.set('postalCode', postalCode);
        fd.set('country', country);
        fd.set('latitude', latitude);
        fd.set('longitude', longitude);
        fd.set('googlePlaceId', googlePlaceId);
        fd.set('phone', phone);
        fd.set('hoursJson', hoursJson);
        if (isActive) fd.set('isActive', 'on');
        fd.set('notes', notes);

        const channelsArr = Object.values(channelMap).map(c => ({
            channel: c.channel,
            enabled: c.enabled,
            radiusMiles: c.radiusMiles,
            maxDriveHours: c.maxDriveHours,
            flatFee: c.flatFee,
            perMileFee: c.perMileFee,
            priceMultiplier: c.priceMultiplier,
        }));
        fd.set('channelsJson', JSON.stringify(channelsArr));

        startTransition(async () => {
            try {
                await saveAction(fd);
                onSaved();
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Save failed');
            }
        });
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="fixed top-0 right-0 h-full w-full sm:w-[640px] bg-[#0F0F0F] border-l border-[#B96A3D22] z-50 flex flex-col"
        >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#ffffff0A] flex items-center justify-between shrink-0">
                <h2 className="text-white font-bold">{isCreating ? 'Add Location' : 'Edit Location'}</h2>
                <button type="button" onClick={onClose} className="text-gray-500 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {error && (
                    <div className="flex items-start gap-2 bg-red-900/20 border border-red-900/40 text-red-300 px-3 py-2 text-xs">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Google Places Autocomplete */}
                <APIProvider apiKey={apiKey}>
                    <div className="bg-[#B96A3D]/10 p-4 border border-[#B96A3D]/20">
                        <label className="block text-[10px] font-bold text-[#B96A3D] mb-2 uppercase tracking-wider">
                            <Search className="w-3 h-3 inline mr-1" />
                            Fill from Google
                        </label>
                        <PlacesAddressInput onSelect={handlePlaceSelected} />
                        <p className="text-[9px] text-[#B96A3D]/60 mt-1.5 uppercase tracking-wider">
                            Auto-fills address, city, state, ZIP, lat/lng, place_id
                        </p>
                    </div>
                </APIProvider>

                {/* Type + Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Type *</label>
                        <select value={type} onChange={e => handleTypeChange(e.target.value as LocationType)}
                            className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-sm">
                            {locationTypes.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Name *</label>
                        <input value={name} onChange={e => setName(e.target.value)}
                            placeholder="Bakery — Dublin OH"
                            className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                    </div>
                </div>

                {/* Address */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Address Line 1 *</label>
                        <input value={addressLine1} onChange={e => setAddressLine1(e.target.value)}
                            className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Address Line 2</label>
                        <input value={addressLine2} onChange={e => setAddressLine2(e.target.value)}
                            placeholder="Suite, unit, etc."
                            className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">City *</label>
                            <input value={city} onChange={e => setCity(e.target.value)}
                                className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">State *</label>
                            <input value={state} onChange={e => setState(e.target.value)}
                                placeholder="OH"
                                className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">ZIP *</label>
                            <input value={postalCode} onChange={e => setPostalCode(e.target.value)}
                                className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                        </div>
                    </div>
                </div>

                {/* Coords / place id (read-only display) */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Latitude</label>
                        <input value={latitude} onChange={e => setLatitude(e.target.value)} readOnly
                            placeholder="—"
                            className="w-full bg-[#0C0C0C] border border-[#ffffff0A] text-gray-400 py-2 px-3 text-sm font-mono cursor-not-allowed" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Longitude</label>
                        <input value={longitude} onChange={e => setLongitude(e.target.value)} readOnly
                            placeholder="—"
                            className="w-full bg-[#0C0C0C] border border-[#ffffff0A] text-gray-400 py-2 px-3 text-sm font-mono cursor-not-allowed" />
                    </div>
                </div>
                {googlePlaceId && (
                    <div className="text-[10px] text-gray-600 font-mono break-all">
                        place_id: {googlePlaceId}
                    </div>
                )}

                {/* Phone + Active */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Phone</label>
                        <input value={phone} onChange={e => setPhone(e.target.value)}
                            className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-300 pb-2 cursor-pointer">
                        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="accent-[#B96A3D]" />
                        Active (eligible for new orders)
                    </label>
                </div>

                {/* Hours JSON */}
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                        Hours (JSON, optional)
                    </label>
                    <textarea value={hoursJson} onChange={e => setHoursJson(e.target.value)}
                        rows={5}
                        placeholder='{ "mon": "07:00-21:00", "tue": "07:00-21:00", ... }'
                        className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-xs font-mono" />
                    <p className="text-[9px] text-gray-600 mt-1">Used to gate same-day made-to-order availability. JSON only for now — UI picker coming later.</p>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                        rows={2}
                        className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                </div>

                {/* Channels */}
                <div className="pt-2 border-t border-[#ffffff0A]">
                    <h3 className="text-white text-sm font-bold mb-1">Fulfillment Channels</h3>
                    <p className="text-[10px] text-gray-500 mb-4 uppercase tracking-wider">
                        Which delivery methods does this location offer? Disabled = removed.
                    </p>
                    <div className="space-y-2">
                        {fulfillmentChannels.map(ch => {
                            const row = channelMap[ch];
                            return (
                                <div key={ch} className={`bg-[#161616] border ${row.enabled ? 'border-[#B96A3D]/30' : 'border-[#ffffff0A]'} p-3 transition-colors`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={row.enabled}
                                                onChange={e => updateChannel(ch, { enabled: e.target.checked })}
                                                className="accent-[#B96A3D]" />
                                            <span className="text-sm text-white font-mono">{channelLabel(ch)}</span>
                                        </label>
                                    </div>
                                    {row.enabled && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pl-6">
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-500 mb-0.5 uppercase tracking-wider">Radius (mi)</label>
                                                <input type="number" step="0.1" value={row.radiusMiles ?? ''}
                                                    onChange={e => updateChannel(ch, { radiusMiles: e.target.value === '' ? null : parseFloat(e.target.value) })}
                                                    placeholder="none"
                                                    className="w-full bg-[#0C0C0C] border border-[#ffffff0A] text-white py-1.5 px-2 text-xs focus:outline-none focus:border-[#B96A3D]" />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-500 mb-0.5 uppercase tracking-wider">Drive (h)</label>
                                                <input type="number" step="0.1" value={row.maxDriveHours ?? ''}
                                                    onChange={e => updateChannel(ch, { maxDriveHours: e.target.value === '' ? null : parseFloat(e.target.value) })}
                                                    placeholder="none"
                                                    className="w-full bg-[#0C0C0C] border border-[#ffffff0A] text-white py-1.5 px-2 text-xs focus:outline-none focus:border-[#B96A3D]" />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-500 mb-0.5 uppercase tracking-wider">Flat fee ($)</label>
                                                <input type="text" inputMode="decimal" value={row.flatFee ?? ''}
                                                    onChange={e => updateChannel(ch, { flatFee: e.target.value || null })}
                                                    placeholder="—"
                                                    className="w-full bg-[#0C0C0C] border border-[#ffffff0A] text-white py-1.5 px-2 text-xs focus:outline-none focus:border-[#B96A3D]" />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-500 mb-0.5 uppercase tracking-wider">Price ×</label>
                                                <input type="number" step="0.01" value={row.priceMultiplier}
                                                    onChange={e => updateChannel(ch, { priceMultiplier: parseFloat(e.target.value) || 1.0 })}
                                                    className="w-full bg-[#0C0C0C] border border-[#ffffff0A] text-white py-1.5 px-2 text-xs focus:outline-none focus:border-[#B96A3D]" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-[#ffffff0A] flex items-center justify-end gap-3 shrink-0 bg-[#0C0C0C]">
                <button type="button" onClick={onClose}
                    className="text-xs text-gray-500 hover:text-white px-4 py-2.5 uppercase tracking-wider">
                    Cancel
                </button>
                <button type="submit" disabled={isPending}
                    className="flex items-center gap-2 bg-[#B96A3D] text-black px-5 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50">
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isPending ? 'Saving…' : 'Save Location'}
                </button>
            </div>
        </form>
    );
}
