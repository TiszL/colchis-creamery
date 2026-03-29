"use client";

import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ProspectModal } from './ProspectModal';
import type { PinData, DashboardStats } from './AnalyticsDashboard';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

function fmtMoney(v: number) {
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(0) + 'K';
  return '$' + v;
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#e8614a',
  HIGH: '#c9a84c',
  MEDIUM: '#CBA153',
  LOW: '#4a7a9a',
  EXPLORATORY: '#7a6a8a',
};

const PRIORITY_BG: Record<string, string> = {
  CRITICAL: 'bg-[#e8614a]/15 text-[#e8614a]',
  HIGH: 'bg-[#c9a84c]/15 text-[#c9a84c]',
  MEDIUM: 'bg-[#CBA153]/15 text-[#CBA153]',
  LOW: 'bg-[#4a7a9a]/15 text-[#4a7a9a]',
  EXPLORATORY: 'bg-[#7a6a8a]/15 text-[#7a6a8a]',
};

export function DashboardOverview({ pins, stats }: { pins: PinData[]; stats: DashboardStats }) {
  const [selectedPin, setSelectedPin] = useState<PinData | null>(null);

  const top10 = useMemo(() =>
    [...pins]
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
      .slice(0, 10),
    [pins]
  );

  const kpis = [
    { label: 'Total Prospects', value: stats.totalPins.toString(), sub: 'Qualified B2B targets', cls: '' },
    { label: 'Annual TAM Low', value: fmtMoney(stats.totalTAMLow * 12), sub: 'Conservative estimate', cls: 'accent' },
    { label: 'Annual TAM High', value: fmtMoney(stats.totalTAMHigh * 12), sub: 'Full-capture scenario', cls: 'accent' },
    { label: 'Critical Prospects', value: stats.criticalCount.toString(), sub: 'Score 70-100', cls: 'red' },
    { label: 'High Prospects', value: stats.highCount.toString(), sub: 'Score 50-69', cls: '' },
    { label: 'Avg Priority Score', value: stats.avgPriorityScore.toFixed(1), sub: 'Out of 100', cls: '' },
    { label: 'States Covered', value: stats.stateCount.toString(), sub: '10-hr drive radius', cls: 'green' },
    { label: 'Total Locations', value: stats.totalPins.toString(), sub: `${stats.totalPins} with coordinates`, cls: '' },
  ];

  // Priority doughnut
  const priorityLabels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'EXPLORATORY'];
  const priorityData = {
    labels: priorityLabels,
    datasets: [{
      data: priorityLabels.map(l => stats.byPriority[l] || 0),
      backgroundColor: priorityLabels.map(l => PRIORITY_COLORS[l]),
      borderWidth: 2,
      borderColor: '#141414',
    }],
  };

  // Tier revenue bar
  const tierOrder = ['CORE', 'ADJACENT', 'STRATEGIC', 'GROWTH', 'EXPERIMENTAL'];
  const tierRevData = {
    labels: tierOrder,
    datasets: [
      {
        label: 'Annual Low',
        data: tierOrder.map(t => ((stats.byTier[t]?.revLow || 0) * 12)),
        backgroundColor: '#CBA15388',
        borderRadius: 4,
      },
      {
        label: 'Annual High',
        data: tierOrder.map(t => ((stats.byTier[t]?.revHigh || 0) * 12)),
        backgroundColor: '#c9a84ccc',
        borderRadius: 4,
      },
    ],
  };

  // States bar (top 8)
  const statesSorted = Object.entries(stats.byState)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);
  const statesData = {
    labels: statesSorted.map(([s]) => s),
    datasets: [{
      label: 'Prospects',
      data: statesSorted.map(([, v]) => v.count),
      backgroundColor: '#CBA153cc',
      borderRadius: 4,
    }],
  };

  // Category revenue (top 8)
  const catsSorted = Object.entries(stats.byCategory)
    .sort((a, b) => b[1].revHigh - a[1].revHigh)
    .slice(0, 8);
  const catsData = {
    labels: catsSorted.map(([, v]) => v.label.split(' ').slice(0, 2).join(' ')),
    datasets: [{
      label: 'Monthly High',
      data: catsSorted.map(([, v]) => v.revHigh),
      backgroundColor: '#c9a84ccc',
      borderRadius: 4,
    }],
  };

  const chartOptions = (isHorizontal = false) => ({
    responsive: true,
    maintainAspectRatio: true,
    indexAxis: isHorizontal ? 'y' as const : 'x' as const,
    plugins: {
      legend: { labels: { color: '#888888', font: { size: 10 } } },
    },
    scales: {
      x: { grid: { color: '#2A2A2A55' }, ticks: { color: '#888888', font: { size: 10 }, callback: (v: any) => v >= 1000 ? (Number(v) / 1000) + 'K' : v } },
      y: { grid: { color: '#2A2A2A55' }, ticks: { color: '#888888', font: { size: 10 }, callback: (v: any) => v >= 1000 ? (Number(v) / 1000) + 'K' : v } },
    },
  });

  return (
    <div>
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        {kpis.map((k, i) => (
          <div key={i} className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 flex flex-col gap-1.5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <span className="text-[10px] font-medium text-[#666666] uppercase tracking-wider">{k.label}</span>
            <span className={`text-2xl font-semibold tabular-nums leading-none ${
              k.cls === 'accent' ? 'text-[#c9a84c]' :
              k.cls === 'red' ? 'text-[#e8614a]' :
              k.cls === 'green' ? 'text-[#CBA153]' : 'text-[#F0EDE6]'
            }`}>{k.value}</span>
            <span className="text-[11px] text-[#888888]">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-[#F0EDE6] tracking-wide mb-1">Priority Distribution</h3>
          <p className="text-[10px] text-[#666666] mb-3">Prospects by score label</p>
          <div className="max-h-60 flex justify-center">
            <Doughnut data={priorityData} options={{ responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#888888', font: { size: 10 }, boxWidth: 10 } } } }} />
          </div>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-[#F0EDE6] tracking-wide mb-1">Annual Revenue by Tier</h3>
          <p className="text-[10px] text-[#666666] mb-3">TAM low–high range ($USD)</p>
          <Bar data={tierRevData} options={chartOptions()} />
        </div>
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-[#F0EDE6] tracking-wide mb-1">Top 8 States by Prospects</h3>
          <p className="text-[10px] text-[#666666] mb-3">Prospect count</p>
          <Bar data={statesData} options={{ ...chartOptions(), plugins: { legend: { display: false } } }} />
        </div>
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-[#F0EDE6] tracking-wide mb-1">Top Categories by Revenue</h3>
          <p className="text-[10px] text-[#666666] mb-3">Monthly high ($)</p>
          <Bar data={catsData} options={{ ...chartOptions(true), plugins: { legend: { display: false } } }} />
        </div>
      </div>

      {/* Top 10 Table */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2A2A2A]">
          <h3 className="text-sm font-semibold text-[#F0EDE6]">Top 10 Prospects by Score</h3>
          <p className="text-[10px] text-[#666666] mt-0.5">Click any row to view detailed profile</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#242424] text-[10px] uppercase tracking-wider text-[#666666] font-semibold">
                <th className="p-3 pl-5">Company</th>
                <th className="p-3">Category</th>
                <th className="p-3">State</th>
                <th className="p-3">Score</th>
                <th className="p-3">Monthly Revenue</th>
                <th className="p-3">Locations</th>
                <th className="p-3">Rating</th>
              </tr>
            </thead>
            <tbody>
              {top10.map(pin => (
                <tr
                  key={pin.id}
                  className="border-b border-[#242424] last:border-b-0 hover:bg-[#1F1F1F] cursor-pointer transition-colors"
                  onClick={() => setSelectedPin(pin)}
                >
                  <td className="p-3 pl-5 text-xs font-medium text-[#F0EDE6]">{pin.brandName || pin.name}</td>
                  <td className="p-3 text-[11px] text-[#666666]">{pin.categoryLabel}</td>
                  <td className="p-3 text-xs text-[#888888]">{pin.state}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_BG[pin.priorityRank || ''] || ''}`}>
                      {pin.priorityScore?.toFixed(1)} {pin.priorityRank}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-[#888888] tabular-nums">{fmtMoney(pin.revenueMonthlyLow || 0)}–{fmtMoney(pin.revenueMonthlyHigh || 0)}</td>
                  <td className="p-3 text-xs text-[#888888]">1</td>
                  <td className="p-3 text-xs text-[#888888]">{pin.googleRating ? `⭐ ${pin.googleRating}` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPin && <ProspectModal pin={selectedPin} onClose={() => setSelectedPin(null)} />}
    </div>
  );
}
