"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { registerB2BAction } from "@/app/actions/auth";
import { Suspense, useEffect, useState, useTransition } from "react";

/**
 * B2B partner registration. Two entry paths:
 *
 * 1. Magic link from the approval email: `/b2b/register?code=X&email=Y` —
 *    code + email are pre-filled. Partner fills password + company, submits.
 *
 * 2. Manual: partner pastes the code from the email body. Same form, no URL.
 *
 * If the partner edits the email and submits with one that doesn't match
 * the code's locked address (e.g. the original employee got the invite but
 * the owner is signing up), the server stages an email-change request and
 * the original invitee gets a confirmation email. The form then shows a
 * "Pending approval" state — the partner can refresh after the original
 * confirms, and registration proceeds.
 */
function B2BRegisterInner() {
    const searchParams = useSearchParams();
    const initialCode = searchParams.get("code") || "";
    const initialEmail = searchParams.get("email") || "";

    const [error, setError] = useState<string | null>(null);
    const [pendingApproval, setPendingApproval] = useState<{ originalEmail: string } | null>(null);
    const [isPending, startTransition] = useTransition();
    const [code, setCode] = useState(initialCode);
    const [email, setEmail] = useState(initialEmail);

    // Keep state in sync if the search params change (e.g. user clicks
    // a second magic link in the same tab).
    useEffect(() => {
        if (initialCode) setCode(initialCode);
        if (initialEmail) setEmail(initialEmail);
    }, [initialCode, initialEmail]);

    const handleSubmit = (formData: FormData) => {
        setError(null);
        setPendingApproval(null);
        startTransition(async () => {
            const result = await registerB2BAction(formData);
            if (!result) return;
            if ("pendingApproval" in result && result.pendingApproval) {
                setPendingApproval({ originalEmail: result.originalEmail });
            } else if ("error" in result && result.error) {
                setError(result.error);
            } else if ("success" in result && result.success) {
                // Phase 11 — full reload to make sure the freshly-set auth
                // cookie is picked up. next-intl's router push has been
                // racey here in the past, causing post-register crashes.
                window.location.assign("/b2b-portal");
            }
        });
    };

    return (
        <main className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-6 relative overflow-hidden text-[#CBA153]">

            {/* Decorative background flair */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#CBA153]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#CBA153]/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10 my-8">
                <div className="text-center mb-10">
                    <Link href="/" className="inline-block mb-8">
                        <img src="/logo.svg" alt="Colchis Food Logo" className="w-20 h-20 object-contain mx-auto" />
                    </Link>
                    <span className="text-xs tracking-[0.4em] uppercase opacity-60 mb-4 block">Partner Portal</span>
                    <h1 className="text-4xl font-serif text-white mb-2">Create Account</h1>
                    <p className="text-gray-400 font-light">
                        {initialCode
                            ? "Confirm your details to activate your B2B partner account."
                            : "Enter your invite code to join the B2B supply network."}
                    </p>
                </div>

                {pendingApproval && (
                    <div className="mb-6 p-5 bg-amber-900/30 text-amber-100 border border-amber-700 text-sm rounded space-y-2">
                        <p className="font-bold">Confirmation required</p>
                        <p>
                            We've emailed <span className="font-mono">{pendingApproval.originalEmail}</span> — the address
                            this invite was originally sent to — asking them to approve registering with{" "}
                            <span className="font-mono">{email}</span>.
                        </p>
                        <p className="text-xs text-amber-200/80">
                            Once they approve, refresh this page and your registration will go through.
                            No password is stored until the change is confirmed.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-3 bg-red-900/40 text-red-200 border border-red-800 text-sm rounded">
                        {error}
                    </div>
                )}

                <form className="bg-[#2C2A29] p-8 md:p-10 rounded shadow-2xl border border-gray-800 space-y-5" action={handleSubmit}>

                    <div>
                        <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-2">Access Code (from Admin)</label>
                        <input
                            type="text"
                            id="code"
                            name="code"
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            placeholder="e.g. COLCHIS-2026-XYZ"
                            className="w-full bg-[#1A1A1A] border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153] p-3 rounded uppercase font-mono tracking-widest"
                            required
                            readOnly={!!initialCode}
                        />
                        {initialCode && (
                            <p className="text-[10px] text-gray-500 mt-1.5">Pre-filled from your invite link.</p>
                        )}
                    </div>

                    <div className="pt-4 border-t border-gray-800">
                        <div>
                            <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-2 mt-4">Company Name</label>
                            <input
                                type="text"
                                id="company"
                                name="company"
                                placeholder="e.g. Kroger Co."
                                className="w-full bg-[#1A1A1A] border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153] p-3 rounded"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Work Email</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="buyer@supermarket.com"
                            className="w-full bg-[#1A1A1A] border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153] p-3 rounded"
                            required
                        />
                        {initialEmail && (
                            <p className="text-[10px] text-gray-500 mt-1.5">
                                Pre-filled — change to register under a different address and we&apos;ll email the
                                original invitee to confirm.
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            placeholder="••••••••"
                            className="w-full bg-[#1A1A1A] border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153] p-3 rounded"
                            required
                            minLength={8}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-[#CBA153] text-black font-bold uppercase tracking-widest text-sm py-4 rounded hover:bg-white transition-all mt-6 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isPending ? "Registering..." : "Register Account"}
                    </button>
                </form>

                <div className="text-center mt-8 space-y-4">
                    <p className="text-sm text-gray-500">
                        Already have an account? <br />
                        <Link href="/b2b/login" className="text-[#CBA153] hover:text-white transition-colors">Sign In</Link>
                    </p>
                    <div className="flex justify-center mt-6">
                        <span className="text-xs text-gray-600 uppercase tracking-widest">&copy; {new Date().getFullYear()} Colchis B2B</span>
                    </div>
                </div>

            </div>
        </main>
    );
}

export default function B2BRegisterPage() {
    // useSearchParams needs to be inside a Suspense boundary in the Next.js
    // app router because params can be unknown during the first render pass.
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#1A1A1A]" />}>
            <B2BRegisterInner />
        </Suspense>
    );
}
