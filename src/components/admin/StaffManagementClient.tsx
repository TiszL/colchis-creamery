"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
    Users, Package, FileText, TrendingUp, BarChart3, Plus, Trash2, AlertCircle,
    CheckCircle, Copy, X, Key, Check, ShieldCheck, ShieldOff, MapPin, Crown,
    ChevronDown, Building2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
    createStaffAccountAction, deleteStaffAccountAction, quickResetPasswordAction,
    get2FASettingAction, toggle2FAAction,
    changeUserGlobalRoleAction, assignLocationRoleAction, removeLocationRoleAction,
} from "@/app/actions/auth";

const GLOBAL_ROLE_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string; description: string }> = {
    PRODUCT_MANAGER: { label: "Product Manager", icon: Package, color: "text-blue-400", bgColor: "bg-blue-900/20", description: "Inventory, orders, reviews, customer ops" },
    CONTENT_MANAGER: { label: "Content Manager", icon: FileText, color: "text-purple-400", bgColor: "bg-purple-900/20", description: "Recipes, journal, marketing pages" },
    SALES:           { label: "Sales Manager",   icon: TrendingUp, color: "text-cyan-400", bgColor: "bg-cyan-900/20", description: "B2B leads, contracts, dispatch pipeline" },
    ANALYTICS_VIEWER:{ label: "Analytics Viewer",icon: BarChart3, color: "text-orange-400", bgColor: "bg-orange-900/20", description: "Read-only revenue + inventory dashboards" },
};

const LOCATION_ROLE_LABEL: Record<string, string> = {
    LOCATION_MANAGER:     "Manager",
    LOCATION_FULFILLMENT: "Fulfillment",
    B2B_SALES_MANAGER:    "B2B Sales",
};

const LOCATION_ROLES = ["LOCATION_MANAGER", "LOCATION_FULFILLMENT", "B2B_SALES_MANAGER"];

interface LocationRef { id: string; name: string; city: string; state: string; type?: string; }
interface LocationAssignment {
    id: string;
    role: string;
    location: { id: string; name: string; city: string; state: string };
}
interface StaffUser {
    id: string; name: string | null; email: string; role: string;
    isActive: boolean; has2FA: boolean; createdAt: string;
    locationRoles?: LocationAssignment[];
}
interface MasterAdmin {
    id: string; name: string | null; email: string; role: string;
    isActive: boolean; has2FA: boolean; createdAt: string;
}
interface B2bPartner {
    id: string; name: string | null; email: string; companyName: string | null;
    isActive: boolean; createdAt: string;
}

interface Props {
    masterAdmins: MasterAdmin[];
    globalStaff: StaffUser[];
    locationOnly: StaffUser[];
    b2bPartners: B2bPartner[];
    locations: LocationRef[];
}

