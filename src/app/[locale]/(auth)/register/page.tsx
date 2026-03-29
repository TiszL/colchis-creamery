"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Mail, Facebook, User } from "lucide-react";
import { registerB2CAction } from "@/app/actions/auth";
import { useState, useTransition, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

function RegisterContent() {
    const t = useTranslations("auth");
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    useEffect(() => {
        const errorParam = searchParams.get("error");
        if (errorParam) {
            setError(errorParam === "OAuthFailed" ? "Social registration failed. Please try again." :
                errorParam === "EmailRequired" ? "Social registration requires email access." :
                    "An authenticaton error occurred.");
        }
    }, [searchParams]);

    const handleSubmit = (formData: FormData) => {
        setError(null);
        startTransition(async () => {
            const result = await registerB2CAction(formData);
            if (result?.error) {
                setError(result.error);
            } else if (result?.success && result?.needsVerification) {
                router.push(`/verify-email?email=${encodeURIComponent(result.email || '')}`);
            } else if (result?.success) {
                router.push("/shop");
            }
        });
    };

    return (
        <main className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 relative">

            <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded shadow-2xl border border-border-light relative z-10 animate-fade-in my-8">

                <div className="text-center mb-10">
                    <Link href="/" className="inline-block mb-6">
                        <img src="/logo-optimized.png" alt="Colchis Creamery Logo" className="w-16 h-16 object-contain mx-auto rounded-full border border-gold/30" />
                    </Link>
                    <h1 className="text-3xl font-serif text-charcoal mb-2">Create Account</h1>
                    <p className="text-charcoal/60 font-light text-sm">Join to track your artisanal cheese orders.</p>
                </div>

                <div className="space-y-4">
                    <a href="/api/auth/social?provider=google" className="w-full flex items-center justify-center gap-3 border border-border-light hover:bg-gray-50 text-charcoal font-medium py-3 px-4 rounded transition">
                        <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Sign up with Google
                    </a>

                    <a href="/api/auth/social?provider=twitter" className="w-full flex items-center justify-center gap-3 border border-border-light hover:bg-gray-50 text-charcoal font-medium py-3 px-4 rounded transition">
                        {/* X Logo SVG */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        Sign up with X
                    </a>
                </div>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border-light"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-3 text-charcoal/50 font-bold tracking-widest">Or register with email</span>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded border border-red-200">
                        {error}
                    </div>
                )}

                <form className="space-y-5" action={handleSubmit}>

                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-charcoal mb-1">Full Name</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-charcoal/40">
                                <User size={18} />
                            </div>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                placeholder="John Doe"
                                className="w-full pl-10 pr-4 py-3 bg-cream/50 border border-border-light text-charcoal placeholder-charcoal/40 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold rounded"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-charcoal mb-1">Email Address</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-charcoal/40">
                                <Mail size={18} />
                            </div>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                placeholder="colchis@example.com"
                                className="w-full pl-10 pr-4 py-3 bg-cream/50 border border-border-light text-charcoal placeholder-charcoal/40 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold rounded"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-charcoal mb-1">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            placeholder="Min. 8 characters"
                            className="w-full px-4 py-3 bg-cream/50 border border-border-light text-charcoal placeholder-charcoal/40 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold rounded"
                            required
                            minLength={8}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-gold text-white font-bold uppercase tracking-widest text-sm py-4 rounded hover:bg-gold/90 transition shadow-lg shadow-gold/20 mt-4 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {isPending ? "Creating Account..." : "Create Account"}
                    </button>
                </form>

                <p className="text-center text-sm text-charcoal/60 mt-8">
                    Already have an account?{" "}
                    <Link href="/login" className="text-gold font-bold hover:text-charcoal transition-colors">Sign in</Link>
                </p>

            </div>
        </main>
    );
}

export default function B2CRegisterPage() {
    return (
        <Suspense>
            <RegisterContent />
        </Suspense>
    );
}
