import { NextRequest } from 'next/server';
import { chatEmitter } from '@/lib/chat-emitter';

/**
 * GET /api/chat/stream?sessionId=xxx
 * Server-Sent Events stream for visitor/user chat.
 * Pushes new messages and session status changes instantly.
 */
export async function GET(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
        return new Response('sessionId is required', { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection event
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`)
            );

            // ── Listen for new messages in this session ──────────────
            const onMessage = (message: any) => {
                try {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'message', message })}\n\n`)
                    );
                } catch {
                    // Stream closed, clean up
                    cleanup();
                }
            };

            // ── Listen for session status changes ────────────────────
            const onStatus = (data: any) => {
                try {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'status', ...data })}\n\n`)
                    );
                } catch {
                    cleanup();
                }
            };

            chatEmitter.on(`message:${sessionId}`, onMessage);
            chatEmitter.on(`session:${sessionId}:status`, onStatus);

            // ── Heartbeat to keep connection alive ───────────────────
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: heartbeat\n\n`));
                } catch {
                    cleanup();
                }
            }, 15000);

            // ── Cleanup ──────────────────────────────────────────────
            function cleanup() {
                chatEmitter.off(`message:${sessionId}`, onMessage);
                chatEmitter.off(`session:${sessionId}:status`, onStatus);
                clearInterval(heartbeat);
                try { controller.close(); } catch { /* already closed */ }
            }

            // Handle client disconnect
            req.signal.addEventListener('abort', cleanup);
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable Nginx buffering
        },
    });
}
