// Customer-facing order-status derivation (display layer ONLY — DB enum
// semantics are unchanged: Order.orderStatus 'CONFIRMED' still means "paid").
//
// Why: at payment the webhook marks the ORDER confirmed (= paid), but the
// KITCHEN hasn't accepted anything yet — customers were shown "Confirmed"
// instantly, which is dishonest. The honest stage lives in the fulfillments:
//   OrderFulfillment.status   (kitchen: PENDING→CONFIRMED→PREPARING→READY→…)
//   OrderFulfillment.courierStatus (courier: REQUESTED→…→DELIVERED)
//
// Pure module — no prisma/server imports; safe in client components.

export type CustomerStage =
    | 'PAYMENT_PENDING'
    | 'RECEIVED'
    | 'CONFIRMED'
    | 'PREPARING'
    | 'READY'
    | 'ON_THE_WAY'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'REFUNDED';

export type TimelineStep = { key: string; label: string; state: 'done' | 'current' | 'upcoming' };

export type FulfillmentLike = {
    status: string;
    courierStatus: string | null;
    deliveryMethod: string;
};

const PICKUP_METHODS = new Set(['IN_STORE_PICKUP', 'IN_STORE_DINE_IN']);
const SHIP_METHODS = new Set(['UPS_2DAY', 'MANUAL_DISPATCH']);

const KITCHEN_RANK: Record<string, number> = {
    PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY: 3, OUT_FOR_DELIVERY: 4, DELIVERED: 5,
};
const COURIER_RANK: Record<string, number> = { OUT_FOR_DELIVERY: 4, DELIVERED: 5 };
const RANK_STAGE: CustomerStage[] = ['RECEIVED', 'CONFIRMED', 'PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED'];

/** Effective progress rank of one fulfillment (kitchen + courier merged). */
function fulfillmentRank(f: FulfillmentLike): number {
    const k = KITCHEN_RANK[f.status] ?? 0;
    const c = f.courierStatus ? (COURIER_RANK[f.courierStatus] ?? 0) : 0;
    return Math.max(k, c);
}

/** Per-fulfillment customer stage. */
export function fulfillmentStage(f: FulfillmentLike): CustomerStage {
    if (f.status === 'CANCELLED') return 'CANCELLED';
    return RANK_STAGE[fulfillmentRank(f)];
}

const STAGE_LABEL: Record<CustomerStage, string> = {
    PAYMENT_PENDING: 'Processing payment',
    RECEIVED: 'Order received',
    CONFIRMED: 'Confirmed',
    PREPARING: 'Preparing',
    READY: 'Ready',
    ON_THE_WAY: 'On the way',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
    REFUNDED: 'Refunded',
};

/** Order-level derived stage: the MOST CONSERVATIVE across active legs —
 *  honest for multi-location orders (the order "is" only as far along as its
 *  slowest leg). */
