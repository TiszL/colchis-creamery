'use client';

// KDS — realtime order queue for location staff. Polls fetchLocationQueue,
// announces new PENDING orders (WebAudio beep + card flash + title badge),
// and drives the kitchen status flow via per-card optimistic mutations.
//
// Kitchen flow: PENDING → CONFIRMED → PREPARING → READY, then
//   • OWN_DELIVERY: READY → OUT_FOR_DELIVERY → DELIVERED
//   • PICKUP / DINE_IN: READY → DELIVERED ("handed over")
//   • courier legs (DoorDash/Uber): kitchen stops at READY — the courier
//     lifecycle continues in courierStatus (written by webhooks).

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
    fetchLocationQueue,
    acceptFulfillment,
    advanceFulfillment,
    retryCourierDispatch,
    type QueueItem,
    type QueueSnapshot,
    type MutationResult,
} from '@/app/actions/location-orders';

const COURIER_METHODS = ['DOORDASH_DRIVE', 'UBER_DIRECT'];

const POLL_MS = 10_000;

// Mirrors nextStatusFor in app/actions/location-orders.ts — used only for the
// optimistic local update; the server remains the source of truth.
function nextLocalStatus(method: string, current: string): string | null {
    if (current === 'CONFIRMED') return 'PREPARING';
    if (current === 'PREPARING') return 'READY';
    if (current === 'READY') {
        if (COURIER_METHODS.includes(method)) return null;
        if (method === 'OWN_DELIVERY') return 'OUT_FOR_DELIVERY';
        return 'DELIVERED';
    }
    if (current === 'OUT_FOR_DELIVERY' && method === 'OWN_DELIVERY') return 'DELIVERED';
    return null;
}

function advanceLabel(method: string, current: string): string | null {
    if (current === 'CONFIRMED') return 'START PREPARING';
    if (current === 'PREPARING') return 'READY';
    if (current === 'READY') {
        if (COURIER_METHODS.includes(method)) return null;
        if (method === 'OWN_DELIVERY') return 'OUT FOR DELIVERY';
        return 'HANDED OVER';
    }
    if (current === 'OUT_FOR_DELIVERY' && method === 'OWN_DELIVERY') return 'DELIVERED';
    return null;
}

function statusClass(status: string): string {
    switch (status) {
        case 'PENDING':          return 'bg-amber-900/30 text-amber-400';
        case 'CONFIRMED':        return 'bg-blue-900/30 text-blue-400';
        case 'PREPARING':        return 'bg-purple-900/30 text-purple-400';
        case 'READY':            return 'bg-emerald-900/30 text-emerald-400';
        case 'OUT_FOR_DELIVERY': return 'bg-sky-900/30 text-sky-400';
        case 'DELIVERED':        return 'bg-gray-900/30 text-gray-400';
        case 'CANCELLED':        return 'bg-red-900/30 text-red-400';
        default:                 return 'bg-gray-900/30 text-gray-400';
    }
}

const COURIER_LABELS: Record<string, string> = {
    REQUESTED:        'Courier requested',
    CONFIRMED:        'Driver assigned',
    OUT_FOR_DELIVERY: 'Picked up · on the way',
    DELIVERED:        'Delivered',
    CANCELLED:        'Courier cancelled',
};

function courierChipClass(status: string): string {
    switch (status) {
        case 'CANCELLED':
        case 'DISPATCH_FAILED': return 'bg-red-900/30 text-red-400';
        case 'DELIVERED':       return 'bg-gray-900/30 text-gray-400';
        default:                return 'bg-teal-900/30 text-teal-400';
    }
}

