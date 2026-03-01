"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";

function AutocompleteInput({
    setLat,
    setLng,
    name,
    setName
}: {
    setLat: (val: string) => void,
    setLng: (val: string) => void,
    name: string,
    setName: (val: string) => void
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const places = useMapsLibrary("places");
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

    useEffect(() => {
        if (!places || !inputRef.current) return;
        const options = { fields: ["name", "geometry", "formatted_address"] };
        setAutocomplete(new places.Autocomplete(inputRef.current, options));
    }, [places]);

    useEffect(() => {
        if (!autocomplete) return;
        autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (place.name) setName(place.name);
            if (place.geometry?.location) {
                setLat(place.geometry.location.lat().toString());
                setLng(place.geometry.location.lng().toString());
            }
        });
    }, [autocomplete, setLat, setLng, setName]);

    return (
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-[#CBA153]" />
            </div>
            <input
                ref={inputRef}
                type="text"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Search businesses, restaurants..."
                className="w-full bg-white text-black font-medium py-3 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CBA153] shadow-inner"
            />
        </div>
    );
}

export function AnalyticsPinForm({ action, apiKey }: { action: (formData: FormData) => void, apiKey: string }) {
    const [lat, setLat] = useState("");
    const [lng, setLng] = useState("");
    const [name, setName] = useState("");

    return (
        <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                <Plus className="w-5 h-5 text-[#CBA153]" />
                <h2 className="text-white font-bold">Add New Target Pin</h2>
            </div>

            <form action={action} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <APIProvider apiKey={apiKey}>
                            <div className="bg-[#CBA153]/10 p-4 rounded-lg border border-[#CBA153]/20">
                                <label className="block text-xs font-bold text-[#CBA153] mb-2 uppercase tracking-wider">
                                    Google Places Search
                                </label>
                                <AutocompleteInput setLat={setLat} setLng={setLng} name={name} setName={setName} />
                                <p className="text-[10px] text-[#CBA153]/60 mt-2 uppercase tracking-wider">
                                    powered by Google Maps
                                </p>
                            </div>
                        </APIProvider>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Latitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    name="latitude"
                                    value={lat}
                                    onChange={(e) => setLat(e.target.value)}
                                    required
                                    placeholder="Auto-filled"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-gray-400 py-3 px-4 rounded-lg focus:outline-none"
                                    readOnly
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Longitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    name="longitude"
                                    value={lng}
                                    onChange={(e) => setLng(e.target.value)}
                                    required
                                    placeholder="Auto-filled"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-gray-400 py-3 px-4 rounded-lg focus:outline-none"
                                    readOnly
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Pin Type</label>
                                <select name="pinType" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]">
                                    <option value="PROSPECT">Prospect</option>
                                    <option value="PARTNER">Partner</option>
                                    <option value="SUPPLIER">Supplier</option>
                                    <option value="ZONE">Zone</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Status</label>
                                <select name="status" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]">
                                    <option value="ACTIVE">Active</option>
                                    <option value="INACTIVE">Inactive</option>
                                    <option value="CONVERTED">Converted</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Contact Info</label>
                            <input type="text" name="contactInfo" placeholder="Email or Phone" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Expected Revenue</label>
                            <input type="text" name="revenue" placeholder="e.g. $5,000/mo" className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153]" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Internal Notes</label>
                            <textarea name="notes" placeholder="Meeting details, next steps..." rows={3} className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] resize-none"></textarea>
                        </div>
                    </div>
                </div>
                <div className="pt-2">
                    <button type="submit" className="bg-[#CBA153] text-black px-8 py-3 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-white transition-all">
                        Save Map Pin
                    </button>
                    <p className="text-gray-500 text-xs mt-2 italic">Data will instantly sync with the interactive Analytics Map</p>
                </div>
            </form>
        </div>
    );
}
