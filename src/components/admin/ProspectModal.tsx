"use client";

import { X, Star, ExternalLink, Globe, Phone, MapPin, Truck, TrendingUp } from 'lucide-react';
import type { PinData } from './AnalyticsDashboard';

function fmtMoney(v: number) {
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(0) + 'K';
  return '$' + v;
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-[#e8614a]/15 text-[#e8614a]',
  HIGH: 'bg-[#c9a84c]/15 text-[#c9a84c]',
  MEDIUM: 'bg-[#CBA153]/15 text-[#CBA153]',
  LOW: 'bg-[#4a7a9a]/15 text-[#4a7a9a]',
  EXPLORATORY: 'bg-[#7a6a8a]/15 text-[#7a6a8a]',
};

export function ProspectModal({ pin, onClose }: { pin: PinData; onClose: () => void }) {
  const priorityCls = PRIORITY_COLORS[pin.priorityRank || ''] || PRIORITY_COLORS.MEDIUM;

  return (
    <div className="fixed inset-0 bg-black/70 z-[999] flex items-start justify-center p-8 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[#141414] border border-[#2A2A2A] rounded-2xl max-w-[680px] w-full p-7 relative shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-[#1F1F1F] text-[#888888] hover:bg-[#2A2A2A] hover:text-white transition-all">
          <X className="w-4 h-4" />
        </button>

        {/* Brand Name */}
        <h2 className="font-serif text-2xl font-semibold text-[#F0EDE6] mb-2 pr-10">{pin.brandName || pin.name}</h2>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-5">
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${priorityCls}`}>
            {pin.priorityRank} — {pin.priorityScore?.toFixed(1)}
          </span>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#1F1F1F] text-[#888888]">{pin.tierLabel}</span>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#1F1F1F] text-[#888888]">{pin.categoryLabel}</span>
          {pin.city && <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#1F1F1F] text-[#888888]">{pin.city}, {pin.state}</span>}
          {pin.distanceMiles != null && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#1F1F1F] text-[#888888]">{pin.distanceMiles.toFixed(0)} mi from Columbus</span>
          )}
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-2.5 mb-5">
          {[
            { label: 'Mo. Low', value: fmtMoney(pin.revenueMonthlyLow || 0) },
            { label: 'Mo. High', value: fmtMoney(pin.revenueMonthlyHigh || 0) },
            { label: 'Annual Low', value: fmtMoney((pin.revenueMonthlyLow || 0) * 12) },
            { label: 'Annual High', value: fmtMoney((pin.revenueMonthlyHigh || 0) * 12) },
          ].map((kpi, i) => (
            <div key={i} className="bg-[#1F1F1F] rounded-lg p-3 text-center">
              <div className="text-lg font-semibold text-[#c9a84c] tabular-nums">{kpi.value}</div>
              <div className="text-[9px] text-[#666666] uppercase tracking-wider mt-0.5">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Contact Info */}
        {(pin.phone || pin.website || pin.address) && (
          <div className="mb-5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#666666] mb-2">Contact & Location</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#888888]">
              {pin.phone && (
                <a href={`tel:${pin.phone}`} className="flex items-center gap-2 hover:text-[#CBA153] transition-colors">
                  <Phone className="w-3 h-3" /> {pin.phone}
                </a>
              )}
              {pin.website && (
                <a href={pin.website.startsWith('http') ? pin.website : `https://${pin.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-[#CBA153] transition-colors truncate">
                  <Globe className="w-3 h-3" /> {pin.website}
                </a>
              )}
              {pin.address && (
                <div className="flex items-start gap-2 col-span-full">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {pin.address}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Why This Prospect */}
        {pin.notes && (
          <div className="mb-5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#666666] mb-2">Why This Prospect</div>
            <div className="text-xs text-[#888888] leading-relaxed bg-[#1F1F1F] border-l-2 border-[#3d7a47] py-3 px-4 rounded-r-lg">
              {pin.notes}
            </div>
          </div>
        )}

        {/* Details Grid */}
        <div className="mb-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[#666666] mb-2">Details</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {pin.googleRating != null && (
              <div className="text-[#888888]"><span className="text-[#666666]">Google Rating:</span> <Star className="w-3 h-3 inline text-yellow-400 fill-yellow-400 -mt-0.5" /> {pin.googleRating}</div>
            )}
            {pin.cheeseLbsLow != null && (
              <div className="text-[#888888]"><span className="text-[#666666]">Cheese Volume:</span> {pin.cheeseLbsLow}–{pin.cheeseLbsHigh} lbs/mo</div>
            )}
            {pin.driveHours != null && (
              <div className="text-[#888888] flex items-center gap-1"><Truck className="w-3 h-3 text-[#666666]" /> {pin.driveHours.toFixed(1)} hrs drive</div>
            )}
            <div className="text-[#888888]"><span className="text-[#666666]">Status:</span> {pin.status}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
