"use client";

import { useState, useMemo } from 'react';
import { BarChart3, Map, Globe, Users, List, Layers, BookOpen } from 'lucide-react';
import { DashboardOverview } from './DashboardOverview';
import { ProspectTable } from './ProspectTable';
import { AnalyticsMapView } from './AnalyticsMapView';
import { GeographyView } from './GeographyView';
import { CategoryView } from './CategoryView';
import { PlaybookView } from './PlaybookView';

export type PinData = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  pinType: string;
  status: string;
  notes: string | null;
  contactInfo: string | null;
  revenue: string | null;
  prospectId: string | null;
  brandName: string | null;
  category: string | null;
  categoryLabel: string | null;
  tier: number | null;
  tierLabel: string | null;
  priorityScore: number | null;
  priorityRank: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  googleRating: number | null;
  revenueMonthlyLow: number | null;
  revenueMonthlyHigh: number | null;
  cheeseLbsLow: number | null;
  cheeseLbsHigh: number | null;
  distanceMiles: number | null;
  driveHours: number | null;
};

export type DashboardStats = {
  totalPins: number;
  totalTAMLow: number;
  totalTAMHigh: number;
  byTier: Record<string, { count: number; revLow: number; revHigh: number }>;
  byPriority: Record<string, number>;
  byState: Record<string, { count: number; revLow: number; revHigh: number }>;
  byCategory: Record<string, { label: string; tier: number; count: number; revLow: number; revHigh: number }>;
  avgPriorityScore: number;
  stateCount: number;
  criticalCount: number;
  highCount: number;
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'prospects', label: 'All Prospects', icon: List },
  { id: 'map', label: 'Map', icon: Map },
  { id: 'geography', label: 'Geography', icon: Globe },
  { id: 'categories', label: 'Categories', icon: Layers },
  { id: 'playbook', label: 'Sales Playbook', icon: BookOpen },
] as const;

type TabId = typeof TABS[number]['id'];

export function AnalyticsDashboard({
  pins,
  stats,
  apiKey,
  canEdit,
}: {
  pins: PinData[];
  stats: DashboardStats;
  apiKey: string;
  canEdit: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <div className="space-y-0">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-[#141414] rounded-xl p-1.5 border border-[#2A2A2A] mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#1a2e1e] text-[#4d9a5a] shadow-sm'
                : 'text-[#888888] hover:text-[#F0EDE6] hover:bg-[#1F1F1F]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
        {/* Right-side stats */}
        <div className="ml-auto flex items-center gap-4 px-3 text-[11px] text-[#888888] whitespace-nowrap">
          <span>Prospects <strong className="text-[#c9a84c]">{stats.totalPins}</strong></span>
          <span>TAM High <strong className="text-[#c9a84c]">${(stats.totalTAMHigh * 12 / 1_000_000).toFixed(1)}M</strong></span>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <DashboardOverview pins={pins} stats={stats} />}
      {activeTab === 'prospects' && <ProspectTable pins={pins} />}
      {activeTab === 'map' && <AnalyticsMapView pins={pins} apiKey={apiKey} canEdit={canEdit} />}
      {activeTab === 'geography' && <GeographyView pins={pins} stats={stats} />}
      {activeTab === 'categories' && <CategoryView pins={pins} stats={stats} />}
      {activeTab === 'playbook' && <PlaybookView />}
    </div>
  );
}
