import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

const ALLOWED_ROLES = ['MASTER_ADMIN', 'PRODUCT_MANAGER'];

/**
 * GET /api/chat/staff
 * List all chat sessions for staff dashboard (WAITING + ACTIVE first, then recent CLOSED).
 * Requires authentication with MASTER_ADMIN or PRODUCT_MANAGER role.
 */
export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessions = await prisma.chatSession.findMany({
        where: {
            status: { in: ['WAITING', 'ACTIVE'] },
        },
        orderBy: [
            { status: 'asc' }, // ACTIVE first, then WAITING
            { lastMessageAt: 'desc' },
        ],
        include: {
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1, // Only last message for preview
            },
            assignedTo: {
                select: { id: true, name: true },
            },
            _count: {
                select: { messages: true },
            },
        },
    });

    // Count waiting sessions for badge
    const waitingCount = sessions.filter(s => s.status === 'WAITING').length;

    // Format response
    const formatted = sessions.map(s => ({
        id: s.id,
        visitorId: s.visitorId,
        visitorName: s.visitorName || 'Anonymous Visitor',
        visitorEmail: s.visitorEmail,
        status: s.status,
        assignedTo: s.assignedTo,
        lastMessage: s.messages[0] || null,
        messageCount: s._count.messages,
        lastMessageAt: s.lastMessageAt,
        createdAt: s.createdAt,
    }));

    return NextResponse.json({
        sessions: formatted,
        waitingCount,
    });
}
