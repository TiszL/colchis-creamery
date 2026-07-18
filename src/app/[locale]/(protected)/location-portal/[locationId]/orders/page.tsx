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
    const caller = await assertLocationRole(locationId, ["LOCATION_MANAGER", "LOCATION_FULFILLMENT", "SERVER"]);
    const initial = await fetchLocationQueue(locationId, "active");

    // Cancel-&-refund + edit are manager-only (fulfillment staff can't move
    // money — they file cancel REQUESTS the manager approves on this same page).
    const canRefund = caller.isMasterAdmin || caller.roles.includes("LOCATION_MANAGER");
    // Waitstaff: may claim tables; if SERVER is their ONLY role they're scoped
    // to dine-in tickets (enforced server-side too, this just shapes the UI).
    const canClaim = caller.isMasterAdmin || caller.roles.includes("SERVER") || caller.roles.includes("LOCATION_MANAGER");
    const serverOnly =
        !caller.isMasterAdmin &&
        caller.roles.includes("SERVER") &&
        !caller.roles.includes("LOCATION_MANAGER") &&
        !caller.roles.includes("LOCATION_FULFILLMENT");

    return (
        <OrdersQueueClient
            locationId={locationId}
            initial={initial}
            canRefund={canRefund}
            canClaim={canClaim}
            serverOnly={serverOnly}
        />
    );
}
