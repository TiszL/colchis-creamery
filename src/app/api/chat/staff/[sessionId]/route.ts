import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { chatEmitter } from '@/lib/chat-emitter';

const ALLOWED_ROLES = ['MASTER_ADMIN', 'PRODUCT_MANAGER'];

/**
 * GET /api/chat/staff/[sessionId]
 * Get full message history for a specific chat session.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const session = await getSession();
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;

    const chatSession = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
            messages: {
                orderBy: { createdAt: 'asc' },
            },
            assignedTo: {
                select: { id: true, name: true },
            },
        },
    });

    if (!chatSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: chatSession });
}

/**
 * PATCH /api/chat/staff/[sessionId]
 * Claim or close a session. Emits SSE events for real-time updates.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const userSession = await getSession();
    if (!userSession || !ALLOWED_ROLES.includes(userSession.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const body = await req.json();
    const { action } = body;

    const chatSession = await prisma.chatSession.findUnique({
        where: { id: sessionId },
    });

    if (!chatSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (action === 'claim') {
        const updated = await prisma.chatSession.update({
            where: { id: sessionId },
            data: {
                assignedToId: userSession.userId,
                status: 'ACTIVE',
            },
        });

        // System message
        const sysMsg = await prisma.chatMessage.create({
            data: {
                sessionId,
                sender: 'system',
                body: `${userSession.name || 'An agent'} has joined the conversation.`,
            },
        });

        // ── Emit events for instant SSE delivery ─────────────────
        chatEmitter.emit(`message:${sessionId}`, sysMsg);
        chatEmitter.emit(`session:${sessionId}:status`, { status: 'ACTIVE', agentName: userSession.name });
        chatEmitter.emit('staff:message', sysMsg);
        chatEmitter.emit('sessions:update');

        return NextResponse.json({ session: updated });
    }

    if (action === 'close') {
        const sysMsg = await prisma.chatMessage.create({
            data: {
                sessionId,
                sender: 'system',
                body: 'This conversation has been closed. Thank you for contacting Colchis Creamery!',
            },
        });

        const updated = await prisma.chatSession.update({
            where: { id: sessionId },
            data: {
                status: 'CLOSED',
                closedAt: new Date(),
            },
        });

        // ── Emit events ──────────────────────────────────────────
        chatEmitter.emit(`message:${sessionId}`, sysMsg);
        chatEmitter.emit(`session:${sessionId}:status`, { status: 'CLOSED' });
        chatEmitter.emit('staff:message', sysMsg);
        chatEmitter.emit('sessions:update');

        return NextResponse.json({ session: updated });
    }

    return NextResponse.json({ error: 'Invalid action. Use "claim" or "close".' }, { status: 400 });
}
