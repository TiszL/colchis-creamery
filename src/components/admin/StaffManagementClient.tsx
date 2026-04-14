"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Users, Package, FileText, TrendingUp, BarChart3, Plus, Trash2, AlertCircle, CheckCircle, Copy, X, Key, Check, ShieldCheck, ShieldOff } from "lucide-react";
import { createStaffAccountAction, deleteStaffAccountAction, resetStaffPasswordAction, quickResetPasswordAction, get2FASettingAction, toggle2FAAction } from "@/app/actions/auth";

const ROLE_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string; description: string }> = {
    PRODUCT_MANAGER: { label: "Product Expert & Customer Assistance", icon: Package, color: "text-blue-400", bgColor: "bg-blue-900/20", description: "Manages inventory, orders, reviews, and customer experience" },
    CONTENT_MANAGER: { label: "Content Manager", icon: FileText, color: "text-purple-400", bgColor: "bg-purple-900/20", description: "Manages recipes, articles, and website content" },
    SALES: { label: "Sales Manager", icon: TrendingUp, color: "text-cyan-400", bgColor: "bg-cyan-900/20", description: "Manages B2B leads, contracts, and sales pipeline" },
    ANALYTICS_VIEWER: { label: "Viewer / Partner", icon: BarChart3, color: "text-orange-400", bgColor: "bg-orange-900/20", description: "Read-only analytics dashboard access" },
};

interface StaffUser {
    id: string;
    name: string | null;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
}

