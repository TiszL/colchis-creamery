"use client";

/**
 * Phase 7 (7b) — Client wrapper around react-chartjs-2 for the admin
 * analytics page. Server-side renders the data; this client component
 * just handles the canvas + interactivity.
 */
import { useEffect, useState } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const COLORS = {
    accent: "#B96A3D",
    accentDim: "#7e4a2e",
    green: "#10B981",
    amber: "#F59E0B",
    blue: "#3B82F6",
    gray: "#6B7280",
};

interface BarSeries {
    label: string;
    data: Array<{ label: string; value: number }>;
    color?: string;
}

export function RevenueBarChart({ title, series }: { title: string; series: BarSeries[] }) {
    // Avoid hydration mismatch — render after mount.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return <div className="h-64 bg-[#0F0F0F] border border-[#ffffff0A] animate-pulse" />;

    // Use the first series' labels as the X-axis.
    const labels = series[0]?.data.map(d => d.label) ?? [];
    const datasets = series.map((s, i) => ({
        label: s.label,
        data: s.data.map(d => d.value / 100), // cents → dollars
        backgroundColor: s.color ?? Object.values(COLORS)[i % Object.values(COLORS).length],
        borderRadius: 2,
    }));

    return (
        <div className="bg-[#161616] border border-[#ffffff0A] p-5">
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-3">{title}</h3>
            <div className="h-64">
                <Bar
                    data={{ labels, datasets }}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: series.length > 1, labels: { color: "#9CA3AF", font: { size: 11 } } },
                            tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: $${(ctx.parsed.y ?? 0).toFixed(2)}` } },
                        },
                        scales: {
                            x: { ticks: { color: "#6B7280", font: { size: 10 } }, grid: { color: "#ffffff0A" } },
                            y: { ticks: { color: "#6B7280", font: { size: 10 }, callback: v => `$${v}` }, grid: { color: "#ffffff0A" } },
                        },
                    }}
                />
            </div>
        </div>
    );
}

export function ChannelSplitChart({ b2cCents, b2bCents }: { b2cCents: number; b2bCents: number }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return <div className="h-64 bg-[#0F0F0F] border border-[#ffffff0A] animate-pulse" />;

    const total = b2cCents + b2bCents;
    if (total === 0) {
        return (
            <div className="bg-[#161616] border border-[#ffffff0A] p-5 h-64 flex items-center justify-center text-gray-500 text-sm">
                No revenue in this window
            </div>
        );
    }

    return (
        <div className="bg-[#161616] border border-[#ffffff0A] p-5">
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-3">B2C vs B2B</h3>
            <div className="h-52">
                <Doughnut
                    data={{
                        labels: ["B2C", "B2B"],
                        datasets: [{
                            data: [b2cCents / 100, b2bCents / 100],
                            backgroundColor: [COLORS.accent, COLORS.blue],
                            borderColor: "#161616",
                            borderWidth: 2,
                        }],
                    }}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: "bottom", labels: { color: "#9CA3AF", font: { size: 11 } } },
                            tooltip: { callbacks: { label: ctx => `${ctx.label}: $${(ctx.parsed as number).toFixed(2)}` } },
                        },
                        cutout: "60%",
                    }}
                />
            </div>
        </div>
    );
}
