"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { acceptInviteAction } from "@/app/actions/b2b-members";

export default function AcceptInvitePage() {
    const [token, setToken] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, start] = useTransition();

    // Read token client-side to avoid the useSearchParams() Suspense requirement.
    useEffect(() => {
        setToken(new URLSearchParams(window.location.search).get("token") || "");
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password !== confirm) { setError("Passwords don't match."); return; }
        if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
        start(async () => {
            const fd = new FormData();
            fd.set("token", token); fd.set("name", name); fd.set("password", password);
            const r = await acceptInviteAction(fd);
            if (r.ok) window.location.assign("/b2b-portal");
            else setError(r.error);
        });
    };

    const field = "w-full bg-[#1A1A1A] border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153] p-3 rounded";

    return (
        <main className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-6 text-[#CBA153]">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <Link href="/" className="inline-block mb-8">
                        <img src="/logo.svg" alt="Colchis Food Logo" className="w-20 h-20 object-contain mx-auto" />
                    </Link>
                    <span className="text-xs tracking-[0.4em] uppercase opacity-60 mb-4 block">Partner Portal</span>
                    <h1 className="text-4xl font-serif text-white mb-2">Accept invitation</h1>
                    <p className="text-gray-400 font-light">Set your name and password to join your company&apos;s wholesale account.</p>
                </div>

                {!token ? (
                    <div className="mb-6 p-3 bg-red-900/40 text-red-200 border border-red-800 text-sm rounded">
                        Missing invitation token. Please use the link from your invitation email.
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className="mb-6 p-3 bg-red-900/40 text-red-200 border border-red-800 text-sm rounded">{error}</div>
                        )}
                        <form onSubmit={handleSubmit} className="bg-[#2C2A29] p-8 md:p-10 rounded shadow-2xl border border-gray-800 space-y-6">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Your name</label>
                                <input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Buyer" className={field} required />
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                                <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={field} required />
                            </div>
                            <div>
                                <label htmlFor="confirm" className="block text-sm font-medium text-gray-300 mb-2">Confirm password</label>
                                <input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" className={field} required />
                            </div>
                            <button type="submit" disabled={isPending}
                                className="w-full bg-[#CBA153] text-black font-bold uppercase tracking-widest text-sm py-4 rounded hover:bg-white transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                                {isPending ? "Joining…" : "Join & sign in"}
                            </button>
                        </form>
                    </>
                )}

                <div className="text-center mt-8">
                    <p className="text-sm text-gray-500">
                        Already have a login? <Link href="/b2b/login" className="text-[#CBA153] hover:text-white transition-colors">Sign in</Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