export default function StaffManagementClient({ initialStaff }: { initialStaff: StaffUser[] }) {
    const [isPending, startTransition] = useTransition();
    const [showCreate, setShowCreate] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState("");

    // Credential display state
    const [createdAccount, setCreatedAccount] = useState<{ name: string; loginId: string; password: string } | null>(null);
    const [passwordCopied, setPasswordCopied] = useState(false);

    // Quick reset state
    const [resetConfirm, setResetConfirm] = useState<string | null>(null);
    const [resetResult, setResetResult] = useState<{ userId: string; password: string } | null>(null);
    const [resetCopied, setResetCopied] = useState(false);

    // Delete state
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // 2FA toggle state
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [twoFALoading, setTwoFALoading] = useState(true);

    // Staff list
    const [staffList, setStaffList] = useState(initialStaff);
    const formRef = useRef<HTMLFormElement>(null);
    const isViewer = selectedRole === "ANALYTICS_VIEWER";

    // Load 2FA setting on mount
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
            if (result?.error) {
                setError(result.error);
            } else if (result?.success && result.tempPassword && result.createdUser) {
                const loginId = formData.get("loginId") as string || result.createdUser.name || "viewer";
                setCreatedAccount({
                    name: result.createdUser.name || loginId,
                    loginId: result.createdUser.email.endsWith("@viewer.local") ? "(no login required)" : result.createdUser.email.endsWith("@staff.local") ? loginId : result.createdUser.email,
                    password: result.tempPassword,
                });
                setPasswordCopied(false);
                setShowCreate(false);
                setSelectedRole("");
                setStaffList(prev => [result.createdUser as StaffUser, ...prev]);
                formRef.current?.reset();
            }
        });
    };

    const handleQuickReset = (userId: string) => {
        setError(null);
        startTransition(async () => {
            const result = await quickResetPasswordAction(userId);
            if (result?.error) {
                setError(result.error);
            } else if (result?.success && result.newPassword) {
                setResetResult({ userId, password: result.newPassword });
                setResetCopied(false);
                setResetConfirm(null);
            }
        });
    };

    const handleDelete = (userId: string) => {
        setError(null);
        startTransition(async () => {
            const result = await deleteStaffAccountAction(userId);
            if (result?.error) {
                setError(result.error);
            } else {
                setDeleteConfirm(null);
                setStaffList(prev => prev.filter(u => u.id !== userId));
                if (resetResult?.userId === userId) setResetResult(null);
            }
        });
    };

    const handleToggle2FA = () => {
        const newValue = !twoFAEnabled;
        startTransition(async () => {
            const result = await toggle2FAAction(newValue);
            if (result?.success) {
                setTwoFAEnabled(newValue);
            } else if (result?.error) {
                setError(result.error);
            }
        });
    };

    const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const staffByRole = Object.entries(ROLE_CONFIG).map(([role, config]) => ({
        role, ...config,
        members: staffList.filter(u => u.role === role),
    }));

    const displayEmail = (email: string) => {
        if (email.endsWith("@staff.local")) return email.replace("@staff.local", "");
        if (email.endsWith("@viewer.local")) return "—";
        return email;
    };

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-serif text-white mb-2">Staff Management</h1>
                    <p className="text-gray-500 font-light">Create and manage staff & visitor accounts.</p>
                </div>
                <button
                    onClick={() => { setShowCreate(!showCreate); setError(null); }}
                    className="bg-[#CBA153] text-black font-bold uppercase tracking-widest text-xs py-3 px-6 rounded-lg hover:bg-white transition-all flex items-center gap-2"
                >
                    <Plus size={16} /> Create Account
                </button>
            </div>

            {/* ── 2FA Toggle ── */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {twoFAEnabled ? (
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                    ) : (
                        <ShieldOff className="w-6 h-6 text-amber-400" />
                    )}
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
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 ${twoFAEnabled ? 'bg-emerald-500' : 'bg-gray-700'} disabled:opacity-50`}
                >
                    <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-300 ${twoFAEnabled ? 'translate-x-7' : 'translate-x-0.5'}`} />
                </button>
            </div>

            {/* ── Credential Card (persists until dismissed) ── */}
            {createdAccount && (
                <div className="bg-[#1A1A1A] rounded-xl border border-emerald-900/30 overflow-hidden animate-fade-in">
                    <div className="px-5 py-3 bg-emerald-950/30 border-b border-emerald-900/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-emerald-400" />
                            <span className="text-emerald-300 font-bold text-sm">Account Created — {createdAccount.name}</span>
                        </div>
                        <button onClick={() => setCreatedAccount(null)} className="text-gray-600 hover:text-white transition-colors p-1"><X size={16} /></button>
                    </div>
                    <div className="p-5 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Login ID</p>
                                <p className="text-white text-sm font-mono bg-[#0D0D0D] px-3 py-2 rounded-lg border border-white/5 select-all">{createdAccount.loginId}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Temporary Password</p>
                                <div className="flex items-center gap-2 bg-[#0D0D0D] px-3 py-2 rounded-lg border border-white/5">
                                    <code className="text-[#CBA153] font-mono text-sm tracking-wider select-all flex-1">{createdAccount.password}</code>
                                    <button
                                        onClick={() => copyToClipboard(createdAccount.password, setPasswordCopied)}
                                        className={`transition-all p-0.5 ${passwordCopied ? "text-emerald-400" : "text-gray-500 hover:text-white"}`}
                                    >
                                        {passwordCopied ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <p className="text-gray-600 text-[11px] flex items-center gap-1.5">
                            ⚠️ Save these credentials now. The password cannot be retrieved later — only reset.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Password Reset Result ── */}
            {resetResult && (
                <div className="bg-[#1A1A1A] rounded-xl border border-blue-900/30 overflow-hidden animate-fade-in">
                    <div className="px-5 py-3 bg-blue-950/30 border-b border-blue-900/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Key size={16} className="text-blue-400" />
                            <span className="text-blue-300 font-bold text-sm">
                                Password Reset — {staffList.find(u => u.id === resetResult.userId)?.name || "Account"}
                            </span>
                        </div>
                        <button onClick={() => setResetResult(null)} className="text-gray-600 hover:text-white transition-colors p-1"><X size={16} /></button>
                    </div>
                    <div className="p-5">
                        <div className="flex items-center gap-3 bg-[#0D0D0D] px-4 py-3 rounded-lg border border-white/5">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold shrink-0">New Password</span>
                            <code className="text-[#CBA153] font-mono text-lg tracking-wider select-all flex-1">{resetResult.password}</code>
                            <button
                                onClick={() => copyToClipboard(resetResult.password, setResetCopied)}
                                className={`transition-all p-1 ${resetCopied ? "text-emerald-400" : "text-gray-500 hover:text-white"}`}
                            >
                                {resetCopied ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                        <p className="text-gray-600 text-[11px] mt-2">⚠️ Share this password securely. It cannot be retrieved later.</p>
                    </div>
                </div>
            )}

            {/* ── Error Banner ── */}
            {error && (
                <div className="p-4 bg-red-950/50 text-red-300 border border-red-900/50 text-sm rounded-lg flex items-center gap-3 animate-fade-in">
                    <AlertCircle size={18} className="shrink-0" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-300 p-1"><X size={14} /></button>
                </div>
            )}

            {/* ── Create Account Form ── */}
            {showCreate && (
                <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#CBA153]/20 animate-fade-in">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-white font-bold">New Staff / Visitor Account</h2>
                        <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
                    </div>
                    <form ref={formRef} action={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Full Name *</label>
                                <input type="text" name="name" required placeholder="John Doe"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                                    {isViewer ? "Username or Email" : "Username or Email *"}
                                </label>
                                <input type="text" name="loginId" required={!isViewer}
                                    placeholder={isViewer ? "Optional for viewers" : "username or name@company.com"}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 transition-all placeholder:text-gray-700" />
                                <p className="text-gray-700 text-[10px] mt-1">
                                    {isViewer ? "Viewers can be created without login credentials." : "Use a username (e.g. productsmanager) or full email."}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Role *</label>
                                <select name="role" required value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 transition-all appearance-none">
                                    <option value="">Select role...</option>
                                    {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                                        <option key={role} value={role}>{config.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 pt-2 border-t border-white/5">
                            <button type="submit" disabled={isPending}
                                className="bg-[#CBA153] text-black font-bold uppercase tracking-widest text-xs py-3 px-6 rounded-lg hover:bg-white transition-all disabled:opacity-50">
                                {isPending ? "Creating..." : "Create Account"}
                            </button>
                            <span className="text-gray-600 text-xs">A temporary password will be generated and displayed after creation.</span>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Role Overview Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {staffByRole.map((group) => (
                    <div key={group.role} className="bg-[#1A1A1A] p-6 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3 mb-2">
                            <group.icon className={`w-5 h-5 ${group.color}`} />
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{group.label}</span>
                        </div>
                        <h3 className="text-3xl font-serif text-white mb-1">{group.members.length}</h3>
                        <p className="text-gray-600 text-[11px]">{group.description}</p>
                    </div>
                ))}
            </div>

            {/* ── Staff List ── */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                    <Users className="w-5 h-5 text-[#CBA153]" />
                    <h2 className="text-white font-bold">All Staff & Visitors</h2>
                    <span className="text-xs text-gray-500 ml-auto">{staffList.length} total</span>
                </div>
                <div>
                    {staffList.length > 0 ? (
                        <ul className="divide-y divide-white/5">
                            {staffList.map((user) => {
                                const roleConfig = ROLE_CONFIG[user.role] || { label: user.role, color: "text-gray-400", bgColor: "bg-gray-900/20" };
                                const emailDisplay = displayEmail(user.email);
                                return (
                                    <li key={user.id} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-[#CBA153]/10 border border-[#CBA153]/20 flex items-center justify-center">
                                                    <span className="text-[#CBA153] text-sm font-bold">{(user.name || user.email).charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <p className="text-white text-sm font-medium">{user.name || emailDisplay}</p>
                                                    <p className="text-gray-600 text-xs font-mono">{emailDisplay}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${roleConfig.color} ${roleConfig.bgColor} px-3 py-1 rounded-full`}>
                                                    {roleConfig.label}
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded ${user.isActive ? "text-emerald-400 bg-emerald-900/20" : "text-red-400 bg-red-900/20"}`}>
                                                    {user.isActive ? "Active" : "Disabled"}
                                                </span>

                                                {/* Quick Reset — 2 clicks: Reset → Confirm */}
                                                {resetConfirm === user.id ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            onClick={() => handleQuickReset(user.id)}
                                                            disabled={isPending}
                                                            className="text-[10px] bg-blue-600 text-white px-2.5 py-1 rounded font-bold hover:bg-blue-500 disabled:opacity-50"
                                                        >
                                                            {isPending ? "..." : "Confirm"}
                                                        </button>
                                                        <button
                                                            onClick={() => setResetConfirm(null)}
                                                            className="text-[10px] text-gray-500 hover:text-white px-2 py-1"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => { setResetConfirm(user.id); setDeleteConfirm(null); }}
                                                        className="text-gray-600 hover:text-[#CBA153] transition-colors p-1.5"
                                                        title="Reset password"
                                                    >
                                                        <Key size={14} />
                                                    </button>
                                                )}

                                                {/* Delete — 2 clicks */}
                                                {deleteConfirm === user.id ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            onClick={() => handleDelete(user.id)}
                                                            disabled={isPending}
                                                            className="text-[10px] bg-red-600 text-white px-2.5 py-1 rounded font-bold hover:bg-red-500 disabled:opacity-50"
                                                        >
                                                            Delete
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(null)}
                                                            className="text-[10px] text-gray-500 hover:text-white px-2 py-1"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => { setDeleteConfirm(user.id); setResetConfirm(null); }}
                                                        className="text-gray-600 hover:text-red-400 transition-colors p-1.5"
                                                        title="Delete account"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="p-8 text-center">
                            <Users className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                            <p className="text-gray-500 text-sm">No staff or visitor accounts yet.</p>
                            <p className="text-gray-600 text-xs mt-1">Click &ldquo;Create Account&rdquo; to get started.</p>
                        </div>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out forwards;
                }
            ` }} />
        </div>
    );
}
