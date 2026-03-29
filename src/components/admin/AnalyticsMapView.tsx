"use client";

import { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { AnalyticsMap } from './AnalyticsMap';
import { ProspectModal } from './ProspectModal';
import type { PinData } from './AnalyticsDashboard';

const TIER_BUTTONS = [
  { value: '', label: 'All', color: 'bg-[#1F1F1F] text-[#888888]' },
  { value: 'CORE', label: 'Core', color: 'bg-[#e8614a]/15 text-[#e8614a]' },
  { value: 'ADJACENT', label: 'Adjacent', color: 'bg-[#c9a84c]/15 text-[#c9a84c]' },
  { value: 'STRATEGIC', label: 'Strategic', color: 'bg-[#4d9a5a]/15 text-[#4d9a5a]' },
  { value: 'GROWTH', label: 'Growth', color: 'bg-[#4a7a9a]/15 text-[#4a7a9a]' },
  { value: 'EXPERIMENTAL', label: 'Experimental', color: 'bg-[#7a6a8a]/15 text-[#7a6a8a]' },
];

const PRIORITY_BG: Record<string, string> = {
  CRITICAL: 'bg-[#e8614a]/15 text-[#e8614a]',
  HIGH: 'bg-[#c9a84c]/15 text-[#c9a84c]',
  MEDIUM: 'bg-[#4d9a5a]/15 text-[#4d9a5a]',
  LOW: 'bg-[#4a7a9a]/15 text-[#4a7a9a]',
  EXPLORATORY: 'bg-[#7a6a8a]/15 text-[#7a6a8a]',
};

function fmtMoney(v: number) {
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(0) + 'K';
  return '$' + v;
}

export function AnalyticsMapView({
  pins,
  apiKey,
  canEdit,
}: {
  pins: PinData[];
  apiKey: string;
  canEdit: boolean;
}) {
  const [tierFilter, setTierFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [modalPin, setModalPin] = useState<PinData | null>(null);

  const filteredPins = useMemo(() => {
    let result = pins;
    if (tierFilter) result = result.filter(p => p.tierLabel === tierFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.state && p.state.toLowerCase().includes(q)) ||
        (p.categoryLabel && p.categoryLabel.toLowerCase().includes(q))
      );
    }
    return result;
  }, [pins, tierFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {TIER_BUTTONS.map(btn => (
          <button
            key={btn.value}
            onClick={() => setTierFilter(btn.value)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              tierFilter === btn.value
                ? btn.color + ' ring-1 ring-current'
                : 'bg-[#141414] text-[#666666] hover:text-[#888888]'
            }`}
          >
            {btn.label}
          </button>
        ))}
        <div className="ml-auto relative">
          <Search className="w-3.5 h-3.5 text-[#666666] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search pins..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-[#141414] border border-[#2A2A2A] rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-[#F0EDE6] placeholder-[#666666] focus:outline-none focus:border-[#3d7a47] w-48"
          />
        </div>
        <span className="text-[11px] text-[#666666]">{filteredPins.length} pins</span>
      </div>

      {/* Map + List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#141414] rounded-xl border border-[#2A2A2A] overflow-hidden">
          <div className="h-[550px] bg-[#0e110e] relative">
            <AnalyticsMap
              apiKey={apiKey}
              initialPins={filteredPins}
              canEdit={canEdit}
              selectedPinId={selectedPinId}
              onPinSelect={setSelectedPinId}
            />
          </div>
        </div>

        <div className="bg-[#141414] rounded-xl border border-[#2A2A2A] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#242424]">
            <h2 className="text-sm font-semibold text-[#F0EDE6]">Prospects</h2>
            <p className="text-[10px] text-[#666666] mt-0.5">{filteredPins.length} locations</p>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[490px]">
            {filteredPins.length > 0 ? (
              <ul className="divide-y divide-[#242424]">
                {filteredPins.map(pin => (
                  <li
                    key={pin.id}
                    className={`px-4 py-3 cursor-pointer transition-colors border-l-2 ${
                      selectedPinId === pin.id
                        ? 'bg-white/5 border-[#c9a84c]'
                        : 'hover:bg-white/5 border-transparent'
                    }`}
                    onClick={() => setSelectedPinId(pin.id)}
                    onDoubleClick={() => setModalPin(pin)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        pin.tier === 1 ? 'bg-[#e8614a]' :
                        pin.tier === 2 ? 'bg-[#c9a84c]' :
                        pin.tier === 3 ? 'bg-[#4d9a5a]' :
                        pin.tier === 4 ? 'bg-[#4a7a9a]' : 'bg-[#7a6a8a]'
                      }`}></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[#F0EDE6] text-xs font-medium truncate">{pin.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[#666666]">{pin.categoryLabel}</span>
                          {pin.revenueMonthlyHigh && (
                            <span className="text-[10px] text-[#c9a84c]">{fmtMoney(pin.revenueMonthlyHigh)}/mo</span>
                          )}
                        </div>
                      </div>
                      {pin.priorityRank && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${PRIORITY_BG[pin.priorityRank] || ''}`}>
                          {pin.priorityRank}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-6 text-[#666666] text-sm text-center">No pins match filters.</p>
            )}
          </div>
        </div>
      </div>

      {modalPin && <ProspectModal pin={modalPin} onClose={() => setModalPin(null)} />}
    </div>
  );
}