export default function StaffManagementClient({
    masterAdmins, globalStaff: initialGlobal, locationOnly: initialLocOnly, b2bPartners, locations,
}: Props) {
    const [isPending, startTransition] = useTransition();
    const [showCreate, setShowCreate] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState("");

    const [createdAccount, setCreatedAccount] = useState<{ name: string; loginId: string; password: string } | null>(null);
    const [passwordCopied, setPasswordCopied] = useState(false);

    const [resetResult, setResetResult] = useState<{ userId: string; password: string; name: string } | null>(null);
    const [resetCopied, setResetCopied] = useState(false);

    const [deleteConfirm, setDeleteConfirm] = useState<StaffUser | null>(null);
    const [roleChange, setRoleChange] = useState<{ user: StaffUser; newRole: string } | null>(null);

    // Inline "add location" form state: keyed by userId so multiple rows can
    // open independently.
    const [addLocOpen, setAddLocOpen] = useState<string | null>(null);

    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [twoFALoading, setTwoFALoading] = useState(true);

    const [globalStaff, setGlobalStaff] = useState(initialGlobal);
    const [locOnly, setLocOnly] = useState(initialLocOnly);
    const formRef = useRef<HTMLFormElement>(null);
    const isViewer = selectedRole === "ANALYTICS_VIEWER";

    useEffect(() => {
        get2FASettingAction().then(result => {
            if (result?.success) setTwoFAEnabled(result.enabled || false);
            setTwoFALoading(false);
        });
    }, []);

    const handleCreate = (formData: FormData) => {
        setError(null);
        startTransition(async () => {
            const result = await createStaffAccountAction(formData);
            if (result?.error) { setError(result.error); return; }
            if (result?.success && result.tempPassword && result.createdUser) {
                const loginId = (formData.get("loginId") as string) || result.createdUser.name || "viewer";
                const display = result.createdUser.email.endsWith("@viewer.local")
                    ? "(no login required)"
                    : result.createdUser.email.endsWith("@staff.local") ? loginId : result.createdUser.email;
                setCreatedAccount({ name: result.createdUser.name || loginId, loginId: display, password: result.tempPassword });
                setPasswordCopied(false);
                setShowCreate(false);
                setSelectedRole("");
                setGlobalStaff(prev => [{ ...result.createdUser as StaffUser, has2FA: false, locationRoles: [] }, ...prev]);
                formRef.current?.reset();
            }
        });
    };

    const handleQuickReset = (user: StaffUser) => {
        setError(null);
        startTransition(async () => {
            const result = await quickResetPasswordAction(user.id);
            if (result?.error) setError(result.error);
            else if (result?.success && result.newPassword) {
                setResetResult({ userId: user.id, password: result.newPassword, name: user.name || user.email });
                setResetCopied(false);
            }
        });
    };

    const handleDelete = () => {
        if (!deleteConfirm) return;
        const userId = deleteConfirm.id;
        startTransition(async () => {
            const result = await deleteStaffAccountAction(userId);
            if (result?.error) setError(result.error);
            else {
                setGlobalStaff(prev => prev.filter(u => u.id !== userId));
                setLocOnly(prev => prev.filter(u => u.id !== userId));
                if (resetResult?.userId === userId) setResetResult(null);
            }
            setDeleteConfirm(null);
        });
    };

    const handleRoleChange = () => {
        if (!roleChange) return;
        const { user, newRole } = roleChange;
        startTransition(async () => {
            const result = await changeUserGlobalRoleAction(user.id, newRole);
            if (result?.error) setError(result.error);
            else {
                // Move user between buckets if their role group changed.
                const becameLocationOnly = newRole === "B2C_CUSTOMER";
                if (becameLocationOnly) {
                    setGlobalStaff(prev => prev.filter(u => u.id !== user.id));
                    if (user.locationRoles && user.locationRoles.length > 0) {
                        setLocOnly(prev => [{ ...user, role: newRole }, ...prev]);
                    }
                } else {
                    setLocOnly(prev => prev.filter(u => u.id !== user.id));
                    setGlobalStaff(prev => {
                        const exists = prev.find(u => u.id === user.id);
                        return exists
                            ? prev.map(u => u.id === user.id ? { ...u, role: newRole } : u)
                            : [{ ...user, role: newRole }, ...prev];
                    });
                }
            }
            setRoleChange(null);
        });
    };

    const handleToggle2FA = () => {
        const newValue = !twoFAEnabled;
        startTransition(async () => {
            const result = await toggle2FAAction(newValue);
            if (result?.success) setTwoFAEnabled(newValue);
            else if (result?.error) setError(result.error);
        });
    };

    const handleAddLocation = (userId: string, formData: FormData) => {
        formData.set("userId", userId);
        startTransition(async () => {
            const result = await assignLocationRoleAction(formData);
            if (result?.error) setError(result.error);
            else {
                // Optimistically reload: easiest path is reload, but we have
                // the data — splice it in.
                const locationId = formData.get("locationId") as string;
                const role = formData.get("role") as string;
                const loc = locations.find(l => l.id === locationId);
                if (loc) {
                    const fakeAssignment: LocationAssignment = {
                        id: `tmp-${Date.now()}`,
                        role,
                        location: { id: loc.id, name: loc.name, city: loc.city, state: loc.state },
                    };
                    const inject = (rows: StaffUser[]) => rows.map(u =>
                        u.id === userId
                            ? { ...u, locationRoles: [...(u.locationRoles || []), fakeAssignment] }
                            : u
                    );
                    setGlobalStaff(inject);
                    setLocOnly(inject);
                }
                setAddLocOpen(null);
            }
        });
    };

    const handleRemoveLocation = (userId: string, assignmentId: string) => {
        startTransition(async () => {
            const result = await removeLocationRoleAction(assignmentId);
            if (result?.error) setError(result.error);
            else {
                const filter = (rows: StaffUser[]) => rows.map(u =>
                    u.id === userId
                        ? { ...u, locationRoles: (u.locationRoles || []).filter(lr => lr.id !== assignmentId) }
                        : u
                );
                setGlobalStaff(filter);
                setLocOnly(filter);
            }
        });
    };

    const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const displayEmail = (email: string) => {
        if (email.endsWith("@staff.local")) return email.replace("@staff.local", "");
        if (email.endsWith("@viewer.local")) return "—";
        return email;
    };

    // Roll-up counts for the role tiles.
    const staffByRole = Object.entries(GLOBAL_ROLE_CONFIG).map(([role, config]) => ({
        role, ...config, count: globalStaff.filter(u => u.role === role).length,
    }));

    const totalCount = masterAdmins.length + globalStaff.length + locOnly.length + b2bPartners.length;

    return (
        <div className="space-y-8">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif text-white mb-2">Staff &amp; Access</h1>
                    <p className="text-gray-500 font-light">
                        Master admins, global staff, per-location operators and B2B partners — all in one place.
                    </p>
                </div>
                <button
                    onClick={() => { setShowCreate(!showCreate); setError(null); }}
                    className="bg-[#B96A3D] text-black font-bold uppercase tracking-widest text-xs py-3 px-6 hover:bg-white transition-all flex items-center justify-center gap-2 self-start"
                >
                    <Plus size={16} /> Create Account
                </button>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatTile icon={Crown}     label="Master admins"  value={masterAdmins.length}  tone="text-amber-400" />
                <StatTile icon={Users}     label="Global staff"   value={globalStaff.length}   tone="text-blue-400" />
                <StatTile icon={MapPin}    label="Location-only"  value={locOnly.length}       tone="text-emerald-400" />
                <StatTile icon={Building2} label="B2B partners"   value={b2bPartners.length}   tone="text-cyan-400" />
            </div>

            {/* ── 2FA org toggle ── */}
            <div className="bg-[#161616] border border-[#ffffff0A] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    {twoFAEnabled
                        ? <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                        : <ShieldOff   className="w-6 h-6 text-amber-400 shrink-0" />}
                    <div>
                        <h3 className="text-white font-bold text-sm">Staff 2FA Requirement</h3>
                        <p className="text-gray-500 text-xs">
                            {twoFAEnabled
                                ? "All staff must verify via email or authenticator app before accessing their portal."
                                : "Staff can log in with just username and password. Enable for production security."}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleToggle2FA}
                    disabled={isPending || twoFALoading}
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 self-start sm:self-auto ${twoFAEnabled ? 'bg-emerald-500' : 'bg-gray-700'} disabled:opacity-50`}
                >
                    <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-300 ${twoFAEnabled ? 'translate-x-7' : 'translate-x-0.5'}`} />
                </button>
            </div>

            {/* ── Credential card ── */}
            {createdAccount && (
                <div className="bg-[#161616] border border-emerald-900/30 overflow-hidden animate-fade-in">
                    <div className="px-5 py-3 bg-emerald-950/30 border-b border-emerald-900/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-emerald-400" />
                            <span className="text-emerald-300 font-bold text-sm">Account Created — {createdAccount.name}</span>
                        </div>
                        <button onClick={() => setCreatedAccount(null)} className="text-gray-600 hover:text-white transition-colors p-1"><X size={16} /></button>
                    </div>
                    <div className="p-5 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Login ID</p>
                                <p className="text-white text-sm font-mono bg-[#0C0C0C] px-3 py-2 border border-[#ffffff0A] select-all break-all">{createdAccount.loginId}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Temporary Password</p>
                                <div className="flex items-center gap-2 bg-[#0C0C0C] px-3 py-2 border border-[#ffffff0A]">
                                    <code className="text-[#B96A3D] font-mono text-sm tracking-wider select-all flex-1 break-all">{createdAccount.password}</code>
                                    <button onClick={() => copyToClipboard(createdAccount.password, setPasswordCopied)}
                                        className={`transition-all p-0.5 shrink-0 ${passwordCopied ? "text-emerald-400" : "text-gray-500 hover:text-white"}`}>
                                        {passwordCopied ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <p className="text-gray-600 text-[11px]">⚠️ Save these credentials now. The password cannot be retrieved later — only reset.</p>
                    </div>
                </div>
            )}

            {/* ── Password Reset Result ── */}
            {resetResult && (
                <div className="bg-[#161616] border border-blue-900/30 overflow-hidden animate-fade-in">
                    <div className="px-5 py-3 bg-blue-950/30 border-b border-blue-900/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Key size={16} className="text-blue-400" />
                            <span className="text-blue-300 font-bold text-sm">Password Reset — {resetResult.name}</span>
                        </div>
                        <button onClick={() => setResetResult(null)} className="text-gray-600 hover:text-white transition-colors p-1"><X size={16} /></button>
                    </div>
                    <div className="p-5">
                        <div className="flex items-center gap-3 bg-[#0C0C0C] px-4 py-3 border border-[#ffffff0A]">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold shrink-0">New Password</span>
                            <code className="text-[#B96A3D] font-mono text-lg tracking-wider select-all flex-1 break-all">{resetResult.password}</code>
                            <button onClick={() => copyToClipboard(resetResult.password, setResetCopied)}
                                className={`transition-all p-1 shrink-0 ${resetCopied ? "text-emerald-400" : "text-gray-500 hover:text-white"}`}>
                                {resetCopied ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                        <p className="text-gray-600 text-[11px] mt-2">⚠️ Share this password securely. It cannot be retrieved later.</p>
                    </div>
                </div>
            )}

            {/* ── Error banner ── */}
            {error && (
                <div className="p-4 bg-red-950/50 text-red-300 border border-red-900/50 text-sm flex items-center gap-3 animate-fade-in">
                    <AlertCircle size={18} className="shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 p-1"><X size={14} /></button>
                </div>
            )}

            {/* ── Create form ── */}
            {showCreate && (
                <div className="bg-[#161616] p-6 border border-[#B96A3D]/20 animate-fade-in">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-white font-bold">New Global Staff Account</h2>
                        <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
                    </div>
                    <p className="text-gray-500 text-xs mb-4">
                        For per-bakery hires that don&apos;t need <code className="text-[#B96A3D]">/portal</code> access,
                        create the user here and then assign them to a location below.
                        Alternatively, use <a href="/admin/location-staff" className="text-[#B96A3D] hover:underline">Location Staff</a> to attach a role to an existing user by email.
                    </p>
                    <form ref={formRef} action={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Full Name *</label>
                                <input type="text" name="name" required placeholder="John Doe"
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-3 px-4 focus:outline-none focus:border-[#B96A3D] focus:ring-1 focus:ring-[#B96A3D]/50 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                                    {isViewer ? "Username or Email" : "Username or Email *"}
                                </label>
                                <input type="text" name="loginId" required={!isViewer}
                                    placeholder={isViewer ? "Optional for viewers" : "username or name@company.com"}
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-3 px-4 focus:outline-none focus:border-[#B96A3D] focus:ring-1 focus:ring-[#B96A3D]/50 transition-all placeholder:text-gray-700" />
                                <p className="text-gray-700 text-[10px] mt-1">
                                    {isViewer ? "Viewers can be created without login credentials." : "Use a username (e.g. productsmanager) or full email."}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Role *</label>
                                <select name="role" required value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-3 px-4 focus:outline-none focus:border-[#B96A3D] focus:ring-1 focus:ring-[#B96A3D]/50 transition-all appearance-none">
                                    <option value="">Select role…</option>
                                    {Object.entries(GLOBAL_ROLE_CONFIG).map(([role, config]) => (
                                        <option key={role} value={role}>{config.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#ffffff0A]">
                            <button type="submit" disabled={isPending}
                                className="bg-[#B96A3D] text-black font-bold uppercase tracking-widest text-xs py-3 px-6 hover:bg-white transition-all disabled:opacity-50">
                                {isPending ? "Creating…" : "Create Account"}
                            </button>
                            <span className="text-gray-600 text-xs flex-1 min-w-[200px]">A temporary password will be generated and displayed after creation.</span>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Role tiles ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {staffByRole.map(group => (
                    <div key={group.role} className="bg-[#161616] p-5 border border-[#ffffff0A]">
                        <div className="flex items-center gap-3 mb-2">
                            <group.icon className={`w-5 h-5 ${group.color}`} />
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{group.label}</span>
                        </div>
                        <h3 className="text-3xl font-serif text-white mb-1">{group.count}</h3>
                        <p className="text-gray-600 text-[11px]">{group.description}</p>
                    </div>
                ))}
            </div>

            {/* ── Master admins ── */}
            <Section icon={Crown} title="Master administrators" count={masterAdmins.length} hint="Full org access. Managed via Security page.">
                {masterAdmins.length === 0 ? (
                    <EmptyRow message="No master administrators." />
                ) : (
                    <ul className="divide-y divide-white/5">
                        {masterAdmins.map(u => (
                            <li key={u.id} className="px-4 sm:px-6 py-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar name={u.name || u.email} tone="amber" />
                                        <div className="min-w-0">
                                            <p className="text-white text-sm font-medium truncate">{u.name || displayEmail(u.email)}</p>
                                            <p className="text-gray-600 text-xs font-mono truncate">{displayEmail(u.email)}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <RoleBadge tone="amber" label="MASTER ADMIN" />
                                        <TwoFABadge enrolled={u.has2FA} />
                                        <ActiveBadge isActive={u.isActive} />
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            {/* ── Global staff ── */}
            <Section icon={Users} title="Global staff" count={globalStaff.length} hint="Portal-wide access; can also be assigned to one or more locations.">
                {globalStaff.length === 0 ? (
                    <EmptyRow message="No global staff yet. Click Create Account above." />
                ) : (
                    <ul className="divide-y divide-white/5">
                        {globalStaff.map(u => (
                            <StaffRow
                                key={u.id} user={u} locations={locations} isPending={isPending}
                                onChangeRole={(newRole) => setRoleChange({ user: u, newRole })}
                                onReset={() => handleQuickReset(u)}
                                onDelete={() => setDeleteConfirm(u)}
                                addLocOpen={addLocOpen === u.id}
                                onToggleAddLoc={() => setAddLocOpen(addLocOpen === u.id ? null : u.id)}
                                onAddLoc={(fd) => handleAddLocation(u.id, fd)}
                                onRemoveLoc={(id) => handleRemoveLocation(u.id, id)}
                                allowRoleChange
                            />
                        ))}
                    </ul>
                )}
            </Section>

            {/* ── Location-only staff ── */}
            <Section
                icon={MapPin} title="Location-only staff" count={locOnly.length}
                hint="Bakery hires with no /portal access — their authority is scoped to assigned locations only."
            >
                {locOnly.length === 0 ? (
                    <EmptyRow message="No location-only staff. Assign existing customer accounts to a location to add them here." />
                ) : (
                    <ul className="divide-y divide-white/5">
                        {locOnly.map(u => (
                            <StaffRow
                                key={u.id} user={u} locations={locations} isPending={isPending}
                                onChangeRole={(newRole) => setRoleChange({ user: u, newRole })}
                                onReset={() => handleQuickReset(u)}
                                onDelete={() => setDeleteConfirm(u)}
                                addLocOpen={addLocOpen === u.id}
                                onToggleAddLoc={() => setAddLocOpen(addLocOpen === u.id ? null : u.id)}
                                onAddLoc={(fd) => handleAddLocation(u.id, fd)}
                                onRemoveLoc={(id) => handleRemoveLocation(u.id, id)}
                                allowRoleChange
                            />
                        ))}
                    </ul>
                )}
            </Section>

            {/* ── B2B partners (read-only) ── */}
            <Section
                icon={Building2} title="B2B partners" count={b2bPartners.length}
                hint="Wholesale accounts. Lifecycle managed in Requests + Contracts; shown here for visibility."
            >
                {b2bPartners.length === 0 ? (
                    <EmptyRow message="No B2B partners onboarded yet." />
                ) : (
                    <ul className="divide-y divide-white/5">
                        {b2bPartners.map(p => (
                            <li key={p.id} className="px-4 sm:px-6 py-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar name={p.companyName || p.name || p.email} tone="cyan" />
                                        <div className="min-w-0">
                                            <p className="text-white text-sm font-medium truncate">{p.companyName || p.name || displayEmail(p.email)}</p>
                                            <p className="text-gray-600 text-xs font-mono truncate">{displayEmail(p.email)}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <RoleBadge tone="cyan" label="B2B PARTNER" />
                                        <ActiveBadge isActive={p.isActive} />
                                        <a href="/admin/requests" className="text-[10px] font-mono uppercase tracking-wider text-[#B96A3D] hover:text-white transition-colors">
                                            Manage →
                                        </a>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <ConfirmDialog
                open={!!deleteConfirm}
                variant="dark"
                tone="danger"
                title={deleteConfirm ? `Delete ${deleteConfirm.name || deleteConfirm.email}?` : ""}
                body={deleteConfirm ? <>This permanently removes the account and revokes all access. Their orders and reviews stay attached to the deleted record.</> : null}
                confirmLabel="Delete account"
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirm(null)}
                busy={isPending}
            />

            <ConfirmDialog
                open={!!roleChange}
                variant="dark"
                tone="normal"
                title={roleChange ? `Change ${roleChange.user.name || roleChange.user.email}'s role?` : ""}
                body={roleChange ? (
                    <>From <strong>{GLOBAL_ROLE_CONFIG[roleChange.user.role]?.label || roleChange.user.role}</strong> to <strong>{GLOBAL_ROLE_CONFIG[roleChange.newRole]?.label || roleChange.newRole}</strong>.
                    {roleChange.newRole === "B2C_CUSTOMER" && " They lose all global portal access; per-location assignments stay."}
                    </>
                ) : null}
                confirmLabel="Change role"
                onConfirm={handleRoleChange}
                onCancel={() => setRoleChange(null)}
                busy={isPending}
            />

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
            `}} />
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ icon: Icon, title, count, hint, children }: {
    icon: any; title: string; count: number; hint: string; children: React.ReactNode;
}) {
    return (
        <section className="bg-[#161616] border border-[#ffffff0A] overflow-hidden">
            <header className="px-4 sm:px-6 py-4 border-b border-[#ffffff0A] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <Icon className="w-5 h-5 text-[#B96A3D]" />
                <h2 className="text-white font-bold">{title}</h2>
                <span className="text-xs text-gray-500">· {count}</span>
                <span className="text-[10px] text-gray-600 sm:ml-auto sm:text-right max-w-xl">{hint}</span>
            </header>
            {children}
        </section>
    );
}

function StatTile({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string; }) {
    return (
        <div className="bg-[#161616] border border-[#ffffff0A] p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
                <Icon className={`w-4 h-4 ${tone}`} />
            </div>
            <p className={`text-2xl font-light text-white`}>{value}</p>
        </div>
    );
}

function Avatar({ name, tone }: { name: string; tone: "amber" | "copper" | "cyan" | "blue"; }) {
    const palette: Record<string, string> = {
        amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
        copper:"bg-[#B96A3D]/10 border-[#B96A3D]/20 text-[#B96A3D]",
        cyan:  "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
        blue:  "bg-blue-500/10 border-blue-500/20 text-blue-400",
    };
    const initial = (name || "?").charAt(0).toUpperCase();
    return (
        <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${palette[tone]}`}>
            <span className="text-sm font-bold">{initial}</span>
        </div>
    );
}

function RoleBadge({ tone, label }: { tone: "amber" | "copper" | "cyan" | "blue"; label: string; }) {
    const palette: Record<string, string> = {
        amber: "text-amber-400 bg-amber-900/20",
        copper:"text-[#B96A3D] bg-[#B96A3D]/10",
        cyan:  "text-cyan-400 bg-cyan-900/20",
        blue:  "text-blue-400 bg-blue-900/20",
    };
    return <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${palette[tone]}`}>{label}</span>;
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
    return (
        <span className={`text-[10px] font-bold px-2 py-1 rounded ${isActive ? "text-emerald-400 bg-emerald-900/20" : "text-red-400 bg-red-900/20"}`}>
            {isActive ? "Active" : "Disabled"}
        </span>
    );
}

function TwoFABadge({ enrolled }: { enrolled: boolean }) {
    return enrolled ? (
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-emerald-900/20 text-emerald-400 inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> 2FA
        </span>
    ) : (
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-gray-700/30 text-gray-500 inline-flex items-center gap-1" title="No TOTP enrolled">
            <ShieldOff className="w-3 h-3" /> No 2FA
        </span>
    );
}

function EmptyRow({ message }: { message: string }) {
    return <div className="px-6 py-8 text-center text-gray-600 text-sm">{message}</div>;
}

function StaffRow({
    user, locations, isPending, onChangeRole, onReset, onDelete,
    addLocOpen, onToggleAddLoc, onAddLoc, onRemoveLoc, allowRoleChange,
}: {
    user: StaffUser;
    locations: LocationRef[];
    isPending: boolean;
    onChangeRole: (role: string) => void;
    onReset: () => void;
    onDelete: () => void;
    addLocOpen: boolean;
    onToggleAddLoc: () => void;
    onAddLoc: (fd: FormData) => void;
    onRemoveLoc: (id: string) => void;
    allowRoleChange: boolean;
}) {
    const cfg = GLOBAL_ROLE_CONFIG[user.role];
    const displayName = user.name || user.email.replace(/@(staff|viewer)\.local$/, "");
    const displayEmail = user.email.endsWith("@viewer.local")
        ? "viewer · no login"
        : user.email.endsWith("@staff.local")
            ? user.email.replace("@staff.local", "")
            : user.email;

    return (
        <li className="px-4 sm:px-6 py-4">
            <div className="flex flex-col gap-3">
                {/* Top row: identity + status + actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar name={displayName} tone="copper" />
                        <div className="min-w-0 flex-1">
                            <p className="text-white text-sm font-medium truncate">{displayName}</p>
                            <p className="text-gray-600 text-xs font-mono truncate">{displayEmail}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {cfg
                            ? <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${cfg.color} ${cfg.bgColor}`}>{cfg.label}</span>
                            : <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full text-gray-400 bg-gray-700/30">{user.role.replace(/_/g, " ")}</span>}
                        <TwoFABadge enrolled={user.has2FA} />
                        <ActiveBadge isActive={user.isActive} />
                        {allowRoleChange && (
                            <RoleChangeMenu
                                currentRole={user.role}
                                onChange={onChangeRole}
                                disabled={isPending}
                            />
                        )}
                        <button onClick={onReset} disabled={isPending}
                            className="text-gray-600 hover:text-[#B96A3D] transition-colors p-1.5 disabled:opacity-30"
                            title="Reset password">
                            <Key size={14} />
                        </button>
                        <button onClick={onDelete} disabled={isPending}
                            className="text-gray-600 hover:text-red-400 transition-colors p-1.5 disabled:opacity-30"
                            title="Delete account">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Location assignments */}
                <div className="flex flex-wrap items-center gap-1.5 sm:pl-13">
                    {(user.locationRoles || []).map(lr => (
                        <span key={lr.id} className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider bg-[#B96A3D]/10 text-[#B96A3D] px-2 py-0.5 rounded">
                            <MapPin className="w-2.5 h-2.5" />
                            {lr.location.name} · {LOCATION_ROLE_LABEL[lr.role] || lr.role}
                            <button onClick={() => onRemoveLoc(lr.id)} disabled={isPending}
                                className="ml-1 text-[#B96A3D]/60 hover:text-red-400 transition-colors"
                                title="Remove assignment">
                                <X className="w-2.5 h-2.5" />
                            </button>
                        </span>
                    ))}
                    <button onClick={onToggleAddLoc} disabled={isPending}
                        className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-gray-500 hover:text-[#B96A3D] px-2 py-0.5 border border-dashed border-gray-700 hover:border-[#B96A3D] rounded transition-colors">
                        <Plus className="w-2.5 h-2.5" /> Location
                    </button>
                </div>

                {/* Inline add-location form */}
                {addLocOpen && (
                    <form action={onAddLoc} className="flex flex-wrap items-end gap-2 pt-2 border-t border-[#ffffff0A]">
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Location</label>
                            <select name="locationId" required
                                className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm">
                                <option value="">Pick a location…</option>
                                {locations.map(l => (
                                    <option key={l.id} value={l.id}>{l.name} ({l.city}, {l.state})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Role</label>
                            <select name="role" required defaultValue="LOCATION_FULFILLMENT"
                                className="bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm">
                                {LOCATION_ROLES.map(r => (
                                    <option key={r} value={r}>{LOCATION_ROLE_LABEL[r] || r}</option>
                                ))}
                            </select>
                        </div>
                        <button type="submit" disabled={isPending}
                            className="bg-[#B96A3D] text-black px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider hover:bg-[#a85d35] transition-colors disabled:opacity-50">
                            Assign
                        </button>
                        <button type="button" onClick={onToggleAddLoc}
                            className="text-[10px] text-gray-500 hover:text-white px-2">
                            Cancel
                        </button>
                    </form>
                )}
            </div>
        </li>
    );
}

function RoleChangeMenu({ currentRole, onChange, disabled }: {
    currentRole: string;
    onChange: (newRole: string) => void;
    disabled: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const options = [
        ...Object.entries(GLOBAL_ROLE_CONFIG).map(([role, c]) => ({ value: role, label: c.label })),
        { value: "B2C_CUSTOMER", label: "Demote to customer" },
    ].filter(o => o.value !== currentRole);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                disabled={disabled}
                className="text-gray-600 hover:text-[#B96A3D] transition-colors p-1.5 disabled:opacity-30"
                title="Change role"
            >
                <ChevronDown size={14} />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 bg-[#0F0F0F] border border-[#B96A3D22] rounded shadow-xl z-10 w-48 py-1">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-[#B96A3D]/10 hover:text-white transition-colors"
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
