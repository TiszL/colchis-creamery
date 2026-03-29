"use client";

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { PinData, DashboardStats } from './AnalyticsDashboard';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function fmtMoney(v: number) {
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(0) + 'K';
  return '$' + v;
}

export function GeographyView({ pins, stats }: { pins: PinData[]; stats: DashboardStats }) {
  const statesSorted = useMemo(() =>
    Object.entries(stats.byState).sort((a, b) => b[1].count - a[1].count),
    [stats.byState]
  );
  const maxCount = statesSorted.length > 0 ? statesSorted[0][1].count : 1;

  const chartData = {
    labels: statesSorted.map(([s]) => s),
    datasets: [
      {
        label: 'Monthly Low',
        data: statesSorted.map(([, v]) => v.revLow),
        backgroundColor: '#CBA15366',
        borderRadius: 3,
      },
      {
        label: 'Monthly High',
        data: statesSorted.map(([, v]) => v.revHigh),
        backgroundColor: '#CBA153bb',
        borderRadius: 3,
      },
    ],
  };

  return (
    <div>
      <div className="mb-2">
        <h2 className="font-serif text-xl font-semibold text-[#F0EDE6]">Geographic Coverage</h2>
        <p className="text-xs text-[#888888]">{statesSorted.length} states within 10-hour drive radius from Columbus, OH</p>
      </div>

      {/* State Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
        {statesSorted.map(([code, s]) => (
          <div key={code} className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 hover:shadow-lg hover:border-[#3d7a47] transition-all cursor-default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-semibold text-[#F0EDE6]">{code}</span>
              <span className="text-xs text-[#666666]">{s.count} prospects</span>
            </div>
            <div className="h-1 bg-[#2A2A2A] rounded-full mb-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3d7a47] to-[#c9a84c] transition-all duration-500"
                style={{ width: `${(s.count / maxCount) * 100}%` }}
              ></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-sm font-semibold text-[#c9a84c] tabular-nums">{s.count}</div>
                <div className="text-[9px] text-[#666666] uppercase tracking-wider">Locations</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#c9a84c] tabular-nums">{fmtMoney(s.revHigh)}</div>
                <div className="text-[9px] text-[#666666] uppercase tracking-wider">Mo. High</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue by State chart */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-5">
        <h3 className="text-xs font-semibold text-[#F0EDE6] tracking-wide mb-1">Revenue Potential by State</h3>
        <p className="text-[10px] text-[#666666] mb-3">Monthly low–high range ($USD)</p>
        <div style={{ height: 280 }}>
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { labels: { color: '#888888', font: { size: 10 } } } },
              scales: {
                x: { grid: { color: '#2A2A2A55' }, ticks: { color: '#888888', font: { size: 10 } } },
                y: { grid: { color: '#2A2A2A55' }, ticks: { color: '#888888', font: { size: 10 }, callback: (v: any) => Number(v) >= 1000 ? (Number(v) / 1000) + 'K' : v } },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
