"use client";

import { useEffect, useRef, useState } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary, InfoWindow } from "@vis.gl/react-google-maps";
import { addAnalyticsPin } from "@/app/actions/analytics";
import { Search, Star, ExternalLink, Globe as GlobeIcon, Phone, MapPin, Truck } from "lucide-react";
import type { PinData } from './AnalyticsDashboard';

// Tier color mapping
const TIER_COLORS: Record<number, string> = {
  1: '#e8614a', // CORE - red/hot
  2: '#c9a84c', // ADJACENT - gold
  3: '#CBA153', // STRATEGIC - green
  4: '#4a7a9a', // GROWTH - blue
  5: '#7a6a8a', // EXPERIMENTAL - purple
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#e8614a',
  HIGH: '#c9a84c',
  MEDIUM: '#CBA153',
  LOW: '#4a7a9a',
  EXPLORATORY: '#7a6a8a',
};

function fmtMoney(v: number) {
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(0) + 'K';
  return '$' + v;
}

// Component that renders the Places Autocomplete search bar on top of the map
function PlacesAutocomplete({
    onPlaceSelect
}: {
    onPlaceSelect: (place: google.maps.places.PlaceResult) => void
}) {
    const [placeAutocomplete, setPlaceAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const places = useMapsLibrary('places');
    const map = useMap();

    useEffect(() => {
        if (!places || !inputRef.current) return;
        const options = {
            fields: ['geometry', 'name', 'formatted_address', 'rating', 'user_ratings_total', 'formatted_phone_number', 'website']
        };
        setPlaceAutocomplete(new places.Autocomplete(inputRef.current, options));
    }, [places]);

    useEffect(() => {
        if (!placeAutocomplete) return;
        placeAutocomplete.addListener('place_changed', () => {
            const place = placeAutocomplete.getPlace();
            if (place.geometry?.location && map) {
                map.panTo(place.geometry.location);
                map.setZoom(16);
                onPlaceSelect(place);
            }
        });
    }, [placeAutocomplete, map, onPlaceSelect]);

    return (
        <div className="absolute top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[400px] z-10 bg-[#1A1A1A] rounded-xl shadow-2xl border border-white/10 flex items-center overflow-hidden">
            <div className="pl-4 pr-2 text-gray-400">
                <Search className="w-5 h-5" />
            </div>
            <input
                ref={inputRef}
                type="text"
                placeholder="Search Google Places to add prospect..."
                className="w-full bg-transparent border-none py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-0"
            />
        </div>
    );
}

function MapEffect({ selectedPin }: { selectedPin: PinData | null }) {
    const map = useMap();
    useEffect(() => {
        if (map && selectedPin) {
            map.panTo({ lat: selectedPin.latitude, lng: selectedPin.longitude });
            map.setZoom(14);
        }
    }, [map, selectedPin]);
    return null;
}

// Rich InfoWindow using our own DB data (no Places API fetch)
function RichInfoWindow({ pin, onClose }: { pin: PinData, onClose: () => void }) {
    const priorityColor = PRIORITY_COLORS[pin.priorityRank || ''] || '#888888';
    const tierColor = TIER_COLORS[pin.tier || 3] || '#CBA153';

    // Build Google Maps URL
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin.name + ' ' + (pin.address || ''))}`;

    return (
        <InfoWindow
            position={{ lat: pin.latitude, lng: pin.longitude }}
            onCloseClick={onClose}
            pixelOffset={[0, -30]}
        >
            <div className="max-w-[320px] text-zinc-900 font-sans flex flex-col -m-3 overflow-hidden rounded-lg bg-white shadow-xl">
                {/* Visual header with tier color gradient and brand initial */}
                <div
                    className="relative h-24 w-full flex items-end px-4 pb-3"
                    style={{
                        background: `linear-gradient(135deg, ${tierColor}ee 0%, ${tierColor}88 50%, ${priorityColor}88 100%)`,
                    }}
                >
                    {/* Brand initial circle */}
                    <div
                        className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md"
                        style={{ backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
                    >
                        {(pin.brandName || pin.name).charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-bold text-base leading-tight text-white drop-shadow-sm">{pin.name}</h3>
                        {pin.categoryLabel && (
                            <span className="text-[10px] text-white/80 font-medium">{pin.categoryLabel}</span>
                        )}
                    </div>
                </div>

                <div className="p-4 flex flex-col gap-2.5">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                        <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: priorityColor }}
                        >
                            {pin.priorityRank} {pin.priorityScore?.toFixed(0)}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{pin.tierLabel}</span>
                        {pin.googleRating != null && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 font-medium inline-flex items-center gap-0.5">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                {pin.googleRating}
                            </span>
                        )}
                    </div>

                    {/* Address */}
                    {pin.address && (
                        <p className="text-xs text-gray-600 leading-snug flex items-start gap-1.5">
                            <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
                            {pin.address}
                        </p>
                    )}

                    {/* Phone + Website */}
                    <div className="flex gap-3 text-xs">
                        {pin.phone && (
                            <a href={`tel:${pin.phone}`} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium">
                                <Phone className="w-3 h-3" /> {pin.phone}
                            </a>
                        )}
                        {pin.website && (
                            <a href={pin.website.startsWith('http') ? pin.website : `https://${pin.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium">
                                <GlobeIcon className="w-3 h-3" /> Website
                            </a>
                        )}
                    </div>

                    {/* Revenue & Volume */}
                    <div className="bg-gray-50 p-2.5 rounded-md border border-gray-100 flex flex-col gap-1">
                        {(pin.revenueMonthlyLow != null || pin.revenueMonthlyHigh != null) && (
                            <div className="text-sm flex justify-between gap-4">
                                <span className="font-semibold text-gray-500 text-[10px] uppercase">Est. Revenue:</span>
                                <span className="font-medium text-xs">{fmtMoney(pin.revenueMonthlyLow || 0)}–{fmtMoney(pin.revenueMonthlyHigh || 0)}/mo</span>
                            </div>
                        )}
                        {(pin.cheeseLbsLow != null || pin.cheeseLbsHigh != null) && (
                            <div className="text-sm flex justify-between gap-4">
                                <span className="font-semibold text-gray-500 text-[10px] uppercase">Cheese Vol:</span>
                                <span className="font-medium text-xs">{pin.cheeseLbsLow}–{pin.cheeseLbsHigh} lbs/mo</span>
                            </div>
                        )}
                        {pin.distanceMiles != null && (
                            <div className="text-sm flex justify-between gap-4">
                                <span className="font-semibold text-gray-500 text-[10px] uppercase">Distance:</span>
                                <span className="font-medium text-xs">{pin.distanceMiles.toFixed(0)} mi ({pin.driveHours?.toFixed(1)} hrs)</span>
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    {pin.notes && (
                        <div className="text-xs text-gray-600 italic leading-snug line-clamp-3">
                            &ldquo;{pin.notes}&rdquo;
                        </div>
                    )}

                    {/* View on Google Maps button */}
                    <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                        style={{ backgroundColor: tierColor }}
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View on Google Maps
                    </a>
                </div>
            </div>
        </InfoWindow>
    );
}

