"use client";

import { useState, useMemo } from 'react';
import { Globe, Search } from 'lucide-react';
import { AnalyticsMap } from './AnalyticsMap';

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

export function AnalyticsView({
    apiKey,
    initialPins,
    canEdit,
    totalPins
}: {
    apiKey: string,
    initialPins: PinData[],
    canEdit: boolean,
    totalPins: number
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

    const filteredPins = useMemo(() => {
        if (!searchQuery.trim()) return initialPins;
        const query = searchQuery.toLowerCase();
        return initialPins.filter(pin =>
            pin.name.toLowerCase().includes(query) ||
            (pin.contactInfo && pin.contactInfo.toLowerCase().includes(query)) ||
            (pin.notes && pin.notes.toLowerCase().includes(query))
        );
    }, [initialPins, searchQuery]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map */}
            <div className="lg:col-span-2 bg-[#111111] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-[#CBA153]" />
                        <h2 className="text-white font-bold">Coverage Map</h2>
                    </div>
                </div>
                <div className="h-[500px] bg-[#0D0D0D] relative">
                    <AnalyticsMap
                        apiKey={apiKey}
                        initialPins={filteredPins}
                        canEdit={canEdit}
                        selectedPinId={selectedPinId}
                        onPinSelect={setSelectedPinId}
                    />
                </div>
            </div>

            {/* Pin Listings */}
            <div className="bg-[#111111] rounded-xl border border-white/5 overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-white/5">
                    <h2 className="text-white font-bold">Targets & Partners</h2>
                    <p className="text-gray-600 text-xs mt-1">{totalPins} total locations</p>

                    <div className="mt-4 relative">
                        <input
                            type="text"
                            placeholder="Search locations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#CBA153]/50 transition-colors"
                        />
                        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[500px] lg:max-h-[calc(500px-80px)]">
                    {filteredPins.length > 0 ? (
                        <ul className="divide-y divide-white/5">
                            {filteredPins.map((pin) => (
                                <li
                                    key={pin.id}
                                    className={`px-6 py-4 transition-colors cursor-pointer border-l-2 ${selectedPinId === pin.id ? 'bg-white/10 border-[#CBA153]' : 'hover:bg-white/5 border-transparent'}`}
                                    onClick={() => setSelectedPinId(pin.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${pin.pinType === 'PARTNER' ? 'bg-emerald-400' :
                                            pin.pinType === 'PROSPECT' ? 'bg-blue-400' :
                                                'bg-[#CBA153]'
                                            }`}></div>
                                        <div className="min-w-0">
                                            <p className="text-white text-sm font-medium truncate">{pin.name}</p>
                                            <p className="text-gray-600 text-xs">{pin.pinType} • {pin.status}</p>
                                        </div>
                                    </div>
                                    {pin.notes && (
                                        <p className="text-gray-500 text-xs mt-2 pl-5 line-clamp-2">{pin.notes}</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="p-6 text-gray-500 text-sm text-center">No pins found.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
