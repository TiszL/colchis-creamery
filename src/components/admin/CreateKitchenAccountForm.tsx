"use client";

import { useState, useTransition, useRef } from "react";
import { AlertCircle, Check, CheckCircle, Copy, UserPlus, X } from "lucide-react";
import { createLocationStaffAction } from "@/app/actions/auth";

interface LocationOption { id: string; name: string; city: string; state: string; }

export default function CreateKitchenAccountForm({ locations }: { locations: LocationOption[] }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    const handleSubmit = (formData: FormData) => {
        setError(null);
        const typedPassword = ((formData.get("password") as string) || "").trim();
        startTransition(async () => {
            const result = await createLocationStaffAction(formData);
            if (result?.error) { setError(result.error); return; }
            if (result?.success && result.createdUser) {
                setCreated({
                    name: result.createdUser.name,
                    email: result.createdUser.email,
                    password: result.tempPassword || typedPassword,
                });
                setCopied(false);
                formRef.current?.reset();
            }
        });
    };

    const copyPassword = () => {
        if (!created) return;
        navigator.clipboard.writeText(created.password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <section className="bg-[#161616] border border-[#B96A3D]/20 p-5 space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#B96A3D]" /> Create kitchen account
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                    Use a real email address — sign-in verification (2FA) codes are delivered there.
                </p>
            </div>

            {error && (
                <div className="p-3 bg-red-950/50 text-red-300 border border-red-900/50 text-sm flex items-center gap-3">
                    <AlertCircle size={16} className="shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 p-1"><X size={14} /></button>
                </div>
            )}

            {created && (
                <div className="border border-emerald-900/30 overflow-hidden">
                    <div className="px-4 py-2.5 bg-emerald-950/30 border-b border-emerald-900/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-emerald-400" />
                            <span className="text-emerald-300 font-bold text-sm">Kitchen account created — {created.name}</span>
                        </div>
                        <button onClick={() => setCreated(null)} className="text-gray-600 hover:text-white transition-colors p-1"><X size={14} /></button>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Sign-in email</p>
                                <p className="text-white text-sm font-mono bg-[#0C0C0C] px-3 py-2 border border-[#ffffff0A] select-all break-all">{created.email}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Password</p>
                                <div className="flex items-center gap-2 bg-[#0C0C0C] px-3 py-2 border border-[#ffffff0A]">
                                    <code className="text-[#B96A3D] font-mono text-sm tracking-wider select-all flex-1 break-all">{created.password}</code>
                                    <button onClick={copyPassword}
                                        className={`transition-all p-0.5 shrink-0 ${copied ? "text-emerald-400" : "text-gray-500 hover:text-white"}`}
                                        title="Copy password">
                                        {copied ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <p className="text-gray-600 text-[11px]">⚠️ Copy now — shown once. The password cannot be retrieved later, only reset from Staff Management.</p>
                    </div>
                </div>
            )}

            <form ref={formRef} action={handleSubmit} className="flex items-end gap-2 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Name</label>
                    <input name="name" type="text" required placeholder="Full name"
                        className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Email</label>
                    <input name="email" type="email" required placeholder="them@gmail.com"
                        className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm" />
                </div>
                <div className="flex-1 min-w-[180px]">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Password</label>
                    <input name="password" type="text" placeholder="Blank = auto-generate"
                        className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm placeholder:text-gray-700" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Location</label>
                    <select name="locationId" required defaultValue=""
                        className="bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm">
                        <option value="" disabled>Pick a location…</option>
                        {locations.map(l => (
                            <option key={l.id} value={l.id}>{l.name} ({l.city}, {l.state})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Role</label>
                    <select name="locationRole" required defaultValue="LOCATION_FULFILLMENT"
                        className="bg-[#0C0C0C] border border-[#B96A3D22] text-white py-1.5 px-3 focus:outline-none focus:border-[#B96A3D] text-sm">
                        <option value="LOCATION_FULFILLMENT">Fulfillment — order queue only</option>
                        <option value="SERVER">Server — claims tables, receives tips</option>
                        <option value="LOCATION_MANAGER">Location manager — full location control</option>
                    </select>
                </div>
                <button type="submit" disabled={isPending}
                    className="flex items-center gap-1.5 bg-[#B96A3D] text-black px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider hover:bg-[#a85d35] transition-colors disabled:opacity-50">
                    <UserPlus className="w-3.5 h-3.5" /> {isPending ? "Creating…" : "Create"}
                </button>
            </form>
        </section>
    );
}
