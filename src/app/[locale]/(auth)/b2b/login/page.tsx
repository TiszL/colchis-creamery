"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { loginAction } from "@/app/actions/auth";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/routing";

export default function B2BLoginPage() {
    const t = useTranslations("auth");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleSubmit = (formData: FormData) => {
        setError(null);
        startTransition(async () => {
            const result = await loginAction(formData);
            if (result?.error) {
                setError(result.error);
            } else if (result?.success) {
                if (result.role === "B2B_PARTNER" || result.role === "ADMIN") {
                    router.push("/b2b-portal");
                } else {
                    setError("Standard retail accounts cannot access the B2B portal.");
                }
            }
        });
    };

    return (
        <main className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-6 relative overflow-hidden text-[#CBA153]">

            {/* Decorative background flair */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#CBA153]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#CBA153]/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <Link href="/" className="inline-block mb-8">
                        <img src="/logo-optimized.png" alt="Colchis Creamery Logo" className="w-20 h-20 object-contain mx-auto rounded-full border border-[#CBA153]/30" />
                    </Link>
                    <span className="text-xs tracking-[0.4em] uppercase opacity-60 mb-4 block">Partner Portal</span>
                    <h1 className="text-4xl font-serif text-white mb-2">Sign In</h1>
                    <p className="text-gray-400 font-light">Enter your credentials to manage your supply chain.</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-900/40 text-red-200 border border-red-800 text-sm rounded">
                        {error}
                    </div>
                )}

                <form className="bg-[#2C2A29] p-8 md:p-10 rounded shadow-2xl border border-gray-800 space-y-6" action={handleSubmit}>

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
                        />
                    </div>

                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center">
                            <input type="checkbox" id="remember" className="bg-[#1A1A1A] border-gray-700 text-[#CBA153] focus:ring-[#CBA153] rounded mr-2" />
                            <label htmlFor="remember" className="text-sm text-gray-400">Remember me</label>
                        </div>
                        <a href="#" className="text-sm text-[#CBA153] hover:text-white transition-colors">Forgot Password?</a>
                    </div>

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-[#CBA153] text-black font-bold uppercase tracking-widest text-sm py-4 rounded hover:bg-white transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {isPending ? "Authenticating..." : "Access Portal"}
                    </button>
                </form>

                <div className="text-center mt-8 space-y-4">
                    <p className="text-sm text-gray-500">
                        Interested in becoming a wholesale partner? <br />
                        <Link href="/wholesale" className="text-[#CBA153] hover:text-white transition-colors">Apply here</Link>
                    </p>
                    <div className="flex justify-center mt-6">
                        <span className="text-xs text-gray-600 uppercase tracking-widest">&copy; {new Date().getFullYear()} Colchis B2B</span>
                    </div>
                </div>

            </div>
        </main>
    );
}
