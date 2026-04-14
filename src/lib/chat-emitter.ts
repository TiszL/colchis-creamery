/**
 * Chat Real-Time Event Bus
 *
 * Global singleton EventEmitter that bridges:
 *   POST /api/chat/messages  →  SSE /api/chat/stream
 *
 * Events:
 *   message:${sessionId}        – New message in a session
 *   sessions:update             – Session list changed (new/claimed/closed)
 *   session:${sessionId}:status – Session status changed (claimed/closed)
 *
 * Uses the same globalThis pattern as Prisma to survive HMR in dev.
 * For multi-instance scaling, swap this for Redis Pub/Sub.
 */

import { EventEmitter } from 'events';

const globalForEmitter = globalThis as typeof globalThis & {
    chatEmitter: EventEmitter;
};

export const chatEmitter =
    globalForEmitter.chatEmitter || new EventEmitter();

globalForEmitter.chatEmitter = chatEmitter;
chatEmitter.setMaxListeners(200);
