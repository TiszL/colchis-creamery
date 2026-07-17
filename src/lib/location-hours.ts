// Location business-hours helpers — pure functions shared by server code
// (checkout scheduling, kitchen dispatch) and client components (checkout UI).
//
// `hours` shape (Location.hours Json): { mon: "07:00-21:00", tue: "07:00-21:00", ... }
// Missing day key = closed that day.
//
// LAUNCH FIX: all math runs in the STORE's timezone (BUSINESS_TIMEZONE,
// America/New_York), never the machine's. Vercel servers run UTC — with the
// old `now.getDay()/getHours()` logic a 7 PM Dublin-OH order evaluated as
// midnight, got stamped "after hours", and was scheduled for tomorrow. The
// customer's browser clock was equally wrong for display. Conversions use
// Intl (no dependencies) and are DST-safe via the guess-and-correct technique.

import { BUSINESS_TIMEZONE } from '@/lib/timezone';

export type LocationHours = Record<string, string> | null | undefined;

const partsFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

type StoreParts = { dayKey: string; y: number; m: number; d: number; minutes: number };

/** The store-local wall-clock parts of an instant. */
function storeParts(instant: Date): StoreParts {
    const parts: Record<string, string> = {};
    for (const p of partsFmt.formatToParts(instant)) parts[p.type] = p.value;
    // hour12:false can render midnight as "24" in some engines — normalize.
    const hour = Number(parts.hour) % 24;
    return {
        dayKey: parts.weekday.toLowerCase().slice(0, 3),
        y: Number(parts.year),
        m: Number(parts.month),
        d: Number(parts.day),
        minutes: hour * 60 + Number(parts.minute),
    };
}

/**
 * The UTC instant at which the store-local wall clock reads y-m-d h:min.
 * Guess-and-correct (2 passes) handles the timezone offset including DST
 * transitions without a tz database.
 */
function storeLocalToInstant(y: number, m: number, d: number, h: number, min: number): Date {
    let guess = new Date(Date.UTC(y, m - 1, d, h, min));
    for (let i = 0; i < 2; i++) {
        const got = storeParts(guess);
        const desired = Date.UTC(y, m - 1, d, h, min);
        const actual = Date.UTC(got.y, got.m - 1, got.d, Math.floor(got.minutes / 60), got.minutes % 60);
        guess = new Date(guess.getTime() + (desired - actual));
    }
    return guess;
}

export function isOpenNow(hours: LocationHours, now: Date = new Date()): boolean {
    if (!hours) return false;
    const local = storeParts(now);
    const range = hours[local.dayKey];
    if (!range) return false;
    const [openStr, closeStr] = range.split('-');
    if (!openStr || !closeStr) return false;
    const [oh, om] = openStr.split(':').map(Number);
    const [ch, cm] = closeStr.split(':').map(Number);
    return local.minutes >= oh * 60 + (om || 0) && local.minutes < ch * 60 + (cm || 0);
}

/**
 * The "86 for today" expiry: the first opening AFTER the current store-local
 * day ends. Whether the kitchen 86es an item before open, mid-service, or
 * after close, the item stays off the menu for the rest of TODAY and comes
 * back at the next day's opening (or later if the store is closed then).
 * Plain nextOpenSlot() would be wrong pre-open — it returns today's opening,
 * expiring the 86 minutes later.
 */
export function nextOpenAfterToday(hours: LocationHours, from: Date = new Date()): Date | null {
    if (!hours) return null;
    const local = storeParts(from);
    // Store-local midnight at the end of today (h=24 overflows to next day
    // via Date.UTC, which storeLocalToInstant handles).
    const endOfToday = storeLocalToInstant(local.y, local.m, local.d, 24, 0);
    return nextOpenSlot(hours, endOfToday);
}

/** Next opening datetime strictly after `from` (checks up to 8 days ahead). */
export function nextOpenSlot(hours: LocationHours, from: Date = new Date()): Date | null {
    if (!hours) return null;
    for (let i = 0; i < 8; i++) {
        // Walk forward in whole days from `from`; the store-local calendar date
        // of each probe instant decides which day's hours apply.
        const probe = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
        const local = storeParts(probe);
        const range = hours[local.dayKey];
        if (!range) continue;
        const [openStr] = range.split('-');
        if (!openStr) continue;
        const [h, m] = openStr.split(':').map(Number);
        const candidate = storeLocalToInstant(local.y, local.m, local.d, h, m || 0);
        if (candidate > from) return candidate;
    }
    return null;
}
