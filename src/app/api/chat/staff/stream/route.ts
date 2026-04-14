import { NextRequest } from 'next/server';
import { chatEmitter } from '@/lib/chat-emitter';
import { getSession } from '@/lib/session';

const ALLOWED_ROLES = ['MASTER_ADMIN', 'PRODUCT_MANAGER'];

/**
 * GET /api/chat/staff/stream
 * SSE stream for staff inbox — pushes session list updates and new messages instantly.
 * Requires authentication.
 */
export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
        return new Response('Unauthorized', { status: 401 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection event
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
            );

            // ── Listen for session list updates ──────────────────────
            const onSessionsUpdate = () => {
                try {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'sessions_update' })}\n\n`)
                    );
                } catch {
                    cleanup();
                }
            };

            // ── Listen for any new message (for active conversation) ─
            const onAnyMessage = (message: any) => {
                try {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'new_message', message })}\n\n`)
                    );
                } catch {
                    cleanup();
                }
            };

            chatEmitter.on('sessions:update', onSessionsUpdate);
            chatEmitter.on('staff:message', onAnyMessage);

            // ── Heartbeat ────────────────────────────────────────────
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: heartbeat\n\n`));
                } catch {
                    cleanup();
                }
            }, 15000);

            // ── Cleanup ──────────────────────────────────────────────
            function cleanup() {
                chatEmitter.off('sessions:update', onSessionsUpdate);
                chatEmitter.off('staff:message', onAnyMessage);
                clearInterval(heartbeat);
                try { controller.close(); } catch { /* already closed */ }
            }

            req.signal.addEventListener('abort', cleanup);
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
