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
    redispatchCourier,
    kitchenCancelOrder,
    kitchenRemoveOrderItems,
    clearStaleFulfillment,
    requestCancelOrder,
    resolveCancelRequest,
    type QueueItem,
    type QueueSnapshot,
    type MutationResult,
} from '@/app/actions/location-orders';
import { BUSINESS_TIMEZONE } from '@/lib/timezone';
import { getThumbUrl } from '@/lib/product-images';

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

// Live MM:SS cook-timer — only shown while the kitchen is on the clock
// (PENDING/CONFIRMED/PREPARING) and capped so a stale card can't render
// nonsense like "73375:57".
function formatAge(ms: number): string {
    if (ms >= 60 * 60_000) return '60+ min';
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Wall-clock times in the BUSINESS timezone — a KDS tablet with a wrong local
// TZ must still show kitchen-true times.
const clockFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TIMEZONE });
const dayKeyFmt = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: BUSINESS_TIMEZONE });
const monthDayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TIMEZONE });

/** '2:47 PM', or 'Jul 14, 2:47 PM' when the order is from another day. */
function formatClock(iso: string): string {
    const d = new Date(iso);
    const time = clockFmt.format(d);
    if (dayKeyFmt.format(d) !== dayKeyFmt.format(new Date())) {
        return `${monthDayFmt.format(d)}, ${time}`;
    }
    return time;
}

function formatRelAge(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}m ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function formatScheduled(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        timeZone: BUSINESS_TIMEZONE,
    });
}

// Money strings are UNPREFIXED dollars ("12.40"); all math in cents.
function toCents(s: string | null): number {
    if (!s) return 0;
    const n = Math.round(parseFloat(s) * 100);
    return Number.isFinite(n) ? n : 0;
}

// 48×48 product thumbnail: -thumb.webp → full image → neutral letter tile.
function ItemThumb({ imageUrl, name }: { imageUrl: string | null; name: string }) {
    const [failed, setFailed] = useState<'thumb' | 'full' | null>(null);
    const src = imageUrl && failed !== 'full'
        ? (failed === 'thumb' ? imageUrl : getThumbUrl(imageUrl))
        : null;
    if (!src) {
        return (
            <div className="w-12 h-12 shrink-0 rounded bg-[#222222] flex items-center justify-center text-gray-500 font-mono text-lg">
                {(name.charAt(0) || '?').toUpperCase()}
            </div>
        );
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt=""
            width={48}
            height={48}
            className="w-12 h-12 shrink-0 rounded object-cover bg-[#222222]"
            onError={() => setFailed(prev => (prev === null ? 'thumb' : 'full'))}
        />
    );
}