export function AnalyticsMap({
    apiKey,
    initialPins,
    canEdit,
    selectedPinId,
    onPinSelect
}: {
    apiKey: string,
    initialPins: PinData[],
    canEdit: boolean,
    selectedPinId?: string | null,
    onPinSelect?: (id: string | null) => void
}) {
    // Default center: Columbus, OH (supply hub)
    const defaultCenter = { lat: 39.96, lng: -83.0 };

    const [selectedPlace, setSelectedPlace] = useState<google.maps.places.PlaceResult | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [localSelectedPin, setLocalSelectedPin] = useState<PinData | null>(null);

    const controlledSelectedPin = selectedPinId
        ? initialPins.find(p => p.id === selectedPinId) || null
        : null;

    const selectedPin = onPinSelect !== undefined ? controlledSelectedPin : localSelectedPin;

    const handlePinSelect = (pin: PinData | null) => {
        if (onPinSelect) onPinSelect(pin ? pin.id : null);
        else setLocalSelectedPin(pin);
    };

    const handleSaveProspect = async () => {
        if (!selectedPlace?.geometry?.location || !selectedPlace.name) return;

        setIsSaving(true);
        try {
            await addAnalyticsPin({
                name: selectedPlace.name,
                latitude: selectedPlace.geometry.location.lat(),
                longitude: selectedPlace.geometry.location.lng(),
                pinType: 'PROSPECT',
                status: 'ACTIVE',
                address: selectedPlace.formatted_address || undefined,
                phone: selectedPlace.formatted_phone_number || undefined,
                website: selectedPlace.website || undefined,
                googleRating: selectedPlace.rating || undefined,
            });
            setSelectedPlace(null);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full h-full relative font-sans">
            <APIProvider apiKey={apiKey}>
                <Map
                    defaultZoom={5}
                    defaultCenter={defaultCenter}
                    mapId="colchis_creamery_admin_map"
                    disableDefaultUI={true}
                    gestureHandling="greedy"
                    zoomControl={true}
                >
                    <MapEffect selectedPin={selectedPin} />
                    {canEdit && (
                        <PlacesAutocomplete onPlaceSelect={setSelectedPlace} />
                    )}

                    {/* Temporary marker for searched location */}
                    {selectedPlace && selectedPlace.geometry?.location && (
                        <AdvancedMarker position={{
                            lat: selectedPlace.geometry.location.lat(),
                            lng: selectedPlace.geometry.location.lng()
                        }}>
                            <div className="relative group">
                                <Pin
                                    background="#ffffff"
                                    borderColor="#CBA153"
                                    glyphColor="#CBA153"
                                    scale={1.2}
                                />
                                {canEdit && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#1A1A1A] p-3 rounded-lg border border-[#CBA153]/30 shadow-2xl whitespace-nowrap z-50 flex flex-col items-center gap-2 transition-all">
                                        <span className="text-white font-bold text-sm block">{selectedPlace.name}</span>
                                        {selectedPlace.formatted_address && (
                                            <span className="text-gray-400 text-xs">{selectedPlace.formatted_address}</span>
                                        )}
                                        <button
                                            onClick={handleSaveProspect}
                                            disabled={isSaving}
                                            className="bg-[#CBA153] text-black px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider hover:bg-white transition-colors w-full"
                                        >
                                            {isSaving ? "Saving..." : "+ Add to Prospects"}
                                        </button>
                                        <button
                                            onClick={() => setSelectedPlace(null)}
                                            className="text-gray-400 hover:text-white text-xs"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        </AdvancedMarker>
                    )}

                    {/* Render pins from DB — colored by tier */}
                    {initialPins.map((pin) => {
                        const tierColor = TIER_COLORS[pin.tier || 3] || '#CBA153';
                        const isCritical = pin.priorityRank === 'CRITICAL';
                        return (
                            <AdvancedMarker
                                key={pin.id}
                                position={{ lat: pin.latitude, lng: pin.longitude }}
                                title={`${pin.name} — ${pin.tierLabel} — ${pin.priorityRank}`}
                                onClick={() => handlePinSelect(pin)}
                            >
                                <Pin
                                    background={tierColor}
                                    borderColor="rgba(0,0,0,0.4)"
                                    glyphColor="#fff"
                                    scale={isCritical ? 1.1 : 0.85}
                                />
                            </AdvancedMarker>
                        );
                    })}

                    {/* Pin Details InfoWindow — uses our DB data, no Places API call */}
                    {selectedPin && (
                        <RichInfoWindow pin={selectedPin} onClose={() => handlePinSelect(null)} />
                    )}
                </Map>
            </APIProvider>
        </div>
    );
}
