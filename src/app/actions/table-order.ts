'use server';

// QR table ordering — public server action. Unauthenticated by design (a
// guest at a table), so it is rate-limited per IP and every real check
// (toggle, table validity, sellability, stock) happens in the engine.

import { createTableOrder, type TableOrderInput, type TableOrderResult } from '@/lib/table-ordering';
import { rateLimit, callerIp, rateLimitMessage } from '@/lib/rate-limit';

export async function placeTableOrder(input: TableOrderInput): Promise<TableOrderResult> {
    const ip = await callerIp();
    const rl = await rateLimit(`table-order:ip:${ip}`, 10, 600);
    if (!rl.ok) {
        return { ok: false, error: rateLimitMessage(rl) };
    }
    const email = (input.contact?.email ?? '').trim().toLowerCase();
    if (email) {
        const rlEmail = await rateLimit(`table-order:email:${email}`, 6, 600);
        if (!rlEmail.ok) return { ok: false, error: rateLimitMessage(rlEmail) };
    }
    return createTableOrder(input);
}
