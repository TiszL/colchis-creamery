"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";

const CATEGORIES = [
    { code: 'GEO_REST', label: 'Georgian Restaurant', tier: 1, tierLabel: 'CORE' },
    { code: 'GEO_BAKERY', label: 'Georgian Bakery', tier: 1, tierLabel: 'CORE' },
    { code: 'GEO_CAFE', label: 'Georgian Cafe', tier: 1, tierLabel: 'CORE' },
    { code: 'EE_MARKET', label: 'Eastern European Market', tier: 1, tierLabel: 'CORE' },
    { code: 'ARMENIAN_REST', label: 'Armenian Restaurant', tier: 2, tierLabel: 'ADJACENT' },
    { code: 'RUSSIAN_REST', label: 'Russian Restaurant', tier: 2, tierLabel: 'ADJACENT' },
    { code: 'TURKISH_MED', label: 'Turkish / Mediterranean', tier: 2, tierLabel: 'ADJACENT' },
    { code: 'EE_DELI', label: 'Eastern European Deli', tier: 2, tierLabel: 'ADJACENT' },
    { code: 'MIDDLE_EAST', label: 'Middle Eastern Restaurant', tier: 2, tierLabel: 'ADJACENT' },
    { code: 'HALAL_MARKET', label: 'Halal / Intl Market', tier: 2, tierLabel: 'ADJACENT' },
    { code: 'DISTRIBUTOR', label: 'Specialty Distributor', tier: 3, tierLabel: 'STRATEGIC' },
    { code: 'GOURMET_RETAIL', label: 'Gourmet Retail / Cheese Shop', tier: 4, tierLabel: 'GROWTH' },
    { code: 'PIZZA_ITALIAN', label: 'Pizza / Italian', tier: 4, tierLabel: 'GROWTH' },
    { code: 'FARM_TABLE', label: 'Farm-to-Table / Artisan', tier: 4, tierLabel: 'GROWTH' },
    { code: 'HOTEL_CATERING', label: 'Hotel / Corporate Catering', tier: 4, tierLabel: 'GROWTH' },
    { code: 'MEAL_KIT', label: 'Meal Kit / Online Grocer', tier: 5, tierLabel: 'EXPERIMENTAL' },
    { code: 'FUSION', label: 'Fusion / Modern', tier: 5, tierLabel: 'EXPERIMENTAL' },
];

const PRIORITY_RANKS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'EXPLORATORY'];

function AutocompleteInput({
    setLat,
    setLng,
    name,
    setName,
    setAddress,
    setPhone,
    setWebsite,
    setGoogleRating,
}: {
    setLat: (val: string) => void,
    setLng: (val: string) => void,
    name: string,
    setName: (val: string) => void,
    setAddress: (val: string) => void,
    setPhone: (val: string) => void,
    setWebsite: (val: string) => void,
    setGoogleRating: (val: string) => void,
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const places = useMapsLibrary("places");
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

    useEffect(() => {
        if (!places || !inputRef.current) return;
        const options = { fields: ["name", "geometry", "formatted_address", "formatted_phone_number", "website", "rating"] };
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
            if (place.formatted_address) setAddress(place.formatted_address);
            if (place.formatted_phone_number) setPhone(place.formatted_phone_number);
            if (place.website) setWebsite(place.website);
            if (place.rating) setGoogleRating(place.rating.toString());
        });
    }, [autocomplete, setLat, setLng, setName, setAddress, setPhone, setWebsite, setGoogleRating]);

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

const inputCls = "w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-3 rounded-lg focus:outline-none focus:border-[#CBA153] text-sm";
const labelCls = "block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider";

