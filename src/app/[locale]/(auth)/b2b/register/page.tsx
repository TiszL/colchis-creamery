"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { registerB2BAction } from "@/app/actions/auth";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/routing";

export default function B2BRegisterPage() {
    const t = useTranslations("auth");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleSubmit = (formData: FormData) => {
        setError(null);
        startTransition(async () => {
            const result = await registerB2BAction(formData);
            if (result?.error) {
                setError(result.error);
            } else if (result?.success) {
                router.push("/b2b-portal");
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
                        <img src="/logo-optimized.png" alt="Colchis Creamery Logo" className="w-20 h-20 object-contain mx-auto rounded-full border border-[#CBA153]/30" />
                    </Link>
                    <span className="text-xs tracking-[0.4em] uppercase opacity-60 mb-4 block">Partner Portal</span>
                    <h1 className="text-4xl font-serif text-white mb-2">Create Account</h1>
                    <p className="text-gray-400 font-light">Enter your invite code to join the B2B supply network.</p>
                </div>

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
                            placeholder="e.g. COLCHIS-2026-XYZ"
                            className="w-full bg-[#1A1A1A] border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153] p-3 rounded uppercase font-mono tracking-widest"
                            required
                        />
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
                            placeholder="buyer@supermarket.com"
                            className="w-full bg-[#1A1A1A] border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153] p-3 rounded"
                            required
                        />
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
