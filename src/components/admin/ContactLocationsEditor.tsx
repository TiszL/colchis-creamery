'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Save, Loader2, MapPin, Search, Trash2, Plus } from 'lucide-react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';

interface Location {
    name: string;
    address: string;
    lat: string;
    lng: string;
    phone: string;
}

interface Props {
    configs: { key: string; value: string }[];
    apiKey: string;
}

const DEFAULT_LOCATIONS: Location[] = [
    { name: 'Colchis Creamery', address: 'Columbus, OH', lat: '39.9612', lng: '-82.9988', phone: '' }
];

function getVal(configs: { key: string; value: string }[], key: string, fallback = ''): string {
    return configs.find(c => c.key === key)?.value || fallback;
}

/* Google Places Autocomplete input */
function PlacesSearchInput({ onSelect }: { onSelect: (loc: Location) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const places = useMapsLibrary('places');
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!places || !inputRef.current) return;
        const opts = { fields: ['name', 'geometry', 'formatted_address', 'formatted_phone_number'] };
        setAutocomplete(new places.Autocomplete(inputRef.current, opts));
    }, [places]);

    useEffect(() => {
        if (!autocomplete) return;
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            onSelect({
                name: place.name || '',
                address: place.formatted_address || '',
                lat: place.geometry?.location?.lat().toString() || '',
                lng: place.geometry?.location?.lng().toString() || '',
                phone: place.formatted_phone_number || '',
            });
            setQuery('');
        });
    }, [autocomplete, onSelect]);

    return (
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-[#CBA153]" />
            </div>
            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search for your business on Google..."
                className="w-full bg-white text-black font-medium py-3 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CBA153] shadow-inner text-sm"
            />
        </div>
    );
}

export default function ContactLocationsEditor({ configs, apiKey }: Props) {
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);

    // Parse existing locations from SiteConfig
    const [locations, setLocations] = useState<Location[]>(() => {
        const raw = getVal(configs, 'contact.locations');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch { /* use defaults */ }
        }
        // Backwards compat: read old mapLat/mapLng format
        const oldLat = getVal(configs, 'contact.mapLat');
        const oldLng = getVal(configs, 'contact.mapLng');
        const oldAddress = getVal(configs, 'contact.address', 'Columbus, OH');
        if (oldLat && oldLng) {
            return [{ name: 'Colchis Creamery', address: oldAddress, lat: oldLat, lng: oldLng, phone: '' }];
        }
        return DEFAULT_LOCATIONS;
    });

    function addLocation(loc: Location) {
        setLocations(prev => [...prev, loc]);
    }

    function removeLocation(idx: number) {
        setLocations(prev => prev.filter((_, i) => i !== idx));
    }

    function updateLocation(idx: number, field: keyof Location, value: string) {
        setLocations(prev => prev.map((loc, i) => i === idx ? { ...loc, [field]: value } : loc));
    }

    async function handleSave() {
        startTransition(async () => {
            // Save locations as JSON array + sync the first location to legacy keys for backward compat
            const primary = locations[0];
            const entries = [
                { key: 'contact.locations', value: JSON.stringify(locations) },
                { key: 'contact.mapLat', value: primary?.lat || '39.9612' },
                { key: 'contact.mapLng', value: primary?.lng || '-82.9988' },
                { key: 'contact.address', value: primary?.address || 'Columbus, OH' },
            ];
            const fd = new FormData();
            fd.set('entries', JSON.stringify(entries));
            const { batchUpsertSiteConfigAction } = await import('@/app/actions/cms');
            await batchUpsertSiteConfigAction(fd);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        });
    }

    return (
        <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-rose-400" />
                    <div>
                        <h2 className="text-white font-bold">Business Locations</h2>
                        <p className="text-gray-500 text-xs mt-0.5">Search Google to add your locations — shown on Contact page map</p>
                    </div>
                    {saved && <span className="text-xs text-emerald-400 animate-pulse ml-3">✓ Saved</span>}
                </div>
                <button onClick={handleSave} disabled={isPending}
                    className="flex items-center gap-2 bg-[#CBA153] text-black px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50">
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isPending ? 'Saving...' : 'Save'}
                </button>
            </div>

            <div className="p-6 space-y-5">
                {/* Google Places Search */}
                <APIProvider apiKey={apiKey}>
                    <div className="bg-[#CBA153]/10 p-4 rounded-lg border border-[#CBA153]/20">
                        <label className="block text-[10px] font-bold text-[#CBA153] mb-2 uppercase tracking-wider">
                            <Plus className="w-3 h-3 inline mr-1" />Add Location via Google Search
                        </label>
                        <PlacesSearchInput onSelect={addLocation} />
                        <p className="text-[9px] text-[#CBA153]/50 mt-1.5 uppercase tracking-wider">
                            Search for your business, restaurant, or office — auto-fills address &amp; coordinates
                        </p>
                    </div>
                </APIProvider>

                {/* Locations List */}
                {locations.length === 0 && (
                    <div className="text-center py-8 text-gray-600">
                        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No locations added. Search above to add your first one.</p>
                    </div>
                )}

                {locations.map((loc, idx) => (
                    <div key={idx} className="bg-[#0D0D0D] rounded-lg border border-white/5 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-[#CBA153]" />
                                <span className="text-white text-sm font-bold">
                                    {idx === 0 ? 'Primary Location' : `Location ${idx + 1}`}
                                </span>
                                {idx === 0 && (
                                    <span className="text-[9px] bg-[#CBA153]/20 text-[#CBA153] px-2 py-0.5 rounded uppercase tracking-wider">
                                        Shown on map
                                    </span>
                                )}
                            </div>
                            {locations.length > 1 && (
                                <button onClick={() => removeLocation(idx)}
                                    className="text-red-400/60 hover:text-red-400 transition-colors p-1">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Name</label>
                                <input value={loc.name} onChange={e => updateLocation(idx, 'name', e.target.value)}
                                    className="w-full bg-[#1A1A1A] border border-white/10 text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Phone</label>
                                <input value={loc.phone} onChange={e => updateLocation(idx, 'phone', e.target.value)}
                                    className="w-full bg-[#1A1A1A] border border-white/10 text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Address</label>
                            <input value={loc.address} onChange={e => updateLocation(idx, 'address', e.target.value)}
                                className="w-full bg-[#1A1A1A] border border-white/10 text-white py-2 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Latitude</label>
                                <input value={loc.lat} readOnly
                                    className="w-full bg-[#1A1A1A] border border-white/5 text-gray-500 py-2 px-3 rounded-lg text-sm cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Longitude</label>
                                <input value={loc.lng} readOnly
                                    className="w-full bg-[#1A1A1A] border border-white/5 text-gray-500 py-2 px-3 rounded-lg text-sm cursor-not-allowed" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