export function AnalyticsPinForm({ action, apiKey }: { action: (formData: FormData) => void, apiKey: string }) {
    const [lat, setLat] = useState("");
    const [lng, setLng] = useState("");
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [website, setWebsite] = useState("");
    const [googleRating, setGoogleRating] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");

    // Auto-fill tier based on category
    const catObj = CATEGORIES.find(c => c.code === selectedCategory);
    const tier = catObj?.tier || '';
    const tierLabel = catObj?.tierLabel || '';

    return (
        <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                <Plus className="w-5 h-5 text-[#CBA153]" />
                <h2 className="text-white font-bold">Add New Prospect</h2>
            </div>

            <form action={action} className="p-6 space-y-5">
                {/* Row 1: Google Search + Coordinates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <APIProvider apiKey={apiKey}>
                            <div className="bg-[#CBA153]/10 p-4 rounded-lg border border-[#CBA153]/20">
                                <label className={labelCls + " !text-[#CBA153]"}>Google Places Search</label>
                                <AutocompleteInput
                                    setLat={setLat} setLng={setLng} name={name} setName={setName}
                                    setAddress={setAddress} setPhone={setPhone} setWebsite={setWebsite} setGoogleRating={setGoogleRating}
                                />
                                <p className="text-[9px] text-[#CBA153]/50 mt-1.5 uppercase tracking-wider">Auto-fills address, phone, website & rating</p>
                            </div>
                        </APIProvider>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Latitude</label>
                            <input type="number" step="any" name="latitude" value={lat} onChange={e => setLat(e.target.value)} required placeholder="Auto" className={inputCls} readOnly />
                        </div>
                        <div>
                            <label className={labelCls}>Longitude</label>
                            <input type="number" step="any" name="longitude" value={lng} onChange={e => setLng(e.target.value)} required placeholder="Auto" className={inputCls} readOnly />
                        </div>
                    </div>
                </div>

                {/* Row 2: Category, Tier, Priority, Type, Status */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                        <label className={labelCls}>Category</label>
                        <select name="category" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className={inputCls}>
                            <option value="">Select...</option>
                            {CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                        </select>
                        <input type="hidden" name="categoryLabel" value={catObj?.label || ''} />
                    </div>
                    <div>
                        <label className={labelCls}>Tier</label>
                        <input type="text" value={tierLabel ? `T${tier} — ${tierLabel}` : '—'} readOnly className={inputCls + " !text-gray-500"} />
                        <input type="hidden" name="tier" value={tier} />
                        <input type="hidden" name="tierLabel" value={tierLabel} />
                    </div>
                    <div>
                        <label className={labelCls}>Priority</label>
                        <select name="priorityRank" className={inputCls}>
                            <option value="">Select...</option>
                            {PRIORITY_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Pin Type</label>
                        <select name="pinType" className={inputCls}>
                            <option value="PROSPECT">Prospect</option>
                            <option value="PARTNER">Partner</option>
                            <option value="SUPPLIER">Supplier</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Status</label>
                        <select name="status" className={inputCls}>
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="CONVERTED">Converted</option>
                        </select>
                    </div>
                </div>

                {/* Row 3: Contact & Revenue fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className={labelCls}>Address</label>
                        <input type="text" name="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Auto-filled" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Phone</label>
                        <input type="text" name="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Auto-filled" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Website</label>
                        <input type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)} placeholder="Auto-filled" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Google Rating</label>
                        <input type="number" step="0.1" name="googleRating" value={googleRating} onChange={e => setGoogleRating(e.target.value)} placeholder="Auto" className={inputCls} />
                    </div>
                </div>

                {/* Row 4: Revenue model */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className={labelCls}>Monthly Rev Low ($)</label>
                        <input type="number" name="revenueMonthlyLow" placeholder="e.g. 500" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Monthly Rev High ($)</label>
                        <input type="number" name="revenueMonthlyHigh" placeholder="e.g. 2000" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Contact Info</label>
                        <input type="text" name="contactInfo" placeholder="Email or name" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>City / State</label>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" name="city" placeholder="City" className={inputCls} />
                            <input type="text" name="state" placeholder="ST" className={inputCls} />
                        </div>
                    </div>
                </div>

                {/* Row 5: Notes */}
                <div>
                    <label className={labelCls}>Internal Notes / Reason</label>
                    <textarea name="notes" placeholder="Why this prospect? Meeting notes, next steps..." rows={2} className={inputCls + " resize-none"}></textarea>
                </div>

                <div className="flex items-center gap-4 pt-1">
                    <button type="submit" className="bg-[#CBA153] text-black px-8 py-3 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-white transition-all">
                        Save Prospect
                    </button>
                    <p className="text-gray-600 text-[10px] italic">Syncs with Analytics Dashboard instantly</p>
                </div>
            </form>
        </div>
    );
}
