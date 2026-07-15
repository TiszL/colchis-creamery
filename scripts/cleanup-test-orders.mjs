// Pre-launch data cleanup — deletes ALL orders (and their child rows) from the
// test/sandbox era so the launch database starts with clean books.
//
// Run this ONCE at cutover (runbook Phase B), BEFORE the first real order:
//
//   # dry run (default) — prints what would be deleted, touches nothing
//   node scripts/cleanup-test-orders.mjs
//
//   # actually delete
//   CONFIRM_CLEANUP=1 node scripts/cleanup-test-orders.mjs
//
//   # optionally only orders created before a date (ISO), e.g. keep launch-day orders
//   CONFIRM_CLEANUP=1 CLEANUP_BEFORE=2026-08-01 node scripts/cleanup-test-orders.mjs
//
// What it deletes: Order + OrderItem + OrderFulfillment(+Items) +
// OrderCancelRequest + Refund + Shipment + order-linked StockMovements +
// internal ProcessedStripeEvent claims. What it does NOT touch: products,
// stock levels (re-count those per the runbook), users, locations, B2B config.
// Load env: `set -a; source .env.local; set +a` first (or run on a machine
// with DATABASE_URL exported).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const confirm = process.env.CONFIRM_CLEANUP === '1';
const before = process.env.CLEANUP_BEFORE ? new Date(process.env.CLEANUP_BEFORE) : null;

async function main() {
    const where = before ? { createdAt: { lt: before } } : {};
    const orders = await prisma.order.findMany({
        where,
        select: { id: true, createdAt: true, totalAmount: true, paymentStatus: true },
        orderBy: { createdAt: 'asc' },
    });
    if (orders.length === 0) {
        console.log('No orders match — nothing to clean.');
        return;
    }
    const ids = orders.map(o => o.id);
    console.log(`Matched ${orders.length} orders (${orders[0].createdAt.toISOString().slice(0, 10)} → ${orders[orders.length - 1].createdAt.toISOString().slice(0, 10)})${before ? ` created before ${before.toISOString().slice(0, 10)}` : ''}.`);

    if (!confirm) {
        console.log('\nDRY RUN — nothing deleted. Re-run with CONFIRM_CLEANUP=1 to delete.');
        console.log('Sample:', orders.slice(0, 5).map(o => `${o.id.slice(0, 8)} $${o.totalAmount} ${o.paymentStatus}`).join(' | '));
        return;
    }

    // Children first (FKs), batched by order-id list.
    const del = async (label, fn) => {
        const r = await fn();
        console.log(`  deleted ${r.count ?? r} ${label}`);
    };
    await del('order cancel requests', () => prisma.orderCancelRequest.deleteMany({ where: { fulfillment: { orderId: { in: ids } } } }));
    await del('fulfillment items', () => prisma.orderFulfillmentItem.deleteMany({ where: { fulfillment: { orderId: { in: ids } } } }));
    await del('shipments', () => prisma.shipment.deleteMany({ where: { orderId: { in: ids } } }).catch(() => ({ count: 0 })));
    await del('fulfillments', () => prisma.orderFulfillment.deleteMany({ where: { orderId: { in: ids } } }));
    await del('refund rows', () => prisma.refund.deleteMany({ where: { orderId: { in: ids } } }));
    await del('order-linked stock movements', () => prisma.stockMovement.deleteMany({ where: { orderId: { in: ids } } }));
    await del('order items', () => prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } }));
    await del('b2b invoices', () => prisma.b2bInvoice.deleteMany({ where: { orderId: { in: ids } } }).catch(() => ({ count: 0 })));
    await del('orders', () => prisma.order.deleteMany({ where: { id: { in: ids } } }));
    // Internal idempotency/claim rows tied to those orders.
    await del('internal claims', () => prisma.processedStripeEvent.deleteMany({
        where: { OR: ids.map(id => ({ id: { contains: id } })) },
    }));

    console.log('\nDone. Remember (runbook): re-count Stock quantities per location before opening.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
