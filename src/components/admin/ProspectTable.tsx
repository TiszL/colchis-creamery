"use client";

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { ProspectModal } from './ProspectModal';
import type { PinData } from './AnalyticsDashboard';

function fmtMoney(v: number) {
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(0) + 'K';
  return '$' + v;
}

const PRIORITY_BG: Record<string, string> = {
  CRITICAL: 'bg-[#e8614a]/15 text-[#e8614a]',
  HIGH: 'bg-[#c9a84c]/15 text-[#c9a84c]',
  MEDIUM: 'bg-[#4d9a5a]/15 text-[#4d9a5a]',
  LOW: 'bg-[#4a7a9a]/15 text-[#4a7a9a]',
  EXPLORATORY: 'bg-[#7a6a8a]/15 text-[#7a6a8a]',
};

type SortField = 'name' | 'category' | 'state' | 'priorityScore' | 'revenueMonthlyHigh' | 'googleRating' | 'tier';

const PER_PAGE = 20;

export function ProspectTable({ pins }: { pins: PinData[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('priorityScore');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(0);
  const [selectedPin, setSelectedPin] = useState<PinData | null>(null);

  // Unique filter options
  const tiers = useMemo(() => [...new Set(pins.map(p => p.tierLabel).filter(Boolean))].sort(), [pins]);
  const categories = useMemo(() => [...new Set(pins.map(p => p.categoryLabel).filter(Boolean))].sort(), [pins]);
  const states = useMemo(() => [...new Set(pins.map(p => p.state).filter(Boolean))].sort(), [pins]);
  const priorities = useMemo(() => [...new Set(pins.map(p => p.priorityRank).filter(Boolean))], [pins]);

  // Filter
  const filtered = useMemo(() => {
    let result = pins;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.brandName && p.brandName.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.categoryLabel && p.categoryLabel.toLowerCase().includes(q))
      );
    }
    if (tierFilter) result = result.filter(p => p.tierLabel === tierFilter);
    if (categoryFilter) result = result.filter(p => p.categoryLabel === categoryFilter);
    if (stateFilter) result = result.filter(p => p.state === stateFilter);
    if (priorityFilter) result = result.filter(p => p.priorityRank === priorityFilter);
    return result;
  }, [pins, searchQuery, tierFilter, categoryFilter, stateFilter, priorityFilter]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      if (typeof av === 'string' && typeof bv === 'string') return sortDir * av.localeCompare(bv);
      return sortDir * ((Number(bv) || 0) - (Number(av) || 0));
    });
  }, [filtered, sortField, sortDir]);

  // Paginate
  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const pageData = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => (d === 1 ? -1 : 1) as 1 | -1);
    else { setSortField(field); setSortDir(-1); }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === -1 ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronUp className="w-3 h-3 inline" />;
  };

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl overflow-hidden">
      {/* Header with filters */}
      <div className="px-5 py-3 border-b border-[#242424] flex flex-wrap items-center gap-3">
        <div className="text-sm font-semibold text-[#F0EDE6]">All Prospects</div>
        <span className="text-[11px] text-[#666666] bg-[#1F1F1F] px-2 py-0.5 rounded-full">{sorted.length} results</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#666666] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
              className="bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-[#F0EDE6] placeholder-[#666666] focus:outline-none focus:border-[#3d7a47] w-40"
            />
          </div>
          <select value={tierFilter} onChange={e => { setTierFilter(e.target.value); setPage(0); }} className="bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[11px] text-[#888888] focus:outline-none focus:border-[#3d7a47]">
            <option value="">All Tiers</option>
            {tiers.map(t => <option key={t} value={t!}>{t}</option>)}
          </select>
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(0); }} className="bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[11px] text-[#888888] focus:outline-none focus:border-[#3d7a47]">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c!}>{c}</option>)}
          </select>
          <select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPage(0); }} className="bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[11px] text-[#888888] focus:outline-none focus:border-[#3d7a47]">
            <option value="">All States</option>
            {states.map(s => <option key={s} value={s!}>{s}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(0); }} className="bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[11px] text-[#888888] focus:outline-none focus:border-[#3d7a47]">
            <option value="">All Priorities</option>
            {priorities.map(p => <option key={p} value={p!}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#242424] text-[10px] uppercase tracking-wider text-[#666666] font-semibold select-none">
              <th className="p-3 pl-5 cursor-pointer hover:text-[#888888]" onClick={() => handleSort('name')}>Company <SortIcon field="name" /></th>
              <th className="p-3 cursor-pointer hover:text-[#888888]" onClick={() => handleSort('category')}>Category <SortIcon field="category" /></th>
              <th className="p-3 cursor-pointer hover:text-[#888888]" onClick={() => handleSort('state')}>State <SortIcon field="state" /></th>
              <th className="p-3 cursor-pointer hover:text-[#888888]" onClick={() => handleSort('priorityScore')}>Score <SortIcon field="priorityScore" /></th>
              <th className="p-3 cursor-pointer hover:text-[#888888]" onClick={() => handleSort('revenueMonthlyHigh')}>Monthly High <SortIcon field="revenueMonthlyHigh" /></th>
              <th className="p-3 cursor-pointer hover:text-[#888888]" onClick={() => handleSort('googleRating')}>Rating <SortIcon field="googleRating" /></th>
              <th className="p-3">City</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map(pin => (
              <tr
                key={pin.id}
                className="border-b border-[#242424] last:border-b-0 hover:bg-[#1F1F1F] cursor-pointer transition-colors"
                onClick={() => setSelectedPin(pin)}
              >
                <td className="p-3 pl-5 text-xs font-medium text-[#F0EDE6]">{pin.brandName || pin.name}</td>
                <td className="p-3 text-[11px] text-[#666666]">{pin.categoryLabel}</td>
                <td className="p-3 text-xs text-[#888888]">{pin.state}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_BG[pin.priorityRank || ''] || ''}`}>
                    {pin.priorityScore?.toFixed(1)}
                  </span>
                </td>
                <td className="p-3 text-xs text-[#888888] tabular-nums">{fmtMoney(pin.revenueMonthlyHigh || 0)}</td>
                <td className="p-3 text-xs text-[#888888]">{pin.googleRating ? `⭐ ${pin.googleRating}` : '–'}</td>
                <td className="p-3 text-xs text-[#666666]">{pin.city || '–'}</td>
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-[#666666] text-sm">No prospects match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-[#242424] text-[11px] text-[#888888]">
        <span>Page {page + 1} of {totalPages || 1}</span>
        <div className="flex gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 rounded-lg bg-[#1F1F1F] hover:bg-[#2A2A2A] hover:text-[#F0EDE6] transition-all disabled:opacity-40 disabled:cursor-default"
          >
            ← Prev
          </button>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 rounded-lg bg-[#1F1F1F] hover:bg-[#2A2A2A] hover:text-[#F0EDE6] transition-all disabled:opacity-40 disabled:cursor-default"
          >
            Next →
          </button>
        </div>
      </div>

      {selectedPin && <ProspectModal pin={selectedPin} onClose={() => setSelectedPin(null)} />}
    </div>
  );
}
