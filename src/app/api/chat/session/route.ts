import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { chatEmitter } from '@/lib/chat-emitter';
import { verifyToken } from '@/lib/auth';

/**
 * POST /api/chat/session
 * Create or resume a chat session.
 * 
 * Auth users: auto-detected via auth_token cookie → no body needed
 * Anonymous:  body { visitorId, visitorName, visitorEmail?, visitorPhone? }
 */
export async function POST(req: NextRequest) {
    try {
        // ── Try to detect authenticated user ─────────────────────────
        let authUser: { userId: string; name: string; email: string } | null = null;
        const token = req.cookies.get('auth_token')?.value;
        if (token) {
            try {
                const payload = await verifyToken(token);
                if (payload) {
                    authUser = {
                        userId: payload.userId as string,
                        name: (payload.name as string) || '',
                        email: (payload.email as string) || '',
                    };
                }
            } catch { /* token invalid, treat as anonymous */ }
        }

        const body = await req.json().catch(() => ({}));

        // ── Authenticated user flow ──────────────────────────────────
        if (authUser) {
            // Resume existing open session by userId
            const existing = await prisma.chatSession.findFirst({
                where: {
                    userId: authUser.userId,
                    status: { in: ['WAITING', 'ACTIVE'] },
                },
                include: { messages: { orderBy: { createdAt: 'asc' } } },
            });

            if (existing) {
                return NextResponse.json({ session: existing, resumed: true });
            }

            // Create new session linked to user account
            const session = await prisma.chatSession.create({
                data: {
                    visitorId: authUser.userId, // use userId as visitorId for consistency
                    visitorName: authUser.name,
                    visitorEmail: authUser.email,
                    userId: authUser.userId,
                    status: 'WAITING',
                },
            });

            // Welcome message
            await prisma.chatMessage.create({
                data: {
                    sessionId: session.id,
                    sender: 'system',
                    body: `Welcome back, ${authUser.name || 'there'}! 🧀 How can we help you today?`,
                },
            });

            const full = await prisma.chatSession.findUnique({
                where: { id: session.id },
                include: { messages: { orderBy: { createdAt: 'asc' } } },
            });

            chatEmitter.emit('sessions:update');
            return NextResponse.json({ session: full, resumed: false }, { status: 201 });
        }

        // ── Anonymous visitor flow ───────────────────────────────────
        const { visitorId, visitorName, visitorEmail, visitorPhone } = body;

        if (!visitorId || typeof visitorId !== 'string') {
            return NextResponse.json({ error: 'visitorId is required' }, { status: 400 });
        }

        if (!visitorName || typeof visitorName !== 'string' || visitorName.trim().length < 1) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        if (!visitorEmail && !visitorPhone) {
            return NextResponse.json({ error: 'Email or phone is required' }, { status: 400 });
        }

        // Resume existing open session
        const existing = await prisma.chatSession.findFirst({
            where: {
                visitorId,
                status: { in: ['WAITING', 'ACTIVE'] },
            },
            include: { messages: { orderBy: { createdAt: 'asc' } } },
        });

        if (existing) {
            return NextResponse.json({ session: existing, resumed: true });
        }

        // Create new session
        const contactInfo = visitorEmail
            ? visitorEmail
            : visitorPhone ? `phone: ${visitorPhone}` : '';

        const session = await prisma.chatSession.create({
            data: {
                visitorId,
                visitorName: visitorName.trim(),
                visitorEmail: contactInfo,
                status: 'WAITING',
            },
        });

        await prisma.chatMessage.create({
            data: {
                sessionId: session.id,
                sender: 'system',
                body: 'Welcome to Colchis Creamery! 🧀 How can we help you today?',
            },
        });

        const full = await prisma.chatSession.findUnique({
            where: { id: session.id },
            include: { messages: { orderBy: { createdAt: 'asc' } } },
        });

        chatEmitter.emit('sessions:update');
        return NextResponse.json({ session: full, resumed: false }, { status: 201 });
    } catch (error) {
        console.error('[Chat Session POST]', error);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }
}

/**
 * GET /api/chat/session?visitorId=xxx
 * Check for existing active session.
 * Auth users: auto-check via cookie.
 */
export async function GET(req: NextRequest) {
    // Try auth user first
    const token = req.cookies.get('auth_token')?.value;
    if (token) {
        try {
            const payload = await verifyToken(token);
            if (payload) {
                const session = await prisma.chatSession.findFirst({
                    where: {
                        userId: payload.userId as string,
                        status: { in: ['WAITING', 'ACTIVE'] },
                    },
                    include: { messages: { orderBy: { createdAt: 'asc' } } },
                });
                return NextResponse.json({ session });
            }
        } catch { /* fall through to visitor check */ }
    }

    // Anonymous visitor
    const visitorId = req.nextUrl.searchParams.get('visitorId');
    if (!visitorId) {
        return NextResponse.json({ session: null });
    }

    const session = await prisma.chatSession.findFirst({
        where: {
            visitorId,
            status: { in: ['WAITING', 'ACTIVE'] },
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    return NextResponse.json({ session });
}
