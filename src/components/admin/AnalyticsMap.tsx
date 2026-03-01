"use client";

import { useEffect, useRef, useState } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { addAnalyticsPin } from "@/app/actions/analytics";
import { Plus, Search } from "lucide-react";

type PinData = {
    id: string;
    latitude: number;
    longitude: number;
    name: string;
    pinType: string;
    status: string;
    contactInfo: string | null;
    revenue: string | null;
    notes: string | null;
};

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
            fields: ['geometry', 'name', 'formatted_address']
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
    }, [placeAutocomplete, placeAutocomplete, map, onPlaceSelect]);

    return (
        <div className="absolute top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[400px] z-10 bg-[#1A1A1A] rounded-xl shadow-2xl border border-white/10 flex items-center overflow-hidden">
            <div className="pl-4 pr-2 text-gray-400">
                <Search className="w-5 h-5" />
            </div>
            <input
                ref={inputRef}
                type="text"
                placeholder="Search for restaurants, shops..."
                className="w-full bg-transparent border-none py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-0"
            />
        </div>
    );
}

export function AnalyticsMap({
    apiKey,
    initialPins,
    canEdit
}: {
    apiKey: string,
    initialPins: PinData[],
    canEdit: boolean
}) {
    // Default center to Tbilisi
    const defaultCenter = { lat: 41.7151, lng: 44.8271 };

    // For storing a newly searched, but not yet saved, location
    const [selectedPlace, setSelectedPlace] = useState<google.maps.places.PlaceResult | null>(null);
    const [isSaving, setIsSaving] = useState(false);

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
            });
            // Clear the temporary selection once saved so it renders from the DB
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
                    defaultZoom={11}
                    defaultCenter={defaultCenter}
                    mapId="colchis_creamery_admin_map"
                    disableDefaultUI={true}
                    gestureHandling="greedy"
                    zoomControl={true}
                >
                    {/* Only show search bar if the user has edit permissions */}
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

                    {/* Render saved pins from DB */}
                    {initialPins.map((pin) => (
                        <AdvancedMarker
                            key={pin.id}
                            position={{ lat: pin.latitude, lng: pin.longitude }}
                            title={pin.name}
                        >
                            <Pin
                                background={
                                    pin.pinType === 'PARTNER' ? '#34d399' :
                                        pin.pinType === 'PROSPECT' ? '#60a5fa' :
                                            '#CBA153'
                                }
                                borderColor="rgba(0,0,0,0.5)"
                                glyphColor="#111"
                                scale={1.0}
                            />
                        </AdvancedMarker>
                    ))}
                </Map>
            </APIProvider>
        </div>
    );
}
