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

    return <OrdersQueueClient locationId={locationId} initial={initial} />;
}