export function customerOrderStage(
    order: { orderStatus: string; paymentStatus: string },
    fulfillments: FulfillmentLike[],
): { stage: CustomerStage; label: string; description: string } {
    const mk = (stage: CustomerStage, description: string) => ({ stage, label: STAGE_LABEL[stage], description });

    if (order.orderStatus === 'CANCELLED') {
        return mk('CANCELLED', order.paymentStatus === 'REFUNDED'
            ? 'This order was cancelled and refunded in full.'
            : 'This order was cancelled.');
    }
    if (order.paymentStatus === 'REFUNDED') {
        return mk('REFUNDED', 'This order was refunded in full.');
    }
    if (order.paymentStatus !== 'PAID') {
        return mk('PAYMENT_PENDING', 'We are confirming your payment.');
    }

    const active = fulfillments.filter(f => f.status !== 'CANCELLED');
    if (fulfillments.length > 0 && active.length === 0) {
        return mk('CANCELLED', 'This order was cancelled.');
    }
    if (active.length === 0) {
        // Legacy orders predating per-fulfillment tracking: map the raw status.
        const raw = order.orderStatus;
        if (raw === 'DELIVERED') return mk('DELIVERED', 'Delivered — enjoy!');
        if (raw === 'SHIPPED') return mk('ON_THE_WAY', 'Your order is on the way.');
        if (raw === 'CONFIRMED') return mk('CONFIRMED', 'Your order is confirmed.');
        return mk('RECEIVED', 'Order received — the kitchen will confirm shortly.');
    }

    const rank = Math.min(...active.map(fulfillmentRank));
    const stage = RANK_STAGE[rank];
    const allPickup = active.every(f => PICKUP_METHODS.has(f.deliveryMethod));
    const allDineIn = active.every(f => f.deliveryMethod === 'IN_STORE_DINE_IN');
    const descriptions: Record<CustomerStage, string> = {
        PAYMENT_PENDING: 'We are confirming your payment.',
        RECEIVED: 'Order received — the kitchen will confirm shortly.',
        CONFIRMED: 'The kitchen confirmed your order.',
        PREPARING: 'Your order is being prepared right now.',
        READY: allDineIn
            ? 'Ready — we are bringing it to your table.'
            : allPickup ? 'Ready for pickup — come on by.' : 'Ready — handing off to your courier.',
        ON_THE_WAY: 'Your order is on the way.',
        DELIVERED: 'Delivered — enjoy!',
        CANCELLED: 'This order was cancelled.',
        REFUNDED: 'This order was refunded in full.',
    };
    return mk(stage, descriptions[stage]);
}

/** Method-aware progress timeline for one fulfillment (for step UIs). */
export function fulfillmentTimeline(f: FulfillmentLike): TimelineStep[] {
    if (f.status === 'CANCELLED') {
        return [{ key: 'cancelled', label: 'Cancelled', state: 'current' }];
    }
    const rank = fulfillmentRank(f);

    let steps: { key: string; label: string; atRank: number }[];
    if (f.deliveryMethod === 'IN_STORE_DINE_IN') {
        steps = [
            { key: 'received', label: 'Received', atRank: 0 },
            { key: 'confirmed', label: 'Confirmed', atRank: 1 },
            { key: 'preparing', label: 'Preparing', atRank: 2 },
            { key: 'ready', label: 'Coming to your table', atRank: 3 },
            { key: 'delivered', label: 'Served', atRank: 5 },
        ];
    } else if (PICKUP_METHODS.has(f.deliveryMethod)) {
        steps = [
            { key: 'received', label: 'Received', atRank: 0 },
            { key: 'confirmed', label: 'Confirmed', atRank: 1 },
            { key: 'preparing', label: 'Preparing', atRank: 2 },
            { key: 'ready', label: 'Ready for pickup', atRank: 3 },
            { key: 'delivered', label: 'Picked up', atRank: 5 },
        ];
    } else if (SHIP_METHODS.has(f.deliveryMethod)) {
        steps = [
            { key: 'received', label: 'Received', atRank: 0 },
            { key: 'confirmed', label: 'Confirmed', atRank: 1 },
            { key: 'shipped', label: 'Shipped', atRank: 3 }, // READY/OUT_FOR_DELIVERY both read as shipped
            { key: 'delivered', label: 'Delivered', atRank: 5 },
        ];
    } else {
        // Courier + own-delivery legs.
        steps = [
            { key: 'received', label: 'Received', atRank: 0 },
            { key: 'confirmed', label: 'Confirmed', atRank: 1 },
            { key: 'preparing', label: 'Preparing', atRank: 2 },
            { key: 'ready', label: 'Ready', atRank: 3 },
            { key: 'on_the_way', label: 'On the way', atRank: 4 },
            { key: 'delivered', label: 'Delivered', atRank: 5 },
        ];
    }

    // Highest step whose threshold is reached = current; below = done.
    let currentIdx = 0;
    for (let i = 0; i < steps.length; i++) if (rank >= steps[i].atRank) currentIdx = i;
    return steps.map((s, i) => ({
        key: s.key,
        label: s.label,
        state: i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming',
    }));
}
