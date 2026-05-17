// Phase 7b.5+ — Order policy constants.
//
// Lives outside src/app/actions/* because 'use server' files can only export
// async functions (Next.js rule). Anything that's shared between a server
// action and a server-page render path goes here.

/** Window during which a customer can self-cancel a PAID order for a full refund.
 *
 *  Set tight (3 min) because the carrier dispatch happens immediately after
 *  payment succeeds — bakery delivery is 25-45 min total. After 3 min the driver
 *  is likely already en route to pick up; we can't cleanly cancel without
 *  charging the dispatch fee + wasting prep work. Later cancellations require
 *  admin intervention. (UPS Ground would need a wider window when added.) */
export const CANCEL_WINDOW_MS = 3 * 60 * 1000;

/** Fulfillment statuses past which a customer can't self-cancel — admin help only. */
export const PAST_CONFIRMED_FULFILLMENT_STATUSES: ReadonlySet<string> = new Set([
    'PREPARING',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
]);
