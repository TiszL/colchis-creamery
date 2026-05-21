'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { MapPin, Plus, Pencil, Trash2, Save, Loader2, Search, X, Power, AlertTriangle, Star, ArrowUp, ArrowDown } from 'lucide-react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import type { LocationType, DeliveryMethod, SalesChannel } from '@prisma/client';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type ChannelRow = {
    deliveryMethod: DeliveryMethod;
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
    // Phase 10 display fields — drive every public address surface
    isPrimary: boolean;
    showOnContactPage: boolean;
    displayDescription: string | null;
    displayBakeryHours: string | null;
    contactCardName: string | null;
    contactCardDoorNote: string | null;
    displayOrder: number;
    // Phase 1 — SalesChannels this location is allowed to handle. Bakery
    // defaults to [LOCAL_HOT, LOCAL_COLD]; cold warehouse to [NATIONAL_SHIP];
    // 3PL to [B2B_WHOLESALE, B2B_FROZEN]. Drives catalog visibility.
    allowsChannels: SalesChannel[];
    stockCount: number;
    fulfillmentCount: number;
    channels: ChannelRow[];
};

type Props = {
    locations: LocationRow[];
    locationTypes: LocationType[];
    fulfillmentChannels: DeliveryMethod[];
    salesChannels: SalesChannel[];
    apiKey: string;
    locale: string;
    saveAction: (fd: FormData) => Promise<void>;
    deleteAction: (fd: FormData) => Promise<void>;
    toggleActiveAction: (fd: FormData) => Promise<void>;
    setPrimaryAction: (fd: FormData) => Promise<void>;
    moveAction: (fd: FormData) => Promise<void>;
};

function salesChannelLabel(c: SalesChannel): string {
    return c.replace(/_/g, ' ');
}

// Defaults for a freshly-created location's allowsChannels, based on type.
function defaultAllowsForType(type: LocationType): SalesChannel[] {
    if (type === 'BAKERY') return ['LOCAL_HOT', 'LOCAL_COLD'];
    if (type === 'D2C_COLD_WAREHOUSE') return ['NATIONAL_SHIP'];
    if (type === 'B2B_3PL_WAREHOUSE') return ['B2B_WHOLESALE', 'B2B_FROZEN'];
    return [];
}

// Sensible default channel config for a freshly-created location, based on type.
// Empty array if the user explicitly picks no defaults.
function defaultChannelsForType(type: LocationType): Partial<Record<DeliveryMethod, Partial<ChannelRow>>> {
    if (type === 'BAKERY') {
        return {
            OWN_DELIVERY: { radiusMiles: 12, priceMultiplier: 1.0 },
            DOORDASH_DRIVE: { radiusMiles: 20, priceMultiplier: 1.0 },
            UBER_DIRECT: { radiusMiles: 20, priceMultiplier: 1.0 },
            IN_STORE_PICKUP: { radiusMiles: null, priceMultiplier: 1.0 },
            IN_STORE_DINE_IN: { radiusMiles: null, priceMultiplier: 1.0 },
        };
    }
    if (type === 'D2C_COLD_WAREHOUSE') {
        return {
            UPS_2DAY: { radiusMiles: null, maxDriveHours: 20, priceMultiplier: 1.0 },
        };
    }
    if (type === 'B2B_3PL_WAREHOUSE') {
        return {}; // B2B configured later
    }
    return {};
}

