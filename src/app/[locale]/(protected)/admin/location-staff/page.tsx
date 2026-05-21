import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { LocationRole } from "@prisma/client";
import { Trash2, UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";

const LOCATION_ROLES = Object.values(LocationRole);

async function assignUserToLocationAction(formData: FormData) {
    "use server";
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") throw new Error("Forbidden");

    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const locationId = formData.get("locationId") as string;
    const role = formData.get("role") as LocationRole;
    if (!email || !locationId || !role) throw new Error("Missing fields");

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new Error(`No user found with email ${email}`);

    // Idempotent: unique(userId, locationId, role) — duplicate adds no-op via upsert.
    await prisma.userLocation.upsert({
        where: { userId_locationId_role: { userId: user.id, locationId, role } },
        update: {},
        create: { userId: user.id, locationId, role },
    });

    revalidatePath("/[locale]/admin/location-staff", "page");
}

async function unassignUserFromLocationAction(formData: FormData) {
    "use server";
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") throw new Error("Forbidden");

    const id = formData.get("id") as string;
    if (!id) return;
    await prisma.userLocation.delete({ where: { id } });
    revalidatePath("/[locale]/admin/location-staff", "page");
}

export default async function LocationStaffAdminPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== "MASTER_ADMIN") redirect(`/${locale}/portal-login`);

    const locations = await prisma.location.findMany({
        where: { isActive: true },
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        include: {
            userRoles: {
                include: { user: { select: { id: true, email: true, name: true, role: true, isActive: true } } },
                orderBy: { createdAt: "asc" },
            },
        },
    });

    return (
        <div className="space-y-8 max-w-5xl">
            <header>
                <h1 className="text-2xl font-serif text-white mb-1">Location staff</h1>
                <p className="text-sm text-gray-500">
                    Assign users to a location with a per-location role. Master admins always have access without an assignment.
                    Existing global staff role (e.g. SALES) is unchanged; this layers location-scoped permissions on top.
                </p>
            </header>

            {locations.map(loc => (
                <section key={loc.id} className="bg-[#161616] border border-[#ffffff0A] p-5">
                    <header className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-white">{loc.name}</h2>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                                {loc.type.replace(/_/g, " ")} · {loc.city}, {loc.state}
                            </p>
                        </div>
                        <span className="text-[10px] font-mono text-gray-600">
                            {loc.userRoles.length} assignment{loc.userRoles.length === 1 ? "" : "s"}
                        </span>
                    </header>

                    {loc.userRoles.length === 0 && (
                        <p className="text-xs text-gray-500 italic mb-4">No staff assigned yet. Use the form below to add the first one.</p>
                    )}

                    {loc.userRoles.length > 0 && (
                        <div className="border border-[#ffffff0A] divide-y divide-[#ffffff0A] mb-4">
                            {loc.userRoles.map(ul => (
                                <div key={ul.id} className="flex items-center justify-between px-3 py-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="min-w-0">
                                            <p className="text-sm text-white truncate">{ul.user.name ?? ul.user.email}</p>
                                            {ul.user.name && <p className="text-[10px] text-gray-500 truncate">{ul.user.email}</p>}
                                        </div>
                                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#B96A3D] bg-[#B96A3D]/10 px-2 py-0.5">
                                            {ul.role.replace(/_/g, " ")}
                                        </span>
                                        <span className="text-[10px] font-mono text-gray-600">global: {ul.user.role}</span>
                                        {!ul.user.isActive && (
                                            <span className="text-[10px] font-mono text-amber-400">INACTIVE</span>
                                        )}
                                    </div>
                                    <form action={unassignUserFromLocationAction}>
                                        <input type="hidden" name="id" value={ul.id} />
                                        <button
                                            type="submit"
                                            className="text-gray-500 hover:text-red-400 transition-colors"
                                            title="Remove this assignment"
                                            aria-label="Remove assignment"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </form>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add-assignment form */}
                    <form action={assignUserToLocationAction} className="flex items-end gap-2 flex-wrap">
                        <input type="hidden" name="locationId" value={loc.id} />
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">User email</label>
                            <input
                                name="email"
                                type="email"
                                required
                                placeholder="staff@colchisfood.com"
                                className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Role</label>
                            <select
                                name="role"
                                required
                                defaultValue="LOCATION_FULFILLMENT"
                                className="bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm"
                            >
                                {LOCATION_ROLES.map(r => (
                                    <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="submit"
                            className="flex items-center gap-1.5 bg-[#B96A3D] text-black px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider hover:bg-[#a85d35] transition-colors"
                        >
                            <UserPlus className="w-3.5 h-3.5" /> Assign
                        </button>
                    </form>
                </section>
            ))}
        </div>
    );
}