// Newest orders on top, oldest sink to the bottom (owner's preference — a new
// order is always the one that needs eyes; stale leftovers shouldn't lead).
function sortQueue(items: QueueItem[]): QueueItem[] {
    return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export default function OrdersQueueClient({
    locationId,
    initial,
    canRefund,
}: {
    locationId: string;
    initial: QueueSnapshot;
    canRefund: boolean;
}) {
    const [view, setView] = useState<'active' | 'done'>('active');
    const [snapshot, setSnapshot] = useState<QueueSnapshot>(initial);
    const [pollError, setPollError] = useState(false);
    // Consecutive poll failures — 1-2 is a network blip (small note), a streak
    // usually means the 7-day staff JWT expired and every action will fail
    // until re-login. Surface that loudly instead of a dying queue.
    const [pollFailStreak, setPollFailStreak] = useState(0);
    // Kitchen-tablet audio: browsers block WebAudio until a user gesture. When
    // the context is suspended the chime is SILENT — show a tap-to-enable chip
    // so staff know sound isn't armed yet.
    const [soundArmed, setSoundArmed] = useState(true);
    const [now, setNow] = useState(() => Date.now());
    const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
    const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
    const [courierNotes, setCourierNotes] = useState<Record<string, string>>({});
    const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
    // "Problem with order" cancel-&-refund panel (manager-only, per card):
    // open → optional reason → two-step confirm (armed → fire).
    const [problemIds, setProblemIds] = useState<Set<string>>(new Set());
    const [problemReasons, setProblemReasons] = useState<Record<string, string>>({});
    const [armedIds, setArmedIds] = useState<Set<string>>(new Set());
    const [cancelledNotes, setCancelledNotes] = useState<Set<string>>(new Set());
    // "Edit order" item-removal panel (manager-only, per card): steppers pick
    // how many of each item to remove → two-step confirm → partial refund.
    const [editIds, setEditIds] = useState<Set<string>>(new Set());
    const [editSelections, setEditSelections] = useState<Record<string, Record<string, number>>>({});
    const [editReasons, setEditReasons] = useState<Record<string, string>>({});
    const [editArmedIds, setEditArmedIds] = useState<Set<string>>(new Set());
    const [editSuccess, setEditSuccess] = useState<Record<string, string>>({});
    // "Remove stale order" (previous-day leftovers, no refund): armed → fire.
    const [staleArmedIds, setStaleArmedIds] = useState<Set<string>>(new Set());
    // Kitchen "Request cancel/refund" panel (fulfillment staff can't move
    // money — they ask, with a required reason; managers approve/decline).
    const [requestOpenIds, setRequestOpenIds] = useState<Set<string>>(new Set());
    const [requestReasons, setRequestReasons] = useState<Record<string, string>>({});
    // Manager resolution of a pending request: optional note + two-step approve.
    const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});
    const [approveArmedIds, setApproveArmedIds] = useState<Set<string>>(new Set());
    const [explainerOpen, setExplainerOpen] = useState(false);
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
            try {
                if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
                void audioCtxRef.current.resume().then(() => setSoundArmed(true));
            } catch { /* noop */ }
        };
        window.addEventListener('click', resume, { once: true });
        // Detect the blocked-audio state so the tap-to-enable chip can render.
        try {
            if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
            setSoundArmed(audioCtxRef.current.state === 'running');
        } catch {
            setSoundArmed(false);
        }
        return () => window.removeEventListener('click', resume);
    }, []);

    // Kitchen-tablet screen wake lock: polling stops when the tablet sleeps and
    // orders arrive to nobody. Best-effort (Safari < 16.4 lacks the API; the
    // 5-minute unaccepted-order email escalation is the backstop). Re-acquired
    // on tab re-focus because the lock is released when the page hides.
    useEffect(() => {
        let lock: { release?: () => Promise<void> } | null = null;
        const acquire = async () => {
            try {
                const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release?: () => Promise<void> }> } };
                if (nav.wakeLock && document.visibilityState === 'visible') {
                    lock = await nav.wakeLock.request('screen');
                }
            } catch { /* denied/unsupported — escalation email covers it */ }
        };
        void acquire();
        const onVisible = () => {
            if (document.visibilityState === 'visible') void acquire();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            try { void lock?.release?.(); } catch { /* noop */ }
        };
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
            setPollFailStreak(0);
        } catch {
            setPollError(true); // transient — keep showing the last good queue
            setPollFailStreak(n => n + 1);
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
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-serif">Order queue</h1>
                        <button
                            type="button"
                            onClick={() => setExplainerOpen(o => !o)}
                            aria-label="How courier delivery works"
                            className={`w-6 h-6 rounded-full border text-[12px] font-mono transition-colors ${
                                explainerOpen
                                    ? 'bg-[#B96A3D] text-black border-[#B96A3D]'
                                    : 'bg-[#161616] text-gray-500 border-[#ffffff1A] hover:text-white'
                            }`}
                        >
                            ?
                        </button>
                    </div>
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

            {pollFailStreak >= 3 && (
                <div className="px-4 py-3 bg-red-900/30 border-2 border-red-700 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[12px] font-mono font-bold uppercase tracking-wider text-red-300">
                        Queue not updating — your session may have expired
                    </p>
                    <a
                        href="/portal-login"
                        className="min-h-[44px] px-5 flex items-center text-[11px] font-mono uppercase tracking-wider bg-red-700 text-white hover:bg-red-600 transition-colors"
                    >
                        Log in again
                    </a>
                </div>
            )}

            {!soundArmed && (
                <button
                    type="button"
                    onClick={() => {
                        try {
                            if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
                            void audioCtxRef.current.resume().then(() => setSoundArmed(true));
                        } catch { /* noop */ }
                    }}
                    className="w-full px-4 py-3 bg-amber-900/30 border-2 border-amber-600 text-amber-300 text-[12px] font-mono font-bold uppercase tracking-wider hover:bg-amber-900/50 transition-colors"
                >
                    🔇 Tap once to enable the new-order chime
                </button>
            )}

            {explainerOpen && (
                <div className="bg-[#161616] border border-[#ffffff0A] px-4 py-4">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-2">How courier delivery works</p>
                    <ol className="space-y-1.5 text-[12px] text-gray-400 list-decimal list-inside">
                        <li>Customer pays → order appears here as <span className="text-amber-400 font-mono">NEW</span> (chime + email).</li>
                        <li>You tap <span className="text-white font-mono">ACCEPT</span> → we book a DoorDash/Uber driver timed to your prep window ({snapshot.prepMinutes} min, set in Admin → Locations).</li>
                        <li>Cook. Tap <span className="text-white font-mono">PREPARING → READY</span> as you go — the customer sees each step live.</li>
                        <li>The driver arrives around your ready time; when they pick up, tracking flips to &quot;on the way&quot; automatically.</li>
                        <li>Driver cancelled/no-show? You + the customer are emailed; use <span className="text-white font-mono">RE-DISPATCH</span> to book another.</li>
                        <li>Problem with an item? <span className="text-white font-mono">EDIT ORDER</span> removes it + auto-refunds. Whole order? <span className="text-white font-mono">CANCEL &amp; REFUND</span> recalls the driver too. (Managers only — kitchen accounts send a <span className="text-white font-mono">CANCEL REQUEST</span> a manager approves right on this screen.)</li>
                    </ol>
                </div>
            )}

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
                    // Hide re-dispatch on kitchen-cancelled fulfillments (courier
                    // recall on a refunded order also leaves courierStatus CANCELLED).
                    const courierCancelled = item.courierStatus === 'CANCELLED' && item.status !== 'CANCELLED';
                    const isUrl = item.trackingUrl?.startsWith('http');
                    const canProblem =
                        canRefund &&
                        item.paymentStatus === 'PAID' &&
                        item.status !== 'DELIVERED' &&
                        item.status !== 'CANCELLED';
                    const problemOpen = problemIds.has(item.id);
                    const armed = armedIds.has(item.id);

                    // Live cook-timer only while the kitchen is on the clock.
                    const isCooking = item.status === 'PENDING' || item.status === 'CONFIRMED' || item.status === 'PREPARING';
                    const itemCount = item.items.reduce((n, l) => n + (l.quantity - l.refundedQuantity), 0);
                    // Before pickup the useful ETA is "when the driver reaches
                    // the counter"; after pickup, the customer dropoff.
                    const courierPickedUp = item.courierStatus === 'OUT_FOR_DELIVERY' || item.courierStatus === 'DELIVERED';
                    const courierEta = courierPickedUp ? item.courierDropoffEtaAt : item.courierPickupEtaAt;
                    const driverWaiting = item.courierSubstate === 'ARRIVED_AT_PICKUP' && item.status !== 'DELIVERED';

                    // "Edit order" (partial item removal) — same money gate as
                    // cancel, but only while the kitchen can still change course.
                    // Mirrors kitchenRemoveOrderItems: editable through READY
                    // until the courier picks up (or own-delivery departs) —
                    // courierPickedUp is computed above for the ETA display.
                    const editableWindow = isCooking || (item.status === 'READY' && !courierPickedUp);
                    const canEdit = canRefund && item.paymentStatus === 'PAID' && editableWindow;
                    const editOpen = editIds.has(item.id);
                    const editArmed = editArmedIds.has(item.id);
                    const sel = editSelections[item.id] ?? {};
                    const removeCount = item.items.reduce((n, l) => n + (sel[l.orderItemId] ?? 0), 0);
                    const removedCents = item.items.reduce((c, l) => c + toCents(l.unitPrice) * (sel[l.orderItemId] ?? 0), 0);
                    const subtotalCents = toCents(item.orderSubtotal);
                    const estRefundCents = removedCents + (subtotalCents > 0 ? Math.round(toCents(item.orderTax) * removedCents / subtotalCents) : 0);
                    const removesEverything =
                        item.items.length > 0 &&
                        item.items.every(l => (sel[l.orderItemId] ?? 0) >= l.quantity - l.refundedQuantity);

                    // Previous-day leftover (business TZ) that isn't scheduled
                    // ahead — offer the no-refund "clear off the board" action.
                    // The server re-validates all three conditions.
                    const isStale =
                        item.status !== 'DELIVERED' &&
                        item.status !== 'CANCELLED' &&
                        dayKeyFmt.format(new Date(item.createdAt)) !== dayKeyFmt.format(new Date(now)) &&
                        (!item.scheduledFor || new Date(item.scheduledFor).getTime() <= now);
                    const staleArmed = staleArmedIds.has(item.id);

                    // Kitchen cancel/refund request state (latest request wins).
                    const cr = item.cancelRequest;
                    const crPending = cr?.status === 'PENDING';
                    const canRequest =
                        !canRefund &&
                        !crPending &&
                        item.paymentStatus === 'PAID' &&
                        item.status !== 'DELIVERED' &&
                        item.status !== 'CANCELLED';
                    const requestOpen = requestOpenIds.has(item.id);
                    const requestReason = requestReasons[item.id] ?? '';
                    const approveArmed = approveArmedIds.has(item.id);

                    return (
                        <div
                            key={item.id}
                            className={`bg-[#161616] border border-[#ffffff0A] p-5 ${flashIds.has(item.id) ? 'kds-flash' : ''}`}
                        >
                            {driverWaiting && (
                                <div className="mb-4 px-3 py-3 bg-amber-500/20 border-2 border-amber-500 text-amber-300 text-[13px] font-mono font-bold uppercase tracking-wider text-center">
                                    Driver waiting at counter — hand off the order
                                </div>
                            )}

                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 ${statusClass(item.status)}`}>
                                            {item.status.replace(/_/g, ' ')}
                                        </span>
                                        {item.hasModifications && (
                                            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-orange-900/30 text-orange-400">
                                                Modified
                                            </span>
                                        )}
                                        {item.courierStatus && !dispatchFailed && (
                                            <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 ${courierChipClass(item.courierStatus)}`}>
                                                {COURIER_LABELS[item.courierStatus] ?? item.courierStatus.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-gray-600 font-mono">{item.deliveryMethod.replace(/_/g, ' ')}</span>
                                        {item.packagingType && (
                                            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-cyan-900/30 text-cyan-400">
                                                {item.packagingType.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-gray-600 font-mono">#{item.orderShort}</span>
                                        {isCooking && (
                                            <span className={`text-[10px] font-mono tabular-nums ${ageClass}`}>{formatAge(ageMs)}</span>
                                        )}
                                        {item.scheduledFor && (
                                            <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-900/30 text-indigo-400">
                                                ⌛ Scheduled — {formatScheduled(item.scheduledFor)}
                                            </span>
                                        )}
                                    </div>

                                    {item.courierName && (
                                        <p className="mb-2 text-[12px] font-mono text-teal-300/90">
                                            Driver {item.courierName}
                                            {item.courierPhone && (
                                                <>
                                                    {' · '}
                                                    <a href={`tel:${item.courierPhone}`} className="text-[#B96A3D] hover:underline">
                                                        {item.courierPhone}
                                                    </a>
                                                </>
                                            )}
                                            {courierEta && <> · arriving {formatClock(courierEta)}</>}
                                        </p>
                                    )}

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

                                    <div className="mt-3 border border-[#ffffff0A] divide-y divide-[#ffffff0A]">
                                        {item.items.map(line => {
                                            const eff = line.quantity - line.refundedQuantity;
                                            return (
                                                <div key={line.orderItemId} className="min-h-[56px] flex items-center gap-3 px-3 py-1.5">
                                                    <ItemThumb imageUrl={line.imageUrl} name={line.name} />
                                                    <span className={`font-bold font-mono text-sm tabular-nums ${eff > 1 ? 'text-amber-400' : 'text-white'}`}>
                                                        {eff}×
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[14px] text-white truncate">{line.name}</p>
                                                        <p className="text-[10px] text-gray-600 font-mono">{line.sku}</p>
                                                    </div>
                                                    <span className="text-[12px] text-gray-500 font-mono shrink-0">${line.unitPrice}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-1.5 text-[11px] font-mono text-gray-500">
                                        {itemCount} item{itemCount === 1 ? '' : 's'} · ${item.orderEffectiveTotal}
                                    </p>

                                    {item.deliveryMethod === 'OWN_DELIVERY' && item.deliveryAddress && (
                                        <div className="mt-2 px-3 py-2 bg-sky-900/20 border border-sky-800/40 text-[12px] font-mono text-sky-300">
                                            📍 {item.deliveryAddress}
                                            {item.accessNote && (
                                                <span className="block mt-0.5 text-sky-400/80">{item.accessNote}</span>
                                            )}
                                        </div>
                                    )}

                                    {(item.orderNotes || item.deliveryNotes) && (
                                        <div className="mt-2 px-3 py-2 bg-amber-900/20 border border-amber-800/40 text-[12px] font-mono text-amber-200/80 space-y-0.5">
                                            {item.orderNotes && <p>📝 {item.orderNotes}</p>}
                                            {item.deliveryNotes && <p>📝 {item.deliveryNotes}</p>}
                                        </div>
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
                                    <div className="text-right">
                                        <div className="text-sm text-white font-mono">{formatClock(item.createdAt)}</div>
                                        <div className={`text-[10px] font-mono ${ageClass}`}>{formatRelAge(ageMs)}</div>
                                    </div>
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

                            {courierCancelled && (
                                <div className="mt-3 px-3 py-2 bg-amber-900/20 border border-amber-800/40 flex items-center justify-between gap-3 flex-wrap">
                                    <p className="text-[11px] font-mono text-amber-400">
                                        The courier cancelled — book a new driver.
                                    </p>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => runAction(item.id, () => redispatchCourier(item.id, locationId))}
                                        className="min-h-[44px] px-5 text-[11px] font-mono uppercase tracking-wider bg-amber-900/40 text-amber-300 border border-amber-800/60 hover:bg-amber-900/60 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        {busy ? 'Dispatching…' : 'Re-dispatch courier'}
                                    </button>
                                </div>
                            )}

                            {/* ── Kitchen cancel/refund request — manager resolves it here */}
                            {cr && crPending && canRefund && (
                                <div className="mt-3 px-3 py-3 bg-red-900/20 border-2 border-red-700/60 space-y-2">
                                    <p className="text-[12px] font-mono font-bold uppercase tracking-wider text-red-300">
                                        ⚠ Kitchen requests cancel &amp; refund
                                    </p>
                                    <p className="text-[12px] font-mono text-gray-300">
                                        {cr.requestedByName}: &ldquo;{cr.reason}&rdquo;
                                    </p>
                                    <input
                                        type="text"
                                        value={resolveNotes[item.id] ?? ''}
                                        onChange={e => setResolveNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        placeholder="Optional note (shown to the kitchen; on approve, also tells the customer why)"
                                        className="w-full bg-[#161616] border border-[#ffffff0A] px-3 py-2 text-[12px] font-mono text-white placeholder-gray-600 focus:outline-none focus:border-red-800/60"
                                    />
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => {
                                                if (!approveArmed) {
                                                    setApproveArmedIds(prev => new Set(prev).add(item.id));
                                                    return;
                                                }
                                                setApproveArmedIds(prev => {
                                                    const next = new Set(prev);
                                                    next.delete(item.id);
                                                    return next;
                                                });
                                                runAction(item.id, () => resolveCancelRequest(cr.id, locationId, true, resolveNotes[item.id] ?? ''), 'CANCELLED');
                                            }}
                                            className={`min-h-[44px] px-5 text-[11px] font-mono uppercase tracking-wider border transition-colors disabled:opacity-50 disabled:cursor-wait ${
                                                approveArmed
                                                    ? 'bg-red-700 text-white border-red-700 hover:bg-red-600'
                                                    : 'bg-red-900/40 text-red-300 border-red-800/60 hover:bg-red-900/60'
                                            }`}
                                        >
                                            {busy ? 'Working…' : approveArmed ? 'Confirm — cancel & refund' : 'Approve & refund'}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => {
                                                setApproveArmedIds(prev => {
                                                    const next = new Set(prev);
                                                    next.delete(item.id);
                                                    return next;
                                                });
                                                runAction(item.id, () => resolveCancelRequest(cr.id, locationId, false, resolveNotes[item.id] ?? ''));
                                            }}
                                            className="min-h-[44px] px-5 text-[11px] font-mono uppercase tracking-wider bg-[#161616] text-gray-300 border border-[#ffffff1A] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            )}

                            {cr && crPending && !canRefund && (
                                <div className="mt-3 px-3 py-2 bg-amber-900/20 border border-amber-800/40 text-[11px] font-mono text-amber-300">
                                    ⏳ Cancel/refund requested — waiting for a manager.
                                    <span className="block mt-0.5 text-amber-400/70">Reason sent: &ldquo;{cr.reason}&rdquo;</span>
                                </div>
                            )}

                            {cr && cr.status === 'DECLINED' && item.status !== 'CANCELLED' && (
                                <div className="mt-3 px-3 py-2 bg-[#161616] border border-[#ffffff1A] text-[11px] font-mono text-gray-400">
                                    ✕ Manager declined the cancel request
                                    {cr.resolutionNote ? <>: &ldquo;{cr.resolutionNote}&rdquo;</> : '.'}
                                    {canRequest && <span className="text-gray-600"> You can send a new request below.</span>}
                                </div>
                            )}

                            {cr && cr.status === 'APPROVED' && item.status === 'CANCELLED' && (
                                <div className="mt-3 px-3 py-2 bg-emerald-900/20 border border-emerald-800/40 text-[11px] font-mono text-emerald-400">
                                    ✓ Cancel request approved — customer refunded in full.
                                </div>
                            )}

                            {(canEdit || canProblem || isStale || canRequest) && (
                                <div className="mt-3">
                                    <div className="flex items-center gap-5 flex-wrap">
                                        {canEdit && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditIds(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(item.id)) next.delete(item.id);
                                                        else next.add(item.id);
                                                        return next;
                                                    });
                                                    setEditArmedIds(prev => {
                                                        const next = new Set(prev);
                                                        next.delete(item.id);
                                                        return next;
                                                    });
                                                    // Only one destructive panel open per card.
                                                    setProblemIds(prev => {
                                                        const next = new Set(prev);
                                                        next.delete(item.id);
                                                        return next;
                                                    });
                                                }}
                                                className="py-1 text-[11px] font-mono text-gray-600 hover:text-gray-400 underline underline-offset-2 transition-colors"
                                            >
                                                {editOpen ? 'Close editor' : 'Edit order'}
                                            </button>
                                        )}
                                        {canProblem && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setProblemIds(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(item.id)) next.delete(item.id);
                                                        else next.add(item.id);
                                                        return next;
                                                    });
                                                    setArmedIds(prev => {
                                                        const next = new Set(prev);
                                                        next.delete(item.id);
                                                        return next;
                                                    });
                                                    setEditIds(prev => {
                                                        const next = new Set(prev);
                                                        next.delete(item.id);
                                                        return next;
                                                    });
                                                }}
                                                className="py-1 text-[11px] font-mono text-gray-600 hover:text-gray-400 underline underline-offset-2 transition-colors"
                                            >
                                                {problemOpen ? 'Never mind' : 'Problem with order?'}
                                            </button>
                                        )}
                                        {canRequest && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRequestOpenIds(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(item.id)) next.delete(item.id);
                                                        else next.add(item.id);
                                                        return next;
                                                    });
                                                }}
                                                className="py-1 text-[11px] font-mono text-gray-600 hover:text-gray-400 underline underline-offset-2 transition-colors"
                                            >
                                                {requestOpen ? 'Never mind' : 'Request cancel/refund'}
                                            </button>
                                        )}
                                        {isStale && (
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => {
                                                    if (!staleArmed) {
                                                        setStaleArmedIds(prev => new Set(prev).add(item.id));
                                                        return;
                                                    }
                                                    setStaleArmedIds(prev => {
                                                        const next = new Set(prev);
                                                        next.delete(item.id);
                                                        return next;
                                                    });
                                                    runAction(item.id, () => clearStaleFulfillment(item.id, locationId), 'CANCELLED');
                                                }}
                                                className={`py-1 text-[11px] font-mono underline underline-offset-2 transition-colors disabled:opacity-50 ${
                                                    staleArmed ? 'text-red-400 hover:text-red-300 font-bold' : 'text-gray-600 hover:text-gray-400'
                                                }`}
                                            >
                                                {staleArmed ? 'Confirm — remove without refund' : 'Remove stale order'}
                                            </button>
                                        )}
                                    </div>

                                    {isStale && staleArmed && (
                                        <p className="mt-1.5 text-[11px] font-mono text-amber-400">
                                            ⚠ Clears this old order off the board — NO refund, no customer email.
                                            If the customer should get their money back, use &quot;Problem with order?&quot; instead.
                                        </p>
                                    )}

                                    {canRequest && requestOpen && (
                                        <div className="mt-2 px-3 py-3 bg-[#17130e] border border-amber-900/40 space-y-3">
                                            <p className="text-[11px] font-mono uppercase tracking-wider text-gray-500">
                                                Ask a manager to cancel &amp; refund this order
                                            </p>
                                            <textarea
                                                value={requestReason}
                                                onChange={e => setRequestReasons(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                placeholder="Why should this order be cancelled? (required — the manager sees this)"
                                                rows={2}
                                                className="w-full bg-[#161616] border border-[#ffffff0A] px-3 py-2 text-[12px] font-mono text-white placeholder-gray-600 focus:outline-none focus:border-amber-800/60"
                                            />
                                            <p className="text-[11px] font-mono text-gray-500">
                                                A manager reviews it on this screen — you&apos;ll see the status here.
                                            </p>
                                            <button
                                                type="button"
                                                disabled={busy || requestReason.trim().length === 0}
                                                onClick={() =>
                                                    runAction(item.id, async () => {
                                                        const res = await requestCancelOrder(item.id, locationId, requestReason);
                                                        if (res.ok) {
                                                            setRequestOpenIds(prev => {
                                                                const next = new Set(prev);
                                                                next.delete(item.id);
                                                                return next;
                                                            });
                                                            setRequestReasons(prev => {
                                                                const next = { ...prev };
                                                                delete next[item.id];
                                                                return next;
                                                            });
                                                        }
                                                        return res;
                                                    })
                                                }
                                                className="min-h-[44px] px-5 text-[11px] font-mono uppercase tracking-wider bg-amber-900/40 text-amber-300 border border-amber-800/60 hover:bg-amber-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {busy ? 'Sending…' : 'Send request to manager'}
                                            </button>
                                        </div>
                                    )}

                                    {canEdit && editOpen && (
                                        <div className="mt-2 px-3 py-3 bg-[#17130e] border border-amber-900/40 space-y-3">
                                            <p className="text-[11px] font-mono uppercase tracking-wider text-gray-500">
                                                Select how many of each item to remove
                                            </p>
                                            <div className="divide-y divide-[#ffffff0A]">
                                                {item.items.map(line => {
                                                    const eff = line.quantity - line.refundedQuantity;
                                                    const removeQty = sel[line.orderItemId] ?? 0;
                                                    const setQty = (qty: number) => {
                                                        setEditSelections(prev => ({
                                                            ...prev,
                                                            [item.id]: { ...(prev[item.id] ?? {}), [line.orderItemId]: qty },
                                                        }));
                                                        // Any change disarms the confirm.
                                                        setEditArmedIds(prev => {
                                                            const next = new Set(prev);
                                                            next.delete(item.id);
                                                            return next;
                                                        });
                                                    };
                                                    return (
                                                        <div key={line.orderItemId} className="py-2 flex items-center gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[13px] text-white truncate">{line.name}</p>
                                                                <p className="text-[10px] text-gray-600 font-mono">
                                                                    {eff} in order · ${line.unitPrice} each
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    disabled={busy || removeQty <= 0}
                                                                    onClick={() => setQty(Math.max(0, removeQty - 1))}
                                                                    className="min-h-[44px] min-w-[44px] text-lg font-mono bg-[#161616] text-gray-300 border border-[#ffffff1A] hover:text-white transition-colors disabled:opacity-30"
                                                                >
                                                                    −
                                                                </button>
                                                                <span className={`w-10 text-center font-mono text-[13px] tabular-nums ${removeQty > 0 ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                                                                    {removeQty}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    disabled={busy || removeQty >= eff}
                                                                    onClick={() => setQty(Math.min(eff, removeQty + 1))}
                                                                    className="min-h-[44px] min-w-[44px] text-lg font-mono bg-[#161616] text-gray-300 border border-[#ffffff1A] hover:text-white transition-colors disabled:opacity-30"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[12px] font-mono text-white">
                                                Refund ≈ ${(estRefundCents / 100).toFixed(2)}
                                            </p>
                                            <input
                                                type="text"
                                                value={editReasons[item.id] ?? ''}
                                                onChange={e => setEditReasons(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                placeholder="What should we tell the customer? (optional)"
                                                className="w-full bg-[#161616] border border-[#ffffff0A] px-3 py-2 text-[12px] font-mono text-white placeholder-gray-600 focus:outline-none focus:border-amber-800/60"
                                            />
                                            <p className="text-[11px] font-mono text-amber-400">
                                                ⚠ Removed items are refunded to the customer automatically. Stock is restored.
                                            </p>
                                            {item.courierStatus && (
                                                <p className="text-[11px] font-mono text-gray-500">
                                                    Driver already booked — packing list sent to the courier still shows the original items.
                                                </p>
                                            )}
                                            {removesEverything && (
                                                <p className="text-[11px] font-mono text-red-400">
                                                    Use &quot;Cancel &amp; refund order&quot; below instead.
                                                </p>
                                            )}
                                            <button
                                                type="button"
                                                disabled={busy || removeCount === 0 || removesEverything}
                                                onClick={() => {
                                                    if (!editArmed) {
                                                        setEditArmedIds(prev => new Set(prev).add(item.id));
                                                        return;
                                                    }
                                                    const removals = item.items
                                                        .map(l => ({ orderItemId: l.orderItemId, quantity: sel[l.orderItemId] ?? 0 }))
                                                        .filter(r => r.quantity > 0);
                                                    runAction(item.id, async () => {
                                                        const res = await kitchenRemoveOrderItems(item.id, locationId, removals, editReasons[item.id] ?? '');
                                                        if (res.ok) {
                                                            setEditSuccess(prev => ({ ...prev, [item.id]: res.amountRefunded ?? '' }));
                                                            setEditIds(prev => {
                                                                const next = new Set(prev);
                                                                next.delete(item.id);
                                                                return next;
                                                            });
                                                            setEditArmedIds(prev => {
                                                                const next = new Set(prev);
                                                                next.delete(item.id);
                                                                return next;
                                                            });
                                                            setEditSelections(prev => {
                                                                const next = { ...prev };
                                                                delete next[item.id];
                                                                return next;
                                                            });
                                                        }
                                                        return res;
                                                    });
                                                }}
                                                className={`min-h-[44px] px-5 text-[11px] font-mono uppercase tracking-wider border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                                    editArmed
                                                        ? 'bg-amber-600 text-black border-amber-600 hover:bg-amber-500'
                                                        : 'bg-amber-900/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/60'
                                                }`}
                                            >
                                                {busy
                                                    ? 'Removing…'
                                                    : editArmed
                                                    ? 'Confirm removal & refund'
                                                    : `Remove ${removeCount} item${removeCount === 1 ? '' : 's'} & refund`}
                                            </button>
                                        </div>
                                    )}

                                    {problemOpen && (
                                        <div className="mt-2 px-3 py-3 bg-[#1a1212] border border-red-900/40 space-y-3">
                                            <textarea
                                                value={problemReasons[item.id] ?? ''}
                                                onChange={e => setProblemReasons(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                placeholder="What should we tell the customer? (optional)"
                                                rows={2}
                                                className="w-full bg-[#161616] border border-[#ffffff0A] px-3 py-2 text-[12px] font-mono text-white placeholder-gray-600 focus:outline-none focus:border-red-800/60"
                                            />
                                            <p className="text-[11px] font-mono text-amber-400">
                                                ⚠ Cancels the ENTIRE order, refunds the customer in full, restores stock, and recalls any courier.
                                            </p>
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => {
                                                    if (!armed) {
                                                        setArmedIds(prev => new Set(prev).add(item.id));
                                                        return;
                                                    }
                                                    runAction(item.id, async () => {
                                                        const res = await kitchenCancelOrder(item.id, locationId, problemReasons[item.id] ?? '');
                                                        if (res.ok) {
                                                            setCancelledNotes(prev => new Set(prev).add(item.id));
                                                            setProblemIds(prev => {
                                                                const next = new Set(prev);
                                                                next.delete(item.id);
                                                                return next;
                                                            });
                                                            setArmedIds(prev => {
                                                                const next = new Set(prev);
                                                                next.delete(item.id);
                                                                return next;
                                                            });
                                                        }
                                                        return res;
                                                    }, 'CANCELLED');
                                                }}
                                                className={`min-h-[44px] px-5 text-[11px] font-mono uppercase tracking-wider border transition-colors disabled:opacity-50 disabled:cursor-wait ${
                                                    armed
                                                        ? 'bg-red-700 text-white border-red-700 hover:bg-red-600'
                                                        : 'bg-red-900/40 text-red-300 border-red-800/60 hover:bg-red-900/60'
                                                }`}
                                            >
                                                {busy ? 'Cancelling…' : armed ? 'Confirm cancel & refund' : 'Cancel & refund order'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {cancelledNotes.has(item.id) && (
                                <div className="mt-3 px-3 py-2 bg-emerald-900/20 border border-emerald-800/40 text-emerald-400 text-[11px] font-mono">
                                    Order cancelled — customer refunded in full.
                                </div>
                            )}

                            {editSuccess[item.id] !== undefined && (
                                <div className="mt-3 px-3 py-2 bg-emerald-900/20 border border-emerald-800/40 text-emerald-400 text-[11px] font-mono">
                                    Items removed — customer refunded{editSuccess[item.id] ? ` $${editSuccess[item.id]}` : ''}.
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