function channelLabel(c: DeliveryMethod): string {
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
    salesChannels,
    apiKey,
    saveAction,
    deleteAction,
    toggleActiveAction,
    setPrimaryAction,
    moveAction,
}: Props) {
    const [editing, setEditing] = useState<LocationRow | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    // Sub-cohort that the public /contact map + footer scan over. Used to figure
    // out whether ↑/↓ are at the top/bottom of the reorderable list.
    const displayList = locations.filter(l => l.isActive && l.showOnContactPage && !l.isPrimary);
    const displayIndex = (id: string) => displayList.findIndex(l => l.id === id);

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
        // Block + explain via info dialog when the location has dependents.
        if (loc.stockCount > 0 || loc.fulfillmentCount > 0) {
            setCannotDeleteNotice(loc);
            return;
        }
        // Otherwise stage for confirmation.
        setPendingDelete(loc);
    };

    const commitDelete = () => {
        const target = pendingDelete;
        if (!target) return;
        setPendingDelete(null);
        const fd = new FormData();
        fd.set('id', target.id);
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

    // Pending-deletion location (in-app ConfirmDialog replaces native confirm).
    const [pendingDelete, setPendingDelete] = useState<LocationRow | null>(null);
    // Non-deletable notice (replaces window.alert).
    const [cannotDeleteNotice, setCannotDeleteNotice] = useState<LocationRow | null>(null);

    const handleSetPrimary = (loc: LocationRow) => {
        if (loc.isPrimary) return;
        const fd = new FormData();
        fd.set('id', loc.id);
        startTransition(async () => {
            await setPrimaryAction(fd);
            showToast(`${loc.name} is now the primary location`);
        });
    };

    const handleMove = (loc: LocationRow, direction: 'up' | 'down') => {
        const fd = new FormData();
        fd.set('id', loc.id);
        fd.set('direction', direction);
        startTransition(async () => {
            await moveAction(fd);
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

                {locations.map(loc => {
                    const dispIdx = displayIndex(loc.id);
                    const canMoveUp = !loc.isPrimary && dispIdx > 0;
                    const canMoveDown = !loc.isPrimary && dispIdx >= 0 && dispIdx < displayList.length - 1;
                    return (
                    <div
                        key={loc.id}
                        className={`bg-[#161616] border ${loc.isPrimary ? 'border-[#B96A3D]/40' : loc.isActive ? 'border-[#ffffff0A]' : 'border-amber-900/40'} p-5 transition-colors`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                    {loc.isPrimary && <Star className="w-4 h-4 text-[#B96A3D] fill-[#B96A3D] shrink-0" aria-label="Primary location" />}
                                    <h2 className="text-white text-base font-bold truncate">{loc.name}</h2>
                                    <span className="text-[9px] bg-[#B96A3D]/20 text-[#B96A3D] px-2 py-0.5 uppercase tracking-wider">
                                        {typeLabel(loc.type)}
                                    </span>
                                    {loc.isPrimary && (
                                        <span className="text-[9px] bg-[#B96A3D] text-black px-2 py-0.5 uppercase tracking-wider font-bold">
                                            Primary
                                        </span>
                                    )}
                                    {!loc.showOnContactPage && (
                                        <span className="text-[9px] bg-gray-800 text-gray-400 px-2 py-0.5 uppercase tracking-wider" title="Hidden from /contact map">
                                            Internal
                                        </span>
                                    )}
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
                                            key={c.deliveryMethod}
                                            className="text-[10px] bg-[#0C0C0C] border border-[#ffffff0A] text-gray-400 px-2 py-1 font-mono"
                                            title={`mult ${c.priceMultiplier}× · ${c.radiusMiles !== null ? `${c.radiusMiles}mi` : c.maxDriveHours !== null ? `${c.maxDriveHours}h drive` : 'no radius'}`}
                                        >
                                            {channelLabel(c.deliveryMethod)}
                                            {c.radiusMiles !== null && <span className="text-[#B96A3D] ml-1">{c.radiusMiles}mi</span>}
                                            {c.maxDriveHours !== null && <span className="text-[#B96A3D] ml-1">{c.maxDriveHours}h</span>}
                                        </span>
                                    ))}
                                </div>

                                <div className="mt-2 text-[10px] text-gray-600">
                                    {loc.stockCount} stock rows · {loc.fulfillmentCount} fulfillments
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                {/* Promote-to-primary — flips this row's isPrimary on,
                                    flips all others off (atomic transaction on the server). */}
                                {!loc.isPrimary && loc.isActive && (
                                    <button
                                        onClick={() => handleSetPrimary(loc)}
                                        disabled={isPending}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-[#B96A3D] border border-[#B96A3D]/40 hover:bg-[#B96A3D] hover:text-black transition-colors disabled:opacity-50"
                                        title="Set as primary — flips this to the brand's main address (footer, contact, JSON-LD all update)"
                                    >
                                        <Star className="w-3 h-3" /> Set as primary
                                    </button>
                                )}
                                {/* Reorder within the non-primary display cohort */}
                                {(canMoveUp || canMoveDown) && (
                                    <div className="flex items-center">
                                        <button
                                            onClick={() => handleMove(loc, 'up')}
                                            disabled={isPending || !canMoveUp}
                                            className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title="Move up in display order"
                                        >
                                            <ArrowUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleMove(loc, 'down')}
                                            disabled={isPending || !canMoveDown}
                                            className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title="Move down in display order"
                                        >
                                            <ArrowDown className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
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
                                    disabled={isPending || loc.isPrimary}
                                    className="p-2 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={loc.isPrimary ? "Can't delete the primary location — promote another first" : "Delete (only if no stock/fulfillments)"}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                    );
                })}
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
                        salesChannels={salesChannels}
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

            {/* Delete confirmation (replaces native window.confirm). */}
            <ConfirmDialog
                open={pendingDelete !== null}
                variant="dark"
                tone="danger"
                title="Delete this location?"
                body={pendingDelete ? <>&ldquo;{pendingDelete.name}&rdquo; will be removed permanently. This cannot be undone — channel config + display fields go with it.</> : null}
                confirmLabel="Delete location"
                onConfirm={commitDelete}
                onCancel={() => setPendingDelete(null)}
            />

            {/* Non-deletable notice (replaces native window.alert). */}
            <ConfirmDialog
                open={cannotDeleteNotice !== null}
                variant="dark"
                infoOnly
                eyebrow="Cannot delete"
                title="This location has linked data"
                body={cannotDeleteNotice
                    ? <>&ldquo;{cannotDeleteNotice.name}&rdquo; has {cannotDeleteNotice.stockCount} stock rows and {cannotDeleteNotice.fulfillmentCount} order fulfillments referencing it. Deactivate it instead (Power icon) so the historical data stays intact.</>
                    : null}
                confirmLabel="Got it"
                onConfirm={() => setCannotDeleteNotice(null)}
                onCancel={() => setCannotDeleteNotice(null)}
            />
        </div>
    );
}

/* ─── Edit / Create Drawer ─────────────────────────────────────────────── */

function LocationDrawer({
    location,
    isCreating,
    locationTypes,
    fulfillmentChannels,
    salesChannels,
    apiKey,
    saveAction,
    onClose,
    onSaved,
}: {
    location: LocationRow | null;
    isCreating: boolean;
    locationTypes: LocationType[];
    fulfillmentChannels: DeliveryMethod[];
    salesChannels: SalesChannel[];
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

    // Phase 10 display-on-public-site fields. Read by the homepage Visit block,
    // the public footer, the contact-page address card + map, and JSON-LD.
    const [showOnContactPage, setShowOnContactPage] = useState(location?.showOnContactPage ?? true);
    const [displayDescription, setDisplayDescription] = useState(location?.displayDescription || '');
    const [displayBakeryHours, setDisplayBakeryHours] = useState(location?.displayBakeryHours || '');
    const [contactCardName, setContactCardName] = useState(location?.contactCardName || '');
    const [contactCardDoorNote, setContactCardDoorNote] = useState(location?.contactCardDoorNote || '');

    // Phase 1 — SalesChannel allowlist. Defaults from type on create; existing
    // value preserved on edit.
    const [allowsChannels, setAllowsChannels] = useState<SalesChannel[]>(
        location?.allowsChannels && location.allowsChannels.length > 0
            ? location.allowsChannels
            : defaultAllowsForType(location?.type || 'BAKERY')
    );
    const toggleAllowedChannel = (c: SalesChannel) => {
        setAllowsChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    };

    // Channel state: keyed by channel enum
    const [channelMap, setChannelMap] = useState<Record<string, ChannelRow & { enabled: boolean }>>(() => {
        const initial: Record<string, ChannelRow & { enabled: boolean }> = {};
        for (const ch of fulfillmentChannels) {
            const existing = location?.channels.find(c => c.deliveryMethod === ch);
            const defaults = defaultChannelsForType(type)[ch as keyof ReturnType<typeof defaultChannelsForType>];
            initial[ch] = {
                deliveryMethod: ch,
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

    const updateChannel = (ch: DeliveryMethod, patch: Partial<ChannelRow & { enabled: boolean }>) => {
        setChannelMap(prev => ({ ...prev, [ch]: { ...prev[ch], ...patch } }));
    };

    // When type changes during CREATE, re-apply defaults for un-enabled channels
    const handleTypeChange = (newType: LocationType) => {
        setType(newType);
        if (!isCreating) return; // don't auto-shuffle on existing locations
        // Reset allowsChannels to type defaults too
        setAllowsChannels(defaultAllowsForType(newType));
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
        // Phase 10 display fields
        if (showOnContactPage) fd.set('showOnContactPage', 'on');
        fd.set('displayDescription', displayDescription);
        fd.set('displayBakeryHours', displayBakeryHours);
        fd.set('contactCardName', contactCardName);
        fd.set('contactCardDoorNote', contactCardDoorNote);
        // Phase 1 — SalesChannel allowlist as multi-value field
        for (const c of allowsChannels) fd.append('allowsChannels[]', c);

        const channelsArr = Object.values(channelMap).map(c => ({
            deliveryMethod: c.deliveryMethod,
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

                {/* Sales Channels this location handles (Phase 1) */}
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Sales Channels Handled *</label>
                    <div className="flex flex-wrap gap-2">
                        {salesChannels.map(c => {
                            const active = allowsChannels.includes(c);
                            return (
                                <button key={c} type="button"
                                    onClick={() => toggleAllowedChannel(c)}
                                    className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${active
                                        ? 'bg-[#B96A3D] text-black border-[#B96A3D]'
                                        : 'bg-[#161616] text-gray-400 border-[#B96A3D22] hover:border-[#B96A3D]/50'
                                        }`}>
                                    {salesChannelLabel(c)}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[9px] text-gray-500 mt-1.5 uppercase tracking-wider">Drives which SKUs this location can carry. A bakery typically handles LOCAL_HOT + LOCAL_COLD; a cold warehouse handles NATIONAL_SHIP; a 3PL handles B2B_WHOLESALE + B2B_FROZEN.</p>
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

                {/* Display on public site — Phase 10 */}
                <div className="pt-2 border-t border-[#B96A3D22]">
                    <div className="flex items-center gap-2 mb-1">
                        <Star className="w-3.5 h-3.5 text-[#B96A3D]" />
                        <h3 className="text-white text-sm font-bold">Public site display</h3>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-4 uppercase tracking-wider leading-relaxed">
                        How this location appears on /contact, the homepage Visit block, and the footer. The PRIMARY location additionally drives the address shown sitewide.
                    </p>

                    <div className="space-y-3 bg-[#0C0C0C] border border-[#B96A3D22] p-4">
                        <label className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer">
                            <input type="checkbox" checked={showOnContactPage} onChange={e => setShowOnContactPage(e.target.checked)} className="accent-[#B96A3D] w-4 h-4" />
                            Show on public /contact page (map pin + address card)
                        </label>
                        <p className="text-[9px] text-gray-600 -mt-1.5 pl-7">
                            Uncheck for internal-only locations (e.g. fulfillment warehouses customers shouldn&apos;t see).
                        </p>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Contact-card display name</label>
                            <input value={contactCardName} onChange={e => setContactCardName(e.target.value)}
                                placeholder='e.g. "The High St Counter"'
                                className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                            <p className="text-[9px] text-gray-600 mt-1">Falls back to the location&apos;s internal name if blank. Shown big-italic above the address on /contact.</p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Door / arrival note</label>
                            <input value={contactCardDoorNote} onChange={e => setContactCardDoorNote(e.target.value)}
                                placeholder='e.g. "Door 4 · ring twice"'
                                className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Visit-block description</label>
                            <textarea value={displayDescription} onChange={e => setDisplayDescription(e.target.value)}
                                rows={2}
                                placeholder='e.g. "The bakery is open Wednesday through Sunday, 8 AM to 9 PM."'
                                className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                            <p className="text-[9px] text-gray-600 mt-1">Shown on the homepage Visit block under the address. Falls back to a generic line if blank.</p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Short hours label</label>
                            <input value={displayBakeryHours} onChange={e => setDisplayBakeryHours(e.target.value)}
                                placeholder='e.g. "Wed–Sun · 8a–9p"'
                                className="w-full bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                            <p className="text-[9px] text-gray-600 mt-1">One-line summary shown on the homepage Visit block. The detailed hours table on /contact is edited at /admin/website/contact.</p>
                        </div>

                        {location?.isPrimary && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-[#B96A3D]/10 border border-[#B96A3D]/30 text-[10px] text-[#B96A3D]">
                                <Star className="w-3 h-3 fill-[#B96A3D]" />
                                <span className="uppercase tracking-wider">This is the primary location. Its address drives the footer, hero, and JSON-LD sitewide.</span>
                            </div>
                        )}
                    </div>
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
