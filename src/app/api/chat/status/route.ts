import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isChatOnline, getScheduleMessage, getOfflineEmail } from '@/lib/chat-hours';
import type { ChatHoursConfig } from '@/lib/chat-hours';

/**
 * Load chat-hours overrides from SiteSetting. Without this the route used the
 * hard-coded Mon–Fri 9–6 ET defaults and the documented config keys did nothing.
 *   chat_hours_start ("09:00") · chat_hours_end ("18:00")
 *   chat_hours_days  ("1,2,3,4,5", Mon=1) · chat_timezone ("America/New_York")
 */
async function loadChatHoursConfig(): Promise<Partial<ChatHoursConfig>> {
    const rows = await prisma.siteSetting.findMany({
        where: { key: { in: ['chat_hours_start', 'chat_hours_end', 'chat_hours_days', 'chat_timezone'] } },
    });
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const config: Partial<ChatHoursConfig> = {};
    if (map.chat_timezone) config.timezone = map.chat_timezone;
    const parseHour = (v?: string): number | undefined => {
        if (!v) return undefined;
        const [hh, mm] = v.split(':').map(s => parseInt(s, 10));
        return Number.isFinite(hh) ? hh + (Number.isFinite(mm) ? mm / 60 : 0) : undefined;
    };
    const start = parseHour(map.chat_hours_start);
    if (start !== undefined) config.startHour = start;
    const end = parseHour(map.chat_hours_end);
    if (end !== undefined) config.endHour = end;
    if (map.chat_hours_days) {
        const days = map.chat_hours_days.split(',').map(d => parseInt(d.trim(), 10)).filter(d => Number.isFinite(d));
        if (days.length) config.days = days;
    }
    return config;
}

/**
 * GET /api/chat/status
 * Returns whether live chat is currently online (within working hours).
 */
export async function GET() {
    const config = await loadChatHoursConfig();
    return NextResponse.json({
        isOnline: isChatOnline(config),
        schedule: getScheduleMessage(config),
        offlineEmail: getOfflineEmail(),
    });
}
