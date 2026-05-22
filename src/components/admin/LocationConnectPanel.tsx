"use client";

/**
 * Phase 4 (4e) — Admin Connect status panel rendered above LocationsClient
 * on /admin/locations. Per-location row showing onboarding status with
 * action buttons that delegate to the server actions from 4b.
 */
import { useState, useTransition } from "react";
import { CreditCard, RefreshCw, ExternalLink, AlertCircle, Check, Clock } from "lucide-react";
import {
    createOrRefreshOnboardingLinkAction,
    refreshConnectStatusAction,
    getDashboardLinkAction,
} from "@/app/actions/stripe-connect";

interface ConnectRow {
    id: string;
    name: string;
    city: string;
    state: string;
    stripeConnectAccountId: string | null;
    stripeOnboardingStatus: string | null;
    stripeOnboardingUpdatedAt: string | null;
}

export function LocationConnectPanel({ locations }: { locations: ConnectRow[] }) {
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    const onOnboard = (id: string) => {
        setError(null);
        setBusyId(id);
        startTransition(async () => {
            const fd = new FormData();
            fd.set("locationId", id);
            const res = await createOrRefreshOnboardingLinkAction(fd);
            setBusyId(null);
            if (!res.ok) { setError(res.error); return; }
            window.location.href = res.onboardingUrl;
        });
    };

    const onRefresh = (id: string) => {
        setError(null);
        setBusyId(id);
        startTransition(async () => {
            const fd = new FormData();
            fd.set("locationId", id);
            const res = await refreshConnectStatusAction(fd);
            setBusyId(null);
            if (!res.ok) { setError(res.error); return; }
        });
    };

    const onDashboard = (id: string) => {
        setError(null);
        setBusyId(id);
        startTransition(async () => {
            const fd = new FormData();
            fd.set("locationId", id);
            const res = await getDashboardLinkAction(fd);
            setBusyId(null);
            if (!res.ok) { setError(res.error); return; }
            window.open(res.url, "_blank");
        });
    };

    return (
        <section className="bg-[#161616] border border-[#ffffff0A] p-5 mb-6">
            <header className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#B96A3D]" /> Stripe Connect
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Per-location payout routing. When a location is fully onboarded, customer charges for orders at that
                        location settle to its connected account (sub-LLC bank). Otherwise charges settle to the platform.
                    </p>
                </div>
            </header>

            {error && (
                <div className="mb-3 px-3 py-2 bg-red-950/30 border border-red-900/40 text-red-300 text-xs font-mono">
                    {error}
                </div>
            )}

            <div className="border border-[#ffffff0A] divide-y divide-[#ffffff0A]">
                {locations.map(loc => {
                    const busy = busyId === loc.id;
                    return (
                        <div key={loc.id} className="flex items-center justify-between gap-4 px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <StatusBadge status={loc.stripeOnboardingStatus} />
                                <div className="min-w-0">
                                    <p className="text-sm text-white truncate">{loc.name}</p>
                                    <p className="text-[10px] text-gray-500 truncate font-mono">
                                        {loc.city}, {loc.state}
                                        {loc.stripeConnectAccountId && <span className="text-gray-600"> · {loc.stripeConnectAccountId}</span>}
                                        {loc.stripeOnboardingUpdatedAt && (
                                            <span className="text-gray-600"> · updated {new Date(loc.stripeOnboardingUpdatedAt).toISOString().slice(0, 10)}</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {loc.stripeOnboardingStatus !== "complete" && (
                                    <button
                                        type="button"
                                        onClick={() => onOnboard(loc.id)}
                                        disabled={busy}
                                        className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider bg-[#B96A3D] text-black hover:bg-[#a85d35] disabled:opacity-50 transition-colors"
                                    >
                                        {loc.stripeConnectAccountId ? "Continue onboarding" : "Onboard with Stripe"}
                                    </button>
                                )}
                                {loc.stripeConnectAccountId && (
                                    <button
                                        type="button"
                                        onClick={() => onRefresh(loc.id)}
                                        disabled={busy}
                                        className="px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider text-gray-400 border border-[#ffffff0A] hover:border-[#B96A3D]/40 hover:text-white disabled:opacity-50 transition-colors flex items-center gap-1"
                                        title="Pull latest status from Stripe"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Refresh
                                    </button>
                                )}
                                {loc.stripeOnboardingStatus === "complete" && (
                                    <button
                                        type="button"
                                        onClick={() => onDashboard(loc.id)}
                                        disabled={busy}
                                        className="px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider text-gray-400 border border-[#ffffff0A] hover:border-[#B96A3D]/40 hover:text-white disabled:opacity-50 transition-colors flex items-center gap-1"
                                        title="Open this location's Stripe dashboard"
                                    >
                                        <ExternalLink className="w-3 h-3" /> Dashboard
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                {locations.length === 0 && (
                    <p className="px-4 py-6 text-center text-gray-500 text-xs italic">No locations yet — create one in the panel below.</p>
                )}
            </div>
        </section>
    );
}

function StatusBadge({ status }: { status: string | null }) {
    const cfg = (() => {
        switch (status) {
            case "complete":   return { tone: "green",  icon: Check,       label: "Connected" };
            case "pending":    return { tone: "amber",  icon: Clock,       label: "Pending" };
            case "restricted": return { tone: "red",    icon: AlertCircle, label: "Restricted" };
            default:           return { tone: "gray",   icon: CreditCard,  label: "Not connected" };
        }
    })();
    const toneClasses: Record<string, string> = {
        green:  "bg-emerald-900/30 text-emerald-400 border-emerald-900/40",
        amber:  "bg-amber-900/30 text-amber-400 border-amber-900/40",
        red:    "bg-red-900/30 text-red-400 border-red-900/40",
        gray:   "bg-gray-900/30 text-gray-500 border-gray-900/40",
    };
    return (
        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-wider border ${toneClasses[cfg.tone]}`}>
            <cfg.icon className="w-3 h-3" /> {cfg.label}
        </span>
    );
}
