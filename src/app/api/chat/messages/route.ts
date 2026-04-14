import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { chatEmitter } from '@/lib/chat-emitter';

/**
 * POST /api/chat/messages
 * Send a message and broadcast via EventEmitter for SSE streams.
 */
export async function POST(req: NextRequest) {
    try {
        const data = await req.json();
        const { sessionId, sender, body, agentId } = data;

        if (!sessionId || !sender || !body) {
            return NextResponse.json({ error: 'sessionId, sender, and body are required' }, { status: 400 });
        }

        if (!['visitor', 'agent', 'system'].includes(sender)) {
            return NextResponse.json({ error: 'Invalid sender type' }, { status: 400 });
        }

        // Verify session exists and is not closed
        const session = await prisma.chatSession.findUnique({
            where: { id: sessionId },
        });

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        if (session.status === 'CLOSED') {
            return NextResponse.json({ error: 'Session is closed' }, { status: 400 });
        }

        // Create the message
        const message = await prisma.chatMessage.create({
            data: {
                sessionId,
                sender,
                body,
                agentId: agentId || null,
            },
        });

        // Update session lastMessageAt
        await prisma.chatSession.update({
            where: { id: sessionId },
            data: { lastMessageAt: new Date() },
        });

        // ── Broadcast to SSE streams ─────────────────────────────────
        chatEmitter.emit(`message:${sessionId}`, message);
        chatEmitter.emit('staff:message', message);
        chatEmitter.emit('sessions:update');

        return NextResponse.json({ message }, { status: 201 });
    } catch (error) {
        console.error('[Chat Messages POST]', error);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}
