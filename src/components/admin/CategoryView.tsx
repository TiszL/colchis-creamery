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

export function CategoryView({ pins, stats }: { pins: PinData[]; stats: DashboardStats }) {
  const catsSorted = useMemo(() =>
    Object.entries(stats.byCategory).sort((a, b) => b[1].revHigh - a[1].revHigh),
    [stats.byCategory]
  );

  const countData = {
    labels: catsSorted.map(([, v]) => v.label.split('/')[0].trim().split(' ').slice(0, 2).join(' ')),
    datasets: [{
      label: 'Prospects',
      data: catsSorted.map(([, v]) => v.count),
      backgroundColor: '#B96A3Daa',
      borderRadius: 4,
    }],
  };

  const revHighData = {
    labels: catsSorted.map(([, v]) => v.label.split('/')[0].trim().split(' ').slice(0, 2).join(' ')),
    datasets: [{
      label: 'Monthly High',
      data: catsSorted.map(([, v]) => v.revHigh),
      backgroundColor: '#c9a84caa',
      borderRadius: 4,
    }],
  };

  const hOpts = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#B96A3D2255' }, ticks: { color: '#888888', font: { size: 10 }, callback: (v: any) => Number(v) >= 1000 ? (Number(v) / 1000) + 'K' : v } },
      y: { grid: { color: '#B96A3D2255' }, ticks: { color: '#888888', font: { size: 9 } } },
    },
  };

  return (
    <div>
      <div className="mb-2">
        <h2 className="font-serif text-xl font-semibold text-[#F5F0E6]">Business Category Analysis</h2>
        <p className="text-xs text-[#7A8278]">{catsSorted.length} prospect categories — sorted by monthly revenue potential</p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#161616] border border-[#B96A3D22] p-5">
          <h3 className="text-xs font-semibold text-[#F5F0E6] tracking-wide mb-1">Prospects per Category</h3>
          <p className="text-[10px] text-[#5A6158] mb-3">Count</p>
          <div style={{ height: 380 }}>
            <Bar data={countData} options={hOpts} />
          </div>
        </div>
        <div className="bg-[#161616] border border-[#B96A3D22] p-5">
          <h3 className="text-xs font-semibold text-[#F5F0E6] tracking-wide mb-1">Monthly Revenue High by Category</h3>
          <p className="text-[10px] text-[#5A6158] mb-3">Ceiling estimate ($)</p>
          <div style={{ height: 380 }}>
            <Bar data={revHighData} options={hOpts} />
          </div>
        </div>
      </div>

      {/* Category Table */}
      <div className="bg-[#161616] border border-[#B96A3D22] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#B96A3D22] text-[10px] uppercase tracking-wider text-[#5A6158] font-semibold">
                <th className="p-3 pl-5">Category</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Count</th>
                <th className="p-3">Monthly Low</th>
                <th className="p-3">Monthly High</th>
                <th className="p-3">Annual High</th>
              </tr>
            </thead>
            <tbody>
              {catsSorted.map(([code, c]) => (
                <tr key={code} className="border-b border-[#B96A3D22] last:border-b-0 hover:bg-[#1C1C1C] transition-colors">
                  <td className="p-3 pl-5 text-xs font-medium text-[#F5F0E6]">{c.label}</td>
                  <td className="p-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1C1C1C] text-[#7A8278] font-medium">T{c.tier}</span>
                  </td>
                  <td className="p-3 text-xs text-[#7A8278]">{c.count}</td>
                  <td className="p-3 text-xs text-[#7A8278] tabular-nums">{fmtMoney(c.revLow)}</td>
                  <td className="p-3 text-xs text-[#7A8278] tabular-nums">{fmtMoney(c.revHigh)}</td>
                  <td className="p-3 text-xs text-[#c9a84c] tabular-nums font-medium">{fmtMoney(c.revHigh * 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
