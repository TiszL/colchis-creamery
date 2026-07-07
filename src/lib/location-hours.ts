// Location business-hours helpers — pure functions shared by server code
// (checkout scheduling, kitchen dispatch) and client components (checkout UI).
//
// `hours` shape (Location.hours Json): { mon: "07:00-21:00", tue: "07:00-21:00", ... }
// Missing day key = closed that day.

export type LocationHours = Record<string, string> | null | undefined;

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function isOpenNow(hours: LocationHours, now: Date = new Date()): boolean {
    if (!hours) return false;
    const range = hours[DAY_KEYS[now.getDay()]];
    if (!range) return false;
    const [openStr, closeStr] = range.split('-');
    if (!openStr || !closeStr) return false;
    const [oh, om] = openStr.split(':').map(Number);
    const [ch, cm] = closeStr.split(':').map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return nowMin >= oh * 60 + (om || 0) && nowMin < ch * 60 + (cm || 0);
}

/** Next opening datetime strictly after `from` (checks up to 8 days ahead). */
export function nextOpenSlot(hours: LocationHours, from: Date = new Date()): Date | null {
    if (!hours) return null;
    for (let i = 0; i < 8; i++) {
        const candidate = new Date(from);
        candidate.setDate(from.getDate() + i);
        const range = hours[DAY_KEYS[candidate.getDay()]];
        if (!range) continue;
        const [openStr] = range.split('-');
        if (!openStr) continue;
        const [h, m] = openStr.split(':').map(Number);
        candidate.setHours(h, m || 0, 0, 0);
        if (candidate > from) return candidate;
    }
    return null;
}
