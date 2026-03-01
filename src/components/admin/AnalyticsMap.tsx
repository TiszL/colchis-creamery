"use client";

import { useEffect, useRef, useState } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary, InfoWindow } from "@vis.gl/react-google-maps";
import { addAnalyticsPin } from "@/app/actions/analytics";
import { Plus, Search, Star, ExternalLink, Globe as GlobeIcon } from "lucide-react";

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
                placeholder="Search Places API..."
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
        }
    }, [map, selectedPin]);
    return null;
}

function RichInfoWindow({ pin, onClose }: { pin: PinData, onClose: () => void }) {
    const map = useMap();
    const places = useMapsLibrary('places');
    const [richData, setRichData] = useState<google.maps.places.PlaceResult | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!map || !places || !pin) return;
        setLoading(true);
        setRichData(null);

        const service = new places.PlacesService(map);

        // Search by name and proximity to the pin
        const request: google.maps.places.FindPlaceFromQueryRequest = {
            query: pin.name,
            fields: ['place_id'],
            locationBias: {
                radius: 50,
                center: { lat: pin.latitude, lng: pin.longitude },
            },
        };

        service.findPlaceFromQuery(request, (results, status) => {
            if (status === places.PlacesServiceStatus.OK && results && results[0] && results[0].place_id) {
                // Fetch rich details
                service.getDetails({
                    placeId: results[0].place_id,
                    fields: ['name', 'formatted_address', 'rating', 'user_ratings_total', 'url', 'website', 'photos']
                }, (details, detailsStatus) => {
                    if (detailsStatus === places.PlacesServiceStatus.OK && details) {
                        setRichData(details);
                    }
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        });
    }, [map, places, pin]);

    const photoUrl = richData?.photos?.[0]?.getUrl({ maxWidth: 400, maxHeight: 200 });

    return (
        <InfoWindow
            position={{ lat: pin.latitude, lng: pin.longitude }}
            onCloseClick={onClose}
            pixelOffset={[0, -30]}
        >
            <div className="max-w-[280px] text-zinc-900 font-sans flex flex-col -m-3 overflow-hidden rounded-lg bg-white shadow-xl">
                {photoUrl ? (
                    <div className="h-32 w-full bg-gray-100 relative">
                        <img src={photoUrl} alt={pin.name} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="h-4 bg-gray-50 w-full" />
                )}

                <div className="p-4 flex flex-col gap-3">
                    <div>
                        <h3 className="font-bold text-lg leading-tight mb-1">{pin.name}</h3>

                        {loading && <p className="text-xs text-gray-500 animate-pulse">Fetching Maps data...</p>}

                        {!loading && richData && (
                            <div className="flex flex-col gap-2">
                                {richData.rating && (
                                    <div className="flex items-center gap-1 text-sm">
                                        <span className="font-bold">{richData.rating}</span>
                                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 -mt-0.5" />
                                        <span className="text-xs text-gray-500 ml-1">({richData.user_ratings_total} reviews)</span>
                                    </div>
                                )}
                                {richData.formatted_address && (
                                    <p className="text-xs text-gray-600 leading-snug">{richData.formatted_address}</p>
                                )}
                                <div className="flex gap-4 mt-1 border-b border-gray-100 pb-3">
                                    {richData.url && (
                                        <a href={richData.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                                            <ExternalLink className="w-3 h-3" /> View on Maps
                                        </a>
                                    )}
                                    {richData.website && (
                                        <a href={richData.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                                            <GlobeIcon className="w-3 h-3" /> Website
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                        <div className="flex gap-2 items-center">
                            <span style={{ backgroundColor: pin.pinType === 'PARTNER' ? '#34d399' : pin.pinType === 'PROSPECT' ? '#60a5fa' : '#CBA153' }} className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"></span>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
                                {pin.pinType} • {pin.status}
                            </span>
                        </div>

                        {(pin.revenue || pin.contactInfo) && (
                            <div className="bg-gray-50 p-2.5 rounded-md border border-gray-100 flex flex-col gap-1.5 mt-1">
                                {pin.revenue && (
                                    <div className="text-sm flex justify-between gap-4">
                                        <span className="font-semibold text-gray-500 text-[10px] uppercase">Est. Value:</span>
                                        <span className="font-medium text-xs">{pin.revenue}</span>
                                    </div>
                                )}
                                {pin.contactInfo && (
                                    <div className="text-sm flex justify-between gap-4">
                                        <span className="font-semibold text-gray-500 text-[10px] uppercase">Contact:</span>
                                        <span className="font-medium text-xs">{pin.contactInfo}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {pin.notes && (
                            <div className="text-xs text-gray-600 mt-1 italic">
                                "{pin.notes}"
                            </div>
                        )}
                    </div>
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
    // Default center to Tbilisi
    const defaultCenter = { lat: 41.7151, lng: 44.8271 };

    // For storing a newly searched, but not yet saved, location
    const [selectedPlace, setSelectedPlace] = useState<google.maps.places.PlaceResult | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Support controlled or uncontrolled selection mode
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
                    <MapEffect selectedPin={selectedPin} />
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
                            onClick={() => handlePinSelect(pin)}
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

                    {/* Pin Details InfoWindow */}
                    {selectedPin && (
                        <RichInfoWindow pin={selectedPin} onClose={() => handlePinSelect(null)} />
                    )}
                </Map>
            </APIProvider>
        </div>
    );
}
