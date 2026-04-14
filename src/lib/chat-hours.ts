/**
 * Chat Working Hours Utility
 * 
 * Determines whether live chat is "online" based on business hours.
 * Default: Monday–Friday, 9:00 AM – 6:00 PM Eastern Time (EST/EDT).
 * 
 * Can be overridden via SiteSetting keys:
 *   chat_hours_start  (e.g. "09:00")
 *   chat_hours_end    (e.g. "18:00")
 *   chat_hours_days   (e.g. "1,2,3,4,5" — Monday=1, Sunday=0)
 *   chat_timezone     (e.g. "America/New_York")
 */

const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_START_HOUR = 9;   // 9 AM
const DEFAULT_END_HOUR = 18;    // 6 PM
const DEFAULT_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri

export interface ChatHoursConfig {
    timezone: string;
    startHour: number;
    endHour: number;
    days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

export function getDefaultChatHours(): ChatHoursConfig {
    return {
        timezone: DEFAULT_TIMEZONE,
        startHour: DEFAULT_START_HOUR,
        endHour: DEFAULT_END_HOUR,
        days: DEFAULT_DAYS,
    };
}

/**
 * Check if the chat is currently within working hours
 */
export function isChatOnline(config?: Partial<ChatHoursConfig>): boolean {
    const c = { ...getDefaultChatHours(), ...config };

    // Get current time in the configured timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: c.timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        weekday: 'short',
    });

    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const weekdayStr = parts.find(p => p.type === 'weekday')?.value || '';

    // Map weekday string to number (0=Sun, 1=Mon, etc.)
    const dayMap: Record<string, number> = {
        'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
    };
    const dayOfWeek = dayMap[weekdayStr] ?? -1;

    // Check if today is a working day
    if (!c.days.includes(dayOfWeek)) return false;

    // Check if current time is within working hours
    const currentDecimal = hour + minute / 60;
    return currentDecimal >= c.startHour && currentDecimal < c.endHour;
}

/**
 * Get a human-readable schedule string
 */
export function getScheduleMessage(config?: Partial<ChatHoursConfig>): string {
    const c = { ...getDefaultChatHours(), ...config };

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Build day range string
    const sortedDays = [...c.days].sort();
    let dayStr: string;
    if (sortedDays.length === 0) {
        dayStr = 'Closed';
    } else if (
        sortedDays.length > 1 &&
        sortedDays[sortedDays.length - 1] - sortedDays[0] === sortedDays.length - 1
    ) {
        // Consecutive range
        dayStr = `${dayNames[sortedDays[0]]}–${dayNames[sortedDays[sortedDays.length - 1]]}`;
    } else {
        dayStr = sortedDays.map(d => dayNames[d]).join(', ');
    }

    // Format hours
    const formatHour = (h: number) => {
        const suffix = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${h12}${suffix}`;
    };

    // Timezone abbreviation
    const tzAbbr = new Intl.DateTimeFormat('en-US', {
        timeZone: c.timezone,
        timeZoneName: 'short',
    }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || c.timezone;

    return `${dayStr} ${formatHour(c.startHour)}–${formatHour(c.endHour)} ${tzAbbr}`;
}

/**
 * Get the fallback email for when chat is offline
 */
export function getOfflineEmail(): string {
    return 'sales@colchiscreamery.com';
}
