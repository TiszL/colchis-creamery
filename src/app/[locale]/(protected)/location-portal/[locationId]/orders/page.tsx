import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { assertLocationRole } from "@/lib/location-rbac";
import { fetchLocationQueue } from "@/app/actions/location-orders";
import OrdersQueueClient from "@/components/location/OrdersQueueClient";

export const dynamic = "force-dynamic";

// Thin server shell — RBAC + initial snapshot; the realtime queue
// (polling, new-order announce, status mutations) lives in the client.
export default async function LocationOrdersPage({
    params,
}: {
    params: Promise<{ locale: string; locationId: string }>;
}) {
    const { locationId } = await params;
    await assertLocationRole(locationId, ["LOCATION_MANAGER", "LOCATION_FULFILLMENT"]);
    const initial = await fetchLocationQueue(locationId, "active");

    // Cancel-&-refund + edit are manager-only (fulfillment staff can't move
    // money — they file cancel REQUESTS the manager approves on this same page).
    const session = await getSession();
    const canRefund =
        session?.role === "MASTER_ADMIN" ||
        (session
            ? !!(await prisma.userLocation.findFirst({
                  where: { userId: session.userId, locationId, role: "LOCATION_MANAGER" },
                  select: { id: true },
              }))
            : false);

    return <OrdersQueueClient locationId={locationId} initial={initial} canRefund={canRefund} />;
}
