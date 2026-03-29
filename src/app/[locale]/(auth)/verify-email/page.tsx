"use client";

import Link from "next/link";
import { Mail, ShieldCheck, RefreshCw } from "lucide-react";
import { verifyEmailAction, resendVerificationAction } from "@/app/actions/auth";
import { useState, useTransition, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const emailParam = searchParams.get("email") || "";
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isResending, setIsResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const router = useRouter();

    // Cooldown timer
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    // Auto-focus first input on mount
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    const handleDigitChange = (index: number, value: string) => {
        // Only allow digits
        const digit = value.replace(/\D/g, "").slice(-1);
        const newDigits = [...digits];
        newDigits[index] = digit;
        setDigits(newDigits);
        setError(null);

        // Auto-advance to next input
        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits are entered
        if (digit && index === 5) {
            const code = newDigits.join("");
            if (code.length === 6) {
                handleVerify(code);
            }
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (pasted.length === 6) {
            const newDigits = pasted.split("");
            setDigits(newDigits);
            inputRefs.current[5]?.focus();
            handleVerify(pasted);
        }
    };

    const handleVerify = (code: string) => {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
            const result = await verifyEmailAction(emailParam, code);
            if (result?.error) {
                setError(result.error);
                setDigits(["", "", "", "", "", ""]);
                inputRefs.current[0]?.focus();
            } else if (result?.success) {
                setSuccess("Email verified! Redirecting...");
                setTimeout(() => {
                    router.push("/shop");
                }, 1500);
            }
        });
    };

    const handleResend = async () => {
        if (cooldown > 0 || isResending) return;
        setIsResending(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await resendVerificationAction(emailParam);
            if (result?.error) {
                setError(result.error);
            } else {
                setSuccess("New verification code sent! Check your email.");
                setCooldown(60);
                setDigits(["", "", "", "", "", ""]);
                inputRefs.current[0]?.focus();
            }
        } catch {
            setError("Failed to resend code.");
        } finally {
            setIsResending(false);
        }
    };

    return (
        <main className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded shadow-2xl border border-border-light animate-fade-in">

                <div className="text-center mb-8">
                    <Link href="/" className="inline-block mb-6">
                        <img src="/logo-optimized.png" alt="Colchis Creamery Logo" className="w-16 h-16 object-contain mx-auto rounded-full border border-gold/30" />
                    </Link>
                    <div className="w-14 h-14 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck className="w-7 h-7 text-gold" />
                    </div>
                    <h1 className="text-2xl font-serif text-charcoal mb-2">Verify Your Email</h1>
                    <p className="text-charcoal/60 text-sm leading-relaxed">
                        We sent a 6-digit code to<br />
                        <strong className="text-charcoal">{emailParam || "your email"}</strong>
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded border border-red-200">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-6 p-3 bg-green-50 text-green-700 text-sm rounded border border-green-200">
                        {success}
                    </div>
                )}

                {/* OTP Inputs */}
                <div className="flex justify-center gap-2.5 mb-6" onPaste={handlePaste}>
                    {digits.map((digit, index) => (
                        <input
                            key={index}
                            ref={el => { inputRefs.current[index] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleDigitChange(index, e.target.value)}
                            onKeyDown={e => handleKeyDown(index, e)}
                            disabled={isPending || !!success}
                            className={`w-12 h-14 text-center text-xl font-bold rounded-lg border-2 transition-all outline-none
                                ${digit ? 'border-gold bg-gold/5 text-charcoal' : 'border-border-light bg-cream/50 text-charcoal'}
                                focus:border-gold focus:ring-2 focus:ring-gold/20
                                disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                        />
                    ))}
                </div>

                {/* Verify button */}
                <button
                    onClick={() => handleVerify(digits.join(""))}
                    disabled={digits.some(d => !d) || isPending || !!success}
                    className="w-full bg-gold text-white font-bold uppercase tracking-widest text-sm py-4 rounded hover:bg-gold/90 transition shadow-lg shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isPending ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Verifying...
                        </>
                    ) : success ? (
                        <>
                            <ShieldCheck className="w-4 h-4" />
                            Verified!
                        </>
                    ) : (
                        "Verify Email"
                    )}
                </button>

                {/* Resend */}
                <div className="text-center mt-6">
                    <p className="text-charcoal/50 text-xs mb-2">Didn't receive the code?</p>
                    <button
                        onClick={handleResend}
                        disabled={cooldown > 0 || isResending}
                        className="text-gold font-semibold text-sm hover:text-charcoal transition-colors disabled:text-charcoal/30 disabled:cursor-not-allowed"
                    >
                        {cooldown > 0 ? `Resend in ${cooldown}s` : isResending ? "Sending..." : "Resend Code"}
                    </button>
                </div>

                {/* Help text */}
                <div className="mt-8 p-3 bg-cream/50 rounded-lg border border-border-light">
                    <div className="flex items-start gap-2.5">
                        <Mail className="w-4 h-4 text-charcoal/40 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-charcoal/50 leading-relaxed">
                            Check your inbox and spam folder. The code expires in 15 minutes.
                            If you continue having trouble, contact <a href="mailto:support@colchiscreamery.com" className="text-gold hover:underline">support@colchiscreamery.com</a>.
                        </p>
                    </div>
                </div>

                <p className="text-center text-sm text-charcoal/60 mt-6">
                    <Link href="/login" className="text-gold font-bold hover:text-charcoal transition-colors">← Back to login</Link>
                </p>
            </div>
        </main>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense>
            <VerifyEmailContent />
        </Suspense>
    );
}
