import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { chatEmitter } from '@/lib/chat-emitter';
import { verifyToken } from '@/lib/auth';

const STAFF_ROLES = ['MASTER_ADMIN', 'PRODUCT_MANAGER', 'CONTENT_MANAGER', 'SALES'];
const MAX_BODY_LEN = 4000;

/**
 * POST /api/chat/messages
 * Send a message and broadcast via EventEmitter for SSE streams.
 */
export async function POST(req: NextRequest) {
    try {
        const data = await req.json();
        const { sessionId, sender, body } = data;

        if (!sessionId || !sender || !body) {
            return NextResponse.json({ error: 'sessionId, sender, and body are required' }, { status: 400 });
        }

        if (!['visitor', 'agent', 'system'].includes(sender)) {
            return NextResponse.json({ error: 'Invalid sender type' }, { status: 400 });
        }

        if (typeof body !== 'string' || body.length > MAX_BODY_LEN) {
            return NextResponse.json({ error: 'Message is empty or too long' }, { status: 400 });
        }

        // Resolve the caller's identity from the auth cookie (if any).
        let authRole: string | null = null;
        let authUserId: string | null = null;
        const token = req.cookies.get('auth_token')?.value;
        if (token) {
            const payload = await verifyToken(token);
            if (payload) {
                authRole = (payload.role as string) || null;
                authUserId = (payload.userId as string) || null;
            }
        }
        const isStaff = !!authRole && STAFF_ROLES.includes(authRole);

        // SECURITY: only authenticated staff may speak as the business. Without
        // this, anyone could POST sender:'agent' and impersonate "Colchis Support".
        if ((sender === 'agent' || sender === 'system') && !isStaff) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

        // Lightweight rate limit (serverless-safe, DB-counted): cap visitor
        // message bursts so the public endpoint can't be flooded.
        if (sender === 'visitor') {
            const recent = await prisma.chatMessage.count({
                where: { sessionId, sender: 'visitor', createdAt: { gte: new Date(Date.now() - 10_000) } },
            });
            if (recent >= 8) {
                return NextResponse.json({ error: 'You are sending messages too quickly.' }, { status: 429 });
            }
        }

        // A visitor message tied to a registered account must come from that
        // account (or staff). Anonymous sessions are bearer-authed by their
        // unguessable sessionId.
        if (sender === 'visitor' && session.userId && session.userId !== authUserId && !isStaff) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // agentId is authoritative from the staff session — never trust the client's.
        const resolvedAgentId = sender === 'agent' ? authUserId : null;

        // Create the message
        const message = await prisma.chatMessage.create({
            data: {
                sessionId,
                sender,
                body,
                agentId: resolvedAgentId,
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

/**
 * GET /api/chat/messages?sessionId=xxx
 * Polling fallback for the SSE stream, which is unreliable on Vercel's
 * multi-instance serverless runtime (the emitting POST and the listening SSE
 * connection can land on different instances). Returns the full thread + status.
 * The unguessable sessionId is the bearer token, same model as the SSE stream.
 */
export async function GET(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }
    const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: {
            status: true,
            messages: { orderBy: { createdAt: 'asc' } },
        },
    });
    if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ messages: session.messages, status: session.status });
}
