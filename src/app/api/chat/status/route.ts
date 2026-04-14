import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isChatOnline, getScheduleMessage, getOfflineEmail } from '@/lib/chat-hours';

/**
 * GET /api/chat/status
 * Returns whether live chat is currently online (within working hours)
 */
export async function GET() {
    const isOnline = isChatOnline();
    const schedule = getScheduleMessage();
    const offlineEmail = getOfflineEmail();

    return NextResponse.json({
        isOnline,
        schedule,
        offlineEmail,
    });
}