function formatAge(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatScheduled(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
}

function sortQueue(items: QueueItem[]): QueueItem[] {
    return [...items].sort((a, b) => {
        const aPending = a.status === 'PENDING' ? 0 : 1;
        const bPending = b.status === 'PENDING' ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        return a.createdAt.localeCompare(b.createdAt);
    });
}

export default function OrdersQueueClient({ locationId, initial }: { locationId: string; initial: QueueSnapshot }) {
    const [view, setView] = useState<'active' | 'done'>('active');
    const [snapshot, setSnapshot] = useState<QueueSnapshot>(initial);
    const [pollError, setPollError] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
    const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
    const [courierNotes, setCourierNotes] = useState<Record<string, string>>({});
    const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
    const [pendingCount, setPendingCount] = useState(() => initial.items.filter(i => i.status === 'PENDING').length);
    const [, startTransition] = useTransition();

    const viewRef = useRef<'active' | 'done'>('active');
    const inflightRef = useRef(false);
    const knownIdsRef = useRef<Set<string>>(new Set(initial.items.map(i => i.id)));
    const audioCtxRef = useRef<AudioContext | null>(null);
    const baseTitleRef = useRef<string | null>(null);

    // ── New-order beep (WebAudio, no asset). Browsers may block until the
    //    first user gesture — a one-time click handler resumes the context.
    const playBeep = useCallback(() => {
        try {
            if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') void ctx.resume();
            const note = (freq: number, at: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.0001, at);
                gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
                osc.connect(gain).connect(ctx.destination);
                osc.start(at);
                osc.stop(at + 0.3);
            };
            note(880, ctx.currentTime);
            note(1174.66, ctx.currentTime + 0.18);
        } catch {
            // Audio unavailable/blocked — never let sound break the queue.
        }
    }, []);

    useEffect(() => {
        const resume = () => {
            try { void audioCtxRef.current?.resume(); } catch { /* noop */ }
        };
        window.addEventListener('click', resume, { once: true });
        return () => window.removeEventListener('click', resume);
    }, []);

    // ── Polling (guarded against overlap; also fired on tab-visible + after mutations)
    const refetch = useCallback(async () => {
        if (inflightRef.current) return;
        inflightRef.current = true;
        const v = viewRef.current;
        try {
            const snap = await fetchLocationQueue(locationId, v);
            if (viewRef.current !== v) return; // view switched mid-flight — stale
            if (v === 'active') {
                const known = knownIdsRef.current;
                const newPending = snap.items.filter(i => !known.has(i.id) && i.status === 'PENDING');
                snap.items.forEach(i => known.add(i.id));
                if (newPending.length > 0) {
                    playBeep();
                    setFlashIds(prev => new Set([...prev, ...newPending.map(i => i.id)]));
                    const ids = newPending.map(i => i.id);
                    setTimeout(() => {
                        setFlashIds(prev => {
                            const next = new Set(prev);
                            ids.forEach(id => next.delete(id));
                            return next;
                        });
                    }, 4000);
                }
                setPendingCount(snap.items.filter(i => i.status === 'PENDING').length);
            }
            setSnapshot(snap);
            setPollError(false);
        } catch {
            setPollError(true); // transient — keep showing the last good queue
        } finally {
            inflightRef.current = false;
        }
    }, [locationId, playBeep]);

    useEffect(() => {
        const interval = setInterval(() => void refetch(), POLL_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible') void refetch();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [refetch]);

    // 1s tick — drives the per-card age timers and "updated Xs ago".
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // Title badge: "(N) " prefix while any PENDING exists.
    useEffect(() => {
        if (baseTitleRef.current === null) {
            baseTitleRef.current = document.title.replace(/^\(\d+\)\s*/, '');
        }
        const base = baseTitleRef.current;
        document.title = pendingCount > 0 ? `(${pendingCount}) ${base}` : base;
        return () => {
            if (baseTitleRef.current !== null) document.title = baseTitleRef.current;
        };
    }, [pendingCount]);

    const switchView = (v: 'active' | 'done') => {
        if (v === viewRef.current) return;
        viewRef.current = v;
        setView(v);
        void refetch();
    };

    // ── Mutations: optimistic status, per-card busy, inline error + revert.
    const runAction = (
        id: string,
        fn: () => Promise<MutationResult>,
        optimisticStatus?: string,
    ) => {
        setBusyIds(prev => new Set(prev).add(id));
        setCardErrors(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        setCourierNotes(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });

        const prevStatus = snapshot.items.find(i => i.id === id)?.status;
        if (optimisticStatus) {
            setSnapshot(s => ({
                ...s,
                items: s.items.map(i => (i.id === id ? { ...i, status: optimisticStatus } : i)),
            }));
        }

        const revert = () => {
            if (optimisticStatus && prevStatus) {
                setSnapshot(s => ({
                    ...s,
                    items: s.items.map(i => (i.id === id ? { ...i, status: prevStatus } : i)),
                }));
            }
        };

        startTransition(async () => {
            try {
                const res = await fn();
                if (!res.ok) {
                    revert();
                    setCardErrors(prev => ({ ...prev, [id]: res.error }));
                } else if (res.courierError) {
                    setCourierNotes(prev => ({ ...prev, [id]: res.courierError! }));
                }
                await refetch();
            } catch (e) {
                revert();
                setCardErrors(prev => ({ ...prev, [id]: e instanceof Error ? e.message : 'Action failed' }));
            } finally {
                setBusyIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }
        });
    };

    const items = sortQueue(snapshot.items);
    const updatedSecs = Math.max(0, Math.floor((now - new Date(snapshot.fetchedAt).getTime()) / 1000));

    return (
        <div className="space-y-6 max-w-5xl">
            <style>{`
                @keyframes kds-flash {
                    0%, 60% { border-color: #B96A3D; box-shadow: 0 0 0 1px #B96A3D; }
                    100%    { border-color: #ffffff0A; box-shadow: none; }
                }
                .kds-flash { animation: kds-flash 4s ease-out; }
            `}</style>

            <header className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-serif mb-1">Order queue</h1>
                    <p className="text-sm text-gray-500">
                        {items.length} {view === 'active' ? 'active' : 'completed'} fulfillment{items.length === 1 ? '' : 's'}
                    </p>
                </div>
                <div className="text-right">
                    <div className="flex gap-1">
                        {(['active', 'done'] as const).map(v => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => switchView(v)}
                                className={`min-h-[44px] px-5 text-[11px] font-mono uppercase tracking-wider border transition-colors ${
                                    view === v
                                        ? 'bg-[#B96A3D] text-black border-[#B96A3D]'
                                        : 'bg-[#161616] text-gray-400 border-[#ffffff0A] hover:text-white'
                                }`}
                            >
                                {v === 'active' ? 'Active' : 'Done'}
                            </button>
                        ))}
                    </div>
                    <p className="mt-1.5 text-[10px] font-mono text-gray-600">
                        updated {updatedSecs}s ago
                        {pollError && <span className="text-red-400"> · connection issue — retrying</span>}
                    </p>
                </div>
            </header>

            {items.length === 0 && (
                <div className="bg-[#161616] border border-[#ffffff0A] p-10 text-center text-gray-500 text-sm">
                    {view === 'active'
                        ? 'No active orders. New orders will appear here as customers check out.'
                        : 'No completed orders yet.'}
                </div>
            )}

            <div className="space-y-3">
                {items.map(item => {
                    const busy = busyIds.has(item.id);
                    const ageMs = now - new Date(item.createdAt).getTime();
                    const ageHot = item.status === 'PENDING' || item.status === 'CONFIRMED';
                    const ageClass = ageHot && ageMs > 20 * 60_000
                        ? 'text-red-400'
                        : ageHot && ageMs > 10 * 60_000
                        ? 'text-amber-400'
                        : 'text-gray-500';
                    const label = item.status === 'PENDING' ? null : advanceLabel(item.deliveryMethod, item.status);
                    const dispatchFailed = item.courierStatus === 'DISPATCH_FAILED';
                    const isUrl = item.trackingUrl?.startsWith('http');

                    return (
                        <div
                            key={item.id}
                            className={`bg-[#161616] border border-[#ffffff0A] p-5 ${flashIds.has(item.id) ? 'kds-flash' : ''}`}
                        >
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 ${statusClass(item.status)}`}>
                                            {item.status.replace(/_/g, ' ')}
                                        </span>
                                        {item.courierStatus && !dispatchFailed && (
                                            <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 ${courierChipClass(item.courierStatus)}`}>
                                                {COURIER_LABELS[item.courierStatus] ?? item.courierStatus.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-gray-600 font-mono">{item.deliveryMethod.replace(/_/g, ' ')}</span>
                                        <span className="text-[10px] text-gray-600 font-mono">#{item.orderShort}</span>
                                        <span className={`text-[10px] font-mono tabular-nums ${ageClass}`}>{formatAge(ageMs)}</span>
                                        {item.scheduledFor && (
                                            <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-900/30 text-indigo-400">
                                                ⌛ Scheduled — {formatScheduled(item.scheduledFor)}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-sm text-white">
                                        {item.customerName}
                                        {item.customerPhone && (
                                            <a
                                                href={`tel:${item.customerPhone}`}
                                                className="inline-block ml-2 py-2 px-1 text-[#B96A3D] hover:underline font-mono text-[13px]"
                                            >
                                                {item.customerPhone}
                                            </a>
                                        )}
                                    </p>

                                    <ul className="mt-2 space-y-0.5">
                                        {item.items.map((line, idx) => (
                                            <li key={idx} className="text-[12px] text-gray-400 font-mono">
                                                {line.quantity}× {line.name} <span className="text-gray-600">({line.sku})</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {item.deliveryNotes && (
                                        <p className="mt-2 text-[12px] text-amber-200/80 font-mono">📝 {item.deliveryNotes}</p>
                                    )}
                                    {item.trackingUrl && (
                                        isUrl ? (
                                            <a
                                                href={item.trackingUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-block mt-2 py-1 text-[11px] font-mono text-[#B96A3D] hover:underline"
                                            >
                                                Track courier →
                                            </a>
                                        ) : (
                                            <p className="mt-2 text-[10px] text-gray-500 font-mono">Tracking: {item.trackingUrl}</p>
                                        )
                                    )}
                                </div>

                                <div className="shrink-0 flex flex-col items-end gap-2">
                                    {item.status === 'PENDING' && (
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => runAction(item.id, () => acceptFulfillment(item.id, locationId), 'CONFIRMED')}
                                            className="min-h-[52px] px-8 text-[13px] font-mono uppercase tracking-wider bg-[#B96A3D] text-black hover:bg-[#a85d35] transition-colors disabled:opacity-50 disabled:cursor-wait"
                                        >
                                            {busy ? 'Accepting…' : 'Accept order'}
                                        </button>
                                    )}
                                    {label && (
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => runAction(
                                                item.id,
                                                () => advanceFulfillment(item.id, locationId),
                                                nextLocalStatus(item.deliveryMethod, item.status) ?? undefined,
                                            )}
                                            className="min-h-[44px] px-5 text-[11px] font-mono uppercase tracking-wider bg-[#B96A3D] text-black hover:bg-[#a85d35] transition-colors disabled:opacity-50 disabled:cursor-wait"
                                        >
                                            {busy ? '…' : `→ ${label}`}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {courierNotes[item.id] && (
                                <div className="mt-3 px-3 py-2 bg-amber-900/20 border border-amber-800/40 text-amber-400 text-[11px] font-mono">
                                    Accepted — courier dispatch failed: {courierNotes[item.id]}
                                </div>
                            )}

                            {dispatchFailed && (
                                <div className="mt-3 px-3 py-2 bg-red-900/20 border border-red-800/40 flex items-center justify-between gap-3 flex-wrap">
                                    <p className="text-[11px] font-mono text-red-400">
                                        COURIER DISPATCH FAILED{item.dispatchError ? ` — ${item.dispatchError}` : ''}
                                    </p>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => runAction(item.id, () => retryCourierDispatch(item.id, locationId))}
                                        className="min-h-[44px] px-5 text-[11px] font-mono uppercase tracking-wider bg-red-900/40 text-red-300 border border-red-800/60 hover:bg-red-900/60 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        {busy ? 'Retrying…' : 'Retry courier'}
                                    </button>
                                </div>
                            )}

                            {cardErrors[item.id] && (
                                <div className="mt-3 px-3 py-2 bg-red-900/20 border border-red-800/40 text-red-400 text-[11px] font-mono">
                                    {cardErrors[item.id]}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
